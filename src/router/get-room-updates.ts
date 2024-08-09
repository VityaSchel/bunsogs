import { getRooms, type UserPermissions } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { getRoomDetails } from '@/router/get-room'
import { testPermission } from '@/utils'

/**
  Polls a room for metadata updates.

  The endpoint polls room metadata for this room, always including the instantaneous room details
  (such as the user's permission and current number of active users), and including the full room
  metadata if the room's info_updated counter has changed from the provided value.

  # URL Parameters

  - `info_updates` — The client's currently cached `info_updates` value for the room.  The full
    room metadata is returned in the response if and only if the room's last update count does not
    equal the given value.

  # Return value

  On success this returns the results of polling the room for updated information.  This endpoint
  always returns ephemeral data, such as the number of active users and the current user's
  permissions, and will include the full room details if and only if it has changed (i.e.
  info_updates does not match) from the `info_updated` value provided by the requestor.

  Note that the `details` field is only present and populated if the room's `info_updates` counter
  differs from the provided `info_updated` value; otherwise the values are unchanged and so it is
  omitted.

  The return value is a JSON object containing the following subset of values of [the full room
  details](#get-roomroom):

  - `token`
  - `active_users`
  - `read`, `write`, `upload`
  - `moderator`, `admin`, `global_moderator`, `global_admin`
  - `default_read`, `default_accessible`, `default_write`, `default_upload`

  If the room metadata has changed then the following is also included:

  - `details` — The full room metadata (as would be returned by the [`/rooms/ROOM`
    endpoint](#get-roomroom)).

  The intention is that this endpoint allows a client to know that it doesn't need to worry about
  updating the room image or pinned messages whenever the `details` field is not included in the
  response.

  # Error status codes

  - 403 Forbidden — if the invoking user does not have access to the room.
  - 404 Forbidden — if room does not exist or user does not have access to it.
 */
export async function getRoomUpdates(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  const infoUpdates = Number(req.params?.['info_updates'])
  if (!roomToken || Array.isArray(roomToken) || !Number.isSafeInteger(infoUpdates) || infoUpdates < 0) {
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
    userIsModerator = userIsGlobalModerator || room.moderators.has(user.sessionID)
    userIsAdmin = userIsModerator || room.admins.has(user.sessionID)
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