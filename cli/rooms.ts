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