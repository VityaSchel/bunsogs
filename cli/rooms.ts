import { db } from './db'
import { CreateRoomInput } from './types'
import assert from 'assert'
import type { roomsEntity } from '../src/schema'

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
