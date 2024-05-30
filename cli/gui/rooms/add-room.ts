import prompts from 'prompts'
import { clearLines, showError, showSuccess } from '../_utils'
import { CreateRoomInput } from '../../types'
import { createRoom } from '../../rooms'

export const addRoomMenu = async () => {
  const value = await drawAddRoomMenu()
  if (value === null) {
    return
  } else {
    try {
      const id = await createRoom(value)
      return await showSuccess(`Created room \`${value.token}\` with id ${id}`)
    } catch (e) {
      return await showError(e)
    }
  }
}

export const drawAddRoomMenu = async (): Promise<CreateRoomInput | null> => {
  const response = await prompts([
    {
      type: 'text',
      name: 'token',
      message: 'Room token (visible in URL, a-z, A-Z, 0-9, _ and - characters)',
      validate: value => value === ''
        ? 'Room token can\'t be empty'
        : value.length > 64
          ? 'Room token must be 64 characters or less'
          : !/^[\w-]{1,64}$/.test(value)
            ? 'Room tokens may only contain a-z, A-Z, 0-9, _, and - characters'
            : true
    },
    {
      type: 'text',
      name: 'name',
      message: 'Room name',
      validate: value => value === ''
        ? 'Room name can\'t be empty'
        : value.length > 64
          ? 'Room name must be 64 characters or less'
          : true
    },
    {
      type: 'text',
      name: 'description',
      message: 'Room description (optional)',
      validate: value => value === ''
        ? true
        : value.length > 1000
          ? 'Room description must be 1000 characters or less'
          : true
    },
    {
      type: 'select',
      name: 'permissions',
      message: 'Select default permissions (these can be configured per-user later)',
      initial: 3,
      choices: [
        { title: 'Hidden (none)', value: 'none', description: 'Room will be invite-only' },
        { title: 'Read-only (ar)', value: 'ar', description: 'Only admins & mods can send messages' },
        { title: 'Read+write (arw)', value: 'arw', description: 'Everyone can chat, you decide who can send images' },
        { title: 'Read, write and upload files (arwu)', value: 'Full permissions, everyone can send anything' }
      ],
    },
  ])
  const isAborted = !(Object.hasOwn(response, 'token') && Object.hasOwn(response, 'name') && Object.hasOwn(response, 'description') && Object.hasOwn(response, 'permissions'))
  if (isAborted) {
    if (Object.hasOwn(response, 'description')) {
      clearLines(4)
    } else if (Object.hasOwn(response, 'name')) {
      clearLines(3)
    } else if (Object.hasOwn(response, 'token')) {
      clearLines(2)
    } else {
      clearLines(1)
    }
    return null
  } else {
    clearLines(4)
    return {
      token: response.token,
      name: response.name,
      description: response.description,
      permissions: response.permissions === 'none' ? '' : response.permissions
    }
  }
}