import { db } from './db'
import { CreateRoomInput } from './types'
import assert from 'assert'
import type { room_moderatorsEntity, roomsEntity, user_permission_overridesEntity, usersEntity } from '../src/schema'
import { getOrCreateUserIdBySessionID } from './global-settings'
import { PermsFlags } from './utils'

export async function getRooms() {
  const rows = await db.query<roomsEntity, Record<string, never>>('SELECT * FROM rooms ORDER BY id')
    .all({})
  return rows
}

export async function getRoomByToken(token: string) {
  const room = await db.query<roomsEntity, { $token: string }>('SELECT * FROM rooms WHERE token = $token')
    .get({ $token: token })
  return room
}

export async function createRoom({ token, name, description, permissions }: CreateRoomInput): Promise<number> {
  try {
    const row = await db.query<{ id: number }, { $token: string, $name: string, $description: string, $read: boolean, $write: boolean, $accessible: boolean, $upload: boolean }>(`
      INSERT INTO rooms(token, name, description, read, accessible, write, upload) VALUES($token, $name, $description, $read, $write, $accessible, $upload) RETURNING id
    `)
      .get({ 
        $token: token,
        $name: name,
        $description: description,
        $read: permissions.includes('r'),
        $write: permissions.includes('w'),
        $accessible: permissions.includes('a'),
        $upload: permissions.includes('u'),
      })
    assert(row)
    return row.id
  } catch(e) {
    throw new Error(`Room with token \`${token}\` already exists`)
  }
}

export async function setRoomName(roomId: number, value: string) {
  await db.query<unknown, { $id: number, $name: string }>('UPDATE rooms SET name = $name WHERE id = $id')
    .run({ $id: roomId, $name: value })
}

export async function setRoomDescription(roomId: number, value: string) {
  await db.query<unknown, { $id: number, $description: string | null }>('UPDATE rooms SET description = $description WHERE id = $id')
    .run({ $id: roomId, $description: value || null })
}

export async function deleteRoom(token: string) {
  await db.transaction(token => {
    db.prepare<null, { $token: string }>(`
          DELETE FROM user_reactions WHERE reaction IN (
            SELECT id FROM reactions WHERE message IN (
              SELECT id FROM messages WHERE room = (
                SELECT id FROM rooms WHERE token = $token)))
        `).run({ $token: token })
    db.prepare<null, { $token: string }>('DELETE FROM rooms WHERE token = $token')
      .run({ $token: token })
  })(token)
}

export async function getMessagesSize(roomId: number): Promise<{ messages: number; sizeInBytes: number }> {
  const size = await db.query<{ 'COUNT(*)': number, 'COALESCE(SUM(data_size), 0)': number }, { $roomId: number }>(`
    SELECT COUNT(*), COALESCE(SUM(data_size), 0)
    FROM messages
    WHERE room = $roomId AND data IS NOT NULL AND NOT filtered
  `).get({ $roomId: roomId })
  if (size === null) throw new Error('Couldn\'t retrieve messages size for room with id ' + roomId)
  return { messages: size['COUNT(*)'], sizeInBytes: size['COALESCE(SUM(data_size), 0)'] }
}

type GetRoomAdminsAndModeratorsReturnType = Pick<room_moderatorsEntity, 'session_id' | 'visible_mod' | 'admin' | 'global_moderator'>
export async function getRoomAdminsAndModerators(roomId: number) {
  const admins: GetRoomAdminsAndModeratorsReturnType[] = []
  const moderators: GetRoomAdminsAndModeratorsReturnType[] = []
  const rows = await db.query<GetRoomAdminsAndModeratorsReturnType, { $roomId: number }>(`
    SELECT session_id, visible_mod, admin FROM room_moderators
    WHERE room = $roomId
    ORDER BY session_id
  `).all({ $roomId: roomId })
  for(const row of rows) {
    if (!row.global_moderator) {
      if(row.admin) {
        admins.push(row)
      } else {
        moderators.push(row)
      }
    }
  }
  return { admins, moderators }
}

export async function removeAdminOrModFromRoom({ roomId, userId }: {
  roomId: number
  userId: number
}) {
  await db.query<null, { $roomId: number, $userId: number }>(`
    UPDATE user_permission_overrides SET admin = FALSE, moderator = FALSE, visible_mod = FALSE 
    WHERE room = $roomId AND "user" = $userId
  `)
    .run({ $roomId: roomId, $userId: userId })
}

export async function addAdmin({ roomId, userSessionID, visible }: {
  roomId: number
  userSessionID: string
  visible: boolean
}) {
  const userId = await getOrCreateUserIdBySessionID(userSessionID)
  await db.query<null, { $roomId: number, $userId: number, $visible: boolean }>(`
    INSERT INTO user_permission_overrides
      (room,
      "user",
      moderator,
      admin,
      visible_mod)
    VALUES ($roomId, $userId, TRUE, TRUE, $visible)
    ON CONFLICT (room, "user") DO UPDATE SET
      moderator = excluded.moderator,
      admin = excluded.admin,
      visible_mod = excluded.visible_mod
  `).run({ $roomId: roomId, $userId: userId, $visible: visible })
}

