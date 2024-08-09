import { db } from '@/db'
import { getServerKey } from '@/keypairs'
import { mapRoomEntityToRoomInstance, Room } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { type roomsEntity } from '@/schema'
import { User } from '@/user'
import { blindSessionId } from '@session.js/blinded-session-id'
import { z } from 'zod'

/**
  Applies a ban of a user from specific rooms, or from the server globally.

  The invoking user must have moderator (or admin) permission in all given rooms when specifying
  `rooms`, and must be a global server moderator (or admin) if using the `global` parameter.

  # Body Parameters

  Takes a JSON object as body with the following keys:

  - `rooms` — List of one or more room tokens from which the user should be banned. The
    invoking user must be a moderator of all of the given rooms.

      This may be set to the single-element list ["*"] to ban the user from all rooms in which the
      invoking user has moderator permissions (the call will succeed if the calling user is a
      moderator in at least one channel).

      Exclusive of `global`.

  - `global` — boolean value: if true then apply the ban at the server-wide global level: the user
    will be banned from the server entirely—not merely from all rooms, but also from calling any
    other server request.  The invoking user must be a global moderator in order to add a global
    ban.

      Exclusive of `rooms`.

  - `timeout` — optional numeric value specifying a time limit on the ban, in seconds.  The
    applied ban will expire and be removed after the given interval.  If omitted (or `null`) then
    the ban is permanent.

      If this endpoint is called multiple times then the `timeout` of the last call takes effect.
      For example, a permanent ban can be replaced with a time-limited ban by calling the endpoint
      again with a `timeout` value, and vice versa.

  The request must include exactly one non-null value of `rooms` and `global`.

  The user's messages are not deleted by this request.  In order to ban and delete all messages
  use the [`/sequence`](#post-sequence) endpoint to bundle a `/user/.../ban` with a
  [`/rooms/all/...`](#delete-roomsallsid) request.

  # Return value

  On success returns a 200 status code with an empty JSON object as body.

  # Error status codes

  400 Bad Request — if invalid parameters (or parameter combinations) are provided, such as an
  empty room list.

  403 Forbidden — if the invoking user does not have moderator access to all of the given `rooms`
  (or, for a global moderator request, is not a global moderator).

  404 Not Found — if one or more of the given `rooms` tokens do not exist.
 */
export async function banUser(req: SogsRequest): Promise<SogsResponse> {
  const sessionIdParam = await z.string().regex(/^(05|15)[a-f0-9]+$/).length(66).safeParseAsync(req.params?.['session_id'])
  if (!sessionIdParam.success) {
    return { status: 400, response: null }
  }
  const sessionId = sessionIdParam.data.startsWith('05')
    ? blindSessionId({ sessionId: sessionIdParam.data, serverPk: getServerKey().publicKey.toString('hex') })
    : sessionIdParam.data

  const user = new User({ sessionID: sessionId })
  await user.refresh({ autovivify: true })

  if(req.user === null)  {
    return { status: 401, response: null }
  }

  const body = await z.object({
    rooms: z.array(z.string()).min(1).optional(),
    global: z.boolean().optional(),
    timeout: z.number().int().positive().nullable().optional(),
  })
    .and(z.union([
      z.object({ rooms: z.undefined(), global: z.boolean() }),
      z.object({ rooms: z.array(z.string()).min(1), global: z.undefined() }),
    ]))
    .safeParseAsync(req.body)

  if(!body.success) {
    return { status: 400, response: null }
  }

  if(req.user.id == user.id) {
    return { status: 400, response: null }
  }

  if(user.admin || user.moderator) {
    return { status: 403, response: null }
  }
  
  if(body.data.rooms !== undefined) {
    const rooms: Room[] = []
    if(body.data.rooms![0] === '*') {
      const roomsEntities = await db.query<roomsEntity, { $user: number }>(`
        SELECT rooms.* FROM user_permissions perm JOIN rooms ON rooms.id = room
        WHERE "user" = $user AND perm.moderator
      `).all({ $user: req.user.id })
      for (const roomEntity of roomsEntities) {
        const room = await mapRoomEntityToRoomInstance(roomEntity)
        rooms.push(room)
      }
    } else {
      for (const roomToken of body.data.rooms) {
        const room = await db.query<roomsEntity, { $token: string }>(`
          SELECT * FROM rooms WHERE token = $token
        `).get({ $token: roomToken })
        if(room === null) {
          return { status: 404, response: null }
        }
        rooms.push(await mapRoomEntityToRoomInstance(room))
      }
    }
    for (const room of rooms) {
      const reqUserPermissions = await room.getUserPermissions(req.user)
      const userPermissions = await room.getUserPermissions(user)
      if (!req.user.admin && !req.user.moderator && !reqUserPermissions.admin && !reqUserPermissions.moderator) {
        return { status: 403, response: null }
      }
      if (userPermissions.admin || userPermissions.moderator) {
        if(!reqUserPermissions.admin) {
          return { status: 403, response: null }
        }
      }
      await room.banUser({ user: user, timeout: body.data.timeout ?? undefined })
    }
  } else {
    if(req.user.admin || req.user.moderator) {
      await user.ban({ timeout: body.data.timeout ?? undefined })
    } else {
      return {
        status: 403,
        response: null
      }
    }
  }

  return {
    status: 200,
    response: {}
  }
}