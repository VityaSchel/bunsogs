import { db } from '@/db'
import type { usersEntity } from '@/schema'

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
          userDb = await db.query<usersEntity, { $id: string }>('INSERT INTO users (session_id) VALUES ($id) RETURNING *')
            .get({ $id: sessionID }) as usersEntity
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

    this.admin = userDb.admin
    this.moderator = userDb.moderator
    this.visibleMod = userDb.visible_mod
    this.banned = userDb.banned
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
}