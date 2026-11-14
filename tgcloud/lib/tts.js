import { fetch } from 'sdk'

// Simple robotic TTS. The tgcloud runtime is a serverless V8 isolate with
// no binaries or npm packages, so eSpeak-NG itself cannot run there; this
// uses a free keyless endpoint with a simple synthetic voice instead.
// Swap synthesizeSpeech() for another backend without touching the handler.
const TTS_URL = 'https://translate.google.com/translate_tts'
const MAX_CHUNKS = 5
const MAX_CHUNK_LENGTH = 180

export async function synthesizeSpeech(text) {
  const chunks = splitForSpeech(text)
  const parts = []

  for (const chunk of chunks) {
    const url = `${TTS_URL}?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(chunk)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    })
    if (!response.ok) throw new Error(`TTS request failed: ${response.status}`)
    parts.push(new Uint8Array(await response.arrayBuffer()))
  }

  const total = parts.reduce((n, part) => n + part.length, 0)
  const audio = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    audio.set(part, offset)
    offset += part.length
  }
  return audio
}

function splitForSpeech(text) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const chunks = []
  let current = ''

  for (const word of words) {
    if (current && current.length + 1 + word.length > MAX_CHUNK_LENGTH) {
      chunks.push(current)
      if (chunks.length === MAX_CHUNKS) return chunks
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current && chunks.length < MAX_CHUNKS) chunks.push(current)
  return chunks
}
