import { api } from 'sdk'

/**
 * Callback query handler - handles inline button presses
 */
export default async function handleCallbackQuery(callbackQuery, ctx) {
  const { id, data, message } = callbackQuery
  const chatId = message.chat.id

  try {
    await api.answerCallbackQuery({
      callback_query_id: id,
    })

    if (!data) {
      return
    }

    const [action, param] = data.split(':')

    switch (action) {
      case 'refresh':
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: 'Refreshed!',
        })
        break

      default:
        await api.answerCallbackQuery({
          callback_query_id: id,
          text: `Unknown: ${action}`,
          show_alert: true,
        })
    }

  } catch (error) {
    console.error('Callback handler error:', error)
    await api.answerCallbackQuery({
      callback_query_id: id,
      text: 'Error processing request',
      show_alert: true,
    })
  }
}
