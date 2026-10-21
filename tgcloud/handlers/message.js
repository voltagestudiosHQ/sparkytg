import { db, api, BotApiError } from 'sdk'
import { eq, and, desc, sql } from 'sdk/db'
import { chat, countMessageTokens, countTokens } from '../lib/openrouter.js'
import { users, conversations, messages, settings } from '../schema.js'

/**
 * Message handler for the Telegram bot
 * Handles user messages and generates AI responses
 */
export default async function handleMessage(message, ctx) {
  const { chat: tgChat, from: tgUser, text, entities } = message
  const chatId = tgChat.id
  const userId = tgUser.id

  try {
    // Ignore non-text messages
    if (!text) {
      return
    }

    // Get or create user
    let user = await db.select().from(users).where(eq(users.tgId, userId)).get()
    
    if (!user) {
      user = await db.insert(users).values({
        tgId: userId,
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        lang: tgUser.language_code || 'en',
      }).returning().run()
      user = user[0]
    }

    // Get user settings
    let userSettings = await db.select().from(settings).where(eq(settings.userId, user.id)).get()
    
    if (!userSettings) {
      userSettings = await db.insert(settings).values({
        userId: user.id,
      }).returning().run()
      userSettings = userSettings[0]
    }

    // Check for commands
    const isCommand = text.startsWith('/')
    
    if (isCommand) {
      await handleCommand(text, chatId, user, userSettings)
      return
    }

    // Get the active conversation or create a new one
    let conversation = await db.select().from(conversations)
      .where(and(
        eq(conversations.userId, user.id),
        eq(conversations.id, userSettings.activeConversationId || 0)
      ))
      .get()

    if (!conversation) {
      // Create a new conversation
      conversation = await db.insert(conversations).values({
        userId: user.id,
        model: userSettings.defaultModel,
        title: text.substring(0, 100),
      }).returning().run()
      conversation = conversation[0]

      // Update user settings with new conversation
      await db.update(settings)
        .set({ activeConversationId: conversation.id })
        .where(eq(settings.userId, user.id))
        .run()
    }

    // Add user message to conversation
    const userMsg = await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'user',
      content: text,
      tokens: countTokens(text),
    }).returning().run()

    // Get conversation history (last 10 messages for context)
    const history = await db.select().from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(10)
      .all()

    // Reverse to get chronological order
    history.reverse()

    // Prepare messages for OpenRouter API
    const apiMessages = history.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    // Check token count
    const tokenCount = countMessageTokens(apiMessages)
    const maxTokens = userSettings.maxTokens || 4096
    
    if (tokenCount > maxTokens - 500) {
      apiMessages.splice(0, Math.ceil((tokenCount - (maxTokens - 500)) / 100))
    }

    // Send typing action
    await api.sendChatAction({ chat_id: chatId, action: 'typing' })

    // Call OpenRouter API
    const response = await chat({
      model: conversation.model,
      messages: apiMessages,
      temperature: (userSettings.temperature || 70) / 100,
      max_tokens: maxTokens,
      headers: {
        referer: `https://t.me/${tgUser.username || 'share'}`,
        title: `Telegram Bot - ${user.firstName}`,
      },
    })

    // Extract assistant response
    const assistantMessage = response.choices?.[0]?.message?.content || ''

    if (!assistantMessage) {
      await api.sendMessage({ chat_id: chatId, text: 'Sorry, I did not receive a valid response.' })
      return
    }

    // Save assistant message to database
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantMessage,
      tokens: countTokens(assistantMessage),
    }).run()

    // Update conversation timestamp
    await db.update(conversations)
      .set({ updatedAt: sql`(unixepoch())` })
      .where(eq(conversations.id, conversation.id))
      .run()

    // Format response with stats if enabled
    let responseText = assistantMessage
    
    if (userSettings.showStats) {
      const assistantTokens = countTokens(assistantMessage)
      const totalTokens = tokenCount + assistantTokens
      responseText += `\n\n---\n*Tokens: ${totalTokens}*`
    }

    // Send response
    await api.sendMessage({
      chat_id: chatId,
      text: responseText,
      parse_mode: 'Markdown',
      reply_to_message_id: message.message_id,
    })

  } catch (error) {
    console.error('Error handling message:', error)
    
    let errorMessage = 'Sorry, an error occurred while processing your request.'
    
    if (error instanceof BotApiError) {
      if (error.code === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.'
      } else if (error.code === 400) {
        errorMessage = 'Invalid request. Please check your input.'
      }
    } else if (error.message.includes('OPENROUTER_API_KEY')) {
      errorMessage = 'Bot is not configured. Please set up the API key.'
    } else if (error.message.includes('OpenRouter API error')) {
      errorMessage = `AI service error: ${error.message}`
    }

    await api.sendMessage({ chat_id: chatId, text: errorMessage })
  }
}

