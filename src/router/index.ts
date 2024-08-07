import FindMyWay, { type HTTPMethod } from 'find-my-way'
import type { User } from '@/user'
import { getCapabilities } from '@/router/get-capabilities'
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

export type SogsRequest = {
  endpoint: string
  method: string
  body: Buffer | null
  params?: { [key: string]: string | undefined }
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
router.on('DELETE', '/room/:token/all/:session_id', deleteAllFromUser)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token/messages/recent', getRoomRecentMessages)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token/messages/since/:since_seqno', getRoomMessagesSince)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/room/:token/message', postRoomMessage)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('DELETE', '/room/:token/message/:message_id', deleteRoomMessage)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/room/:token/file', uploadFileToRoom)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token/file/:file_id', retrieveFileInRoom)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token/file/:file_id/:filename', retrieveFileInRoom)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/user/:session_id/ban', banUser)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/user/:session_id/unban', unbanUser)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/user/:session_id/moderator', appointModerator)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/room/:token/pin/:message_id', pinMessage)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/room/:token/unpin/all', unpinAllMessages)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/room/:token/unpin/:message_id', unpinMessage)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/inbox', getDmInbox)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/inbox/since/:message_id', getDmInboxSince)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/outbox', getDmOutbox)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/outbox/since/:message_id', getDmOutboxSince)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('POST', '/inbox/:session_id', sendDmMessage)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('DELETE', '/inbox', deleteDmInbox)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('PUT', '/room/:token/reaction/:message_id/:reaction', addReaction)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('DELETE', '/room/:token/reaction/:message_id/:reaction', deleteReaction)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('DELETE', '/room/:token/reactions/:message_id', deleteAllMessageReactions)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('DELETE', '/room/:token/reactions/:message_id/:reaction', deleteAllMessageReactions)
// @ts-expect-error fmw expects a handler with a specific signature
router.on('GET', '/room/:token/reactors/:message_id/:reaction', getMessageReactionReactors)

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
  deleteRoomMessage,
  uploadFileToRoom,
  retrieveFileInRoom,
  deleteAllFromUser,
  banUser,
  unbanUser,
  appointModerator,
  pinMessage,
  unpinMessage,
  unpinAllMessages,
  getDmInbox,
  getDmInboxSince,
  getDmOutbox,
  getDmOutboxSince,
  sendDmMessage,
  deleteDmInbox,
  addReaction,
  deleteReaction,
  deleteAllMessageReactions,
  getMessageReactionReactors,
}