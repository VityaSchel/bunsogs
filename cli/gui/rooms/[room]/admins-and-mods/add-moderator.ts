import prompts from 'prompts'
import { clearLines, showError } from '../../../_utils'
import { addModerator } from '../../../../rooms'
import { roomsEntity } from '../../../../../src/schema'

export const addModeratorMenu = async (room: roomsEntity) => {
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Admins/moderators ❯ Add new moderator\x1b[0m`)
  const { id, visible } = await prompts([
    {
      type: 'text',
      name: 'id',
      message: 'Session ID of user which you want to make a moderator',
      validate: id => id.length !== 66
        ? 'Session ID must be exactly 66 characters long'
        : /(05|15)[a-f0-9]+/.test(id)
          ? true
          : 'Invalid Session ID format'
    },
    {
      type: 'toggle',
      name: 'visible',
      message: 'Visible for regular users?',
      initial: true,
      active: 'visible',
      inactive: 'hidden'
    },
  ])
  clearLines(visible !== undefined ? 3 : 2)
  if (id) {
    try {
      await addModerator({ roomId: room.id, userSessionID: id, visible })
    } catch (e) {
      await showError(e)
    }
  }
  return
}