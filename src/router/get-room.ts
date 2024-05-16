import { isUserGlobalAdmin, isUserGlobalModerator } from '@/global-settings'
import type { SogsRequestUser } from '@/middlewares/auth'
import { Room, getRooms, type UserPermissions } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'

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

  return {
    status: 200,
    response: await getRoomDetails(room, null),
    contentType: 'application/json'
  }
}

export async function getRoomDetails(room: Room, user: SogsRequestUser | null) {
  let userIsGlobalAdmin = false
  let userIsGlobalModerator = false
  let userIsModerator = false
  let userIsAdmin = false
  if(user !== null) {
    userIsGlobalAdmin = isUserGlobalAdmin(user)
    userIsGlobalModerator = userIsGlobalAdmin || isUserGlobalModerator(user)
    userIsModerator = userIsGlobalModerator || room.moderators.includes(user)
    userIsAdmin = userIsModerator || room.admins.includes(user)
  }

  let userPermissions: UserPermissions
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
    admins: room.admins,
    created: room.created / 1000,
    description: room.description,
    image_id: room.imageId,
    info_updates: room.infoUpdates,
    message_sequence: room.messageSequence,
    moderators: room.moderators,
    name: room.name,
    ...((userIsAdmin || userIsModerator) ? {
      default_read: room.defaultRead,
      default_write: room.defaultWrite,
      default_upload: room.defaultUpload,
      default_accessible: room.defaultAccessible,
      hidden_admins: room.hiddenAdmins,
      hidden_moderators: room.hiddenModerators
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
    moderator: userIsModerator,
    admin: userIsAdmin,
    ...(userIsGlobalModerator && { global_moderator: true }),
    ...(userIsGlobalAdmin && { global_admin: true }),
  }
}