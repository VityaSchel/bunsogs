import { getRooms } from '@/rooms'
import type { SogsRequest, SogsResponse } from '@/router'

export function getRoom(req: SogsRequest): SogsResponse {
  const roomId = req.params?.['id']
  if (!roomId) {
    return {
      status: 404,
      response: null
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

  return {
    status: 200,
    response: {
      active_users: room.activeUsers,
      active_users_cutoff: room.activeUsersCutoff,
      admins: room.admins,
      created: room.created / 1000,
      info_updates: room.infoUpdates,
      message_sequence: room.messageSequence,
      moderators: room.moderators,
      name: room.name,
      read: room.defaultRead,
      token: room.token,
      upload: room.defaultUpload,
      write: room.defaultWrite,
      pinned_messages: room.pinnedMessages.map(pm => ({
        id: pm.id,
        pinned_at: pm.pinnedAt,
        pinned_by: pm.pinnedBy
      })),
    },
    contentType: 'application/json'
  }
}