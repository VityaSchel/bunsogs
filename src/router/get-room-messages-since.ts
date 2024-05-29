import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { z } from 'zod'

export async function getRoomMessagesSince(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken) {
    return {
      status: 404,
      response: null
    }
  }

  const sinceSequenceNumber = Number(req.params?.['since_seqno'])
  if (!Number.isSafeInteger(sinceSequenceNumber) || sinceSequenceNumber < 0) {
    return {
      status: 404,
      response: null
    }
  }

  const query = await z.object({
    limit: z.coerce.number().int().min(1).max(256).default(100),
    t: z.string().regex(/^[a-z]+$/i).optional(),
    r: z.string().optional(),
    reactors: z.coerce.number().int().min(0).max(20).default(4)
  }).safeParseAsync(req.searchParams)
  if (!query.success) {
    return {
      response: null,
      status: 400
    }
  }

  const rooms = getRooms()
  const room = rooms.get(roomToken)
  if (!room) {
    return {
      status: 404,
      response: null
    }
  }

  const availableFlags = ['r']
  const eventTypes = query.data.t
    ? Array.from(new Set(query.data.t.split('')))
      .filter(f => availableFlags.includes(f))
    : []

  if (req.user !== null) {
    room.updateUserActivity(req.user)
  }

  const messages = await room.getMessages(
    req.user, 
    { sequence: sinceSequenceNumber }, 
    { 
      reactions: eventTypes.includes('r'),
      reactorLimit: query.data.reactors, 
      limit: query.data.limit 
    }
  )

  return {
    status: 200,
    response: messages,
    contentType: 'application/json'
  }
}