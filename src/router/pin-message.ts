import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'
import { z } from 'zod'

/**
  Adds a pinned message to this room.

  Note that existing pinned messages are *not* removed: the new message is added to the pinned
  message list.  (If you want to remove existing pins then build a sequence request that first
  calls .../unpin/all).

  The user must have admin (not just moderator) permissions in the room in order to pin messages.

  Pinned messages that are already pinned will be re-pinned (that is, their pin timestamp and
  pinning admin user will be updated).  Because pinned messages are returned in pinning-order this
  allows admins to order multiple pinned messages in a room by re-pinning (via this endpoint) in
  the order in which pinned messages should be displayed.

  # URL Parameters

  - `msg_id` — The message ID of a post in this room that should be pinned.  The message must not
    be deleted or a whisper.

  # JSON parameters

  Takes a JSON object as the request body.  Currently empty (but that may change in the future).

  # Return value

  On success returns a 200 status code and returns a JSON object as response containing keys:

  - `info_updates` -- the new info_updates value of the room; a client can use this to avoid
    race conditions with room info polling that might not yet include the updated value(s).

  # Error status codes

  - 403 Forbidden — returned if the invoking user does not have admin permission in this room.

  - 404 Not Found — returned if the given post was not found in this room or is ineligible for
    pinning (e.g. a whisper or deleted post).
 */
export async function pinMessage(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken || Array.isArray(roomToken)) {
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

  const pinnedMessageId = z.number().int().nonnegative().parse(Number(req.params?.['message_id']))
  
  await room.pin({ messageId: pinnedMessageId, pinnedBy: req.user })

  return {
    status: 200,
    response: {
      info_updates: room.infoUpdates
    }
  }
}