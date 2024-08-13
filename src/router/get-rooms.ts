import { getRooms } from '@/room'
import type { SogsRequest, SogsResponse } from '@/router'
import { getRoomDetails } from '@/router/get-room'
import { testPermission } from '@/utils'

export async function getRoomsRoute(req: SogsRequest): Promise<SogsResponse> {
  const rooms = getRooms()
  const accessibleRooms: any[] = []

  for (const room of rooms.values()) {
    if (req.user !== null) {
      const permissions = await room.getUserPermissions(req.user)
      if (!testPermission(permissions, ['accessible'])) {
        continue
      }
    } else if (!room.defaultAccessible) {
      continue
    }

    accessibleRooms.push(await getRoomDetails(room, null))
  }

  return {
    status: 200,
    response: accessibleRooms,
    contentType: 'application/json'
  }
}