/**
 * Handle bot commands
 */
async function handleCommand(text, chatId, user, settings) {
  const command = text.split(' ')[0].toLowerCase()
  const args = text.split(' ').slice(1)

  switch (command) {
    case '/start':
      await api.sendMessage({
        chat_id: chatId,
        text: `Hello, ${user.firstName}!\n\nI am an AI assistant powered by OpenRouter. Send me a message to start chatting!\n\nUse /help to see available commands.`,
      })
      break

    case '/help':
      await api.sendMessage({
        chat_id: chatId,
        text: `Available commands:\n\n` +
              `/start - Start a new chat\n` +
              `/new - Start a new conversation\n` +
              `/models - List available AI models\n` +
              `/model <name> - Switch AI model\n` +
              `/temp <value> - Set temperature (0-100)\n` +
              `/maxtokens <value> - Set max tokens\n` +
              `/stats - Toggle token usage stats\n` +
              `/settings - Show current settings\n` +
              `/clear - Clear current conversation\n` +
              `/help - Show this help message`,
        parse_mode: 'Markdown',
      })
      break

    case '/new':
      await db.update(settings)
        .set({ activeConversationId: null })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: 'New conversation started! Your next message will begin a fresh chat.'
      })
      break

    case '/settings':
      await api.sendMessage({
        chat_id: chatId,
        text: `Current settings:\n\n` +
              `Model: ${settings.defaultModel}\n` +
              `Temperature: ${settings.temperature || 70}/100\n` +
              `Max tokens: ${settings.maxTokens || 4096}\n` +
              `Show stats: ${settings.showStats ? 'Yes' : 'No'}`,
      })
      break

    case '/model':
      if (args.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Current model: ${settings.defaultModel}\n\nUse /model <name> to switch. Example: /model openai/gpt-4o`
        })
        return
      }
      await db.update(settings)
        .set({ defaultModel: args[0] })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: `Model switched to: ${args[0]}`
      })
      break

    case '/temp':
      if (args.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Current temperature: ${settings.temperature || 70}/100\n\nUse /temp <value> to set (0-100). Example: /temp 80`
        })
        return
      }
      const temp = parseInt(args[0])
      if (isNaN(temp) || temp < 0 || temp > 100) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Temperature must be a number between 0 and 100'
        })
        return
      }
      await db.update(settings)
        .set({ temperature: temp })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: `Temperature set to: ${temp}/100`
      })
      break

    case '/maxtokens':
      if (args.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Current max tokens: ${settings.maxTokens || 4096}\n\nUse /maxtokens <value> to set. Example: /maxtokens 2048`
        })
        return
      }
      const tokens = parseInt(args[0])
      if (isNaN(tokens) || tokens < 1 || tokens > 8192) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Max tokens must be a number between 1 and 8192'
        })
        return
      }
      await db.update(settings)
        .set({ maxTokens: tokens })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: `Max tokens set to: ${tokens}`
      })
      break

    case '/stats':
      const newStatsValue = !settings.showStats
      await db.update(settings)
        .set({ showStats: newStatsValue })
        .where(eq(settings.userId, user.id))
        .run()
      await api.sendMessage({
        chat_id: chatId,
        text: `Token usage stats: ${newStatsValue ? 'Enabled' : 'Disabled'}`
      })
      break

    case '/clear':
      if (settings.activeConversationId) {
        await db.delete(messages)
          .where(eq(messages.conversationId, settings.activeConversationId))
          .run()
        await db.delete(conversations)
          .where(eq(conversations.id, settings.activeConversationId))
          .run()
        await db.update(settings)
          .set({ activeConversationId: null })
          .where(eq(settings.userId, user.id))
          .run()
        await api.sendMessage({
          chat_id: chatId,
          text: 'Current conversation cleared.'
        })
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: 'No active conversation to clear.'
        })
      }
      break

    case '/models':
      try {
        const { listModels } = await import('../lib/openrouter.js')
        const models = await listModels()
        const modelList = models.slice(0, 20).map(m => `• ${m.id}`).join('\n')
        await api.sendMessage({
          chat_id: chatId,
          text: `Available models:\n\n${modelList}\n\nUse /model <name> to switch.`,
          parse_mode: 'Markdown',
        })
      } catch (error) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Could not fetch model list. Please check your API key.'
        })
      }
      break

    default:
      await api.sendMessage({
        chat_id: chatId,
        text: `Unknown command: ${command}\n\nUse /help to see available commands.`
      })
  }
}
