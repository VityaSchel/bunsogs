import prompts from 'prompts'
import { getUserIdBySessionID, globalUnban } from '../../../global-settings'
import { clearLines, showError } from '../../_utils'

export const globalUnbanMenu = async (sessionID: string) => {
  const userId = await getUserIdBySessionID(sessionID)
  if (!userId) {
    return await showError('User not found')
  }
  console.log('\x1b[36m? \x1b[38;1;240mGlobal settings ❯ Global bans ❯ Unban user\x1b[0m')
  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Are you sure you want to unban this user globally?',
  })
  clearLines(2)
  if (confirmed) {
    try {
      await globalUnban(userId)
    } catch (e) {
      await showError(e)
    }
  }
  return
}