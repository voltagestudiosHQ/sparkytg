// Public template only. Copy to tgcloud/lib/secrets.js and add real
// values there; never put credentials in this file. In CI, values are
// injected via addkey.sh instead.

export const OPENROUTER_KEY = 'YOUR_OPENROUTER_API_KEY'

// Optional override for Sparky's persona. Leave empty ('') to use the
// built-in persona defined in tgcloud/lib/persona.js. Set this (here or
// as the SYSTEM_PROMPT CI secret) to change how Sparky behaves without
// touching code.
export const SYSTEM_PROMPT = ''