export async function addModerator({ roomId, userSessionID, visible }: {
  roomId: number
  userSessionID: string
  visible: boolean
}) {
  const userId = await getOrCreateUserIdBySessionID(userSessionID)
  await db.query<null, { $roomId: number, $userId: number, $visible: boolean }>(`
    INSERT INTO user_permission_overrides
      (room,
      "user",
      moderator,
      admin,
      visible_mod)
    VALUES ($roomId, $userId, TRUE, FALSE, $visible)
    ON CONFLICT (room, "user") DO UPDATE SET
      moderator = excluded.moderator,
      admin = excluded.admin,
      visible_mod = excluded.visible_mod
  `).run({ $roomId: roomId, $userId: userId, $visible: visible })
}

export async function roomBan({ roomId, userId }: {
  roomId: number, 
  userId: number 
}, options?: { timeoutInSeconds: number }) {
  await db.query<null, { $roomId: number, $userId: number }>(`
    INSERT INTO user_permission_overrides (room, "user", banned, moderator, admin)
      VALUES ($roomId, $userId, TRUE, FALSE, FALSE)
    ON CONFLICT (room, "user") DO
      UPDATE SET banned = TRUE, moderator = FALSE, admin = FALSE
  `).run({ $userId: userId, $roomId: roomId })
  await db.query<null, { $roomId: number, $userId: number }>(`
    DELETE FROM user_ban_futures WHERE room = $roomId AND "user" = $userId
  `).run({ $roomId: roomId, $userId: userId })
  if(options?.timeoutInSeconds !== undefined) {
    await db.query<null, { $roomId: number, $userId: number, $endsAt: number }>(`
      INSERT INTO user_ban_futures
      (room, "user", banned, at) VALUES ($roomId, $userId, FALSE, $endsAt)
    `).run({ $roomId: roomId, $userId: userId, $endsAt: Math.floor(Date.now() / 1000) + options.timeoutInSeconds })
  }
}

export async function roomUnban({ roomId, userId }: {
  roomId: number, 
  userId: number 
}) {
  await db.query<null, { $roomId: number, $userId: number }>(`
    UPDATE user_permission_overrides SET banned = FALSE
    WHERE room = $roomId AND "user" = $userId AND banned
  `).run({ $userId: userId, $roomId: roomId })
}

export async function getRoomBans(roomId: number) {
  return await db.query<Pick<usersEntity, 'session_id'>, { $roomId: number }>(`
    SELECT session_id
    FROM user_permission_overrides upo JOIN users ON upo."user" = users.id
    WHERE room = $roomId AND upo.banned
  `).all({ $roomId: roomId })
}

/**
 * Queries the number of active users in the past `cutoff` seconds.  This is like the
 * `active_users` property except that it always queries for the instantaneous value
 * (`active_users` is only updated every few seconds in sogs.cleanup), and supports values
 * other than the default activity threshold.
 * Note that room activity records are periodically removed, so specifying a cutoff above
 * config.ROOM_ACTIVE_PRUNE_THRESHOLD days is useless.
 */
export async function activeUsersLast(roomId: number, periodInSeconds: number) {
  return await db.query('SELECT COUNT(*) FROM room_users WHERE room = $roomId AND last_active >= $since')
    .get({ $roomId: roomId, $since: Math.floor(Date.now() / 1000) - periodInSeconds })
}

export async function setRoomPermissionOverride({ roomId, userId, permissions }: {
  roomId: number
  userId: number
  permissions: PermsFlags
}) {
  return await db.query<null, { $roomId: number, $userId: number, $read: boolean | null, $accessible: boolean | null, $write: boolean | null, $upload: boolean | null }>(`
    INSERT INTO user_permission_overrides (room, "user", read, accessible, write, upload)
    VALUES ($roomId, $userId, $read, $accessible, $write, $upload)
    ON CONFLICT (room, "user") DO UPDATE SET
      read = $read, accessible = $accessible, write = $write, upload = $upload
  `).run({ 
    $roomId: roomId, 
    $userId: userId, 
    $read: permissions.read || null,
    $accessible: permissions.accessible || null,
    $write: permissions.write || null,
    $upload: permissions.upload || null,
  })
}

export async function getRoomPermissionsOverrides(roomId: number) {
  return await db.query<Pick<usersEntity, 'session_id'> & user_permission_overridesEntity, { $roomId: number }>(`
    SELECT session_id, upo.* FROM user_permission_overrides upo
    JOIN users ON "user" = users.id
    WHERE room = $roomId 
      AND (read IS NOT NULL OR accessible IS NOT NULL OR write IS NOT NULL OR upload IS NOT NULL)
  `).all({ $roomId: roomId })
}

export async function getUserRoomPermissionOverrides({ roomId, userId }: {
  roomId: number, 
  userId: number 
}) {
  return await db.query<user_permission_overridesEntity, { $roomId: number, $userId: number }>(`
    SELECT * from user_permission_overrides WHERE "user" = $userId AND room = $roomId
  `).get({ $roomId: roomId, $userId: userId })
}