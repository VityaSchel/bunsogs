import prompts from 'prompts'
import { CreateRoomInput } from './types'
import { addAdmin, addGlobalAdmin, addGlobalModerator, addModerator, createRoom, deleteRoom, getGlobalAdminsAndModerators, getOrCreateUserIdBySessionID, getRoomAdminsAndModerators, getRoomByToken, getRooms, removeAdminOrModFromRoom, removeGlobalAdminOrMod, setRoomDescription, setRoomName } from './rooms'
import { roomsEntity } from '../src/schema'
import assert from 'assert'
import { formatSid } from './utils'

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
      return await roomsMenu()
    case 'back':
      return
    case 'disabled':
      return await roomsMenu()
    default: {
      if (value) {
        const room = await getRoomByToken(value)
        assert(room)
        await roomMenu(room)
        return await roomsMenu()
      } else {
        process.exit(0)
      }
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

const roomMenu = async (room: roomsEntity) => {
  const value = await drawRoomMenu(room)
  switch (value) {
    case 'name':
      await editRoomNameMenu(room)
      return await roomMenu(room)
    case 'description':
      await editRoomDescriptionMenu(room)
      return await roomMenu(room)
    case 'avatar':
      // TODO
      await showError('This section of CLI is still under development')
      return await roomMenu(room)
    case 'adminsAndMods':
      await roomAdminsAndModsMenu(room)
      return await roomMenu(room)
    case 'bans':
      // TODO
      await showError('This section of CLI is still under development')
      return await roomMenu(room)
    case 'permissions':
      // TODO
      await showError('This section of CLI is still under development')
      return await roomMenu(room)
    case 'delete':
      await deleteRoomMenu(room)
      return await roomMenu(room)
    case 'back':
      return
    default:
      process.exit(0)
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
      { title: 'Manage mods and admins', value: 'adminsAndMods' },
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
      await setRoomName(room.id, response.value)
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
      await setRoomDescription(room.id, response.value)
      await showSuccess('Room description changed to ' + response.value)
    } catch(e) {
      await showError(e)
    }
  }
  return
}

const roomAdminsAndModsMenu = async (room: roomsEntity) => {
  const value = await drawRoomAdminsAndModsMenu(room)
  switch (value) {
    case 'addAdmin':
      await addAdminMenu(room)
      return await roomAdminsAndModsMenu(room)
    case 'addModerator':
      await addModeratorMenu(room)
      return await roomAdminsAndModsMenu(room)
    case 'back':
      return
    case 'disabled':
      return await roomAdminsAndModsMenu(room)
    default: {
      if (value) {
        await deleteRoomAdminOrMod(room, value)
        return await roomAdminsAndModsMenu(room)
      } else {
        process.exit(0)
      }
    }
  }
}

const drawRoomAdminsAndModsMenu = async (room: roomsEntity) => {
  const { admins, moderators } = await getRoomAdminsAndModerators(room.id)
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Admins/moderators`,
    choices: [
      { title: '\x1b[0m\x1b[38;5;238m──────Admins──────', value: 'disabled' },
      ...(admins.length
        ? admins.map(admin => { 
          let title = formatSid(admin.session_id)
          if(!admin.visible_mod) {
            title = '\x1b[3m[hidden]\x1b[23m ' + title
          }
          return {
            title,
            description: 'Hit enter to remove them from list', 
            value: admin.session_id
          }
        })
        : [{ title: '\x1b[0m\x1b[38;5;235mNo admins added in this room', value: 'disabled' }]
      ),
      { title: '\x1b[0m\x1b[38;5;238m────Moderators────', value: 'disabled' },
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
        : [{ title: '\x1b[0m\x1b[38;5;235mNo moderators added in this room', value: 'disabled' }]
      ),
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      { title: 'Add room admin', value: 'addAdmin' },
      { title: 'Add room moderator', value: 'addModerator' },
      { title: 'Go back', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}

const addAdminMenu = async (room: roomsEntity) => {
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Admins/moderators ❯ Add new admin\x1b[0m`)
  const { id, visible } = await prompts([
    {
      type: 'text',
      name: 'id',
      message: 'Session ID of user which you want to make an admin',
      validate: id => id.length !== 66
        ? 'Session ID must be exactly 66 characters long'
        : /05[a-f0-9]+/.test(id)
          ? true
          : 'Invalid Session ID format'
    },
    {
      type: 'toggle',
      name: 'visible',
      message: 'Visible for regular users?',
      initial: true,
      active: 'visible',
      inactive: 'hidden'
    },
  ])
  clearLines(visible !== undefined ? 3 : 2)
  if (id) {
    try {
      await addAdmin({ roomId: room.id, userSessionID: id, visible })
    } catch (e) {
      await showError(e)
    }
  }
  return
}

