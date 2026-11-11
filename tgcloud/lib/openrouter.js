import { fetch } from 'sdk'

const OPENAI_BASE_URL = 'https://openrouter.ai/api/v1'

// OPENROUTER_KEY is imported from secrets.js which must be created in tgcloud/lib/
// Use ./addkey.sh OPENROUTER_KEY "your-key" to create it
// This file is git-ignored but deployed with the bot
import { OPENROUTER_KEY } from './secrets.js'

/**
 * OpenRouter API client for Telegram bot
 * Uses OpenRouter's OpenAI-compatible API endpoint
 */
export const OPENROUTER_API_URL = OPENAI_BASE_URL

const MAX_ATTEMPTS = 3

/**
 * Send a chat completion request to OpenRouter
 * @param {Object} params
 * @param {string} params.model - Model identifier
 * @param {Array} params.messages - Array of {role, content} objects
 * @param {number} [params.temperature=0.7]
 * @param {number} [params.max_tokens=4096]
 * @param {boolean} [params.stream=false]
 * @param {Object} [params.headers]
 * @returns {Promise<Object>}
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

  const requestHeaders = {
    'Content-Type': 'application/json',
    'HTTP-Referer': headers.referer || 'https://tgcloud.ai',
    'X-Title': headers.title || 'Telegram AI Bot',
  }

  const body = {
    model,
    messages,
    temperature,
    max_tokens,
    stream,
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        ...requestHeaders,
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
    const status = response.status
    const error = new Error(`OpenRouter API error: ${status} - ${errorText}`)
    error.status = status

    if (status !== 429 || attempt === MAX_ATTEMPTS) {
      throw error
    }
  }
}

/**
 * Get list of available models from OpenRouter
 * @returns {Promise<Array>}
 */
export async function listModels() {
  if (!OPENROUTER_KEY) {
    throw new Error('OPENROUTER_KEY not configured in tgcloud/lib/secrets.js')
  }

  const response = await fetch(`${OPENAI_BASE_URL}/models`, {
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.data || data.models || []
}

/**
 * Count tokens in text (approximate)
 * @param {string} text
 * @returns {number}
 */
export function countTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Count tokens in messages array
 * @param {Array} messages
 * @returns {number}
 */
export function countMessageTokens(messages) {
  if (!messages) return 0
  let total = 0
  for (const msg of messages) {
    total += countTokens(msg.content)
    total += 5
  }
  return total
}
