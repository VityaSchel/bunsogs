import { getRooms, type UserPermissions } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { getRoomDetails } from '@/router/get-room'
import { testPermission } from '@/utils'

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
  
  let permissions: UserPermissions | undefined = undefined
  if (req.user !== null) {
    permissions = await room.getUserPermissions(req.user)
    if (!testPermission(permissions, ['accessible'])) {
      return { status: 404, response: null }
    }
    room.updateUserActivity(req.user)
  } else if (!room.defaultAccessible) {
    return { status: 404, response: null }
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

  if (!permissions) {
    permissions = {
      read: room.defaultRead,
      write: room.defaultWrite,
      upload: room.defaultUpload,
      banned: false,
      accessible: true,
      moderator: false,
      admin: false
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
      read: permissions.banned ? false : permissions.read,
      write: permissions.banned ? false : permissions.write,
      upload: permissions.banned ? false : permissions.upload,
      ...(includeDetails && { 
        details: await getRoomDetails(room, user)
      })
    },
    contentType: 'application/json'
  }
}