const addModeratorMenu = async (room: roomsEntity) => {
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Admins/moderators ❯ Add new moderator\x1b[0m`)
  const { id, visible } = await prompts([
    {
      type: 'text',
      name: 'id',
      message: 'Session ID of user which you want to make a moderator',
      validate: id => id.length !== 66
        ? 'Session ID must be exactly 66 characters long'
        : /05[a-f0-9]+/.test(id)
          ? true
          : 'Invalid Session ID format'
    },
    {
      type: 'toggle',
      name: 'visible',
      message: 'Visible for regular users?',
      initial: true,
      active: 'visible',
      inactive: 'hidden'
    },
  ])
  clearLines(visible !== undefined ? 3 : 2)
  if (id) {
    try {
      await addModerator({ roomId: room.id, userSessionID: id, visible })
    } catch (e) {
      await showError(e)
    }
  }
  return
}

const deleteRoomAdminOrMod = async (room: roomsEntity, userSessionID: string) => {
  const userId = await getOrCreateUserIdBySessionID(userSessionID)
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Admins/moderators ❯ Remove from list\x1b[0m`)
  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Are you sure you want to demote this person to regular user?',
  })
  clearLines(2)
  if (confirmed) {
    try {
      await removeAdminOrModFromRoom({ roomId: room.id, userId })
    } catch (e) {
      await showError(e)
    }
  }
  return
}

const deleteRoomMenu = async (room: roomsEntity) => {
  console.log('\x1b[33mDeleting room includes deleting all messages, files and other content in it.')
  console.log('\x1b[33mIt is permanent and dangerous. If you want to proceed, type room\'s token below')
  const response = await prompts({
    type: 'text',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Delete room`,
  })
  clearLines(3)
  const ctrlCPressed = typeof response.value !== 'string'
  if (!ctrlCPressed && response.value === room.token) {
    try {
      await deleteRoom(room.token)
      await showSuccess('Room deleted')
    } catch(e) {
      await showError(e)
    }
  }
  return
}

const drawGlobalSettingsMenu = async () => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: 'Global settings menu',
    choices: [
      { title: 'Global admins', description: 'Manage global admins/moderators', value: 'globalAdminsAndMods' },
      { title: 'Global bans/unbans', description: 'Ban Session ID(s) in all rooms', value: 'bans' },
      { title: 'Global permissions', description: 'Set global permissions overrides for specific Session ID(s)', value: 'overrides' },
      { title: 'Back', description: 'Back to main menu', value: 'back' }
    ]
  })
  clearLines(1)
  return response.value
}

const globalSettingsMenu = async () => {
  const value = await drawGlobalSettingsMenu()
  switch (value) {
    case 'globalAdminsAndMods':
      await globalAdminsAndModsMenu()
      return await globalSettingsMenu()
    case 'bans':
      // TODO
      await showError('This section of CLI is still under development')
      return await globalSettingsMenu()
    case 'overrides':
      // TODO
      await showError('This section of CLI is still under development')
      return await globalSettingsMenu()
    case 'back':
      return
    default:
      process.exit(0)
  }
}

const globalAdminsAndModsMenu = async () => {
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

const addGlobalAdminMenu = async () => {
  console.log('\x1b[36m? \x1b[38;1;240mGlobal settings ❯ Global admins/moderators ❯ Add new admin\x1b[0m')
  const { id, visible } = await prompts([
    {
      type: 'text',
      name: 'id',
      message: 'Session ID of user which you want to make a global admin',
      validate: id => id.length !== 66
        ? 'Session ID must be exactly 66 characters long'
        : /05[a-f0-9]+/.test(id)
          ? true
          : 'Invalid Session ID format'
    },
    {
      type: 'toggle',
      name: 'visible',
      message: 'Visible for regular users?',
      initial: true,
      active: 'visible',
      inactive: 'hidden'
    },
  ])
  clearLines(visible !== undefined ? 3 : 2)
  if (id) {
    try {
      await addGlobalAdmin({ userSessionID: id, visible })
    } catch (e) {
      await showError(e)
    }
  }
  return
}

const addGlobalModeratorMenu = async () => {
  console.log('\x1b[36m? \x1b[38;1;240mGlobal settings ❯ Global admins/moderators ❯ Add new moderator\x1b[0m')
  const { id, visible } = await prompts([
    {
      type: 'text',
      name: 'id',
      message: 'Session ID of user which you want to make a global moderator',
      validate: id => id.length !== 66
        ? 'Session ID must be exactly 66 characters long'
        : /05[a-f0-9]+/.test(id)
          ? true
          : 'Invalid Session ID format'
    },
    {
      type: 'toggle',
      name: 'visible',
      message: 'Visible for regular users?',
      initial: true,
      active: 'visible',
      inactive: 'hidden'
    },
  ])
  clearLines(visible !== undefined ? 3 : 2)
  if (id) {
    try {
      await addGlobalModerator({ userSessionID: id, visible })
    } catch (e) {
      await showError(e)
    }
  }
  return
}

const deleteGlobalAdminOrMod = async (userSessionID: string) => {
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