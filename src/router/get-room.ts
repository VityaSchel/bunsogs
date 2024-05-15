import { Room, getRooms } from '@/rooms'
import type { SogsRequest, SogsResponse } from '@/router'

export async function getRoom(req: SogsRequest): Promise<SogsResponse> {
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
    response: await getRoomDetails(room, null),
    contentType: 'application/json'
  }
}

export async function getRoomDetails(room: Room, user: any | null) {
  const isUserGlobalAdmin = false
  const isUserGlobalModerator = isUserGlobalAdmin || false
  const isUserModerator = isUserGlobalModerator || false
  const isUserAdmin = isUserModerator || false

  const userPermissions = ['read', 'write']

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
    ...((isUserAdmin || isUserModerator) ? {
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
    read: userPermissions.includes('read'),
    write: userPermissions.includes('write'),
    upload: userPermissions.includes('upload'),
    moderator: isUserModerator,
    admin: isUserAdmin,
    global_moderator: isUserGlobalModerator,
    global_admin: isUserGlobalAdmin
  }
}