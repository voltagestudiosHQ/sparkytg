import { db } from 'sdk'
import { eq } from 'sdk/db'
import { users, settings } from '../schema.js'

/**
 * Utility functions for the Telegram bot
 */

/**
 * Get or create a user in the database
 * @param {Object} tgUser - Telegram user object
 * @returns {Promise<Object>} - User record
 */
export async function getOrCreateUser(tgUser) {
  let user = await db.select().from(users).where(eq(users.tgId, tgUser.id)).get()
  
  if (!user) {
    const newUser = await db.insert(users).values({
      tgId: tgUser.id,
      username: tgUser.username,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      lang: tgUser.language_code || 'en',
    }).returning().run()
    user = newUser[0]
  }
  
  return user
}

/**
 * Get or create user settings
 * @param {number} userId - User ID from the database
 * @returns {Promise<Object>} - Settings record
 */
export async function getOrCreateSettings(userId) {
  let settingsRecord = await db.select().from(settings).where(eq(settings.userId, userId)).get()
  
  if (!settingsRecord) {
    const newSettings = await db.insert(settings).values({
      userId,
    }).returning().run()
    settingsRecord = newSettings[0]
  }
  
  return settingsRecord
}

/**
 * Format a Telegram user for display
 * @param {Object} user - User object
 * @returns {string} - Formatted user string
 */
export function formatUser(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  const username = user.username ? `@${user.username}` : ''
  return username ? `${name} (${username})` : name
}

/**
 * Escape special Markdown characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeMarkdown(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\\)')
    .replace(/!/g, '\\!')
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} - Formatted string
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} - Formatted string
 */
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
