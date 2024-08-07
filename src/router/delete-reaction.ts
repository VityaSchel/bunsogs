import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'
import { z } from 'zod'

/**
  Removes a reaction from a post this room.  The user must have read access in the room.  This
  only removes the user's own reaction but does not affect the reactions of other users.

  # URL Parameters

  - `msg_id` — The message ID from which the reaction should be removed.  The message must be in
    this room, must not be deleted, and must be a regular message (i.e. not a whisper).

  - `reaction` — The UTF-8 reaction string.  See the PUT endpoint for encoding information.

  # Return value

  On success returns a 200 status code and a JSON object response body with keys:

  - `"removed"` — boolean value indicating whether the reaction was removed (true) or was not
    present to begin with (false).
  - `"seqno"` — the message's new seqno value.  (See description in the put reaction endpoint).

  # Error status codes

  - 403 Forbidden — returned if the user doesn't have read permission in the room.
  - 404 Not Found — returned if the given post does not exist
  - 400 Bad Request — if the input does not contain a valid reaction

  Note that it is *not* an error to attempt to remove a reaction that does not exist (instead in
  such a case the success response return value includes `"removed": false`).
 */
export async function deleteReaction(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken) {
    return { status: 400, response: null }
  }

  const messageId = Number(req.params?.['message_id'])
  if (!Number.isSafeInteger(messageId) || messageId < 0) {
    return { status: 404, response: null }
  }

  if (req.user === null) {
    return { status: 401, response: null }
  }

  const rooms = getRooms()
  const room = rooms.get(roomToken)
  if (!room) {
    return { status: 404, response: null }
  } else {
    const permissions = await room.getUserPermissions(req.user)
    if (!testPermission(permissions, ['accessible'])) {
      return { status: 404, response: null }
    } else if (!testPermission(permissions, ['read'])) {
      return { status: 403, response: null }
    }
    room.updateUserActivity(req.user)
  }

  const reaction = z.string().min(1).max(12).parse(req.params?.['reaction'])

  const { seqno, removed } = await room.removeReaction({
    messageId,
    reaction,
    user: req.user
  })
  
  return {
    status: 200,
    response: {
      removed,
      seqno
    },
    contentType: 'application/json'
  }
}