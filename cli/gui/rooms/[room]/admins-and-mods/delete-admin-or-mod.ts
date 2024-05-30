import prompts from 'prompts'
import { clearLines, showError } from '../../../_utils'
import { roomsEntity } from '../../../../../src/schema'
import { getOrCreateUserIdBySessionID } from '../../../../global-settings'
import { removeAdminOrModFromRoom } from '../../../../rooms'

export const deleteRoomAdminOrMod = async (room: roomsEntity, userSessionID: string) => {
  const userId = await getOrCreateUserIdBySessionID(userSessionID)
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Admins/moderators ❯ Remove from list\x1b[0m`)
  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Are you sure you want to demote this person to regular user?',
  })
  clearLines(2)
  if (confirmed) {
    try {
      await removeAdminOrModFromRoom({ roomId: room.id, userId })
    } catch (e) {
      await showError(e)
    }
  }
  return
}