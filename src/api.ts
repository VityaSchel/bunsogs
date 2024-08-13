import { getConfig } from '@/config'
import { db } from '@/db'
import { getServerKey } from '@/keypairs'
import { mapRoomEntityToRoomInstance, Room } from '@/room'
import type { inboxEntity, roomsEntity } from '@/schema'
import { User } from '@/user'
import { z } from 'zod'

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

const sessionIdSchema = z.string().length(66).regex(/^(15|05)[a-f0-9]+$/)

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

export const paramsSchemas = {
  banUser: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
    timeout: z.number().min(1).max(Number.MAX_SAFE_INTEGER).optional()
  }),
  unbanUser: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
  }),
  setUserPermissions: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()]),
    accessible: z.boolean().nullable().optional(),
    read: z.boolean().nullable().optional(),
    write: z.boolean().nullable().optional(),
    upload: z.boolean().nullable().optional(),
  }),
  sendDm: z.object({
    from: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    to: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    message: z.string().base64()
  }),
  sendMessage: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()]),
    data: z.string().base64(),
    signature: z.string().base64(),
    whisperTo: z.union([sessionIdSchema, z.number().nonnegative().int()]).optional(),
    whisperMods: z.boolean().optional(),
    files: z.array(z.number().nonnegative().int()).optional()
  }),
  deleteMessage: z.object({
    room: z.union([z.string().min(1), z.number().int().nonnegative()]),
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    messageId: z.number().int().nonnegative()
  }),
  setRoomAdmin: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()]),
    visible: z.boolean()
  }),
  setRoomModerator: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()]),
    visible: z.boolean()
  }),
  setGlobalAdmin: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    visible: z.boolean()
  }),
  setGlobalModerator: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    visible: z.boolean()
  }),
  removeRoomAdmin: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()])
  }),
  removeRoomModerator: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()])
  }),
  removeGlobalAdmin: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()])
  }),
  removeGlobalModerator: z.object({
    user: z.union([sessionIdSchema, z.number().nonnegative().int()])
  }),
  uploadFile: z.object({
    uploader: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    room: z.union([z.string().min(1), z.number().int().nonnegative()]),
    file: z.instanceof(Uint8Array)
  }),
  addReaction: z.object({
    room: z.union([z.string().min(1), z.number().int().nonnegative()]),
    user: z.union([sessionIdSchema, z.number().nonnegative().int()]),
    messageId: z.number().int().nonnegative(),
    reaction: z.string().min(1)
  })
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

export async function sendDm({ from, to, message }: {
  from: string | number
  to: string | number
  message: string
}) {
  const fromUser = await getUserInstance(from)
  const toUser = await getUserInstance(to)
  const data = Buffer.from(message, 'base64')
  await db.query<inboxEntity, { $sender: number, $recipient: number, $data: Buffer, $expiry: number }>(`
    INSERT INTO inbox (sender, recipient, body, expiry)
    VALUES ($sender, $recipient, $data, $expiry)
  `).run({
    $sender: fromUser.id,
    $recipient: toUser.id,
    $data: data,
    $expiry: Date.now() + getConfig().dm_expiry
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

export async function sendMessage({ user, room, data, signature, whisperTo, whisperMods, files }: {
  user: string | number
  room: string | number
  data: string
  signature: string
  whisperTo?: string | number
  whisperMods?: boolean
  files?: number[]
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  const whisperToUser = whisperTo === undefined ? null : await getUserInstance(whisperTo)
  const msg = await roomInstance.addPost(
    userInstance, 
    Buffer.from(data, 'base64'),
    Buffer.from(signature, 'base64'),
    whisperToUser, 
    whisperMods, 
    files
  )
  return { id: msg.id }
}

export async function deleteMessage({ user, room, messageId }: {
  user: string | number
  room: string | number
  messageId: number
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  await roomInstance.deletePosts(userInstance, [messageId])
}

export async function setRoomAdmin({ user, room, visible }: {
  user: string | number
  room: string | number
  visible: boolean
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  await roomInstance.setModerator({ user: userInstance, visible })
}

export async function removeRoomAdmin({ user, room }: {
  user: string | number
  room: string | number
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  await roomInstance.removeAdmin({ user: userInstance })
}

export async function setRoomModerator({ user, room, visible }: {
  user: string | number
  room: string | number
  visible: boolean
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  await roomInstance.setModerator({ user: userInstance, visible })
}

export async function removeRoomModerator({ user, room }: {
  user: string | number
  room: string | number
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  await roomInstance.removeModerator({ user: userInstance })
}

export async function setGlobalAdmin({ user, visible }: {
  user: string | number
  visible: boolean
}) {
  const userInstance = await getUserInstance(user)
  await userInstance.setGlobalAdmin({ visible })
}

export async function removeGlobalAdmin({ user }: {
  user: string | number
}) {
  const userInstance = await getUserInstance(user)
  await userInstance.removeGlobalAdmin()
}

export async function setGlobalModerator({ user, visible }: {
  user: string | number
  visible: boolean
}) {
  const userInstance = await getUserInstance(user)
  await userInstance.setGlobalModerator({ visible })
}

export async function removeGlobalModerator({ user }: {
  user: string | number
}) {
  const userInstance = await getUserInstance(user)
  await userInstance.removeGlobalModerator()
}

export async function uploadFile({ uploader, room, file }: {
  uploader: string | number
  room: string | number
  file: Uint8Array
}) {
  const userInstance = await getUserInstance(uploader)
  const roomInstance = await getRoomInstance(room)
  if (file.length > getConfig().max_size) {
    throw new Error('File too large')
  }

  const insertedFile = await roomInstance.uploadFile({
    file: Buffer.from(file),
    providedFilename: null,
    user: userInstance
  })
  return { id: insertedFile.id }
}

export async function addReaction({ room, user, messageId, reaction }: {
  room: string | number
  user: string | number
  messageId: number
  reaction: string
}) {
  const userInstance = await getUserInstance(user)
  const roomInstance = await getRoomInstance(room)
  await roomInstance.addReaction({ user: userInstance, messageId, reaction })
}

export function mapRoom(room: Room) {
  return {
    id: room.id,
    token: room.token
  }
}

export function mapSogs() {
  return {
    pk: getServerKey().publicKey.toString('hex'),
    url: getConfig().url
  }
}