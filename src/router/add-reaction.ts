import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'
import { z } from 'zod'

/**
  Adds a reaction to the given message in this room.  The user must have read access in the room.

  Reactions are short strings of 1-12 unicode codepoints, typically emoji (or character sequences
  to produce an emoji variant, such as 👨🏿‍🦰, which is composed of 4 unicode "characters"
  but usually renders as a single emoji "Man: Dark Skin Tone, Red Hair").

  # URL Parameters

  - `msg_id` — The message ID on which the reaction should be applied.  The message must be in
    this room, must not be deleted, and must be a regular message (i.e. not a whisper).

  - `reaction` — The reaction to be added, as a UTF-8 string. When making a direct HTTP request it
    is strongly recommended to use a URL-encoded UTF-8 byte sequence (e.g. `%f0%9f%8d%86` for
    `🍆`); many HTTP libraries will do this encoding automatically.  When making an onion request
    you can use the UTF-8 value directly in the path if that is simpler than URL-encoding.  Note
    that regardless of whether URL-encoding is used or not, the X-SOGS-Signature value must sign
    the unencoded value (i.e. `🍆` not `%f0%9f%8d%86`).

  # JSON parameters

  Takes an empty JSON object as the request body.  All values in the object are reserved for
  possible future use.

  # Return value

  On success returns a 200 status code and a JSON object response body with keys:

  - `"added"` — boolean value indicating whether the reaction was added (true) or already present
    (false).
  - `"seqno"` — the message's new seqno value.  This can be used to identify stale reaction
    updates when polling and reactions can race: if an in-progress poll returns a reaction update
    for the message with a seqno less than this value then the client can know that that reaction
    update won't yet have the reaction added here.

  # Error status codes

  - 403 Forbidden — returned if the user doesn't have read permission in the room.
  - 404 Not Found — returned if the given post does not exist
  - 400 Bad Request — if the input does not contain a valid reaction

  Note that it is *not* an error to attempt to add a reaction that the user has already added
  (instead in such a case the success response return value includes `"added": false`).
 */
export async function addReaction(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken || Array.isArray(roomToken)) {
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

  const { added, seqno } = await room.addReaction({
    messageId,
    reaction,
    user: req.user
  })
  return {
    status: 200,
    response: {
      added,
      seqno
    },
    contentType: 'application/json'
  }
}