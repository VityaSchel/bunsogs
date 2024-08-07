import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'
import { z } from 'zod'

/**
  Returns the list of all reactors who have added a particular reaction to a particular message.

  # URL Parameters

  - `msg_id` — The message ID in this room for which reactions are being queried.  The message
    must be in this room, must not be deleted, and must be a regular message (i.e. not a whisper).

  - `reaction` — The UTF-8 reaction string.  See the PUT endpoint for encoding information.

  # Query Parameters

  - `limit` — if specified this indicates the maximum number of reactor IDs to return.  If omitted
    or specified as <= 0 then there is no limit.

  # Return value

  On success returns a 200 status code with a body consisting of a JSON list of [session ID,
  timestamp] pairs containing the users who added this reaction, and the unix timestamp at which
  they added the reaction.

  # Error status codes

  - 403 Forbidden — if the caller does not have read access to the room
  - 404 Not Found — if the referenced post does not exist or is not a regular message
  - 400 Bad Request — if the `reaction` value is not a valid reaction
 */
export async function getMessageReactionReactors(req: SogsRequest): Promise<SogsResponse> {
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
  let limit = req.searchParams?.['limit'] ? Number(req.searchParams['limit']) : undefined
  if (typeof limit === 'number' && limit < 0) {
    limit = undefined
  }

  const reactors = await room.getReactors({
    messageId,
    reaction,
    limit: limit,
    sessionIds: true
  })
  return {
    status: 200,
    response: reactors,
    contentType: 'application/json'
  }
}