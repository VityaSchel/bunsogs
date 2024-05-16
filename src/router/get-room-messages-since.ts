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
    flags: z.string().regex(/^[a-z]+$/).optional(),
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
  const flags = query.data.flags 
    ? Array.from(new Set(query.data.flags.split('')))
      .filter(f => availableFlags.includes(f))
    : []

  if (req.user !== null) {
    room.updateUserActivity(req.user)
  }

  const messages = await room.getMessages(
    req.user, 
    { recent: true }, 
    { 
      reactions: flags.includes('r'),
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