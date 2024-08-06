/* eslint-disable quotes */
import { Database } from 'bun:sqlite'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { migrate, getMigrations, getDatabaseVersion } from 'bun-sqlite-migrations'
import type { pinned_messagesEntity, room_moderatorsEntity, roomsEntity, usersEntity } from '@/schema'
import { getServerKey } from '@/keypairs'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

export const db = new Database(__dirname + '../db.sqlite3', { create: true })
const newDatabase = await db.query('SELECT name FROM sqlite_master WHERE type="table"').all().length === 0

const migrations = getMigrations(__dirname + '../migrations/updates')
migrations.forEach(migration => migration.version += 1)
if (newDatabase) {
  migrations.unshift(getMigrations(__dirname + '../migrations/init')[0])
}
migrate(db, migrations)

const getUserQuery = await db.query<usersEntity, { $id: number }>('SELECT session_id FROM users WHERE id = :id')

export async function getRoomsFromDb() {
  const rooms = await db.query<roomsEntity, []>('SELECT * FROM rooms').all()
  return rooms
}

export async function getPinnedMessagesFromDb(roomId: number) {
  const pinnedMessages = await db.query<pinned_messagesEntity, { $id: number }>(
    `SELECT message, pinned_at, users.session_id
    FROM pinned_messages JOIN users ON pinned_by = users.id
    WHERE room = $id
    ORDER BY pinned_at`
  ).all({ $id: roomId })
  return await Promise.all(pinnedMessages.map(async pm => {
    const user = await getUserQuery.get({ $id: pm.pinned_by })
    
    return {
      id: pm.message,
      pinnedAt: pm.pinned_at,
      pinnedBy: user!.session_id
    }
  }))
}

export async function getRoomAdminsAndModsFromDb(roomId: number) {
  const roomAdminsAndMods = await db.query<room_moderatorsEntity, { $id: number }>(
    `SELECT session_id, visible_mod, admin FROM room_moderators
    WHERE room = $id
    ORDER BY session_id`
  ).all({ $id: roomId })

  const admins: string[] = []
  const moderators: string[] = []
  const hiddenAdmins: string[] = []
  const hiddenModerators: string[] = []

  for (const adminOrMod of roomAdminsAndMods) {
    if(adminOrMod.session_id == null) continue

    const isSystemUser = adminOrMod.session_id.substring(0, 2) === 'ff' 
      && adminOrMod.session_id.substring(2) === getServerKey().publicKey.toString('hex')
    if (isSystemUser) continue

    if(adminOrMod.admin) {
      if(adminOrMod.visible_mod) {
        admins.push(adminOrMod.session_id)
      } else {
        hiddenAdmins.push(adminOrMod.session_id)
      }
    } else {
      if(adminOrMod.visible_mod) {
        moderators.push(adminOrMod.session_id)
      } else {
        hiddenModerators.push(adminOrMod.session_id)
      }
    }
  }

  return { 
    admins, 
    moderators, 
    hiddenAdmins, 
    hiddenModerators 
  }
}

process.on('SIGINT', () => {
  db.close(false)
  process.exit(0)
})