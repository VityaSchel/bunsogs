import prompts from 'prompts'
import { clearLines, showError, showSuccess } from '../../_utils'
import { setRoomDescription } from '../../../rooms'
import { roomsEntity } from '../../../../src/schema'

export const editRoomDescriptionMenu = async (room: roomsEntity) => {
  const response = await prompts({
    type: 'text',
    name: 'value',
    initial: room.description || '',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Description`,
    validate: value => value === ''
      ? true
      : value.length > 1000
        ? 'Room description must be 1000 characters or less'
        : true
  })
  clearLines(1)
  const ctrlCPressed = typeof response.value !== 'string'
  if (!ctrlCPressed && response.value !== String(room.description)) {
    try {
      await setRoomDescription(room.id, response.value)
      room.description = response.value
      await showSuccess('Room description changed to ' + response.value)
    } catch (e) {
      await showError(e)
    }
  }
  return
}