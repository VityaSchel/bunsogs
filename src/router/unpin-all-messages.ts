import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'

/**
  Removes *all* pinned messages from this room.

  The user must have admin (not just moderator) permissions in the room.

  # JSON parameters

  Takes an empty JSON object as the request body.

  # Return value

  On success returns a 200 status code with an JSON object as response body containing keys:

  - `unpinned` - count of how many pinned messages were removed.
  - `info_updates` - new `info_updates` property for the room.  This value is only incremented by
    this operation if at least one message was found and unpinned (i.e. if `unpinned > 0`).

  # Error status codes

  - 403 Forbidden — returned if the invoking user does not have admin permission in this room.
 */
export async function unpinAllMessages(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken) {
    return { status: 400, response: null }
  }

  if (req.user === null) {
    return { status: 401, response: null }
  }

  const rooms = getRooms()
  const room = rooms.get(roomToken)
  if (!room) {
    return {
      status: 404,
      response: null
    }
  } else {
    const permissions = await room.getUserPermissions(req.user)
    if (!testPermission(permissions, ['accessible'])) {
      return { status: 404, response: null }
    } else if (!req.user.admin && !permissions.admin) {
      return { status: 403, response: null }
    }
    room.updateUserActivity(req.user)
  }

  const unpinned = await room.unpinAll()

  return {
    status: 200,
    response: {
      unpinned: unpinned,
      info_updates: room.infoUpdates
    }
  }
}