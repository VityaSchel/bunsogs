import { db } from '@/db'
import { getServerKey } from '@/keypairs'
import { mapRoomEntityToRoomInstance, Room } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { type roomsEntity } from '@/schema'
import { User } from '@/user'
import { blindSessionId } from '@session.js/blinded-session-id'
import { z } from 'zod'

export async function unbanUser(req: SogsRequest): Promise<SogsResponse> {
  const sessionIdParam = await z.string().regex(/^(05|15)[a-f0-9]+$/).length(66).safeParseAsync(req.params?.['session_id'])
  if (!sessionIdParam.success) {
    return { status: 400, response: null }
  }
  const sessionId = sessionIdParam.data.startsWith('05')
    ? blindSessionId({ sessionId: sessionIdParam.data, serverPk: getServerKey().publicKey.toString('hex') })
    : sessionIdParam.data

  const user = new User({ sessionID: sessionId })
  await user.refresh()

  if(req.user === null)  {
    return { status: 401, response: null }
  }

  const body = await z.object({
    rooms: z.array(z.string()).min(1).optional(),
    global: z.boolean().optional()
  })
    .and(z.union([
      z.object({ rooms: z.undefined(), global: z.boolean() }),
      z.object({ rooms: z.array(z.string()).min(1), global: z.undefined() }),
    ]))
    .safeParseAsync(req.body)

  if(!body.success) {
    return { status: 400, response: null }
  }

  if(req.user.id == user.id) {
    return { status: 400, response: null }
  }
  
  if(body.data.rooms !== undefined) {
    const rooms: Room[] = []
    if(body.data.rooms![0] === '*') {
      const roomsEntities = await db.query<roomsEntity, { $user: number }>(`
        SELECT rooms.* FROM user_permissions perm JOIN rooms ON rooms.id = room
        WHERE "user" = $user AND perm.moderator
      `).all({ $user: req.user.id })
      for (const roomEntity of roomsEntities) {
        const room = await mapRoomEntityToRoomInstance(roomEntity)
        rooms.push(room)
      }
    } else {
      for (const roomToken of body.data.rooms) {
        const room = await db.query<roomsEntity, { $token: string }>(`
          SELECT * FROM rooms WHERE token = $token
        `).get({ $token: roomToken })
        if(room === null) {
          return { status: 404, response: null }
        }
        rooms.push(await mapRoomEntityToRoomInstance(room))
      }
    }
    for (const room of rooms) {
      const reqUserPermissions = await room.getUserPermissions(req.user)
      if (!req.user.admin && !req.user.moderator && !reqUserPermissions.admin && !reqUserPermissions.moderator) {
        return { status: 403, response: null }
      }
      await room.unbanUser({ user: user })
    }
  } else {
    if(req.user.admin || req.user.moderator) {
      await user.unban()
    } else {
      return {
        status: 403,
        response: null
      }
    }
  }

  return {
    status: 200,
    response: {}
  }
}