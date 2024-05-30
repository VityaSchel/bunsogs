import prompts from 'prompts'
import { CreateRoomInput } from './types'
import { addAdmin, addModerator, createRoom, deleteRoom, getRoomAdminsAndModerators, getRoomBans, getRoomByToken, getRoomPermissionsOverrides, getRooms, getUserRoomPermissionsOverrides, removeAdminOrModFromRoom, roomBan, roomUnban, setRoomDescription, setRoomName, setRoomPermissionOverride } from './rooms'
import { roomsEntity } from '../src/schema'
import assert from 'assert'
import { PermsFlags, formatPermsOverride, formatSid } from './utils'
import { addGlobalAdmin, addGlobalModerator, getGlobalAdminsAndModerators, getGlobalBans, getOrCreateUserIdBySessionID, getUserIdBySessionID, globalBan, globalUnban, removeGlobalAdminOrMod } from './global-settings'

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
      await roomBansMenu(room)
      return await roomMenu(room)
    case 'permissions':
      await roomPermissionOverridesMenu(room)
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

const roomBansMenu = async (room: roomsEntity) => {
  const value = await drawRoomBansMenu(room)
  switch (value) {
    case 'ban':
      await roomBanMenu(room)
      return await roomBansMenu(room)
    case 'back':
      return
    case 'disabled':
      return await roomBansMenu(room)
    default: {
      if (value) {
        await roomUnbanMenu(room, value)
        return await roomBansMenu(room)
      } else {
        process.exit(0)
      }
    }
  }
}

