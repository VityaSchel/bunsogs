import prompts from 'prompts'
import { formatSid } from '../../../utils'
import { clearLines } from '../../_utils'
import { getGlobalAdminsAndModerators } from '../../../global-settings'
import { addGlobalAdminMenu } from './add-global-admin'
import { addGlobalModeratorMenu } from './add-global-moderator'
import { deleteGlobalAdminOrMod } from './delete-global-admin-or-mod'

export const globalAdminsAndModsMenu = async () => {
  const value = await drawGlobalAdminsAndModsMenu()
  switch (value) {
    case 'addGlobalAdmin':
      await addGlobalAdminMenu()
      return await globalAdminsAndModsMenu()
    case 'addGlobalModerator':
      await addGlobalModeratorMenu()
      return await globalAdminsAndModsMenu()
    case 'back':
      return
    case 'disabled':
      return await globalAdminsAndModsMenu()
    default: {
      if (value) {
        await deleteGlobalAdminOrMod(value)
        return await globalAdminsAndModsMenu()
      } else {
        process.exit(0)
      }
    }
  }
}

const drawGlobalAdminsAndModsMenu = async () => {
  const { admins, moderators } = await getGlobalAdminsAndModerators()
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: 'Global settings ❯ Global admins/moderators',
    choices: [
      { title: '\x1b[0m\x1b[38;5;238m────Global admins────', value: 'disabled' },
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
        : [{ title: '\x1b[0m\x1b[38;5;235mNo admins added globally', value: 'disabled' }]
      ),
      { title: '\x1b[0m\x1b[38;5;238m──Global moderators──', value: 'disabled' },
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
        : [{ title: '\x1b[0m\x1b[38;5;235mNo moderators added globally', value: 'disabled' }]
      ),
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      { title: 'Add global admin', value: 'addGlobalAdmin' },
      { title: 'Add global moderator', value: 'addGlobalModerator' },
      { title: 'Go back', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}