import { usersEntity } from '../src/schema'
import { db } from './db'
import { PermsFlags } from './utils'

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

export async function getUserIdBySessionID(sessionID: string) {
  const user = await db.query<Pick<usersEntity, 'id'>, { $sessionID: string }>('SELECT id FROM users WHERE session_id = $sessionID')
    .get({ $sessionID: sessionID })
  if (user === null) {
    return null
  } else {
    return user.id
  }
}

export async function getGlobalBans() {
  const bannedUsers = await db.query<usersEntity, Record<string, never>>('SELECT * FROM users WHERE banned = TRUE')
    .all({})
  return bannedUsers
}

export async function globalBan(userId: number, options?: { timeoutInSeconds?: number }) {
  const user = await db.query<Pick<usersEntity, 'moderator'>, { $userId: number }>('SELECT moderator FROM users WHERE id = $userId')
    .get({ $userId: userId })
  if(user === null) throw new Error('User does not exists')
  else if(user.moderator) throw new Error('User is global admin/moderator')

  await db.query<null, { $userId: number }>('UPDATE users SET banned = TRUE WHERE id = $userId')
    .run({ $userId: userId })
  await db.query<null, { $userId: number }>('DELETE FROM user_ban_futures WHERE room IS NULL AND "user" = $userId')
    .run({ $userId: userId })

  if (options?.timeoutInSeconds !== undefined) {
    await db.query<null, { $userId: number, $endsAt: number }>(`
      INSERT INTO user_ban_futures
      ("user", room, banned, at) VALUES ($userId, NULL, FALSE, $endsAt)
    `).run({ $userId: userId, $endsAt: Math.floor(Date.now() / 1000) + options.timeoutInSeconds })
  }
}

export async function globalUnban(userId: number) {
  await db.query<null, { $userId: number }>('UPDATE users SET banned = FALSE WHERE id = $userId')
    .run({ $userId: userId })
  await db.query<null, { $userId: number }>('DELETE FROM user_ban_futures WHERE room IS NULL AND "user" = $userId')
    .run({ $userId: userId })
}

// TODO: global permissions overrides
// export async function getGlobalPermissionsOverrides() {
  
// }

// export async function getUserGlobalPermissionOverrides(userId: number) {

// }

// export async function setGlobalPermissionsOverrides({ userId, permissions }: {
//   userId: number
//   permissions: PermsFlags
// }) {

// }