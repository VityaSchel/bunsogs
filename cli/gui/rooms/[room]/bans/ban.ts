import prompts from 'prompts'
import { roomsEntity } from '../../../../../src/schema'
import { clearLines, showError } from '../../../_utils'
import { getOrCreateUserIdBySessionID } from '../../../../global-settings'
import { roomBan } from '../../../../rooms'
import { blindSessionId } from '@session.js/blinded-session-id'
import { key } from '../../../../db'

export const roomBanMenu = async (room: roomsEntity) => {
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Bans ❯ Ban user\x1b[0m`)
  const { userSessionID, timeout } = await prompts([
    {
      type: 'text',
      name: 'userSessionID',
      message: 'Enter Session ID of user you want to ban in this room',
      validate: id => id.length !== 66
        ? 'Session ID must be exactly 66 characters long'
        : /(05|15)[a-f0-9]+/.test(id)
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
  clearLines(userSessionID !== undefined ? 3 : 2)
  if (userSessionID) {
    const sessionId = userSessionID.startsWith('05') ? blindSessionId({
      sessionId: userSessionID,
      serverPk: Buffer.from(key.publicKey).toString('hex')
    }) : userSessionID
    const userId = await getOrCreateUserIdBySessionID(sessionId)
    try {
      await roomBan({ roomId: room.id, userId }, typeof timeout === 'number' ? { timeoutInSeconds: timeout } : undefined)
    } catch (e) {
      await showError(e)
    }
  }
  return
}