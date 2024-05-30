import prompts from 'prompts'
import { roomsEntity } from '../../../../src/schema'
import { clearLines, showError, showSuccess } from '../../_utils'
import { deleteRoom } from '../../../rooms'

export const deleteRoomMenu = async (room: roomsEntity) => {
  console.log('\x1b[33mDeleting room includes deleting all messages, files and other content in it.')
  console.log('\x1b[33mIt is permanent and dangerous. If you want to proceed, type room\'s token below')
  const response = await prompts({
    type: 'text',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Delete room`,
  })
  clearLines(3)
  const ctrlCPressed = typeof response.value !== 'string'
  if (!ctrlCPressed && response.value === room.token) {
    try {
      await deleteRoom(room.token)
      await showSuccess('Room deleted')
    } catch (e) {
      await showError(e)
    }
  }
  return
}