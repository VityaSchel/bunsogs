import { sendPluginMessage } from '@/plugins'
import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'
import { z } from 'zod'
import * as API from '@/api'

export async function getRoomRecentMessages(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken || Array.isArray(roomToken)) {
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
  const room = rooms.get(roomToken)
  if (!room) {
    return {
      status: 404,
      response: null
    }
  }

  if (req.user !== null) {
    const permissions = await room.getUserPermissions(req.user)
    if (!testPermission(permissions, ['accessible'])) {
      return { status: 404, response: null }
    } else if (!testPermission(permissions, ['read'])) {
      return { status: 403, response: null }
    }
    room.updateUserActivity(req.user)
  } else if (!room.defaultAccessible) {
    return { status: 404, response: null }
  }

  sendPluginMessage('onRecentMessagesRequest', {
    user: req.user && await API.mapUser(req.user, room),
    room: API.mapRoom(room),
  })

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