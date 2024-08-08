/* eslint-disable quotes */
import { Database } from 'bun:sqlite'
import { migrate, type Migration, parseSqlContent } from 'bun-sqlite-migrations'
import type { pinned_messagesEntity, room_moderatorsEntity, roomsEntity, usersEntity } from '@/schema'
import { getServerKey } from '@/keypairs'
import { file } from 'bun'
// @ts-expect-error - Importing SQL files
import initMigration from './migrations/init/init_pysogs_schema.sql' with { type: 'file' }
// @ts-expect-error - Importing SQL files
import migration1 from './migrations/updates/0001_rooms_rate_limit_settings.sql' with { type: 'file' }

export const db = new Database('./db.sqlite3', { create: true })
const newDatabase = await db.query('SELECT name FROM sqlite_master WHERE type="table"').all().length === 0

const migrationsSql: string[] = [
  await file(migration1).text()
]
if (newDatabase) {
  migrationsSql.unshift(await file(initMigration).text())
}
const migrations: Migration[] = migrationsSql.map((sql, i) => ({
  down: '',
  up: parseSqlContent(sql),
  version: newDatabase ? i + 1 : i + 2
}))
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