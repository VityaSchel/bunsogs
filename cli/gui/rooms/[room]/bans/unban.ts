import prompts from 'prompts'
import { clearLines, showError } from '../../../_utils'
import { roomsEntity } from '../../../../../src/schema'
import { getUserIdBySessionID } from '../../../../global-settings'
import { roomUnban } from '../../../../rooms'

export const roomUnbanMenu = async (room: roomsEntity, sessionID: string) => {
  const userId = await getUserIdBySessionID(sessionID)
  if (!userId) {
    return await showError('User not found')
  }
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Bans ❯ Unban user\x1b[0m`)
  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Are you sure you want to unban this user in this room?',
  })
  clearLines(2)
  if (confirmed) {
    try {
      await roomUnban({ roomId: room.id, userId })
    } catch (e) {
      await showError(e)
    }
  }
  return
}