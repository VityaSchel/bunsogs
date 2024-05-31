import prompts from 'prompts'
import { clearLines, showError, showSuccess } from '../../_utils'
import { roomsEntity } from '../../../../src/schema'
import { setRoomName } from '../../../rooms'

export const editRoomNameMenu = async (room: roomsEntity) => {
  const response = await prompts({
    type: 'text',
    name: 'value',
    initial: room.name,
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Name`,
    validate: value => value === ''
      ? 'Room name can\'t be empty'
      : value.length > 64
        ? 'Room name must be 64 characters or less'
        : true
  })
  clearLines(1)
  const ctrlCPressed = !response.value
  if (!ctrlCPressed && response.value !== room.name) {
    try {
      await setRoomName(room.id, response.value)
      room.name = response.value
      await showSuccess('Room name changed to ' + response.value)
    } catch (e) {
      await showError(e)
    }
  }
  return
}