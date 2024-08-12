import { db } from '@/db'
import { getServerKey } from '@/keypairs'
import { mapRoomEntityToRoomInstance, Room } from '@/room'
import type { roomsEntity } from '@/schema'
import { User } from '@/user'

async function getUserInstance(user: number | string): Promise<User> {
  let userInstance: User
  if (typeof user === 'string') {
    userInstance = new User({ sessionID: user })
  } else {
    userInstance = new User({ id: user })
  }
  await userInstance.refresh({ autovivify: true })
  return userInstance
}

async function getRoomInstance(room: number | string): Promise<Room> {
  let roomEntity: roomsEntity | null
  if (typeof room === 'string') {
    roomEntity = await db.query<roomsEntity, { $token: string }>(`
      SELECT * FROM rooms WHERE token = $token
    `).get({ $token: room })
  } else {
    roomEntity = await db.query<roomsEntity, { $roomId: number }>(`
      SELECT * FROM rooms WHERE id = $roomId
    `).get({ $roomId: room })
  }
  if (roomEntity === null) {
    throw new Error('Room ' + room + ' not found')
  }
  const roomInstance = await mapRoomEntityToRoomInstance(roomEntity)
  return roomInstance
}

export async function banUser({ user, timeout }: {
  user: number | string
  timeout?: number
}) {
  const userInstance = await getUserInstance(user)
  await userInstance.ban({ timeout })
}

export async function unbanUser({ user }: {
  user: number | string
}) {
  const userInstance = await getUserInstance(user)
  await userInstance.unban()
}

export async function banUserInRoom({ user, room, timeout }: {
  user: number | string
  room: number | string
  timeout?: number
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  await roomInstance.banUser({ user: userInstance, timeout })
}

export async function unbanUserInRoom({ user, room }: {
  user: number | string
  room: number | string
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  await roomInstance.unbanUser({ user: userInstance })
}

export async function setUserPermissions({ user, room, accessible, read, write, upload }: {
  user: number | string
  room: number | string
  accessible?: boolean | null
  read?: boolean | null
  write?: boolean | null
  upload?: boolean | null
}) {
  if(accessible === undefined && read === undefined && write === undefined && upload === undefined) {
    return
  }
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  let clauseInsert = '', clauseValues = '', clauseVariables = ''
  if(read !== undefined) {
    clauseInsert += ', read'
    clauseValues += ', $read'
    clauseVariables += ', read = $read'
  }
  if(accessible !== undefined) {
    clauseInsert += ', accessible'
    clauseValues += ', $accessible'
    clauseVariables += ', accessible = $accessible'
  }
  if(write !== undefined) {
    clauseInsert += ', write'
    clauseValues += ', $write'
    clauseVariables += ', write = $write'
  }
  if(upload !== undefined) {
    clauseInsert += ', upload'
    clauseValues += ', $upload'
    clauseVariables += ', upload = $upload'
  }
  return await db.query<null, { $roomId: number, $userId: number, $read?: boolean | null, $accessible?: boolean | null, $write?: boolean | null, $upload?: boolean | null }>(`
    INSERT INTO user_permission_overrides (room, "user"${clauseInsert})
    VALUES ($roomId, $userId${clauseValues})
    ON CONFLICT (room, "user") DO UPDATE SET
      ${clauseVariables}
  `).run({
    $roomId: roomInstance.id,
    $userId: userInstance.id,
    ...(read !== undefined && { $read: read }),
    ...(accessible !== undefined && { $accessible: accessible }),
    ...(write !== undefined && { $write: write }),
    ...(upload !== undefined && { $upload: upload })
  })
}

export async function mapUser(user: User, room: Room) {
  return {
    id: user.id,
    session_id: user.sessionID,
    admin: user.admin,
    moderator: user.moderator,
    roomPermissions: await room.getUserPermissions(user)
  }
}

export function mapRoom(room: Room) {
  return {
    id: room.id,
    token: room.token
  }
}

export function mapSogs() {
  return {
    pk: getServerKey().publicKey
  }
}