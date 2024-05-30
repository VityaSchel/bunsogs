import prompts from 'prompts'
import { roomsEntity } from '../../../../../src/schema'
import { clearLines } from '../../../_utils'
import { getRoomRateLimits } from '../../../../rooms'
import { editRoomRateLimitSettings } from './rate-limits'
import { editRoomParticipantsDmSetting } from './participants-dm'

export const roomGeneralSettings = async (room: roomsEntity) => {
  const value = await drawRoomGeneralSettingsMenu(room)
  switch (value) {
    case 'rateLimits':
      await editRoomRateLimitSettings(room)
      return await roomGeneralSettings(room)
    case 'participantsDm':
      await editRoomParticipantsDmSetting(room)
      return await roomGeneralSettings(room)
    case 'back':
      return
    default:
      process.exit(0)
  }
}

const drawRoomGeneralSettingsMenu = async (room: roomsEntity) => {
  const rateLimits = await getRoomRateLimits(room.id)
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ General settings`,
    choices: [
      {
        title: 'Rate limits', 
        value: 'rateLimits',
        description: `Current: up to ${rateLimits.size ?? 5} messages per time frame of ${rateLimits.interval ?? 16} seconds`
      },
      { 
        title: 'Participants DM', 
        value: 'participantsDm',
        description: 'Whether participants can send messages to each other'
      },
      { title: 'Go back', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}