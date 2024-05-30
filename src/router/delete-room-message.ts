import { BadPermission, PostRateLimited } from '@/errors'
import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'

export async function deleteRoomMessage(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken) {
    return { status: 400, response: null }
  }

  const messageId = Number(req.params?.['message_id'])
  if (!Number.isSafeInteger(messageId) || messageId < 0) {
    return { status: 404, response: null }
  }

  if(req.user === null)  {
    return { status: 401, response: null }
  }
  
  const rooms = getRooms()
  const room = rooms.get(roomToken)
  if (!room) {
    return { status: 404, response: null }
  }

  if(req.user !== null) {
    const permissions = await room.getUserPermissions(req.user)
    if (!testPermission(permissions, ['accessible'])) {
      return { status: 404, response: null }
    } else if (!testPermission(permissions, ['write'])) {
      return { status: 403, response: null }
    }
    room.updateUserActivity(req.user)
  } else if(!room.defaultAccessible) {
    return { status: 404, response: null }
  }

  try {
    const message = await room.deletePosts(
      req.user,
      [messageId]
    )
    return {
      status: 200,
      response: message,
      contentType: 'application/json'
    }
  } catch(e) {
    if (e instanceof PostRateLimited) {
      return {
        status: 429,
        response: null
      }
    } else if(e instanceof BadPermission) {
      return {
        status: 403,
        response: null
      } 
    } else {
      throw e
    }
  }
}