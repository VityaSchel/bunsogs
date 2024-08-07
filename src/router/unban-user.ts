import { db } from '@/db'
import { getServerKey } from '@/keypairs'
import { mapRoomEntityToRoomInstance, Room } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { type roomsEntity } from '@/schema'
import { User } from '@/user'
import { blindSessionId } from '@session.js/blinded-session-id'
import { z } from 'zod'

/**
  Appoints or removes a moderator or admin.

  This endpoint is used to appoint or remove moderator/admin permissions either for specific rooms
  or for server-wide global moderator permissions.

  Admins/moderators of rooms can only be appointed or removed by a user who has admin permissions
  in the room (including global admins).  Global admins/moderators may only be appointed by a
  global admin.

  # Body Parameters

  Takes a JSON object as body with the following keys:

  - `rooms` — List of one or more room tokens to which the moderator status should be applied. The
    invoking user must be an admin of all of the given rooms.

      This may be set to the single-element list `["*"]` to add or remove the moderator from all
      rooms in which the current user has admin permissions (the call will succeed if the calling
      user is an admin in at least one room).

      Exclusive of `global`.

  - `global` — boolean value: if true then apply the change at the server-wide global level: the
    user will be added/removed as a global moderator/admin.  The invoking user must be a global
    admin in order to control global mods/admins.

      Exclusive of `rooms`.

  - `moderator` — optional boolean value indicating that this user should have moderator
    permissions added (`true`), removed (`false`), or left alone (omitted or `null`).  At least
    one non-null value of `moderator` or `admin` must be provided.

  - `visible` — boolean specifying whether the moderator/admin should be made publicly visible as
    a moderator/admin of the room(s) (if `true`) or hidden (`false`).  Hidden moderators/admins
    still have all the same permissions as visible moderators/admins, but are visible only to
    other moderators/admins; regular users in the room will not know their moderator status.

      The default behaviour if this field is omitted (or `null`) is to make the moderator visible
      when adding as a room moderator/admin, and hidden if adding as a global moderator/admin.

  - `admin` — boolean value indicating that this user should have admin permissions added
    (`true`), removed (`false`), or left alone (omitted or `null`).  Note that granting admin
    permission automatically includes granting moderator permission, and thus it is an error to
    use `admin=true` with `moderator=false`.

  The request must include exactly one non-null value of `rooms` and `global`, and at least one
  non-null value of `moderator` and `admin`.

  Different combinations of `moderator` and `admin` true/false/omitted values interact as follows
  (note that an omitted value and an explicit `null` value are equivalent):

  - `admin=true` — Adds admin permissions (and, implicitly, moderator permissions).
  - `admin=true`, `moderator=true` — Same as above (adds admin permission).
  - `admin=false`, `moderator=true` — Removes admin permission, if present, and assigns moderator
    permission.  This both demotes an admin to a moderator, and promotes a non-moderator to a
    moderator.
  - `admin=false`, — Removes admin permission, if present, but leaves moderator permissions alone.
    This effectively "demotes" the user from admin to moderator, but will not promote a
    non-moderator/admin to a moderator.
  - `moderator=true` — Adds moderator permissions.  If admin permission is already present, it
    remains in effect.
  - `moderator=false` — Removes moderator **and admin** permissions, if present.
  - `moderator=false`, `admin=false` — Same as above (removes both).
  - `admin=true`, `moderator=false` — Error: because admin implies moderator, this is impossible
    to fulfill.
  - both null — Error: at least one must have a non-null value.

  If an admin or moderator has both global and room-specific moderation permissions then their
  actual moderator status will be taken as the greater of the two.  That is, they will have room
  admin permissions if listed as an admin of *either* the room or global server.

  Visibility, however, is determined by the room-specific visibility setting, regardless of the
  global setting.  (So, for example, a hidden global admin with moderator powers in a room will
  appears as a visible admin of the room, and a global visible admin listed as a room hidden
  moderator will be effectively a hidden admin of the room).

  # Return value

  On success returns a 200 status code with JSON object as body containing keys:

  - "info_updates": this is an object where each key is a room token, and each value is that
    room's new `info_updates` value.  For a request making changes to room-level mods (i.e. using
    the `rooms` parameter) this will be the new `info_updates` value for each of the given rooms.
    For global moderator changes this will contain the new info_updates value of *all* rooms on
    the server (because all rooms are updated when a global mod is added/removed).

    These values can be useful to track whether possibly-concurrent room polling requests are
    expected to have the moderator changes applied yet.

  # Error status codes

  400 Bad Request — if invalid parameters (or parameter combinations) are provided, such as an
  empty room list, or not specifying either moderator or admin parameters.

  403 Forbidden — if the invoking user does not have admin access to all of the given `rooms` (or,
  for a global moderator request, is not a global admin).

  404 Not Found — if one or more of the given `rooms` tokens do not exist.
 */
export async function unbanUser(req: SogsRequest): Promise<SogsResponse> {
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
    global: z.boolean().optional()
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
      if (!req.user.admin && !req.user.moderator && !reqUserPermissions.admin && !reqUserPermissions.moderator) {
        return { status: 403, response: null }
      }
      await room.unbanUser({ user: user })
    }
  } else {
    if(req.user.admin || req.user.moderator) {
      await user.unban()
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