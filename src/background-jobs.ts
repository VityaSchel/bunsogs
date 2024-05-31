import { getConfig, type Config } from '@/config'
import { db } from '@/db'
import { noncesExpirations, noncesUsed } from '@/nonce'
import { getRooms } from '@/room'
import type { user_ban_futuresEntity } from '@/schema'
import fs from 'fs/promises'
import path from 'path'

let config: Config

const intervals = {
  /** Interval in ms for refreshing rooms info from database (such as name, description, etc) */
  dataRefresh: 2000,
  /** Interval in ms for cleaning up database */
  dbCleanup: 10000
}

export function startBackgroundJobs() {
  config = getConfig()
  startRefreshJobs()
  startCleanupJobs()
}

async function startRefreshJobs() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await Promise.all(Array.from(await getRooms().values()).map(room => room.refresh()))
    await new Promise(resolve => setTimeout(resolve, intervals.dataRefresh))
  }
}

async function startCleanupJobs() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await Promise.all([
      pruneFiles(),
      pruneMessagesHistory(),
      pruneExpiredDms(),
      pruneRoomActivity(),
      expireNonceHistory(),
      applyPermissionsUpdates()
    ])
    await new Promise(resolve => setTimeout(resolve, intervals.dbCleanup))
  }
}

async function pruneFiles() {
  const rows = await db.query<{ path: string }, { $expiry: number }>(`
    DELETE FROM files WHERE expiry < $expiry RETURNING path
  `).all({ $expiry: Math.floor(Date.now() / 1000) })
  const paths = rows.map(r => r.path)
  for(const filepath of paths) {
    try {
      await fs.unlink(path.resolve(__dirname, '../', filepath))
    } catch(e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
        continue
      } else {
        console.error('Error while pruning old uploaded file:', e)
      }
    }
  }
}

async function pruneMessagesHistory() {
  await db.query<null, { $t: number }>('DELETE FROM message_history WHERE replaced < $t')
    .run({ $t: Math.floor(Date.now() / 1000) - 30 * 86400.0 })
}

async function pruneExpiredDms() {
  await db.query<null, { $now: number }>('DELETE FROM inbox WHERE expiry < $now')
    .run({ $now: Math.floor(Date.now() / 1000) })
}

async function pruneRoomActivity() {
  await db.query<null, { $t: number }>('DELETE FROM room_users WHERE last_active < $t')
    .run({ $t: Math.floor(Date.now() / 1000) - config.active_prune_threshold * 24 * 60 * 60 })
  await db.query<null, { $since: number }>(`
    UPDATE rooms SET active_users = (
    SELECT COUNT(*) FROM room_users WHERE room = rooms.id AND last_active >= $since)
  `).run({ $since: Math.floor(Date.now() / 1000) - config.active_threshold })
}

async function expireNonceHistory() {
  // Bunsogs stores nonces in-memory
  for(const [nonce, expiration] of noncesExpirations.entries()) {
    if(Date.now() > expiration) {
      noncesUsed.delete(nonce)
    }
  }
}

async function applyPermissionsUpdates() {
  const $now = Math.floor(Date.now() / 1000)
  await db.query<null, { $now: number }>(`
    INSERT INTO user_permission_overrides (room, "user", read, write, upload)
    SELECT f.room, f."user",
        CASE WHEN f.read IS NULL THEN o.read ELSE NULLIF(f.read, r.read) END,
        CASE WHEN f.write IS NULL THEN o.write ELSE NULLIF(f.write, r.write) END,
        CASE WHEN f.upload IS NULL THEN o.upload ELSE NULLIF(f.upload, r.upload) END
      FROM user_permission_futures f
        JOIN rooms r ON f.room = r.id
        LEFT JOIN user_permission_overrides o ON f.room = o.room AND f."user" = o."user"
      WHERE at <= $now
      ORDER BY at
    ON CONFLICT (room, "user") DO UPDATE SET
      read = excluded.read, write = excluded.write, upload = excluded.upload
  `).get({ $now })
  await db.query<null, { $now: number }>('DELETE FROM user_permission_futures WHERE at <= $now')
    .run({ $now })

  let globalBanUpdates = 0, roomBanUpdates = 0
  const bans = await db.query<Pick<user_ban_futuresEntity, 'user' | 'room' | 'banned'>, { $now: number }>(`
    SELECT "user", room, banned FROM user_ban_futures WHERE at <= $now ORDER BY at
  `).all({ $now })
  for(const { user, room, banned } of bans) {
    if(room === null) {
      await db.query<null, { $userId: number, $banned: boolean }>(`
        UPDATE users SET banned = $banned WHERE id = $userId
      `)
        .run({ $userId: user, $banned: banned })
      globalBanUpdates++
    } else {
      await db.query<null, { $roomId: number, $userId: number, $banned: boolean }>(`
        INSERT INTO user_permission_overrides (room, "user", banned)
        VALUES ($roomId, $userId, $banned)
        ON CONFLICT (room, "user") DO UPDATE SET banned = excluded.banned
      `).run({ $roomId: room, $userId: user, $banned: banned })
      roomBanUpdates++
    }
  }

  if(globalBanUpdates > 0 || roomBanUpdates > 0) {
    await db.query<null, { $now: number }>('DELETE FROM user_ban_futures WHERE at <= $now')
      .run({ $now })
  }
}