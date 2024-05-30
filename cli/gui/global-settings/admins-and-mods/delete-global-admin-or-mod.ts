import prompts from 'prompts'
import { getOrCreateUserIdBySessionID, removeGlobalAdminOrMod } from '../../../global-settings'
import { clearLines, showError } from '../../_utils'

export const deleteGlobalAdminOrMod = async (userSessionID: string) => {
  const userId = await getOrCreateUserIdBySessionID(userSessionID)
  console.log('\x1b[36m? \x1b[38;1;240mGlobal settings ❯ Global admins/moderators ❯ Remove from list\x1b[0m')
  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Are you sure you want to demote this person to regular user?',
  })
  clearLines(2)
  if (confirmed) {
    try {
      await removeGlobalAdminOrMod(userId)
    } catch (e) {
      await showError(e)
    }
  }
  return
}