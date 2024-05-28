import prompts from 'prompts'
import { CreateRoomInput } from './types'
import { createRoom, getRoomByToken, getRooms } from './rooms'
import { roomsEntity } from '../src/schema'
import assert from 'assert'
import { db } from './db'

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
    ],
    hint: ' '
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
    ],
    hint: ' '
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
      { title: 'Rooms', value: 'rooms' },
      { title: 'Global settings', value: 'globalSettings' },
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
    default: {
      if (value) {
        const room = await getRoomByToken(value)
        assert(room)
        await roomMenu(room)
        return await roomsMenu()
      } else {
        process.exit(0)
      }
      break
    }
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
    ]
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

const drawRoomMenu = async (room: roomsEntity) => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token})`,
    choices: [
      { 
        title: 'Edit name', value: 'name',
        description: room.name || undefined
      },
      { 
        title: room.description ? 'Edit description' : 'Add description', 
        value: 'description',
        description: room.description || undefined
      },
      { title: room.image ? 'Edit avatar' : 'Add avatar', description: 'Avatar is the room\'s picture, displayed in Session clients', value: 'avatar' },
      { title: 'Manage mods and admins', value: 'mods' },
      { title: 'Ban/unban user(s)', value: 'bans' },
      { title: 'Manage users permissions', description: 'For advanced use', value: 'permissions' },
      { title: 'Delete room', value: 'delete' },
      { title: 'Go back', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}

const editRoomNameMenu = async (room: roomsEntity) => {
  const response = await prompts({
    type: 'text',
    name: 'value',
    initial: room.name,
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Name`,
    validate: value => value === ''
      ? 'Room name can\'t be empty'
      : value.length > 64
        ? 'Room name must be 64 characters or less'
        : true
  })
  clearLines(1)
  const ctrlCPressed = !response.value
  if (!ctrlCPressed && response.value !== room.name) {
    try {
      await db.query<unknown, { $id: number, $name: string }>('UPDATE rooms SET name = $name WHERE id = $id')
        .run({ $id: room.id, $name: response.value })
      await showSuccess('Room name changed to ' + response.value)
    } catch(e) {
      await showError(e)
    }
  }
  return
}

const editRoomDescriptionMenu = async (room: roomsEntity) => {
  const response = await prompts({
    type: 'text',
    name: 'value',
    initial: room.description || '',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Description`,
    validate: value => value === ''
      ? true
      : value.length > 1000
        ? 'Room description must be 1000 characters or less'
        : true
  })
  clearLines(1)
  const ctrlCPressed = typeof response.value !== 'string'
  if (!ctrlCPressed && response.value !== String(room.description)) {
    try {
      await db.query<unknown, { $id: number, $description: string }>('UPDATE rooms SET description = $description WHERE id = $id')
        .run({ $id: room.id, $description: response.value || null })
      await showSuccess('Room description changed to ' + response.value)
    } catch(e) {
      await showError(e)
    }
  }
  return
}

const roomMenu = async (room: roomsEntity) => {
  const value = await drawRoomMenu(room)
  switch (value) {
    case 'name':
      return await editRoomNameMenu(room)
    case 'description':
      return await editRoomDescriptionMenu(room)
    case 'avatar':

      break
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
      { title: 'Global admins', description: 'Manage global admins', value: 'globalAdmins' },
      { title: 'Global moderators', description: 'Manage global moderators', value: 'globalModerators' },
      { title: 'Override global permissions', description: 'Set global override for specific Session ID', value: 'overrides' },
      { title: 'Back', description: 'Back to main menu', value: 'back' }
    ]
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