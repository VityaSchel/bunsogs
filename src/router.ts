import { getRooms } from '@/rooms'
import FindMyWay, { type HTTPMethod } from 'find-my-way'

type SogsRequest = {
  endpoint: string
  method: string
  body: object | null
  params?: { [key: string]: string | undefined }
}

type SogsResponse = {
  status: number,
  response: string | null,
  contentType?: string
}

const router = FindMyWay({
  ignoreDuplicateSlashes: true,
  ignoreTrailingSlash: true
})

router.on('GET', '/capabilities', getCapabilities)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:id', getRoom)

export async function handleIncomingRequest(req: SogsRequest): Promise<SogsResponse> {
  console.log('handled', req.endpoint, req.method, req.body) // TODO: remove
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
    return await handler({ ...req, params: route.params })
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
  getRoom
}

function getCapabilities(): SogsResponse {
  return {
    status: 200,
    response: JSON.stringify({
      'capabilities': [
        // 'blind',
        // 'reactions',
        'sogs'
      ]
    }),
    contentType: 'application/json'
  }
}

function getRoom(req: SogsRequest): SogsResponse {
  const roomId = req.params?.['id']
  if (!roomId) {
    return {
      status: 404,
      response: null
    }
  }

  const rooms = getRooms()
  const room = rooms.get(roomId)
  if (!room) {
    return {
      status: 404,
      response: null
    }
  }

  return {
    status: 200,
    response: JSON.stringify({
      active_users: room.activeUsers,
      active_users_cutoff: room.activeUsersCutoff,
      admins: room.admins,
      created: room.created / 1000,
      info_updates: room.infoUpdates,
      message_sequence: room.messageSequence,
      moderators: room.moderators,
      name: room.name,
      read: room.defaultRead,
      token: room.token,
      upload: room.defaultUpload,
      write: room.defaultWrite,
      pinned_messages: room.pinnedMessages.map(pm => ({
        id: pm.id,
        pinned_at: pm.pinnedAt,
        pinned_by: pm.pinnedBy
      })),
    }),
    contentType: 'application/json'
  }
}