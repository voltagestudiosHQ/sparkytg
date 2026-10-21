import { api } from 'sdk'

/**
 * Handler for callback queries (inline button presses)
 * Currently handles basic callback responses
 */
export default async function handleCallbackQuery(callbackQuery, ctx) {
  const { id, data, message, from } = callbackQuery
  const chatId = message.chat.id

  try {
    // Acknowledge the callback query
    await api.answerCallbackQuery({
      callback_query_id: id,
      text: 'Processing...',
    })

    // Parse callback data (format: action:param)
    const [action, param] = data.split(':')

    switch (action) {
      case 'help':
        const helpText = `📖 Help Menu\n\n` +
          `Select an option:\n\n` +
          `• Commands - List all bot commands\n` +
          `• Settings - Configure bot behavior\n` +
          `• About - Learn about this bot`

        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: helpText,
          parse_mode: 'Markdown',
        })
        break

      case 'commands':
        const commandsText = `💡 Available Commands:\n\n` +
          `/start - Welcome message\n` +
          `/new - New conversation\n` +
          `/clear - Clear conversation\n` +
          `/model - Switch AI model\n` +
          `/temp - Set temperature\n` +
          `/maxtokens - Set max tokens\n` +
          `/settings - Show settings\n` +
          `/help - This help`

        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: commandsText,
          parse_mode: 'Markdown',
        })
        break

      case 'settings':
        const settingsText = `⚙️ Settings:\n\n` +
          `Use these commands:\n\n` +
          `/model <name> - Switch AI model\n` +
          `/temp <0-100> - Set temperature\n` +
          `/maxtokens <1-8192> - Set max tokens\n` +
          `/stats - Toggle token stats\n` +
          `/settings - Show current settings`

        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: settingsText,
          parse_mode: 'Markdown',
        })
        break

      case 'about':
        const aboutText = `ℹ️ About Sparky AI Bot:\n\n` +
          `A Telegram bot that connects to OpenRouter AI.\n\n` +
          `• Powered by OpenRouter API\n` +
          `• Supports multiple AI models\n` +
          `• Conversation history saved\n` +
          `• Customizable settings\n\n` +
          `Source: github.com/voltagestudiosHQ/sparkytg`

        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: aboutText,
          parse_mode: 'Markdown',
        })
        break

      default:
        await api.answerCallbackQuery({
          callback_query_id: id,
          text: 'Unknown action',
          show_alert: true,
        })
    }

  } catch (error) {
    console.error('Error in callback_query handler:', error)
    await api.answerCallbackQuery({
      callback_query_id: id,
      text: 'An error occurred',
      show_alert: true,
    })
  }
}
