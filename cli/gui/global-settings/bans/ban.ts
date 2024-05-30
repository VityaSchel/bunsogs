import prompts from 'prompts'
import { clearLines, showError } from '../../_utils'
import { getOrCreateUserIdBySessionID, globalBan } from '../../../global-settings'

export const globalBanMenu = async () => {
  console.log('\x1b[36m? \x1b[38;1;240mGlobal settings ❯ Global bans ❯ Ban user\x1b[0m')
  const { sessionID, timeout } = await prompts([
    {
      type: 'text',
      name: 'sessionID',
      message: 'Enter Session ID of user you want to ban globally',
      validate: id => id.length !== 66
        ? 'Session ID must be exactly 66 characters long'
        : /05[a-f0-9]+/.test(id)
          ? true
          : 'Invalid Session ID format'
    },
    {
      type: 'number',
      name: 'timeout',
      min: 0,
      max: Number.MAX_VALUE,
      message: 'Enter time in seconds after which user will be unbanned (optional)',
    },
  ])
  clearLines(sessionID !== undefined ? 3 : 2)
  if (sessionID) {
    const userId = await getOrCreateUserIdBySessionID(sessionID)
    try {
      await globalBan(userId, typeof timeout === 'number' ? { timeoutInSeconds: timeout } : undefined)
    } catch (e) {
      await showError(e)
    }
  }
  return
}