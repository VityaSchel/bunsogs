import { BadPermission, PostRateLimited } from '@/errors'
import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { User } from '@/user'
import { testPermission } from '@/utils'
import { z } from 'zod'
import SJSON from 'secure-json-parse'

/**
  Posts a new message to a room.

  The method takes a JSON request body containing the details to be added to the room.

  # JSON parameters

  ## Required fields:

  - `data` — (required) the serialized message body, encoded in base64.
  - `signature` — (required) a 64-byte Ed25519 signature of the message body, signed by the
    current user's keys, encoded in base64 (i.e. 88 base64 chars).

  ## Optional fields:

  - `whisper_to` — Takes a Session ID; if present this indicates that this message is a whisper
    that should only be shown to the given user.  Note that only moderators may set this flag.

  - `whisper_mods` — Boolean.  If true, then this message will be visible to moderators but not
    ordinary users.  If this *and* `whisper_to` are used together then the message will be visible
    to the given user *and* any room moderators.  (This can be used, for instance, to issue a
    warning to a user that only the user and other mods can see).  Note that only moderators may
    set this flag.

  - `files` — Array of file IDs of new files uploaded as attachments of this post.  This is
    required to preserve uploads for the default expiry period (15 days, unless otherwise
    configured by the SOGS administrator).  Uploaded files that are not attached to a post will
    be deleted much sooner.

      If any of the given file ids are already associated with another message then the
      association is ignored (i.e. the files remain associated with the original message).

      When submitting a [message *edit*](#put-roomroommessagemsg_id) this field must contain the
      IDs of any newly uploaded files that are part of the edit.  Existing attachment IDs may also
      be included, but are not required.

  # Return value

  On success this returns a status **201** (Created), *not* the default 200 (OK) returned by most
  endpoints.  The request body is json containing the post details, as would be returned from
  the [GET /room/:room/message/:id](#get-roomroommessagemsg_id) endpoint.

  # Error status codes

  - 403 Forbidden — if the invoking user does not have write permission to the room.
  - 404 — if room does not exist or user does not have access to it
 */
export async function postRoomMessage(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken || Array.isArray(roomToken)) {
    return { status: 400, response: null }
  }

  if(req.user === null)  {
    return { status: 401, response: null }
  }

  if (req.body === null) {
    return { status: 400, response: null }
  }
  const parsedBody = SJSON.parse(req.body.toString('utf-8'))
  const body = await z.object({
    data: z.string().min(1).base64(),
    signature: z.string().length(88).base64(),
    whisper_to: z.string().length(66).regex(/^[a-z0-9]+$/).optional(),
    whisper_mods: z.boolean().optional(),
    files: z.array(z.union([
      z.coerce.number().int().min(0).transform(Number),
      z.number().int().min(0)
    ])).optional()
  }).safeParseAsync(parsedBody)
  if(!body.success) {
    return { status: 400, response: null }
  }
  
  const rooms = getRooms()
  const room = rooms.get(roomToken)
  if (!room) {
    return {
      status: 404,
      response: null
    }
  } else {
    const permissions = await room.getUserPermissions(req.user)
    if (!testPermission(permissions, ['accessible'])) {
      return { status: 404, response: null }
    } else if (!testPermission(permissions, ['write'])) {
      return { status: 403, response: null }
    }
    room.updateUserActivity(req.user)
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
      status: 201,
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