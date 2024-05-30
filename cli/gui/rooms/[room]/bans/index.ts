import prompts from 'prompts'
import { clearLines } from '../../../_utils'
import { formatSid } from '../../../../utils'
import { roomsEntity } from '../../../../../src/schema'
import { getRoomBans } from '../../../../rooms'
import { roomBanMenu } from './ban'
import { roomUnbanMenu } from './unban'

export const roomBansMenu = async (room: roomsEntity) => {
  const value = await drawRoomBansMenu(room)
  switch (value) {
    case 'ban':
      await roomBanMenu(room)
      return await roomBansMenu(room)
    case 'back':
      return
    case 'disabled':
      return await roomBansMenu(room)
    default: {
      if (value) {
        await roomUnbanMenu(room, value)
        return await roomBansMenu(room)
      } else {
        process.exit(0)
      }
    }
  }
}

const drawRoomBansMenu = async (room: roomsEntity) => {
  const bannedUsers = await getRoomBans(room.id)
  const response = await prompts({
    type: 'autocomplete',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Bans`,
    choices: [
      { title: 'Ban user in this room', value: 'ban' },
      { title: 'Go back', value: 'back' },
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      ...(bannedUsers.length
        ? bannedUsers.map(user => ({
          title: formatSid(user.session_id),
          description: 'Hit enter to unban',
          value: user.session_id
        }))
        : [{ title: '\x1b[0m\x1b[38;5;235mNo users banned in this room', value: 'disabled' }]
      )
    ]
  })
  clearLines(1)
  return response.value
}