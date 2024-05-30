import prompts from 'prompts'
import assert from 'assert'
import { clearLines } from '../_utils'
import { addRoomMenu } from './add-room'
import { getRoomByToken, getRooms } from '../../rooms'
import { roomMenu } from './[room]'

export const roomsMenu = async () => {
  const value = await drawRoomsMenu()
  switch (value) {
    case 'addRoom':
      await addRoomMenu()
      return await roomsMenu()
    case 'back':
      return
    case 'disabled':
      return await roomsMenu()
    default: {
      if (value) {
        const room = await getRoomByToken(value)
        assert(room)
        await roomMenu(room)
        return await roomsMenu()
      } else {
        process.exit(0)
      }
    }
  }
}

export const drawRoomsMenu = async () => {
  const rooms = await getRooms()
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: 'Rooms menu',
    choices: [
      ...(rooms.length
        ? rooms.map(room => ({ title: room.name, description: '@' + room.token, value: room.token }))
        : [{ title: '\x1b[0m\x1b[38;5;235mNo rooms added yet', value: 'disabled' }]
      ),
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      { title: 'Create a new room', value: 'addRoom' },
      { title: 'Back', description: 'Back to main menu', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}