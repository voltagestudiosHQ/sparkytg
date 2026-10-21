import { api } from 'sdk'

/**
 * Handler for /help command
 * Shows available commands and bot information
 */
export default async function handleHelp(message, ctx) {
  const { chat } = message
  const chatId = chat.id

  const helpText = `📖 Sparky AI Bot - Help\n\n` +
    `This bot connects you to OpenRouter AI models directly in Telegram.\n\n` +
    `💡 Commands:\n\n` +
    `/start - Start the bot and get a welcome message\n` +
    `/new - Start a new conversation\n` +
    `/clear - Clear the current conversation history\n` +
    `/settings - Show your current settings\n\n` +
    `⚙️ Configuration:\n\n` +
    `/model <name> - Switch AI model (e.g., /model openai/gpt-4o-mini)\n` +
    `/models - List available AI models\n` +
    `/temp <0-100> - Set temperature (creativity level)\n` +
    `/maxtokens <1-8192> - Set maximum tokens per response\n` +
    `/stats - Toggle token usage statistics display\n\n` +
    `ℹ️ Information:\n\n` +
    `/help - Show this help message\n\n` +
    `💬 To chat: Just send a message! The bot will respond using AI.\n\n` +
    `🔧 Powered by: OpenRouter (openrouter.ai)`

  await api.sendMessage({
    chat_id: chatId,
    text: helpText,
    parse_mode: 'Markdown',
  })
}
