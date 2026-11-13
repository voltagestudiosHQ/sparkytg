import { db } from 'sdk'
import { eq } from 'sdk/db'
import { messageGenerations } from '../schema.js'

export default async function handleStoppedMessageGeneration(generation) {
  const generationId = `${generation.chat.id}:${generation.draft_id}`

  await db
    .update(messageGenerations)
    .set({ stopped: true })
    .where(eq(messageGenerations.id, generationId))
    .run()
}
