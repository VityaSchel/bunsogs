import { db } from '@/db'
import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import type { filesEntity } from '@/schema'
import { testPermission } from '@/utils'
import path from 'path'
import fs from 'fs/promises'

/**
  Retrieves a file uploaded to the room.

  Retrieves a file via its numeric id from the room, returning the file content directly as the
  binary response body.  The file's suggested filename (as provided by the uploader) is provided
  in the Content-Disposition header, if available.

  # URL Parameters

  - `fileId` — The id of the attachment to download.

  # Return value

  On success the file content is returned as bytes in the response body.  Additional information
  is provided via response headers:

  ## Content-Length

  The size (in bytes) of the attachment.

  ## Content-Type

  Always `application-octet-stream` (even if the uploader specified something else).

  ## Content-Disposition

  This specifies the suggested filename as provided by the uploader, if present.  The filename is
  encoded using standard RFC 5987 encoding, for example:

      Content-Disposition: attachment; filename*=UTF-8''filename.txt

  See [the upload endpoint](#post-roomroomfile) for filename encoding details.  If the attachment
  was uploaded without a filename then this header will not include the filename component, i.e.:

      Content-Disposition: attachment

  ## Date

  The timestamp at which this file was uploaded, as a standard HTTP date.

  ## Expires

  The timestamp at which this file is currently scheduled to expire, as a standard HTTP date.

  # Error status codes

  - 403 Forbidden — Returned if the current user does not have permission to read messages in the
    room, e.g. because they are banned or the room permissions otherwise restrict access.

  - 404 Not Found — Returned if the attachment does not exist in this room (or has expired).

  pysogs ref: rooms.py -> serve_file
 */
export async function retrieveFileInRoom(req: SogsRequest): Promise<SogsResponse> {
  const roomToken = req.params?.['token']
  if (!roomToken) {
    return { status: 400, response: null }
  }

  const fileId = Number(req.params?.['file_id'])
  if (!fileId && !Number.isSafeInteger(fileId) || fileId < 0) {
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
    if(req.user !== null) {
      const permissions = await room.getUserPermissions(req.user)
      if (!testPermission(permissions, ['accessible'])) {
        return { status: 404, response: null }
      }
      room.updateUserActivity(req.user)
    } else if(!room.defaultAccessible) {
      return { status: 404, response: null }
    }
  }

  const file = await db.query<filesEntity, { $roomId: number, $fileId: number }>('SELECT * FROM files WHERE room = $roomId AND id = $fileId')
    .get({ $roomId: room.id, $fileId: fileId })
  if (file === null || (file.expiry !== null && file.expiry < Math.floor(Date.now() / 1000))) {
    return { status: 404, response: null }
  } else {
    const filePath = await path.resolve(__dirname, '../../', file.path)
    const fileContents = await fs.readFile(filePath)
    const headers: Record<string, string> = {
      'Date': String(Math.floor(file.uploaded)),
      'Content-Length': String(fileContents.byteLength),
      'Content-Disposition': 'attachment',
    }
    if(file.filename) {
      headers['Content-Disposition'] = 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(file.filename)
    }
    if(file.expiry !== null) {
      headers['Expires'] = new Date(file.expiry).toUTCString()
    }
    return {
      status: 200,
      response: fileContents,
      contentType: 'application/octet-stream',
      headers
    }
  }
}