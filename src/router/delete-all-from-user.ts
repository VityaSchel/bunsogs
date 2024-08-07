import { BadPermission, PostRateLimited } from '@/errors'
import { getServerKey } from '@/keypairs'
import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { User } from '@/user'
import { testPermission } from '@/utils'
import { blindSessionId } from '@session.js/blinded-session-id'
import { z } from 'zod'

export async function deleteAllFromUser(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken) {
    return { status: 400, response: null }
  }

  const sessionIdParam = await z.string().regex(/^(05|15)[a-f0-9]+$/).length(66).safeParseAsync(req.params?.['session_id'])
  if (!sessionIdParam.success) {
    return { status: 400, response: null }
  }
  const sessionId = sessionIdParam.data.startsWith('05')
    ? blindSessionId({ sessionId: sessionIdParam.data, serverPk: getServerKey().publicKey.toString('hex') })
    : sessionIdParam.data

  if(req.user === null)  {
    return { status: 401, response: null }
  }
  
  const rooms = getRooms()
  const room = rooms.get(roomToken)
  if (!room) {
    return { status: 404, response: null }
  }

  const user = new User({ sessionID: sessionId })
  await user.refresh()
  if (!user) {
    return { status: 404, response: null }
  }

  if (req.user.sessionID !== sessionId) {
    const userPermissions = await room.getUserPermissions(user)
    const reqUserPermissions = await room.getUserPermissions(req.user)
    if (userPermissions.admin && !reqUserPermissions.admin) {
      return { status: 403, response: null }
    } else if (!reqUserPermissions.admin || !reqUserPermissions.moderator) {
      return { status: 403, response: null }
    }
    room.updateUserActivity(req.user)
  } else if(!room.defaultAccessible) {
    return { status: 404, response: null }
  }

  try {
    const messageIds = await room.deleteAllFromUser(user)
    if (messageIds.length === 0) {
      return {
        status: 404,
        response: null
      }
    }
    return {
      status: 200,
      response: {},
      contentType: 'application/json'
    }
  } catch(e) {
    if (e instanceof PostRateLimited) {
      return {
        status: 429,
        response: null
      }
    } else if(e instanceof BadPermission) {
      return {
        status: 403,
        response: null
      } 
    } else {
      throw e
    }
  }
}