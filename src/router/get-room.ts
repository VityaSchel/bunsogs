import { Room, getRooms, type UserPermissions } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import type { User } from '@/user'
import { testPermission } from '@/utils'

export async function getRoom(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken) {
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

  if (req.user !== null) {
    const permissions = await room.getUserPermissions(req.user)
    if (!testPermission(permissions, ['accessible'])) {
      return { status: 404, response: null }
    }
    room.updateUserActivity(req.user)
  } else if (!room.defaultAccessible) {
    return { status: 404, response: null }
  }

  return {
    status: 200,
    response: await getRoomDetails(room, null),
    contentType: 'application/json'
  }
}

export async function getRoomDetails(room: Room, user: User | null) {
  let isUserGlobalAdmin = false
  let isUserGlobalModerator = false
  let isUserModerator = false
  let isUserAdmin = false
  if(user !== null) {
    isUserGlobalAdmin = user.admin
    isUserGlobalModerator = isUserGlobalAdmin || user.moderator
    isUserModerator = isUserGlobalModerator || room.moderators.has(user)
    isUserAdmin = isUserModerator || room.admins.has(user)
  }

  let userPermissions: Pick<UserPermissions, 'read' | 'write' | 'upload' | 'banned'>
  if(user !== null) {
    userPermissions = await room.getUserPermissions(user)
  } else {
    userPermissions = {
      read: room.defaultRead,
      write: room.defaultWrite,
      upload: room.defaultUpload,
      banned: false
    }
  }

  return {
    active_users: room.activeUsers,
    active_users_cutoff: room.activeUsersCutoff,
    admins: Array.from(room.admins).map(a => a.blindedID),
    created: room.created / 1000,
    description: room.description,
    image_id: room.imageId,
    info_updates: room.infoUpdates,
    message_sequence: room.messageSequence,
    moderators: Array.from(room.moderators).map(a => a.blindedID),
    name: room.name,
    ...((isUserAdmin || isUserModerator) ? {
      default_read: room.defaultRead,
      default_write: room.defaultWrite,
      default_upload: room.defaultUpload,
      default_accessible: room.defaultAccessible,
      hidden_admins: Array.from(room.hiddenAdmins).map(a => a.blindedID),
      hidden_moderators: Array.from(room.hiddenModerators).map(a => a.blindedID)
    } : {}),
    token: room.token,
    pinned_messages: room.pinnedMessages.map(pm => ({
      id: pm.id,
      pinned_at: pm.pinnedAt,
      pinned_by: pm.pinnedBy
    })),
    read: userPermissions.banned ? false : userPermissions.read,
    write: userPermissions.banned ? false : userPermissions.write,
    upload: userPermissions.banned ? false : userPermissions.upload,
    moderator: isUserModerator,
    admin: isUserAdmin,
    ...(isUserGlobalModerator && { global_moderator: true }),
    ...(isUserGlobalAdmin && { global_admin: true }),
  }
}