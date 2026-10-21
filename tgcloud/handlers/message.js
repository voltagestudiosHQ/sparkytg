import { db, api, BotApiError } from 'sdk'
import { eq, and, desc, sql } from 'sdk/db'
import { chat, countMessageTokens, countTokens } from '../lib/openrouter.js'
import { users, conversations, messages, settings } from '../schema.js'

const DEFAULT_MODEL = 'openai/gpt-4o-mini'
const DEFAULT_TEMPERATURE = 70
const DEFAULT_MAX_TOKENS = 4096

/**
 * Message handler - processes all Telegram messages
 */
export default async function handleMessage(message, ctx) {
  const { chat: tgChat, from: tgUser, text } = message
  const chatId = tgChat.id
  const userId = tgUser.id

  // Ignore non-text messages
  if (!text) {
    return
  }

  try {
    // Get or create user
    let user = await db.select().from(users).where(eq(users.tgId, userId)).get()

    if (!user) {
      user = await db
        .insert(users)
        .values({
          tgId: userId,
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          lang: tgUser.language_code || 'en',
        })
        .returning()
        .run()
      user = user[0]
    }

    // Get or create user settings
    let userSettings = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, user.id))
      .get()

    if (!userSettings) {
      userSettings = await db
        .insert(settings)
        .values({
          userId: user.id,
          defaultModel: DEFAULT_MODEL,
          temperature: DEFAULT_TEMPERATURE,
          maxTokens: DEFAULT_MAX_TOKENS,
        })
        .returning()
        .run()
      userSettings = userSettings[0]
    }

    // Handle commands
    if (text.startsWith('/')) {
      await handleCommand(text, chatId, user, userSettings)
      return
    }

    // Get or create active conversation
    let conversation = userSettings.activeConversationId
      ? await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, userSettings.activeConversationId))
          .get()
      : null

    if (!conversation) {
      conversation = await db
        .insert(conversations)
        .values({
          userId: user.id,
          model: userSettings.defaultModel || DEFAULT_MODEL,
          title: text.substring(0, 100),
        })
        .returning()
        .run()
      conversation = conversation[0]

      await db
        .update(settings)
        .set({ activeConversationId: conversation.id })
        .where(eq(settings.userId, user.id))
        .run()
    }

    // Store user message
    await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        role: 'user',
        content: text,
        tokens: countTokens(text),
      })
      .run()

    // Get conversation history (last 20 messages for context)
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(20)
      .all()

    history.reverse()

    // Prepare messages for OpenRouter
    const apiMessages = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Trim history if too long
    const tokenCount = countMessageTokens(apiMessages)
    const maxTokens = userSettings.maxTokens || DEFAULT_MAX_TOKENS

    if (tokenCount > maxTokens - 500) {
      const messagesToRemove = Math.max(
        0,
        Math.ceil((tokenCount - (maxTokens - 500)) / 100)
      )
      apiMessages.splice(0, messagesToRemove)
    }

    // Show typing indicator
    await api.sendChatAction({ chat_id: chatId, action: 'typing' })

    // Call OpenRouter
    const response = await chat({
      model: conversation.model,
      messages: apiMessages,
      temperature: (userSettings.temperature || DEFAULT_TEMPERATURE) / 100,
      max_tokens: maxTokens,
      headers: {
        referer: `https://t.me/${tgUser.username || 'share'}`,
        title: `Telegram Bot - ${user.firstName}`,
      },
    })

    const assistantMessage = response.choices?.[0]?.message?.content || ''

    if (!assistantMessage) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'Sorry, I did not receive a valid response from the AI.',
      })
      return
    }

    // Store assistant message
    await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantMessage,
        tokens: countTokens(assistantMessage),
      })
      .run()

    // Update conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: sql`(unixepoch())` })
      .where(eq(conversations.id, conversation.id))
      .run()

    // Format response
    let responseText = assistantMessage

    if (userSettings.showStats) {
      const assistantTokens = countTokens(assistantMessage)
      const totalTokens = tokenCount + assistantTokens
      responseText += `\n\n---\n*Tokens: ${totalTokens}*`
    }

    await api.sendMessage({
      chat_id: chatId,
      text: responseText,
      parse_mode: 'Markdown',
      reply_to_message_id: message.message_id,
    })

  } catch (error) {
    console.error('Message handler error:', error)

    let errorMessage = 'Sorry, an error occurred.'

    if (error instanceof BotApiError) {
      if (error.code === 429) {
        errorMessage = 'Rate limit exceeded. Please wait and try again.'
      } else if (error.code === 400 || error.code === 403) {
        errorMessage = 'Invalid request. Please check your input.'
      }
    } else if (error?.message?.includes('OPENROUTER_KEY not configured')) {
      errorMessage = 'Bot not configured. Please set OPENROUTER_KEY in tgcloud/lib/secrets.js'
    } else if (error?.message?.includes('OpenRouter API error')) {
      errorMessage = `AI Error: ${error.message}`
    } else if (error?.message) {
      errorMessage = `Error: ${error.message}`
    }

    await api.sendMessage({ chat_id: chatId, text: errorMessage })
  }
}

