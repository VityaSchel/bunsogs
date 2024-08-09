import prompts from 'prompts'
import { clearLines } from '../_utils'
import { globalAdminsAndModsMenu } from './admins-and-mods'
import { globalBansMenu } from './bans'
import { globalPermissionOverridesMenu } from './permissions'
import { apiAccessMenu } from './api-access'

export const globalSettingsMenu = async () => {
  const value = await drawGlobalSettingsMenu()
  switch (value) {
    case 'globalAdminsAndMods':
      await globalAdminsAndModsMenu()
      return await globalSettingsMenu()
    case 'bans':
      await globalBansMenu()
      return await globalSettingsMenu()
    case 'overrides':
      await globalPermissionOverridesMenu()
      return await globalSettingsMenu()
    case 'apiAccess':
      await apiAccessMenu()
      return await globalSettingsMenu()
    case 'back':
      return
    default:
      process.exit(0)
  }
}

const drawGlobalSettingsMenu = async () => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: 'Global settings menu',
    choices: [
      { title: 'Global admins/mods', description: 'Manage global admins/moderators', value: 'globalAdminsAndMods' },
      { title: 'Global bans/unbans', description: 'Ban Session ID(s) in all rooms', value: 'bans' },
      { title: 'Global permissions overrides', description: 'Set global permissions overrides for specific Session ID(s)', value: 'overrides' },
      { title: 'API admin access', description: '[Advanced use] Enable/disable REST API access via secret token for debugging', value: 'apiAccess' },
      { title: 'Back', description: 'Back to main menu', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}