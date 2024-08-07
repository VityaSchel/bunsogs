import { getConfig } from '@/config'
import { db } from '@/db'
import type { SogsRequest, SogsResponse } from '@/router'
import { serializeMessage } from '@/router/dm'
import type { inboxEntity } from '@/schema'
import { User } from '@/user'
import { z } from 'zod'
import SJSON from 'secure-json-parse'

/**
  Delivers a direct message to a user via their blinded Session ID.

  The body of this request is a JSON object containing a `message` key with a value of the
  encrypted-then-base64-encoded message to deliver.

  Message encryption is described in the [`GET` /inbox](#GET-inbox) endpoint.

  # Return value

  On successful deposit of the message a 201 (Created) status code is returned.  The body will be
  a JSON object containing the message details as would be returned by retrieving the message,
  except that it omits the encrypted message body.

  # Error status codes

  400 Bad Request — if no message is provided.

  404 Not Found — if the given Session ID does not exist on this server, either because they have
  never accessed the server, or because they have been permanently banned.
 */
export async function sendDmMessage(req: SogsRequest): Promise<SogsResponse> {
  if (req.body === null) {
    return {
      response: null,
      status: 400
    }
  }

  if(req.user === null) {
    return {
      response: null,
      status: 401
    }
  }

  const sessionId = z.string().regex(/^15[a-f0-9]+$/).length(66).parse(req.params?.['session_id'])
  const user = new User({ sessionID: sessionId })
  try {
    await user.refresh({ autovivify: false })
  } catch(e) {
    if (e instanceof Error && e.message === 'User not found') {
      return {
        response: null,
        status: 404
      }
    }
  }
  const parsedBody = SJSON.parse(req.body.toString('utf-8'))
  const body = await z.object({
    message: z.string().max(24000),
  }).parse(parsedBody)

  const data = Buffer.from(body.message, 'base64')

  const message = await db.query<inboxEntity, { $sender: number, $recipient: number, $data: Buffer, $expiry: number }>(`
    INSERT INTO inbox (sender, recipient, body, expiry)
    VALUES ($sender, $recipient, $data, $expiry)
    RETURNING *
  `).get({ 
    $sender: req.user.id, 
    $recipient: user.id, 
    $data: data, 
    $expiry: Date.now() + getConfig().dm_expiry 
  })

  if(!message) {
    return {
      response: null,
      status: 500
    }
  }

  return {
    response: await serializeMessage(message, false),
    status: 201,
    contentType: 'application/json'
  }
}