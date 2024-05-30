import prompts from 'prompts'
import { clearLines } from '../../../_utils'
import { formatPermsOverride, formatSid } from '../../../../utils'
import { roomsEntity } from '../../../../../src/schema'
import { getRoomPermissionsOverrides } from '../../../../rooms'
import { changeUserRoomPermissionsOverridesMenu } from './change'

export const roomPermissionOverridesMenu = async (room: roomsEntity) => {
  const value = await drawRoomPermissionOverridesMenu(room)
  switch (value) {
    case 'addNewOverride':
      await changeUserRoomPermissionsOverridesMenu(room)
      return await roomPermissionOverridesMenu(room)
    case 'back':
      return
    case 'disabled':
      return await roomPermissionOverridesMenu(room)
    default: {
      if (value) {
        await changeUserRoomPermissionsOverridesMenu(room, value)
        return await roomPermissionOverridesMenu(room)
      } else {
        process.exit(0)
      }
    }
  }
}

const drawRoomPermissionOverridesMenu = async (room: roomsEntity) => {
  const permissionOverrides = await getRoomPermissionsOverrides(room.id)
  const response = await prompts({
    type: 'autocomplete',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ User permissions overrides`,
    choices: [
      { title: 'Modify user\'s permisions', value: 'addNewOverride' },
      { title: 'Go back', value: 'back' },
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      ...(permissionOverrides.length
        ? permissionOverrides.map(override => ({
          title: formatSid(override.session_id) + ` (${formatPermsOverride(override)})`,
          description: 'Hit enter to edit permissions',
          value: override.session_id
        }))
        : [{ title: '\x1b[0m\x1b[38;5;235mNo users with special permissions', value: 'disabled' }]
      )
    ]
  })
  clearLines(1)
  return response.value
}