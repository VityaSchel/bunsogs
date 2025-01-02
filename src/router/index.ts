import type { User } from '@/user'
import SJSON from 'secure-json-parse'
import { getCapabilities } from '@/router/get-capabilities'
import { getRoomsRoute } from '@/router/get-rooms'
import { getRoom } from '@/router/get-room'
import { getRoomUpdates } from '@/router/get-room-updates'
import { getRoomRecentMessages } from '@/router/get-room-recent-messages'
import { getRoomMessagesSince } from '@/router/get-room-messages-since'
import { postRoomMessage } from '@/router/post-room-message'
import { deleteRoomMessage } from '@/router/delete-room-message'
import { deleteAllFromUser } from '@/router/delete-all-from-user'
import { uploadFileToRoom } from '@/router/upload-file-to-room'
import { retrieveFileInRoom } from '@/router/retrieve-file-in-room'
import { banUser } from '@/router/ban-user'
import { unbanUser } from '@/router/unban-user'
import { appointModerator } from '@/router/appoint-moderator'
import { pinMessage } from '@/router/pin-message'
import { unpinMessage } from '@/router/unpin-message'
import { unpinAllMessages } from '@/router/unpin-all-messages'
import { getDmInbox } from '@/router/dm/get-inbox'
import { getDmInboxSince } from '@/router/dm/get-inbox-since'
import { getDmOutbox } from '@/router/dm/get-outbox'
import { getDmOutboxSince } from '@/router/dm/get-outbox-since'
import { sendDmMessage } from '@/router/dm/send-message'
import { deleteDmInbox } from '@/router/dm/delete-inbox'
import { addReaction } from '@/router/add-reaction'
import { deleteReaction } from '@/router/delete-reaction'
import { deleteAllMessageReactions } from '@/router/delete-all-message-reactions'
import { getMessageReactionReactors } from '@/router/get-message-reaction-reactors'
import { match } from 'path-to-regexp'

export type SogsRequest = {
  endpoint: string
  method: string
  body: Buffer | any | null
  params?: Partial<Record<string, string | string[]>>
  headers?: { [key: string]: string }
  searchParams?: { [k: string]: string }
  user: User | null
}

export type SogsResponse = {
  status: number,
  response: any,
  contentType?: string
  headers?: Record<string, string>
}

type Route = { method: string, route: string, handler: (req: SogsRequest) => SogsResponse | Promise<SogsResponse>, bodyType?: 'buffer' | 'json' | 'any' }
const router: Route[] = []

router.push({ method: 'GET', route: '/capabilities', handler: getCapabilities })
router.push({ method: 'GET', route: '/rooms', handler: getRoomsRoute })
router.push({ method: 'GET', route: '/room/:token', handler: getRoom })
router.push({ method: 'GET', route: '/room/:token/pollInfo/:info_updates', handler: getRoomUpdates })
router.push({ method: 'DELETE', route: '/room/:token/all/:session_id', handler: deleteAllFromUser })
router.push({ method: 'GET', route: '/room/:token/messages/recent', handler: getRoomRecentMessages })
router.push({ method: 'GET', route: '/room/:token/messages/since/:since_seqno', handler: getRoomMessagesSince })
router.push({ method: 'POST', route: '/room/:token/message', handler: postRoomMessage, bodyType: 'json' })
router.push({ method: 'DELETE', route: '/room/:token/message/:message_id', handler: deleteRoomMessage })
router.push({ method: 'POST', route: '/room/:token/file', handler: uploadFileToRoom, bodyType: 'buffer' })
router.push({ method: 'GET', route: '/room/:token/file/:file_id', handler: retrieveFileInRoom })
router.push({ method: 'GET', route: '/room/:token/file/:file_id/:filename', handler: retrieveFileInRoom })
router.push({ method: 'POST', route: '/user/:session_id/ban', handler: banUser, bodyType: 'json' })
router.push({ method: 'POST', route: '/user/:session_id/unban', handler: unbanUser, bodyType: 'json' })
router.push({ method: 'POST', route: '/user/:session_id/moderator', handler: appointModerator, bodyType: 'json' })
router.push({ method: 'POST', route: '/room/:token/pin/:message_id', handler: pinMessage, bodyType: 'json' })
router.push({ method: 'POST', route: '/room/:token/unpin/all', handler: unpinAllMessages, bodyType: 'json' })
router.push({ method: 'POST', route: '/room/:token/unpin/:message_id', handler: unpinMessage, bodyType: 'json' })
router.push({ method: 'GET', route: '/inbox', handler: getDmInbox })
router.push({ method: 'GET', route: '/inbox/since/:message_id', handler: getDmInboxSince })
router.push({ method: 'GET', route: '/outbox', handler: getDmOutbox })
router.push({ method: 'GET', route: '/outbox/since/:message_id', handler: getDmOutboxSince })
router.push({ method: 'POST', route: '/inbox/:session_id', handler: sendDmMessage, bodyType: 'json' })
router.push({ method: 'DELETE', route: '/inbox', handler: deleteDmInbox })
router.push({ method: 'PUT', route: '/room/:token/reaction/:message_id/:reaction', handler: addReaction })
router.push({ method: 'DELETE', route: '/room/:token/reaction/:message_id/:reaction', handler: deleteReaction })
router.push({ method: 'DELETE', route: '/room/:token/reactions/:message_id', handler: deleteAllMessageReactions })
router.push({ method: 'DELETE', route: '/room/:token/reactions/:message_id/:reaction', handler: deleteAllMessageReactions })
router.push({ method: 'GET', route: '/room/:token/reactors/:message_id/:reaction', handler: getMessageReactionReactors })

const methodsMap = new Map<string, Route[]>()
router.forEach(route => {
  if (!methodsMap.has(route.method)) {
    methodsMap.set(route.method, [])
  }
  methodsMap.get(route.method)?.push(route)
})

export async function handleIncomingRequest(req: SogsRequest): Promise<SogsResponse> {
  const supportedMethods = ['GET', 'POST', 'PUT', 'DELETE']

  if (!supportedMethods.includes(req.method)) {
    return {
      response: null,
      status: 405
    }
  }

  const request = findRoute(req.method, req.endpoint)
  if (request) {
    let parsedBody: any
    if (request.route.bodyType === 'json') {
      if (typeof req.body === 'string') {
        parsedBody = SJSON.parse(req.body)
      } else if(Buffer.isBuffer(req.body)) {
        parsedBody = SJSON.parse(req.body.toString('utf-8'))
      } else {
        parsedBody = req.body
      }
    } else if (request.route.bodyType === 'buffer') {
      if(Buffer.isBuffer(req.body)) {
        parsedBody = req.body
      } else {
        return {
          response: null,
          status: 400
        }
      }
    } else {
      parsedBody = req.body
    }
    return await request.route.handler({ ...req, body: parsedBody, params: request.params, searchParams: request.searchParams })
  } else {
    if(process.env.BUNSOGS_DEV === 'true') {
      console.warn('Unknown route', req.method, req.endpoint)
    }
    return {
      response: null,
      status: 404
    }
  }
}

function findRoute(method: string, route: string): { route: Route, params: Partial<Record<string, string | string[]>>, searchParams: Record<string, string> } | null {
  const methodRoutes = methodsMap.get(method)
  if (!methodRoutes) return null
  const url = new URL(route, 'http://localhost')
  for(const endpoint of methodRoutes) {
    const result = match(endpoint.route)(url.pathname)
    if(result !== false) {
      return { route: endpoint, params: result.params, searchParams: Object.fromEntries(url.searchParams.entries()) }
    }
  }
  return null
}
