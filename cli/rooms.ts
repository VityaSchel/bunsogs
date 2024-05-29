import { db } from './db'
import { CreateRoomInput } from './types'
import assert from 'assert'
import type { room_moderatorsEntity, room_usersEntity, roomsEntity, usersEntity } from '../src/schema'

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

export async function createRoom({ token, name, description }: CreateRoomInput): Promise<number> {
  try {
    const row = await db.query<{ id: number }, { $token: string, $name: string, $description: string }>('INSERT INTO rooms(token, name, description) VALUES($token, $name, $description) RETURNING id')
      .get({ $token: token, $name: name, $description: description })
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

export async function getUserIdBySessionID(sessionID: string) {
  const user = await db.query<Pick<usersEntity, 'id'>, { $sessionID: string }>('SELECT id FROM users WHERE session_id = $sessionID')
    .get({ $sessionID: sessionID })
  if(user === null) {
    return null
  } else {
    return user.id
  }
}

export async function getOrCreateUserIdBySessionID(sessionID: string) {
  const userId = await getUserIdBySessionID(sessionID)
  if (userId !== null) {
    return userId
  } else {
    const user = await db.query<Pick<usersEntity, 'id'>, { $id: string }>('INSERT INTO users (session_id) VALUES ($id) RETURNING id')
      .get({ $id: sessionID }) as usersEntity
    return user.id
  }
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


export async function getGlobalAdminsAndModerators() {
  const admins: usersEntity[] = []
  const moderators: usersEntity[] = []
  const rows = await db.query<usersEntity, Record<string, never>>(`
    SELECT * FROM users WHERE moderator
  `).all({})
  for (const row of rows) {
    if (row.admin) {
      admins.push(row)
    } else {
      moderators.push(row)
    }
  }
  return { admins, moderators }
}

export async function removeGlobalAdminOrMod(userId: number) {
  await db.query<null, { $userId: number }>(`
    UPDATE users
    SET admin = FALSE, moderator = FALSE
    WHERE id = $userId
  `).run({ $userId: userId })
}

export async function addGlobalAdmin({ userSessionID, visible }: {
  userSessionID: string
  visible: boolean
}) {
  const userId = await getOrCreateUserIdBySessionID(userSessionID)
  await db.query<null, { $visible: boolean, $userId: number }>(`
    UPDATE users
    SET moderator = TRUE, visible_mod = $visible, admin = TRUE
    WHERE id = $userId
  `).run({ $userId: userId, $visible: visible })
}

export async function addGlobalModerator({ userSessionID, visible }: {
  userSessionID: string
  visible: boolean
}) {
  const userId = await getOrCreateUserIdBySessionID(userSessionID)
  await db.query<null, { $visible: boolean, $userId: number }>(`
    UPDATE users
    SET moderator = TRUE, visible_mod = $visible, admin = FALSE
    WHERE id = $userId
  `).run({ $userId: userId, $visible: visible })
}