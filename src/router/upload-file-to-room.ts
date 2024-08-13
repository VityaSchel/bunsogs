import { getConfig } from '@/config'
import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { testPermission } from '@/utils'

/**
  Uploads a file to a room.

  Takes the request as binary in the body and takes other properties (specifically the suggested
  filename) via submitted headers.

  The user must have upload and posting permissions for the room.  The file will have a default
  lifetime of 1 hour, which is extended to 15 days (by default) when a post referencing the
  uploaded file is posted or edited.

  # URL Parameters

  # Body

  The body of the request is the raw bytes that make up the attachment body.

  # Header parameters

  ## Content-Type

  This should be set to application/octet-stream.  If the client has a strong reason to use
  another content type then it may do so, but it is acceptable to always use
  `application/octet-stream`.

  ## Content-Disposition

  The attachment filename should be provided via the `Content-Disposition` header of the request,
  encoded as URI-encoded UTF-8 as per RFC 5987.  Specifically, it should be formatted as:

      Content-Disposition: attachment; filename*=UTF-8''filename.txt

  where `filename.txt` is a utf-8 byte sequence with any bytes not in the following list encoded
  using %xx URI-style encoding.

  Non-encoded ascii characters: A-Z, a-z, 0-9, !, #, $, &, +, -, ., ^, _, `, |, ~.  All other
  characters shall be represented as their utf-8 byte sequence.

  For instance, a file named `my 🎂.txt` (🎂 = U+1F382, with utf-8 representation 0xF0 0x9F 0x8E
  0x82) should specify the filename in the header as:

      Content-Disposition: attachment; filename*=UTF-8''my%20%f0%9f%8e%82.txt

  Filenames are not required as they are not always available (such as when uploading a pasted
  image) but should be used when possible.

  The filename, if provided, will be provided in the same format in the download header for the
  file.

  # Error status codes

  - 403 Forbidden — Returned if the current user does not have permission to post messages or
    upload files to the room.

  - 404 Not Found — Returned if the room does not exist, or is configured as inaccessible (and
    this user doesn't have access).

  # Return value

  On successful upload this endpoint returns a 201 (Created) status code (*not* 200), with a JSON
  body containing an object with key:

  - `id` — the numeric id of the upload.  If the id is not referenced via a subsequent new post,
    post edit, or room image request within one hour then the attachment will be deleted.

    pysogs ref: rooms.py -> upload_file
 */
export async function uploadFileToRoom(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken || Array.isArray(roomToken)) {
    return { status: 400, response: null }
  }

  if (req.user === null) {
    return { status: 401, response: null }
  }

  if (req.body === null) {
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
    } else if (!testPermission(permissions, ['write', 'upload'])) {
      return { status: 403, response: null }
    }
    room.updateUserActivity(req.user)
  }

  if (req.body.length === 0) {
    return { status: 400, response: null }
  } else if (req.body.length > getConfig().max_size) {
    return { status: 413, response: null }
  }

  const contentDispositionPrefix = 'attachment; filename*=UTF-8\'\''
  const providedFilename = (req.headers && 'content-disposition' in req.headers && req.headers['content-disposition'].startsWith(contentDispositionPrefix)) 
    ? decodeURIComponent(req.headers['content-disposition'].substring(contentDispositionPrefix.length))
    : null

  try {
    const insertedFile = await room.uploadFile({
      file: req.body,
      providedFilename: providedFilename,
      user: req.user
    })
    return { response: { id: insertedFile.id }, status: 201, contentType: 'application/json' }
  } catch(e) {
    if (e instanceof Error && e.message === 'Insufficient space on disk') {
      return { response: null, status: 507 }
    } else {
      throw e
    }
  }
}