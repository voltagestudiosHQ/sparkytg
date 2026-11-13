import { db, api, BotApiError } from 'sdk'
import { eq, desc, sql } from 'sdk/db'
import { chat } from '../lib/openrouter.js'
import { SYSTEM_PROMPT } from '../lib/secrets.js'
import { users, conversations, messages, messageGenerations } from '../schema.js'

const MODEL = '@preset/sparky' // This is sparky itself. DO NOT TOUCH. If you want to change the model, change settings in the OpenRouter dashboard. This is a preset that uses the same model as Sparky, but with a system prompt that makes it more helpful and friendly for Telegram users.
const HISTORY_LIMIT = 20 // Number of messages to keep in the conversation history for context
const TELEGRAM_MESSAGE_LIMIT = 4000 // Telegram has a message character limit of 4096, but we use 4000 to be safe and avoid issues with formatting or special characters.

export default async function handleMessage(message) {
  const { chat: tgChat, from: tgUser, text } = message
  const chatId = tgChat.id

  if (!text) return

  try {
    if (text.startsWith('/')) {
      await handleCommand(text, chatId, tgUser)
      return
    }

    const user = await getOrCreateUser(tgUser)

    let conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.id))
      .limit(1)
      .get()

    if (!conversation) {
      conversation = await db
        .insert(conversations)
        .values({
          userId: user.id,
          model: MODEL,
          title: text.substring(0, 100),
        })
        .returning()
        .run()
      conversation = conversation[0]
    }

    await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        role: 'user',
        content: text,
      })
      .run()

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.id))
      .limit(HISTORY_LIMIT)
      .all()

    history.reverse()

    await api.sendChatAction({ chat_id: chatId, action: 'typing' })

    if (!SYSTEM_PROMPT) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'Bot not configured. Please set SYSTEM_PROMPT in tgcloud/lib/secrets.js',
      })
      return
    }

    const chatParams = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
      headers: {
        referer: 'https://tgcloud.ai',
        title: 'Sparky AI Bot',
      },
    }

    let reply
    let stopped = false
    if (tgChat.type === 'private') {
      const result = await streamReply(chatParams, {
        chatId,
        draftId: message.message_id,
        messageThreadId: message.message_thread_id,
      })
      reply = result.text
      stopped = result.stopped
    } else {
      const response = await chat(chatParams)
      reply = response.choices?.[0]?.message?.content || ''
    }

    if (!reply) {
      if (stopped) return
      await api.sendMessage({
        chat_id: chatId,
        text: 'Sorry, I did not receive a valid response from the AI.',
      })
      return
    }

    await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        role: 'assistant',
        content: reply,
      })
      .run()

    await db
      .update(conversations)
      .set({ updatedAt: sql`(unixepoch())` })
      .where(eq(conversations.id, conversation.id))
      .run()

    await sendReply(chatId, reply, message.message_id, message.message_thread_id)
  } catch (error) {
    console.error('Message handler error:', error)

    let errorMessage = 'Sorry, an error occurred.'

    if (error instanceof BotApiError) {
      if (error.code === 429) {
        errorMessage = 'Rate limit exceeded. Please wait and try again.'
      }
    } else if (error?.status === 429 || error?.message?.includes('OpenRouter API error: 429')) {
      errorMessage = 'The AI model is rate-limited right now. Please try again in a minute.'
    } else if (error?.message?.includes('OPENROUTER_KEY not configured')) {
      errorMessage = 'Bot not configured. Please set OPENROUTER_KEY in tgcloud/lib/secrets.js'
    }

    await api.sendMessage({ chat_id: chatId, text: errorMessage })
  }
}

async function sendReply(chatId, text, replyToMessageId, messageThreadId) {
  const thread = messageThreadId ? { message_thread_id: messageThreadId } : {}

  if (text.length <= TELEGRAM_MESSAGE_LIMIT) {
    await api.sendMessage({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
      ...thread,
    })
    return
  }

  for (let i = 0; i < text.length; i += TELEGRAM_MESSAGE_LIMIT) {
    await api.sendMessage({
      chat_id: chatId,
      text: text.slice(i, i + TELEGRAM_MESSAGE_LIMIT),
      ...(i === 0 ? { reply_to_message_id: replyToMessageId } : {}),
      ...thread,
    })
  }
}

