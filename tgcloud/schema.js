import { table, integer, text, boolean, sql, index } from 'sdk/db'

// Users table
export const users = table('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tgId: integer('tg_id').unique(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  lang: text('lang').default('en'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  tgIdIdx: index('idx_users_tg_id').on(t.tgId),
}))

// Conversations table
export const conversations = table('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  model: text('model').notNull(),
  title: text('title'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  userIdx: index('idx_conversations_user_id').on(t.userId),
}))

// Messages table
export const messages = table('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  tokens: integer('tokens'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  convIdx: index('idx_messages_conversation_id').on(t.conversationId),
}))

// Settings table
export const settings = table('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').unique(),
  activeConversationId: integer('active_conversation_id'),
  defaultModel: text('default_model').default('openrouter/free'),
  temperature: integer('temperature').default(70),
  maxTokens: integer('max_tokens').default(4096),
  showStats: boolean('show_stats').default(true),
}, (t) => ({
  userIdx: index('idx_settings_user_id').on(t.userId),
}))
