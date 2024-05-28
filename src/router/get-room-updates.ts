import { getRooms, type UserPermissions } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { getRoomDetails } from '@/router/get-room'

export async function getRoomUpdates(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  const infoUpdates = Number(req.params?.['info_updates'])
  if (!roomToken || !Number.isSafeInteger(infoUpdates) || infoUpdates < 0) {
    return {
      status: 404,
      response: null
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

  const user = req.user

  let userIsGlobalAdmin = false
  let userIsGlobalModerator = false
  let userIsModerator = false
  let userIsAdmin = false
  if (user !== null) {
    userIsGlobalAdmin = user.admin
    userIsGlobalModerator = userIsGlobalAdmin || user.moderator
    userIsModerator = userIsGlobalModerator || room.moderators.has(user)
    userIsAdmin = userIsModerator || room.admins.has(user)
  }

  let userPermissions: Pick<UserPermissions, 'read' | 'write' | 'upload' | 'banned'>
  if (user !== null) {
    userPermissions = await room.getUserPermissions(user)
  } else {
    userPermissions = {
      read: room.defaultRead,
      write: room.defaultWrite,
      upload: room.defaultUpload,
      banned: false
    }
  }

  const includeDetails = room.infoUpdates !== infoUpdates

  return {
    status: 200,
    response: {
      active_users: room.activeUsers,
      token: room.token,
      ...((userIsAdmin || userIsModerator) ? {
        default_read: room.defaultRead,
        default_write: room.defaultWrite,
        default_upload: room.defaultUpload,
        default_accessible: room.defaultAccessible,
      } : {}),
      read: userPermissions.banned ? false : userPermissions.read,
      write: userPermissions.banned ? false : userPermissions.write,
      upload: userPermissions.banned ? false : userPermissions.upload,
      ...(includeDetails && { 
        details: await getRoomDetails(room, user)
      })
    },
    contentType: 'application/json'
  }
}