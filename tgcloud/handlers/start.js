import { db, api } from 'sdk'
import { eq } from 'sdk/db'
import { users, settings } from '../schema.js'

/**
 * Handler for /start command
 * Welcomes new users and initializes their profile
 */
export default async function handleStart(message, ctx) {
  const { chat, from } = message
  const chatId = chat.id
  const userId = from.id

  try {
    // Get or create user
    let user = await db.select().from(users).where(eq(users.tgId, userId)).get()
    
    if (!user) {
      user = await db.insert(users).values({
        tgId: userId,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        lang: from.language_code || 'en',
      }).returning().run()
      user = user[0]

      // Create default settings
      await db.insert(settings).values({
        userId: user.id,
      }).run()
    }

    const welcomeMessage = `👋 Hello, ${from.first_name}!\n\n` +
      `I am Sparky, your AI assistant powered by OpenRouter.\n\n` +
      `💬 Send me any message to start chatting!\n\n` +
      `⚙️ Use /help to see all available commands.\n\n` +
      `🌟 Features:\n` +
      `• Chat with various AI models\n` +
      `• Customize temperature and token limits\n` +
      `• View token usage statistics\n` +
      `• Manage conversation history`

    await api.sendMessage({
      chat_id: chatId,
      text: welcomeMessage,
      parse_mode: 'Markdown',
    })

  } catch (error) {
    console.error('Error in /start handler:', error)
    await api.sendMessage({
      chat_id: chatId,
      text: 'Welcome! There was an error initializing your profile, but you can still use the bot.'
    })
  }
}
