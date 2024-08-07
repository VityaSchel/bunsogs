import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'
import { z } from 'zod'

/**
  Remove a message from this room's pinned message list.

  The user must have admin (not just moderator) permissions in the room.

  # URL Parameters

  - `msg_id` — The message ID of a pinned post in this room that should be unpinned.  If the
    message ID is not currently pinned then this endpoint does nothing.

  # JSON parameters

  Takes a JSON object as the request body.  Currently empty (but that may change in the future).

  # Return value

  On success returns a 200 status code and returns an JSON object as response body containing
  keys:

  - `unpinned` - boolean value indicating whether the message was pinned and has now been unpinned
    (true), or was already unpinned (false).
  - `info_updates` - the new info_updates value for the room.  This value will only change if the
    given message was actually pinned (i.e. it does not increment when `unpinned` is false).

  # Error status codes

  - 403 Forbidden — returned if the invoking user does not have admin permission in this room.
 */
export async function unpinMessage(req: SogsRequest): Promise<SogsResponse> {
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

  const pinnedMessageId = z.number().int().nonnegative().parse(req.params?.['message_id'])
  
  await room.unpin({ messageId: pinnedMessageId })

  return {
    status: 200,
    response: {
      info_updates: room.infoUpdates
    }
  }
}