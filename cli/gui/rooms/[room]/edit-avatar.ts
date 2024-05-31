import prompts from 'prompts'
import { roomsEntity } from '../../../../src/schema'
import { clearLines, showError, showSuccess } from '../../_utils'
import { setRoomAvatar } from '../../../rooms'

export const editRoomAvatarMenu = async (room: roomsEntity) => {
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Avatar\x1b[0m`)
  console.log('Enter path to new server avatar or submit empty value to delete avatar')
  console.log('Tip: if you\'re on Mac you can simply drag-n-drop file here from Finder')
  const response = await prompts({
    type: 'text',
    name: 'value',
    message: 'Path to new avatar:',
    validate: value => value === ''
      ? true
      : value.length > 1000
        ? 'Room description must be 1000 characters or less'
        : true
  })
  clearLines(4)
  if (response.value !== undefined) {
    try {
      if(response.value) {
        const fileId = await setRoomAvatar({ roomId: room.id, roomToken: room.token, filepath: response.value.trim() })
        room.image = fileId
        await showSuccess('Room avatar changed; you can delete/move this file now, it was copied to bunsogs media storage')
      } else {
        await setRoomAvatar({ roomId: room.id, roomToken: room.token, filepath: null })
        room.image = null
        await showSuccess('Room avatar deleted')
      }
    } catch (e) {
      await showError(e)
    }
  }
  return
}