const drawRoomBansMenu = async (room: roomsEntity) => {
  const bannedUsers = await getRoomBans(room.id)
  const response = await prompts({
    type: 'autocomplete',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ Bans`,
    choices: [
      { title: 'Ban user in this room', value: 'ban' },
      { title: 'Go back', value: 'back' },
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      ...(bannedUsers.length
        ? bannedUsers.map(user => ({
          title: formatSid(user.session_id),
          description: 'Hit enter to unban',
          value: user.session_id
        }))
        : [{ title: '\x1b[0m\x1b[38;5;235mNo users banned in this room', value: 'disabled' }]
      )
    ]
  })
  clearLines(1)
  return response.value
}

const roomBanMenu = async (room: roomsEntity) => {
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Bans ❯ Ban user\x1b[0m`)
  const { sessionID, timeout } = await prompts([
    {
      type: 'text',
      name: 'sessionID',
      message: 'Enter Session ID of user you want to ban in this room',
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
      await roomBan({ roomId: room.id, userId }, typeof timeout === 'number' ? { timeoutInSeconds: timeout } : undefined)
    } catch (e) {
      await showError(e)
    }
  }
  return
}

const roomUnbanMenu = async (room: roomsEntity, sessionID: string) => {
  const userId = await getUserIdBySessionID(sessionID)
  if (!userId) {
    return await showError('User not found')
  }
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ Bans ❯ Unban user\x1b[0m`)
  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Are you sure you want to unban this user in this room?',
  })
  clearLines(2)
  if (confirmed) {
    try {
      await roomUnban({ roomId: room.id, userId })
    } catch (e) {
      await showError(e)
    }
  }
  return
}

const roomPermissionOverridesMenu = async (room: roomsEntity) => {
  const value = await drawRoomPermissionOverridesMenu(room)
  switch (value) {
    case 'addNewOverride':
      await changeUserRoomPermissionsOverridesMenu(room)
      return await roomPermissionOverridesMenu(room)
    case 'back':
      return
    case 'disabled':
      return await roomPermissionOverridesMenu(room)
    default: {
      if (value) {
        await changeUserRoomPermissionsOverridesMenu(room, value)
        return await roomPermissionOverridesMenu(room)
      } else {
        process.exit(0)
      }
    }
  }
}

const drawRoomPermissionOverridesMenu = async (room: roomsEntity) => {
  const permissionOverrides = await getRoomPermissionsOverrides(room.id)
  const response = await prompts({
    type: 'autocomplete',
    name: 'value',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ User permissions overrides`,
    choices: [
      { title: 'Modify user\'s permisions', value: 'addNewOverride' },
      { title: 'Go back', value: 'back' },
      { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
      ...(permissionOverrides.length
        ? permissionOverrides.map(override => ({
          title: formatSid(override.session_id) + ` (${formatPermsOverride(override)})`,
          description: 'Hit enter to edit permissions',
          value: override.session_id
        }))
        : [{ title: '\x1b[0m\x1b[38;5;235mNo users with special permissions', value: 'disabled' }]
      )
    ]
  })
  clearLines(1)
  return response.value
}

const changeUserRoomPermissionsOverridesMenu = async (room: roomsEntity, userSessionId?: string) => {
  console.log(`\x1b[36m? \x1b[38;1;240mRooms ❯ ${room.name} (@${room.token}) ❯ User permissions overrides ❯ Modify user's permissions\x1b[0m`)
  let clearSessionIdLine = false
  if (!userSessionId) {
    clearSessionIdLine = true
    const { sessionID } = await prompts({
      type: 'text',
      name: 'sessionID',
      message: 'Session ID of user of whom you want to modify permissions',
      validate: id => id.length !== 66
        ? 'Session ID must be exactly 66 characters long'
        : /05[a-f0-9]+/.test(id)
          ? true
          : 'Invalid Session ID format'
    })
    if (!sessionID) {
      clearLines(2)
      return
    }
    userSessionId = sessionID
  }
  const userId = await getOrCreateUserIdBySessionID(userSessionId as string)
  const overrides = await getUserRoomPermissionsOverrides({ roomId: room.id, userId })
  const currentAccessible = overrides?.accessible !== null ? Boolean(overrides!.accessible) : null
  const currentRead = overrides?.accessible !== null ? Boolean(overrides!.accessible) : null
  const currentWrite = overrides?.accessible !== null ? Boolean(overrides!.accessible) : null
  const currentUpload = overrides?.accessible !== null ? Boolean(overrides!.accessible) : null
  const response = await prompts([
    {
      type: 'select',
      name: 'accessible',
      message: 'Accessible',
      initial: ['true', 'false', 'null'].indexOf(String(currentAccessible)),
      choices: [
        { title: 'True' + (currentAccessible === true ? ' (current value)' : ''), description: 'Room requests won\'t throw 404 errors', value: 'true' },
        { title: 'False' + (currentAccessible === false ? ' (current value)' : ''), description: 'Room will be invisible for this user', value: 'false' },
        { title: 'Not specified' + (currentAccessible === null ? ' (current value)' : ''), description: 'Fallback to default value for this room', value: 'null' }
      ],
    },
    {
      type: 'select',
      name: 'read',
      message: 'Read',
      initial: ['true', 'false', 'null'].indexOf(String(currentRead)),
      choices: [
        { title: 'True' + (currentRead === true ? ' (current value)' : ''), description: 'User can see messages and request room\'s updates', value: 'true' },
        { title: 'False' + (currentRead === false ? ' (current value)' : ''), description: 'Room requests will throw 403 errors', value: 'false' },
        { title: 'Not specified' + (currentRead === null ? ' (current value)' : ''), description: 'Fallback to default value for this room', value: 'null' }
      ],
    },
    {
      type: 'select',
      name: 'write',
      message: 'Write',
      initial: ['true', 'false', 'null'].indexOf(String(currentWrite)),
      choices: [
        { title: 'True' + (currentWrite === true ? ' (current value)' : ''), description: 'User can send messages', value: 'true' },
        { title: 'False' + (currentWrite === false ? ' (current value)' : ''), description: 'User can\'t send messages', value: 'false' },
        { title: 'Not specified' + (currentWrite === null ? ' (current value)' : ''), description: 'Fallback to default value for this room', value: 'null' }
      ],
    },
    {
      type: 'select',
      name: 'upload',
      message: 'Upload',
      initial: ['true', 'false', 'null'].indexOf(String(currentUpload)),
      choices: [
        { title: 'True' + (currentUpload === true ? ' (current value)' : ''), description: 'User can upload files such as images attachments', value: 'true' },
        { title: 'False' + (currentUpload === false ? ' (current value)' : ''), description: 'User can\'t upload any files', value: 'false' },
        { title: 'Not specified' + (currentUpload === null ? ' (current value)' : ''), description: 'Fallback to default value for this room', value: 'null' }
      ],
    },
  ])
  const isAborted = !(Object.hasOwn(response, 'accessible') && Object.hasOwn(response, 'read') && Object.hasOwn(response, 'write') && Object.hasOwn(response, 'upload'))
  if (isAborted) {
    if (Object.hasOwn(response, 'write')) {
      clearLines(clearSessionIdLine ? 6 : 5)
    } else if (Object.hasOwn(response, 'read')) {
      clearLines(clearSessionIdLine ? 5 : 4)
    } else if (Object.hasOwn(response, 'accessible')) {
      clearLines(clearSessionIdLine ? 4 : 3)
    } else {
      clearLines(clearSessionIdLine ? 3 : 2)
    }
    return null
  } else {
    clearLines(clearSessionIdLine ? 6 : 5)
    try {
      const toFlagValue = strval => strval === 'true' 
        ? true
        : strval === 'false'
          ? false
          : null
      const permissions: PermsFlags = {
        accessible: toFlagValue(response.accessible),
        read: toFlagValue(response.read),
        write: toFlagValue(response.write),
        upload: toFlagValue(response.upload),
      }
      await setRoomPermissionOverride({ roomId: room.id, userId, permissions })
    } catch(e) {
      await showError(e)
    }
  }
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
      { title: 'Global permissions overrides', description: 'Set global permissions overrides for specific Session ID(s)', value: 'overrides' },
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
      await globalBansMenu()
      return await globalSettingsMenu()
    case 'overrides':
      await globalPermissionOverridesMenu()
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

const globalBansMenu = async () => {
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

const globalBanMenu = async () => {
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

const globalUnbanMenu = async (sessionID: string) => {
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

const globalPermissionOverridesMenu = async () => {
  await showError('This section of CLI is still under development')
  // TODO: global permissions overrides
  // getGlobalPermissionsOverrides, getUserGlobalPermissionOverrides, setGlobalPermissionsOverrides
  // const value = await drawGlobalPermissionOverridesMenu()
  // switch (value) {
  //   case 'addNewOverride':
  //     await changeUserGlobalPermissionsOverridesMenu()
  //     return await globalPermissionOverridesMenu()
  //   case 'back':
  //     return
  //   case 'disabled':
  //     return await globalPermissionOverridesMenu()
  //   default: {
  //     if (value) {
  //       await changeUserGlobalPermissionsOverridesMenu(value)
  //       return await globalPermissionOverridesMenu()
  //     } else {
  //       process.exit(0)
  //     }
  //   }
  // }
}

// const drawGlobalPermissionOverridesMenu = async () => {
//   const permissionOverrides = await getGlobalPermissionsOverrides()
//   const response = await prompts({
//     type: 'autocomplete',
//     name: 'value',
//     message: 'Global settings ❯ Global permissions overrides',
//     choices: [
//       { title: 'Modify user\'s permisions', value: 'addNewOverride' },
//       { title: 'Go back', value: 'back' },
//       { title: '\x1b[0m\x1b[38;5;235m──────────────────', value: 'disabled' },
//       ...(permissionOverrides.length
//         ? permissionOverrides.map(override => ({
//           title: formatSid(override.session_id) + ` (${formatPermsOverride(override)})`,
//           description: 'Hit enter to edit permissions',
//           value: override.session_id
//         }))
//         : [{ title: '\x1b[0m\x1b[38;5;235mNo users with special permissions', value: 'disabled' }]
//       )
//     ]
//   })
//   clearLines(1)
//   return response.value
// }

// const changeUserGlobalPermissionsOverridesMenu = async (userSessionId?: string) => {
//   console.log('\x1b[36m? \x1b[38;1;240mGlobal settings ❯ Global permissions overrides ❯ Modify user\'s permissions\x1b[0m')
//   let clearSessionIdLine = false
//   if (!userSessionId) {
//     clearSessionIdLine = true
//     const { sessionID } = await prompts({
//       type: 'text',
//       name: 'sessionID',
//       message: 'Session ID of user of whom you want to modify permissions',
//       validate: id => id.length !== 66
//         ? 'Session ID must be exactly 66 characters long'
//         : /05[a-f0-9]+/.test(id)
//           ? true
//           : 'Invalid Session ID format'
//     })
//     if (!sessionID) {
//       clearLines(2)
//       return
//     }
//     userSessionId = sessionID
//   }
//   const userId = await getOrCreateUserIdBySessionID(userSessionId as string)
//   const overrides = await getUserGlobalPermissionOverrides(userId)
//   const currentAccessible = overrides?.accessible !== null ? Boolean(overrides!.accessible) : null
//   const currentRead = overrides?.accessible !== null ? Boolean(overrides!.accessible) : null
//   const currentWrite = overrides?.accessible !== null ? Boolean(overrides!.accessible) : null
//   const currentUpload = overrides?.accessible !== null ? Boolean(overrides!.accessible) : null
//   const response = await prompts([
//     {
//       type: 'select',
//       name: 'accessible',
//       message: 'Accessible',
//       initial: ['true', 'false', 'null'].indexOf(String(currentAccessible)),
//       choices: [
//         { title: 'True' + (currentAccessible === true ? ' (current value)' : ''), description: 'Rooms requests won\'t throw 404 errors', value: 'true' },
//         { title: 'False' + (currentAccessible === false ? ' (current value)' : ''), description: 'All rooms will be invisible for this user', value: 'false' },
//         { title: 'Not specified' + (currentAccessible === null ? ' (current value)' : ''), description: 'Fallback to each room\'s default value', value: 'null' }
//       ],
//     },
//     {
//       type: 'select',
//       name: 'read',
//       message: 'Read',
//       initial: ['true', 'false', 'null'].indexOf(String(currentRead)),
//       choices: [
//         { title: 'True' + (currentRead === true ? ' (current value)' : ''), description: 'User can see messages and request rooms updates', value: 'true' },
//         { title: 'False' + (currentRead === false ? ' (current value)' : ''), description: 'Rooms requests will throw 403 errors', value: 'false' },
//         { title: 'Not specified' + (currentRead === null ? ' (current value)' : ''), description: 'Fallback to each room\'s default value', value: 'null' }
//       ],
//     },
//     {
//       type: 'select',
//       name: 'write',
//       message: 'Write',
//       initial: ['true', 'false', 'null'].indexOf(String(currentWrite)),
//       choices: [
//         { title: 'True' + (currentWrite === true ? ' (current value)' : ''), description: 'User can send messages in rooms', value: 'true' },
//         { title: 'False' + (currentWrite === false ? ' (current value)' : ''), description: 'User can\'t send messages in rooms', value: 'false' },
//         { title: 'Not specified' + (currentWrite === null ? ' (current value)' : ''), description: 'Fallback to each room\'s default value', value: 'null' }
//       ],
//     },
//     {
//       type: 'select',
//       name: 'upload',
//       message: 'Upload',
//       initial: ['true', 'false', 'null'].indexOf(String(currentUpload)),
//       choices: [
//         { title: 'True' + (currentUpload === true ? ' (current value)' : ''), description: 'User can upload files such as images attachments in rooms', value: 'true' },
//         { title: 'False' + (currentUpload === false ? ' (current value)' : ''), description: 'User can\'t upload any files in rooms', value: 'false' },
//         { title: 'Not specified' + (currentUpload === null ? ' (current value)' : ''), description: 'Fallback to each room\'s default value', value: 'null' }
//       ],
//     },
//   ])
//   const isAborted = !(Object.hasOwn(response, 'accessible') && Object.hasOwn(response, 'read') && Object.hasOwn(response, 'write') && Object.hasOwn(response, 'upload'))
//   if (isAborted) {
//     if (Object.hasOwn(response, 'write')) {
//       clearLines(clearSessionIdLine ? 6 : 5)
//     } else if (Object.hasOwn(response, 'read')) {
//       clearLines(clearSessionIdLine ? 5 : 4)
//     } else if (Object.hasOwn(response, 'accessible')) {
//       clearLines(clearSessionIdLine ? 4 : 3)
//     } else {
//       clearLines(clearSessionIdLine ? 3 : 2)
//     }
//     return null
//   } else {
//     clearLines(clearSessionIdLine ? 6 : 5)
//     try {
//       const toFlagValue = strval => strval === 'true'
//         ? true
//         : strval === 'false'
//           ? false
//           : null
//       const permissions: PermsFlags = {
//         accessible: toFlagValue(response.accessible),
//         read: toFlagValue(response.read),
//         write: toFlagValue(response.write),
//         upload: toFlagValue(response.upload),
//       }
//       await setGlobalPermissionsOverrides({ userId, permissions })
//     } catch (e) {
//       await showError(e)
//     }
//   }
// }