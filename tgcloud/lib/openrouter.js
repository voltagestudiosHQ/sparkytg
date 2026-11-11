import { fetch } from 'sdk'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'
const MAX_ATTEMPTS = 3

// OPENROUTER_KEY is imported from secrets.js which must be created in tgcloud/lib/
// Use ./addkey.sh OPENROUTER_KEY "your-key" to create it
// This file is git-ignored but deployed with the bot
import { OPENROUTER_KEY } from './secrets.js'

/**
 * Send a chat completion request to OpenRouter.
 * Retries up to 3 times on 429 (rate limit).
 */
export async function chat(params) {
  const {
    model,
    messages,
    temperature = 0.7,
    max_tokens = 4096,
    stream = false,
    headers = {},
  } = params

  if (!OPENROUTER_KEY) {
    throw new Error('OPENROUTER_KEY not configured in tgcloud/lib/secrets.js')
  }

  const body = {
    model,
    messages,
    temperature,
    max_tokens,
    stream,
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'HTTP-Referer': headers.referer || 'https://tgcloud.ai',
        'X-Title': headers.title || 'Sparky AI Bot',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      if (stream) {
        return response.body
      }
      return await response.json()
    }

    const errorText = await response.text()
    const error = new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    error.status = response.status

    if (response.status !== 429 || attempt === MAX_ATTEMPTS) {
      throw error
    }
  }
}
