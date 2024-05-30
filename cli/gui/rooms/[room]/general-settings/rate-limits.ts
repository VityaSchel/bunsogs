import prompts from 'prompts'
import { roomsEntity } from '../../../../../src/schema'
import { clearLines, showError } from '../../../_utils'
import { setRoomRateLimits } from '../../../../rooms'

export const editRoomRateLimitSettings = async (room: roomsEntity) => {
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ General settings ❯ Rate limits\x1b[0m`)
  const { size, interval } = await prompts([
    {
      type: 'number',
      name: 'size',
      min: 0,
      max: Number.MAX_VALUE,
      message: 'How many messages user can send in a time frame? Pass 0 to disable rate limits',
      validate: size => size === '' ? 'Please input a number' : true
    },
    {
      type: 'number',
      name: 'interval',
      min: 0.1,
      max: Number.MAX_VALUE,
      message: 'How much is the time frame in seconds?',
      validate: size => size === '' ? 'Please input a number' : true
    },
  ])
  clearLines(size !== undefined ? 3 : 2)
  if (size !== undefined && interval !== undefined) {
    try {
      await setRoomRateLimits(room.id, { size, interval })
    } catch (e) {
      await showError(e)
    }
  }
  return
}