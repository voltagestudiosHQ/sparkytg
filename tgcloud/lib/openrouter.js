import { fetch } from 'sdk'

const OPENAI_BASE_URL = 'https://openrouter.ai/api/v1'

/**
 * OpenRouter API client for Telegram bot
 * Uses OpenRouter's OpenAI-compatible API endpoint
 */
export const OPENROUTER_API_URL = OPENAI_BASE_URL

/**
 * Send a chat completion request to OpenRouter
 * @param {Object} params - Chat completion parameters
 * @param {string} params.model - Model identifier (e.g., 'openai/gpt-4o-mini')
 * @param {Array} params.messages - Array of message objects with role and content
 * @param {number} [params.temperature=0.7] - Sampling temperature (0-1)
 * @param {number} [params.max_tokens=4096] - Maximum tokens to generate
 * @param {boolean} [params.stream=false] - Whether to stream the response
 * @param {Object} [params.headers] - Additional headers (e.g., HTTP-Referer, X-Title)
 * @returns {Promise<Object>} - Chat completion response
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

  const requestHeaders = {
    'Content-Type': 'application/json',
    'HTTP-Referer': headers?.referer || 'https://tgcloud.ai',
    'X-Title': headers?.title || 'Telegram AI Bot',
    ...headers,
  }

  // Get API key from environment
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required')
  }

  const body = {
    model,
    messages,
    temperature,
    max_tokens,
    stream,
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      ...requestHeaders,
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${error}`)
  }

  if (stream) {
    return response.body
  }

  return response.json()
}

/**
 * Get list of available models from OpenRouter
 * @returns {Promise<Array>} - List of model objects
 */
export async function listModels() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required')
  }

  const response = await fetch(`${OPENAI_BASE_URL}/models`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${error}`)
  }

  const data = await response.json()
  return data.data || data.models || []
}

/**
 * Get a specific model's information
 * @param {string} modelId - Model identifier
 * @returns {Promise<Object>} - Model information
 */
export async function getModel(modelId) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required')
  }

  const response = await fetch(`${OPENAI_BASE_URL}/models/${modelId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${error}`)
  }

  return response.json()
}

/**
 * Count tokens in a text string using a simple approximation
 * @param {string} text - Text to count tokens for
 * @returns {number} - Approximate token count
 */
export function countTokens(text) {
  // Simple approximation: 4 characters per token on average
  // This is a rough estimate; for accurate counting, use a proper tokenizer
  return Math.ceil(text.length / 4)
}

/**
 * Count tokens in messages array
 * @param {Array} messages - Array of message objects
 * @returns {number} - Total token count
 */
export function countMessageTokens(messages) {
  let total = 0
  for (const msg of messages) {
    total += countTokens(msg.content || '')
    // Add a small overhead for role and formatting
    total += 5
  }
  return total
}
