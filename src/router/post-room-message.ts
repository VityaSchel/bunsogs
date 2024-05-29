import { BadPermission, PostRateLimited } from '@/errors'
import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { User } from '@/user'
import { z } from 'zod'

export async function postRoomMessage(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken) {
    return {
      status: 400,
      response: null
    }
  }

  if(req.user === null)  {
    return {
      status: 401,
      response: null
    }
  }

  const body = await z.object({
    data: z.string().min(1).base64(),
    signature: z.string().length(88).base64(),
    whisper_to: z.string().length(66).regex(/^[a-z0-9]+$/).optional(),
    whisper_mods: z.boolean().optional(),
    files: z.array(z.number().int().min(0)).optional()
  }).safeParseAsync(req.body)
  if(!body.success) {
    return {
      status: 400,
      response: null
    }
  }
  
  const rooms = getRooms()
  const room = rooms.get(roomToken)
  if (!room) {
    return {
      status: 404,
      response: null
    }
  }

  const data = Buffer.from(body.data.data, 'base64')
  const signature = Buffer.from(body.data.signature, 'base64')

  const whisperTo = body.data.whisper_to 
    ? new User({ sessionID: body.data.whisper_to })
    : null

  if (whisperTo !== null) {
    await whisperTo.refresh({ autovivify: true })
  }

  try {
    const message = await room.addPost(
      req.user,
      data,
      signature,
      whisperTo,
      body.data.whisper_mods,
      body.data.files
    )
    return {
      status: 200,
      response: message,
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