// ============================================
// Command Handler
// ============================================

async function handleCommand(text, chatId, user, settings) {
  const parts = text.split(' ')
  const command = parts[0].toLowerCase()
  const args = parts.slice(1)

  switch (command) {
    case '/start':
      await api.sendMessage({
        chat_id: chatId,
        text: `Hello, ${user.firstName}!\n\nI am an AI assistant. Send me a message to start chatting!\n\nUse /help for commands.`,
      })
      break

    case '/help':
      await api.sendMessage({
        chat_id: chatId,
        text: `Available commands:\n\n` +
          `/start - Welcome message\n` +
          `/new - New conversation\n` +
          `/clear - Clear conversation\n` +
          `/model <name> - Switch AI model\n` +
          `/models - List models\n` +
          `/temp <0-100> - Set temperature\n` +
          `/maxtokens <n> - Set max tokens\n` +
          `/stats - Toggle stats\n` +
          `/settings - Show settings\n` +
          `/help - This help`,
        parse_mode: 'Markdown',
      })
      break

    case '/new':
      await db
        .update(settings)
        .set({ activeConversationId: null })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: 'New conversation started. Your next message will begin a fresh chat.',
      })
      break

    case '/clear':
      if (settings.activeConversationId) {
        await db
          .delete(messages)
          .where(eq(messages.conversationId, settings.activeConversationId))
          .run()
        await db
          .delete(conversations)
          .where(eq(conversations.id, settings.activeConversationId))
          .run()
        await db
          .update(settings)
          .set({ activeConversationId: null })
          .where(eq(settings.userId, user.id))
          .run()
        await api.sendMessage({
          chat_id: chatId,
          text: 'Conversation cleared.',
        })
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: 'No active conversation to clear.',
        })
      }
      break

    case '/settings':
      await api.sendMessage({
        chat_id: chatId,
        text: `Settings:\n\n` +
          `Model: ${settings.defaultModel || DEFAULT_MODEL}\n` +
          `Temperature: ${settings.temperature || DEFAULT_TEMPERATURE}/100\n` +
          `Max tokens: ${settings.maxTokens || DEFAULT_MAX_TOKENS}\n` +
          `Show stats: ${settings.showStats ? 'Yes' : 'No'}`,
      })
      break

    case '/model':
      if (args.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Current: ${settings.defaultModel || DEFAULT_MODEL}\nUse: /model <name>`,
        })
        return
      }
      await db
        .update(settings)
        .set({ defaultModel: args[0] })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: `Model set to: ${args[0]}`,
      })
      break

    case '/models':
      try {
        const { listModels } = await import('../lib/openrouter.js')
        const models = await listModels()
        const modelList = models.slice(0, 15).map((m) => `• ${m.id}`).join('\n')
        await api.sendMessage({
          chat_id: chatId,
          text: `Available models:\n\n${modelList}\n\nUse: /model <name>`,
          parse_mode: 'Markdown',
        })
      } catch (e) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Could not fetch models. Check your API key.',
        })
      }
      break

    case '/temp':
      if (args.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Current: ${settings.temperature || DEFAULT_TEMPERATURE}/100\nUse: /temp <0-100>`,
        })
        return
      }
      const temp = parseInt(args[0])
      if (isNaN(temp) || temp < 0 || temp > 100) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Temperature must be 0-100',
        })
        return
      }
      await db
        .update(settings)
        .set({ temperature: temp })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: `Temperature set to: ${temp}/100`,
      })
      break

    case '/maxtokens':
      if (args.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Current: ${settings.maxTokens || DEFAULT_MAX_TOKENS}\nUse: /maxtokens <n>`,
        })
        return
      }
      const tokens = parseInt(args[0])
      if (isNaN(tokens) || tokens < 1 || tokens > 8192) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Max tokens must be 1-8192',
        })
        return
      }
      await db
        .update(settings)
        .set({ maxTokens: tokens })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: `Max tokens set to: ${tokens}`,
      })
      break

    case '/stats':
      const showStats = !settings.showStats
      await db
        .update(settings)
        .set({ showStats })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: `Token stats: ${showStats ? 'Enabled' : 'Disabled'}`,
      })
      break

    default:
      await api.sendMessage({
        chat_id: chatId,
        text: `Unknown: ${command}\nUse /help`,
      })
  }
}
