import { getRooms } from '@/rooms'
import type { SogsRequest, SogsResponse } from '@/router'
import { getRoomDetails } from '@/router/get-room'

export async function getRoomUpdates(req: SogsRequest): Promise<SogsResponse> {
  const roomId = req.params?.['id']
  const infoUpdates = Number(req.params?.['info_updates'])
  if (!roomId || !Number.isSafeInteger(infoUpdates) || infoUpdates < 0) {
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

  const includeDetails = room.infoUpdates !== infoUpdates

  return {
    status: 200,
    response: {
      active_users: room.activeUsers,
      token: room.token,
      default_read: room.defaultRead,
      default_write: room.defaultWrite,
      default_upload: room.defaultUpload,
      default_accessible: room.defaultAccessible,
      ...(includeDetails && { 
        details: await getRoomDetails(room, req.user)
      })
    },
    contentType: 'application/json'
  }
}