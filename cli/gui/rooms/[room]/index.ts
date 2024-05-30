import prompts from 'prompts'
import { clearLines } from '../../_utils'
import { roomsEntity } from '../../../../src/schema'
import { editRoomNameMenu } from './edit-name'
import { editRoomDescriptionMenu } from './edit-description'
import { editRoomAvatarMenu } from './edit-avatar'
import { roomAdminsAndModsMenu } from './admins-and-mods'
import { roomBansMenu } from './bans'
import { roomPermissionOverridesMenu } from './permissions'
import { deleteRoomMenu } from './delete'
import { roomGeneralSettings } from './general-settings'

export const roomMenu = async (room: roomsEntity) => {
  const value = await drawRoomMenu(room)
  switch (value) {
    case 'name':
      await editRoomNameMenu(room)
      return await roomMenu(room)
    case 'description':
      await editRoomDescriptionMenu(room)
      return await roomMenu(room)
    case 'avatar':
      await editRoomAvatarMenu(room)
      return await roomMenu(room)
    case 'general':
      await roomGeneralSettings(room)
      return await roomMenu(room)
    case 'adminsAndMods':
      await roomAdminsAndModsMenu(room)
      return await roomMenu(room)
    case 'bans':
      await roomBansMenu(room)
      return await roomMenu(room)
    case 'permissions':
      await roomPermissionOverridesMenu(room)
      return await roomMenu(room)
    case 'delete':
      if(await deleteRoomMenu(room)) {
        return
      } else {
        return await roomMenu(room)
      }
    case 'back':
      return
    default:
      process.exit(0)
  }
}

const drawRoomMenu = async (room: roomsEntity) => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token})`,
    choices: [
      {
        title: 'Edit name', value: 'name',
        description: room.name || undefined
      },
      {
        title: room.description ? 'Edit description' : 'Add description',
        value: 'description',
        description: room.description || undefined
      },
      { title: room.image ? 'Edit avatar' : 'Add avatar', description: 'Avatar is the room\'s picture, displayed in Session clients', value: 'avatar' },
      { title: 'General settings', description: 'Rate limits, participants DMs', value: 'general' },
      { title: 'Manage mods and admins', value: 'adminsAndMods' },
      { title: 'Ban/unban user(s)', value: 'bans' },
      { title: 'Manage users permissions', description: 'For advanced use', value: 'permissions' },
      { title: 'Delete room', value: 'delete' },
      { title: 'Go back', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}