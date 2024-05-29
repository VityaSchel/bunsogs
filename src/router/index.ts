import FindMyWay, { type HTTPMethod } from 'find-my-way'
import { getCapabilities } from '@/router/get-capabilities'
import { getRoom } from '@/router/get-room'
import { getRoomUpdates } from '@/router/get-room-updates'
import { getRoomRecentMessages } from '@/router/get-room-recent-messages'
import { getRoomMessagesSince } from '@/router/get-room-messages-since'
import { postRoomMessage } from '@/router/post-room-message'
import type { User } from '@/user'
import { deleteRoomMessage } from '@/router/delete-room-message'

export type SogsRequest = {
  endpoint: string
  method: string
  body: any | null
  params?: { [key: string]: string | undefined }
  headers?: { [key: string]: string }
  searchParams?: { [k: string]: string }
  user: User | null
}

export type SogsResponse = {
  status: number,
  response: any,
  contentType?: string
}

const router = FindMyWay({
  ignoreDuplicateSlashes: true,
  ignoreTrailingSlash: true
})

router.on('GET', '/capabilities', getCapabilities)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token', getRoom)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token/pollInfo/:info_updates', getRoomUpdates)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token/messages/recent', getRoomRecentMessages)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token/messages/since/:since_seqno', getRoomMessagesSince)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/room/:token/message', postRoomMessage)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('DELETE', '/room/:token/message/:message_id', deleteRoomMessage)

export async function handleIncomingRequest(req: SogsRequest): Promise<SogsResponse> {
  const supportedMethods = ['GET', 'POST', 'PUT', 'DELETE']

  if (!supportedMethods.includes(req.method)) {
    return {
      response: null,
      status: 405
    }
  }

  const route = router.find(req.method as HTTPMethod, req.endpoint)
  const handler = route ? routesMap[route.handler.name] : null
  if (route && handler) {
    return await handler({ ...req, params: route.params, searchParams: route.searchParams })
  } else {
    console.warn('Unknown route', req.method, req.endpoint)
    return {
      response: null,
      status: 404
    }
  }
}

const routesMap: { [route: string]: (req: SogsRequest) => SogsResponse | Promise<SogsResponse> } = {
  getCapabilities,
  getRoom,
  getRoomUpdates,
  getRoomRecentMessages,
  getRoomMessagesSince,
  postRoomMessage,
  deleteRoomMessage
}