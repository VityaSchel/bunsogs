#!/usr/bin/env bun

import Yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import packageJson from './package.json'
import { mainMenu } from './gui'

const argv = Yargs(hideBin(process.argv))
  .option('add-room TOKEN', {
    type: 'string',
    description: 'Add a room with the given token'
  })
  .option('name NAME', {
    type: 'string',
    description: 'Set the room\'s initial name for --add - room; if omitted use the token name'
  })
  .option('description DESCRIPTION', {
    type: 'string',
    description: 'Sets or updates a room\'s description (with --add-room or --rooms)'
  })
  .option('delete-room TOKEN', {
    type: 'string',
    description: 'Delete the room with the given token'
  })
  .option('add-moderators SESSIONID [SESSIONID ...]', {
    type: 'array',
    description: 'Add the given Session ID(s) as a moderator of the room given by --rooms'
  })
  .option('delete-moderators SESSIONID [SESSIONID ...]', {
    type: 'array',
    description: 'Delete the the given Session ID(s) as moderator and admins of the room given by --rooms'
  })
  .option('users SESSIONID [SESSIONID ...]', {
    type: 'array',
    description: 'One or more specific users to set permissions for with --add-perms, --remove-perms, --clear-perms. If omitted then the room default permissions will be set for the given room(s) instead.'
  })
  .option('add-perms ADD_PERMS', {
    type: 'array',
    description: 'With --add-room or --rooms, set these permissions to true; takes a string of 1-4 of the letters "rwua" for [r]ead, [w]rite, [u]pload, and [a]ccess.'
  })
  .option('remove-perms REMOVE_PERMS', {
    type: 'array',
    description: 'With --add-room or --rooms, set these permissions to false; takes the same string as --add-perms, but denies the listed permissions rather than granting them.'
  })
  .option('clear-perms CLEAR_PERMS', {
    type: 'array',
    description: 'With --add-room or --rooms, clear room or user overrides on these permissions, returning them to the default setting. Takes the same argument as --add-perms.'
  })
  .option('admin', {
    type: 'boolean',
    description: 'Add the given moderators as admins rather than ordinary moderators'
  })
  .option('rooms TOKEN [TOKEN ...]', {
    type: 'array',
    description: 'Room(s) to use when adding/removing moderators/admins or when setting permissions. If a single room name of '+' is given then the user will be added/removed as a global admin/moderator. \'+\' is not valid for setting permissions. If a single room name of \'*\' is given then the changes take effect on each of the server\'s current rooms.'
  })
  .option('visible', {
    type: 'boolean',
    description: 'Make an added moderator/admins\' status publicly visible.This is the default for room mods, but not for global mods'
  })
  .option('hidden', {
    type: 'boolean',
    description: 'Hide the added moderator/admins\' status from public users.This is the default for global mods, but not for roommods'
  })
  .option('list-rooms', {
    alias: 'L',
    type: 'boolean',
    description: 'List current rooms and basic stats'
  })
  .option('list-global-mods', {
    alias: 'M',
    type: 'boolean',
    description: 'List global moderators/admins'
  })
  // @ts-expect-error types are not updated yet
  .usageConfiguration({
    'hide-types': true
  })
  .example('bunsogs-cli --add-room bun --name "Bun.sh lovers"', 'Add new room "bun"')
  .example('bunsogs-cli --rooms bun fish --admin --add-moderators 050123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef 0500112233445566778899aabbccddeeff00112233445566778899aabbccddeeff', 'Add 2 admins to each of rooms "xyz" and "abc"')
  .example('bunsogs-cli --add-moderators 050123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef --rooms=+ --visible', 'Add a global moderator visible as a moderator of all rooms')
  .example('bunsogs-cli --add-perms rw --remove-perms u --rooms="*"', 'Set default read/write True and upload False on all rooms')
  .example('bunsogs-cli --clear-perms rwua --rooms="*" --users 050123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'Remove overrides for user 0501234... on all rooms')
  .epilogue('A database will be loaded from current directory, if one exists. You can override this by specifying a path to the db.sqlite3 to load in BUNSOGS_DB environment variable.')
  .locale('en')
  .wrap(120)
  .parse()


const isInteractiveMode = ![
  'addRoom',
  'name',
  'description',
  'deleteRoom',
  'addModerators',
  'deleteModerators',
  'users',
  'addPerms',
  'removePerms',
  'clearPerms',
  'admin',
  'rooms',
  'visible',
  'hidden',
  'listRooms',
  'listGlobalMods',
].some(arg => Object.hasOwn(argv, arg))



if (isInteractiveMode) {
  console.log('')
  console.log('  Bunsogs CLI v' + packageJson.version)
  console.log('')
  // eslint-disable-next-line no-constant-condition
  await mainMenu()
  console.log('')
  process.exit(1)
}
