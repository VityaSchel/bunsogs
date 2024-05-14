/* eslint-disable quotes */
import { Database } from 'bun:sqlite'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { migrate, getMigrations } from 'bun-sqlite-migrations'
import type { roomsEntity } from '@/schema'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const db = new Database(__dirname + '../db.sqlite3', { create: true })
migrate(db, getMigrations(__dirname + '../migrations'))

export async function getRooms() {
  const rooms = await db.query<roomsEntity, any>('SELECT * FROM rooms').all()
  console.log(rooms)
}

process.on('SIGINT', () => {
  db.close(false)
  process.exit(0)
})