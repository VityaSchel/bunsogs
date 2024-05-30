import prompts from 'prompts'
import { getGlobalBans } from '../../../global-settings'
import { formatSid } from '../../../utils'
import { clearLines } from '../../_utils'
import { globalBanMenu } from './ban'
import { globalUnbanMenu } from './unban'

export const globalBansMenu = async () => {
  const value = await drawGlobalBansMenu()
  switch (value) {
    case 'ban':
      await globalBanMenu()
      return await globalBansMenu()
    case 'back':
      return
    case 'disabled':
      return await globalBansMenu()
    default: {
      if (value) {
        await globalUnbanMenu(value)
        return await globalBansMenu()
      } else {
        process.exit(0)
      }
    }
  }
}

const drawGlobalBansMenu = async () => {
  const bannedUsers = await getGlobalBans()
  const response = await prompts({
    type: 'autocomplete',
    name: 'value',
    message: 'Global settings ❯ Global bans',
    choices: [
      { title: 'Ban user globally', value: 'ban' },
      { title: 'Go back', value: 'back' },
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      ...(bannedUsers.length
        ? bannedUsers.map(user => ({
          title: formatSid(user.session_id),
          description: 'Hit enter to unban',
          value: user.session_id
        }))
        : [{ title: '\x1b[0m\x1b[38;5;235mNo users banned globally', value: 'disabled' }]
      )
    ]
  })
  clearLines(1)
  return response.value
}