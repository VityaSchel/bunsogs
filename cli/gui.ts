import prompts from 'prompts'
import { CreateRoomInput } from './types'
import { createRoom, getRooms } from './rooms'

const clearLines = (count) => {
  process.stdout.write(`\x1b[${count}A`)
  process.stdout.write('\x1b[0J')
}

const showSuccess = async (message: string) => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: '' + message,
    choices: [
      { title: 'OK', value: 'ok' }
    ]
  })
  clearLines(1)
  return response.value === 'ok'
}

const showError = async (e: any) => {
  let message: string
  if(e instanceof Error) {
    message = 'Error: ' + e.message
  } else if(typeof e === 'string') {
    message = e
  } else {
    message = 'Unknown error'
  }
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: '\x07\x1b[37;41;1m' + message + '\x1b[49m',
    choices: [
      { title: 'OK', value: 'ok' }
    ]
  })
  clearLines(1)
  return response.value === 'ok'
}

export const mainMenu = async () => {
  switch (await drawMainMenu()) {
    case 'rooms':
      await roomsMenu()
      break
    case 'globalSettings':
      await globalSettingsMenu()
      break
    case 'exit':
    default:
      return
  }
  await mainMenu()
}

const drawMainMenu = async () => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: 'Main menu',
    choices: [
      { title: 'Rooms', description: 'This is the second option', value: 'rooms' },
      { title: 'Global settings', description: 'This is the first option', value: 'globalSettings' },
      { title: 'Exit', description: 'Exit bunsogs-cli', value: 'exit' }
    ],
    hint: 'Use arrow keys to move, Enter to select'
  })
  clearLines(1)
  return response.value
}

const roomsMenu = async () => {
  const value = await drawRoomsMenu()
  switch (value) {
    case 'addRoom':
      await addRoomMenu()
      break
    case 'back':
      return
    case 'disabled':
      await roomsMenu()
      break
    default:
      if (value) {
        // await roomMenu()
      } else {
        process.exit(0)
      }
      // break
      return
  }
}

const drawRoomsMenu = async () => {
  const rooms = await getRooms()
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: 'Rooms menu',
    choices: [
      ...(rooms.length
        ? rooms.map(room => ({ title: room.name, description: '@' + room.token, value: room.token }))
        : [{ title: '\x1b[0m\x1b[38;5;235mNo rooms added yet', value: 'disabled' }]
      ),
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      { title: 'Create a new room', value: 'addRoom' },
      { title: 'Back', description: 'Back to main menu', value: 'back' }
    ],
    hint: 'Use arrow keys to move, Enter to select'
  })
  clearLines(1)
  return response.value
}

const addRoomMenu = async () => {
  const value = await drawAddRoomMenu()
  if (value === null) {
    return
  } else {
    try {
      const id = await createRoom(value)
      return await showSuccess(`Created room \`${value.token}\` with id ${id}`)
    } catch(e) {
      return await showError(e)
    }
  }
}

const drawAddRoomMenu = async (): Promise<CreateRoomInput | null> => {
  const response = await prompts([
    {
      type: 'text',
      name: 'token',
      message: 'Room token',
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
  ])
  const isAborted = !(Object.hasOwn(response, 'token') && Object.hasOwn(response, 'name') && Object.hasOwn(response, 'description'))
  if (isAborted) {
    if (Object.hasOwn(response, 'name')) {
      clearLines(3)
    } else if (Object.hasOwn(response, 'token')) {
      clearLines(2)
    } else {
      clearLines(1)
    }
    return null
  } else {
    clearLines(3)
    return {
      token: response.token,
      name: response.name,
      description: response.description,
    }
  }
}

const drawGlobalSettingsMenu = async () => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: 'Global settings menu',
    choices: [
      { title: 'Global admins', description: 'Manage global admins', value: 'globalAdmins' },
      { title: 'Global moderators', description: 'Manage global moderators', value: 'globalModerators' },
      { title: 'Override global permissions', description: 'Set global override for specific Session ID', value: 'overrides' },
      { title: 'Back', description: 'Back to main menu', value: 'back' }
    ],
    hint: 'Use arrow keys to move, Enter to select'
  })
  clearLines(1)
  return response.value
}

const globalSettingsMenu = async () => {
  switch (await drawGlobalSettingsMenu()) {
    case 'globalAdmins':
      // await globalAdminsMenu()
      // break
      return
    case 'globalModerators':
      // await globalModeratorsMenu()
      // break
      return
    case 'overrides':
      // await globalOverridesMenu()
      // break
      return
    case 'back':
      return
    default:
      process.exit(0)
  }
}