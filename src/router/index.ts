import FindMyWay, { type HTTPMethod } from 'find-my-way'
import type { SogsRequestUser } from '@/middlewares/auth'
import { getCapabilities } from '@/router/get-capabilities'
import { getRoom } from '@/router/get-room'
import { getRoomUpdates } from '@/router/get-room-updates'
import { getRoomRecentMessages } from '@/router/get-room-recent-messages'

export type SogsRequest = {
  endpoint: string
  method: string
  body: string | null
  params?: { [key: string]: string | undefined }
  headers?: { [key: string]: string | undefined }
  searchParams?: { [k: string]: string }
  user: SogsRequestUser | null
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
router.on('GET', '/room/:id', getRoom)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:id/pollInfo/:info_updates', getRoomUpdates)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:id/messages/recent', getRoomRecentMessages)

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
  getRoomRecentMessages
}