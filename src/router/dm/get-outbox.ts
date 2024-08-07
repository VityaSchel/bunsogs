import type { SogsRequest, SogsResponse } from '@/router'
import { getDmMessagesFrom, serializeMessage } from '@/router/dm'
import { z } from 'zod'

const paramsSchema = z.object({
  limit: z.number().min(1).max(256).default(100).optional()
})
export async function getDmOutbox(req: SogsRequest): Promise<SogsResponse> {
  if (req.user === null) {
    return { status: 401, response: null }
  }
  
  const params: z.infer<typeof paramsSchema> = req.params ? paramsSchema.parse(req.searchParams) : {}
  const messages = await getDmMessagesFrom({
    senderId: req.user.id,
    ...('limit' in params && { limit: params.limit })
  })

  const messagesSerialized = []
  for (const message of messages) {
    messagesSerialized.push(await serializeMessage(message))
  }
  if (messagesSerialized.length) {
    return {
      status: 200,
      response: messagesSerialized,
      contentType: 'application/json'
    }
  } else {
    return {
      status: 304,
      response: null
    }
  }
}