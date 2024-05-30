import prompts from 'prompts'
import { clearLines } from '../../../_utils'
import { roomsEntity } from '../../../../../src/schema'
import { getRoomAdminsAndModerators } from '../../../../rooms'
import { formatSid } from '../../../../utils'
import { addAdminMenu } from './add-admin'
import { addModeratorMenu } from './add-moderator'
import { deleteRoomAdminOrMod } from './delete-admin-or-mod'

export const roomAdminsAndModsMenu = async (room: roomsEntity) => {
  const value = await drawRoomAdminsAndModsMenu(room)
  switch (value) {
    case 'addAdmin':
      await addAdminMenu(room)
      return await roomAdminsAndModsMenu(room)
    case 'addModerator':
      await addModeratorMenu(room)
      return await roomAdminsAndModsMenu(room)
    case 'back':
      return
    case 'disabled':
      return await roomAdminsAndModsMenu(room)
    default: {
      if (value) {
        await deleteRoomAdminOrMod(room, value)
        return await roomAdminsAndModsMenu(room)
      } else {
        process.exit(0)
      }
    }
  }
}

const drawRoomAdminsAndModsMenu = async (room: roomsEntity) => {
  const { admins, moderators } = await getRoomAdminsAndModerators(room.id)
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Admins/moderators`,
    choices: [
      { title: '\x1b[0m\x1b[38;5;238m──────Admins──────', value: 'disabled' },
      ...(admins.length
        ? admins.map(admin => {
          let title = formatSid(admin.session_id)
          if (!admin.visible_mod) {
            title = '\x1b[3m[hidden]\x1b[23m ' + title
          }
          return {
            title,
            description: 'Hit enter to remove them from list',
            value: admin.session_id
          }
        })
        : [{ title: '\x1b[0m\x1b[38;5;235mNo admins added in this room', value: 'disabled' }]
      ),
      { title: '\x1b[0m\x1b[38;5;238m────Moderators────', value: 'disabled' },
      ...(moderators.length
        ? moderators.map(moderator => {
          let title = formatSid(moderator.session_id)
          if (!moderator.visible_mod) {
            title = '\x1b[3m[hidden]\x1b[23m ' + title
          }
          return {
            title,
            description: 'Hit enter to remove them from list',
            value: moderator.session_id
          }
        })
        : [{ title: '\x1b[0m\x1b[38;5;235mNo moderators added in this room', value: 'disabled' }]
      ),
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      { title: 'Add room admin', value: 'addAdmin' },
      { title: 'Add room moderator', value: 'addModerator' },
      { title: 'Go back', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}