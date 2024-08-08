import { db } from '@/db'
import type { usersEntity } from '@/schema'
import { SQLiteError } from 'bun:sqlite'

export class User {
  id = -1
  sessionID = ''
  banned = false
  admin = false
  moderator = false
  visibleMod = false
  created = 0
  lastActive = 0

  constructor(options:
    { id: number } |
    { sessionID: string }
  ) {
    if ('sessionID' in options) {
      this.sessionID = options.sessionID
    } else if('id' in options) {
      this.id = options.id
    } else {
      throw new Error('Invalid options')
    }
  }

  async refresh(options?: { autovivify?: boolean }): Promise<void> {
    let userDb: usersEntity
    if (this.id === -1) {
      const sessionID = this.sessionID
      if (!sessionID) {
        throw new Error('User is not initialized')
      }

      const result = await db.query<usersEntity, { $sessionID: string }>('SELECT * FROM users WHERE session_id = $sessionID')
        .get({ $sessionID: sessionID })
      if (result) {
        userDb = result
      } else {
        if (sessionID && options?.autovivify) {
          try {
            userDb = await db.query<usersEntity, { $id: string }>('INSERT INTO users (session_id) VALUES ($id) RETURNING *')
              .get({ $id: sessionID }) as usersEntity
          } catch(e) {
            if (e instanceof SQLiteError && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              userDb = await db.query<usersEntity, { $sessionID: string }>('SELECT * FROM users WHERE session_id = $sessionID')
                .get({ $sessionID: sessionID })!
            } else {
              throw e
            }
          }
        } else {
          throw new Error('User not found')
        }
      }
    } else {
      const result = await db.query<usersEntity, { $id: number }>('SELECT * FROM users WHERE id = $id')
        .get({ $id: this.id })
      if (!result) throw new Error('User not found')
      userDb = result
    }

    this.admin = userDb.admin ? true : false
    this.moderator = userDb.moderator ? true : false
    this.visibleMod = userDb.visible_mod ? true : false
    this.banned = userDb.banned ? true : false
    this.created = userDb.created
    this.lastActive = userDb.last_active
    this.sessionID = userDb.session_id
    this.id = userDb.id
  }

  async ban({ timeout }: {
    timeout: number | undefined
  }) {
    await db.query<null, { $userId: number }>('UPDATE users SET banned = TRUE WHERE id = $userId')
      .run({ $userId: this.id })
    await db.query<null, { $userId: number }>('DELETE FROM user_ban_futures WHERE room IS NULL AND "user" = $userId')
      .run({ $userId: this.id })
    if (timeout !== undefined) {
      await db.query<null, { $userId: number, $at: number }>(`
        INSERT INTO user_ban_futures
        ("user", room, banned, at) VALUES ($userId, NULL, FALSE, $at)
      `)
        .run({ $userId: this.id, $at: timeout })
    }
  }

  async unban() {
    await db.query<null, { $userId: number }>('UPDATE users SET banned = FALSE WHERE id = $userId')
      .run({ $userId: this.id })
    await db.query<null, { $userId: number }>('DELETE FROM user_ban_futures WHERE room IS NULL AND "user" = $userId')
      .run({ $userId: this.id })
  }

  async setGlobalAdmin({ visible }: { visible: boolean }) {
    await db.query<null, { $visible: boolean, $userId: number }>(`
      UPDATE users
      SET moderator = TRUE, visible_mod = $visible, admin = TRUE
      WHERE id = $userId
    `).run({ $visible: visible, $userId: this.id })
    this.admin = true
    this.moderator = true
  }

  async setGlobalModerator({ visible }: { visible: boolean }) {
    await db.query<null, { $visible: boolean, $userId: number }>(`
      UPDATE users
      SET moderator = TRUE, visible_mod = $visible
      WHERE id = $userId
    `).run({ $visible: visible, $userId: this.id })
    this.moderator = true
  }

  async removeGlobalAdmin() {
    await db.query<null, { $userId: number }>(`
      UPDATE users
      SET admin = FALSE
      WHERE id = $userId
    `).run({ $userId: this.id })
    this.admin = false
    this.moderator = false
  }

  async removeGlobalModerator() {
    await db.query<null, { $userId: number }>(`
      UPDATE users
      SET admin = FALSE, moderator = FALSE
      WHERE id = $userId
    `).run({ $userId: this.id })
    this.moderator = false
  }
}