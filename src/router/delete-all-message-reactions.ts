import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'
import { z } from 'zod'

/**
  Removes all reactions of all users from a post in this room.  The calling must have moderator
  permissions in the room.  This endpoint can either remove a single reaction (e.g. remove all 🍆
  reactions) by specifying it after the message id (following a /), or remove *all* reactions from
  the post by not including the `/<reaction>` suffix of the URL.

  # URL Parameters

  - `msg_id` — The message ID from which the reactions should be removed.  The message must be in
    this room, must not be deleted, and must be a regular message (i.e. not a whisper).

  - `reaction` — The optional UTF-8 reaction string. If specified then all reactions of this type
    are removed; if omitted then *all* reactions are removed from the post.  See the PUT endpoint
    for encoding information.

  # Return value

  On success returns a 200 status code and a JSON object response body with keys:

  - `"removed"` — the total number of reactions that were deleted.
  - `"seqno"` — the message's new seqno value.  (See description in the put reaction endpoint).

  # Error status codes

  - 403 Forbidden — if not a moderator
  - 404 Not Found — if the referenced post does not exist or is not a regular message
  - 400 Bad Request — if the input does not contain a valid reaction *or* `"all": true`.
 */
export async function deleteAllMessageReactions(req: SogsRequest): Promise<SogsResponse> {
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
    } else if (!permissions.moderator) {
      return { status: 403, response: null }
    }
    room.updateUserActivity(req.user)
  }

  const reaction = z.string().max(12).optional().parse(req.params?.['reaction'])

  const { removed, seqno } = await room.removeAllReactions({
    messageId,
    reaction
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