async function streamReply(params, { chatId, draftId, messageThreadId }) {
  const generationId = `${chatId}:${draftId}`
  const thread = messageThreadId ? { message_thread_id: messageThreadId } : {}

  await db.insert(messageGenerations).values({ id: generationId }).run()

  try {
    await api.sendMessageDraft({
      chat_id: chatId,
      draft_id: draftId,
      text: '',
      can_stop: true,
      keep_on_stop: true,
      ...thread,
    })

    const body = await chat({ ...params, stream: true })
    if (!body) throw new Error('OpenRouter returned an empty streaming response')

    return await readStreamReply(body, { chatId, draftId, generationId, thread })
  } finally {
    await db.delete(messageGenerations).where(eq(messageGenerations.id, generationId)).run()
  }
}

async function readStreamReply(body, { chatId, draftId, generationId, thread }) {
  const decoder = new TextDecoder()
  const iterator = body[Symbol.asyncIterator]()
  let pending = iterator.next().then((result) => ({ type: 'chunk', result }))
  let bufferedLine = ''
  let reply = ''
  let lastDraftUpdate = Date.now()

  const processLine = (line) => {
    if (!line.startsWith('data:')) return

    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return

    const event = JSON.parse(data)
    const content = event.choices?.[0]?.delta?.content
    if (typeof content === 'string') reply += content
  }

  const processChunk = (text) => {
    bufferedLine += text
    let newline = bufferedLine.indexOf('\n')
    while (newline !== -1) {
      processLine(bufferedLine.slice(0, newline).replace(/\r$/, ''))
      bufferedLine = bufferedLine.slice(newline + 1)
      newline = bufferedLine.indexOf('\n')
    }
  }

  const updateDraft = async () => {
    if (!reply || reply.length > TELEGRAM_MESSAGE_LIMIT || Date.now() - lastDraftUpdate < 1000) return

    await api.sendMessageDraft({
      chat_id: chatId,
      draft_id: draftId,
      text: reply,
      can_stop: true,
      keep_on_stop: true,
      ...thread,
    })
    lastDraftUpdate = Date.now()
  }

  while (true) {
    let timeout
    let outcome
    try {
      outcome = await Promise.race([
        pending,
        new Promise((resolve) => {
          timeout = setTimeout(() => resolve({ type: 'poll' }), 500)
        }),
      ])
    } finally {
      clearTimeout(timeout)
    }

    if (outcome.type === 'poll') {
      const generation = await db
        .select()
        .from(messageGenerations)
        .where(eq(messageGenerations.id, generationId))
        .get()
      if (generation?.stopped) {
        await iterator.return?.()
        return { text: reply, stopped: true }
      }
      continue
    }

    if (outcome.result.done) {
      processChunk(decoder.decode())
      if (bufferedLine) processLine(bufferedLine.replace(/\r$/, ''))
      return { text: reply, stopped: false }
    }

    const chunk = outcome.result.value
    processChunk(typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true }))
    await updateDraft()
    pending = iterator.next().then((result) => ({ type: 'chunk', result }))
  }
}

async function handleCommand(text, chatId, tgUser) {
  const command = text.split(' ')[0].toLowerCase()

  if (command === '/start') {
    await api.sendMessage({
      chat_id: chatId,
      text: `Hello, ${tgUser.first_name}! I'm Sparky, your AI assistant. Send me a message to start chatting — I'll remember the conversation. Use /new to start fresh.`,
    })
    return
  }

  if (command === '/new') {
    const user = await getOrCreateUser(tgUser)
    const oldConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .all()

    for (const conv of oldConversations) {
      await db
        .delete(messages)
        .where(eq(messages.conversationId, conv.id))
        .run()
    }

    await db
      .delete(conversations)
      .where(eq(conversations.userId, user.id))
      .run()

    await db
      .insert(conversations)
      .values({ userId: user.id, model: MODEL })
      .run()

    await api.sendMessage({
      chat_id: chatId,
      text: 'Started a new conversation. All previous messages were deleted, and your next message begins fresh.',
    })
    return
  }

  if (command === '/help') {
    await api.sendMessage({
      chat_id: chatId,
      text: 'Send me any message and I will reply.\n\n/new - start a fresh conversation\n/help - show this help',
    })
    return
  }

  await api.sendMessage({
    chat_id: chatId,
    text: 'Unknown command. Send me a message, or use /help.',
  })
}

async function getOrCreateUser(tgUser) {
  let user = await db.select().from(users).where(eq(users.tgId, tgUser.id)).get()

  if (!user) {
    user = await db
      .insert(users)
      .values({
        tgId: tgUser.id,
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        lang: tgUser.language_code || 'en',
      })
      .returning()
      .run()
    user = user[0]
  }

  return user
}
