import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { z } from 'zod'

export async function getRoomRecentMessages(req: SogsRequest): Promise<SogsResponse> {
  const roomId = req.params?.['id']
  if (!roomId) {
    return {
      status: 404,
      response: null
    }
  }

  const query = await z.object({
    limit: z.coerce.number().int().min(1).max(256).default(100),
    reactors: z.coerce.number().int().min(0).max(20).default(4)
  }).safeParseAsync(req.searchParams)
  if (!query.success) {
    return {
      response: null,
      status: 400
    }
  }

  const rooms = getRooms()
  const room = rooms.get(roomId)
  if (!room) {
    return {
      status: 404,
      response: null
    }
  }

  if (req.user !== null) {
    room.updateUserActivity(req.user)
  }

  const messages = await room.getMessages(
    req.user, 
    { recent: true }, 
    { reactorLimit: query.data.reactors, limit: query.data.limit }
  )

  return {
    status: 200,
    response: messages,
    contentType: 'application/json'
  }
}