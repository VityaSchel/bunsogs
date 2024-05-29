import prompts from 'prompts'
import { db } from './db'
import { addAdmin, addGlobalAdmin, addGlobalModerator, addModerator, createRoom, deleteRoom, getGlobalAdminsAndModerators, getMessagesSize, getOrCreateUserIdBySessionID, getRoomAdminsAndModerators, getRoomByToken, getRooms, getUserIdBySessionID, removeAdminOrModFromRoom, removeGlobalAdminOrMod, setRoomDescription, setRoomName } from './rooms'
import { roomsEntity } from '../src/schema'

function validateArgs(args: Record<string, any>, { updateRoom }: { updateRoom: boolean }) {
  const incompatible = [
    ['--add-room', args.addRoom],
    ['--delete-room', args.deleteRoom],
    ['room modifiers', updateRoom],
    ['--list-rooms', args.listRooms],
    ['--list-global-mods', args.listGlobalMods],
    ['--upgrade', args.upgrade],
    ['--check-upgrades', args.checkUpgrades],
  ]
  for (let i = 1; i < incompatible.length; i++) {
    for (let j = 0; j < i; j++) {
      if (incompatible[j][1] && incompatible[i][1]) {
        console.error(`Error: ${incompatible[j][0]} and ${incompatible[i][0]} are incompatible`)
        process.exit(1)
      }
    }
  }
  if (updateRoom && !args.rooms) {
    console.error('A room must be specified (using --rooms) when updating permissions or room details')
    process.exit(1)
  }
  if (args.rooms && !updateRoom) {
    console.error('Error: --rooms specified without a room modification option')
    process.exit(1)
  }
}

export async function parseArgsCommand(args: Record<string, any>) {
  const updateRoom = !args.addRoom && (
    args.description !== undefined
    || args.name !== undefined
    || args.addModerators !== undefined
    || args.deleteModerators !== undefined
    || args.addPerms !== undefined
    || args.removePerms !== undefined
    || args.clearPerms !== undefined
  )
  validateArgs(args, { updateRoom })
  let perms: PermsFlags = {}
  if (args.addPerms) {
    perms = parseAndSetPermFlags(perms, args.addPerms, true)
  }
  if (args.removePerms) {
    perms = parseAndSetPermFlags(perms, args.removePerms, false)
  }
  if (args.clearPerms) {
    perms = parseAndSetPermFlags(perms, args.clearPerms, null)
  }
  if (args.addRoom) {
    if(args.addRoom === true) {
      console.error('Error: you must provide room\'s token to --add-room in order to create room')
      process.exit(1)
    }

    roomTokenValid(args.addRoom)

    const roomId = await createRoom({
      token: args.addRoom,
      name: args.name || args.addRoom,
      description: args.description
    })

    const permissionsQuery: string[] = []
    const permissionsQueryParams: { $read?: boolean | null, $write?: boolean | null, $accessible?: boolean | null, $upload?: boolean | null } = {}
    if ('read' in perms) {
      permissionsQuery.push('read = $read')
      permissionsQueryParams.$read = perms.read
    }
    if ('write' in perms) {
      permissionsQuery.push('write = $write')
      permissionsQueryParams.$write = perms.write
    }
    if ('accessible' in perms) {
      permissionsQuery.push('accessible = $accessible')
      permissionsQueryParams.$accessible = perms.accessible
    }
    if ('upload' in perms) {
      permissionsQuery.push('upload = $upload')
      permissionsQueryParams.$upload = perms.upload
    }
    if (permissionsQuery.length) {
      await db.query<roomsEntity, { $roomId: number } & typeof permissionsQueryParams>('UPDATE rooms SET ' + permissionsQuery.join(', ') + ' WHERE id = $roomId')
        .get({ $roomId: roomId, ...permissionsQueryParams }) as roomsEntity
    }
    
    const room = await getRoomByToken(args.addRoom)
    if (!room) {
      console.error(`Couldn't create room ${args.addRoom}`)
      process.exit(1)
    }
    console.log(`Created room ${args.addRoom}:`)
    printRoom(room)
  } else if (args.deleteRoom) {
    const room = await db.query<roomsEntity, { $roomToken: number }>('SELECT * FROM rooms WHERE token = $roomToken')
      .get({ $roomToken: args.deleteRoom })
    if(room === null) {
      console.error(`Room with token \`${args.deleteRoom}\` does not exists`)
      process.exit(1)
    }
    printRoom(room)
    let confirmed: boolean = args.y
    if (!args.y) {
      const { value } = await prompts({
        name: 'value',
        type: 'confirm',
        message: 'Are you sure you want to delete this room?'
      })
      confirmed = value
    }
    if (confirmed) {
      await deleteRoom(room.token)
      console.log('Room deleted.')
    } else {
      console.log('Aborted.')
      process.exit(2)
    }
  } else if (updateRoom) {
    let rooms: roomsEntity[] = []
    let allRooms = false
    let globalRooms = false

    if (args.rooms.length > 1 && (args.rooms.includes('*') || args.rooms.includes('+'))) {
      console.error('Error: \'+\'/\'*\' arguments to --rooms cannot be used with other rooms')
      process.exit(1)
    }

    if (args.rooms.includes('+')) {
      globalRooms = true
    } else if (args.rooms.includes('*')) {
      rooms = await getRooms()
      allRooms = true
    } else {
      for (const roomToken of args.rooms) {
        const room = await getRoomByToken(roomToken)
        if (room === null) {
          console.error(`No such room: '${roomToken}'`)
          process.exit(1)
        }
        rooms.push(room)
      }
    }

    if (rooms.length === 0 && !globalRooms) {
      console.error('Error: --rooms is required when updating room settings/permissions')
      process.exit(1)
    }

    if (args.addModerators) {
      for (const a of args.addModerators) {
        if (!/^[01]5[A-Fa-f0-9]{64}$/.test(a)) {
          console.error(`Error: '${a}' is not a valid session id`)
          process.exit(1)
        }
      }

      if (globalRooms) {
        for (const sid of args.addModerators) {
          if (args.admin) {
            await addGlobalAdmin({ userSessionID: sid, visible: args.visible })
          } else {
            await addGlobalModerator({ userSessionID: sid, visible: args.visible })
          }
          console.log(
            `Added ${sid} as ${args.visible ? 'visible' : 'hidden'} ${args.admin ? 'admin' : 'moderator'}`
          )
        }
      } else {
        for (const sid of args.addModerators) {
          for (const room of rooms) {
            if (args.admin) {
              await addAdmin({ roomId: room.id, userSessionID: sid, visible: !args.hidden })
            } else {
              await addModerator({ roomId: room.id, userSessionID: sid, visible: !args.hidden })
            }
            console.log(
              `Added ${sid} as ${args.hidden ? 'hidden' : 'visible'} ${args.admin ? 'admin' : 'moderator'} of ${room.name} (${room.token})`
            )
          }
        }
      }
    }

    if (args.deleteModerators) {
      for (const a of args.deleteModerators) {
        if (!/^[01]5[A-Fa-f0-9]{64}$/.test(a)) {
          console.error(`Error: '${a}' is not a valid session id`)
          process.exit(1)
        }
      }
      
      if (globalRooms) {
        for (const sid of args.deleteModerators) {
          const userId = await getUserIdBySessionID(sid)
          if (userId === null) throw new Error(sid + 'is not global admin/moderator')
          await removeGlobalAdminOrMod(userId)
          console.log(`Removed ${sid} (id${userId}) as global admin/moderator`)
        }
      } else {
        for (const sid of args.deleteModerators) {
          for (const room of rooms) {
            const userId = await getUserIdBySessionID(sid)
            if (userId === null) throw new Error(sid + 'is not global admin/moderator')
            await removeAdminOrModFromRoom({ roomId: room.id, userId })
            console.log(`Removed ${sid} as moderator/admin of ${room.name} (${room.token})`)
          }
        }
      }
    }

    if (args.addPerms || args.clearPerms || args.removePerms) {
      if (globalRooms) {
        console.error('Error: --rooms cannot be \'+\' (i.e. global) when updating room permissions')
        process.exit(1)
      }

      console.warn('Warning: Changing permissions is currently under development feature in bunsogs-cli')

      // let users = []
      // if (args.users) {
      //   users = args.users.map(sid => new User({ sessionId: sid, tryBlinding: true }))
      // }

      // if (users.length === 0) {
      //   for (const room of rooms) {
      //     if ('read' in perms) {
      //       room.defaultRead = perms.read
      //       console.log(`${room.defaultRead ? 'Enabled' : 'Disabled'} default read permission in ${room.token}`)
      //     }
      //     if ('write' in perms) {
      //       room.defaultWrite = perms.write
      //       console.log(`${room.defaultWrite ? 'Enabled' : 'Disabled'} default write permission in ${room.token}`)
      //     }
      //     if ('accessible' in perms) {
      //       room.defaultAccessible = perms.accessible
      //       console.log(`${room.defaultAccessible ? 'Enabled' : 'Disabled'} default accessible permission in ${room.token}`)
      //     }
      //     if ('upload' in perms) {
      //       room.defaultUpload = perms.upload
      //       console.log(`${room.defaultUpload ? 'Enabled' : 'Disabled'} default upload permission in ${room.token}`)
      //     }
      //   }
      // } else {
      //   const sysadmin = new SystemUser()
      //   for (const room of rooms) {
      //     for (const user of users) {
      //       room.setPermissions({ user, mod: sysadmin, ...perms })
      //       console.log(`Updated room permissions for ${user} in ${room.token}`)
      //     }
      //   }
      // }
    }

    if (args.description !== undefined) {
      if (globalRooms || allRooms) {
        console.error('Error: --rooms cannot be \'+\' or \'*\' (i.e. global/all) with --description')
        process.exit(1)
      }

      if(args.description.length > 1000) {
        console.error('Error: Room description must be 1000 characters or less')
        process.exit(1)
      }

      for (const room of rooms) {
        await setRoomDescription(room.id, args.description)
        console.log(`Updated ${room.token} description to:\n\n${args.description}\n`)
      }
    }

    if (args.name !== undefined) {
      if (globalRooms || allRooms) {
        console.error('Error: --rooms cannot be \'+\' or \'*\' (i.e. global/all) with --name')
        process.exit(1)
      }

      if (args.name === '') {
        console.error('Error: Room name can\'t be empty')
        process.exit(1)
      } else if(args.name > 64) {
        console.error('Error: Room name must be 64 characters or less')
        process.exit(1)
      }

      for (const room of rooms) {
        await setRoomName(room.id, args.name)
        console.log(`Changed ${room.token} name from '${room.name}' to '${args.name}'`)
      }
    }
  } else if (args.listRooms) {
    const rooms = await getRooms()
    if (rooms.length > 0) {
      rooms.forEach(printRoom)
    } else {
      console.log('No rooms.')
    }
  } else if (args.listGlobalMods) {
    const { moderators, admins } = await getGlobalAdminsAndModerators()

    const visibleAdmins: typeof admins = []
    const hiddenAdmins: typeof admins = []
    admins.forEach(a => a.visible_mod ? visibleAdmins.push(a) : hiddenAdmins.push(a))

    const visibleModerators: typeof moderators = []
    const hiddenModerators: typeof moderators = []
    moderators.forEach(m => m.visible_mod ? visibleModerators.push(m) : hiddenModerators.push(m))

    console.log(`${admins.length} global admins (${hiddenAdmins.length} hidden), ${moderators.length} moderators (${hiddenModerators.length} hidden):`)
    visibleAdmins.forEach(u => console.log(`- ${u.session_id} (admin)`))
    hiddenAdmins.forEach(u => console.log(`- ${u.session_id} (hidden admin)`))
    visibleModerators.forEach(u => console.log(`- ${u.session_id} (moderator)`))
    hiddenModerators.forEach(u => console.log(`- ${u.session_id} (hidden moderator)`))
  } else {
    console.error('Error: no action given')
    process.exit(1)
  }
}

async function printRoom(room: roomsEntity) {
  const { token, name, description } = room
  // const { serverPubkeyHex } = getServerPubkey()

  const { messages, sizeInBytes } = await getMessagesSize(room.id)
  // let [files, filesSize] = attachmentsSize()
  // const reactions = reactionsCounts()
  // const rTotal = reactions.reduce((sum, x) => sum + x[1], 0)
  // reactions.sort((a, b) => b[1] - a[1])

  const messagesSize = sizeInBytes / 1_000_000
  // filesSize /= 1_000_000

  // const active = [1, 7, 14, 30].map(days => activeUsersLast(days * 86400))
  const { admins, moderators } = await getRoomAdminsAndModerators(room.id)
  const hiddenAdmins = admins.reduce((prev, cur) => !cur.visible_mod ? prev + 1 : prev, 0)
  const hiddenModerators = admins.reduce((prev, cur) => !cur.visible_mod ? prev + 1 : prev, 0)

  // const perms = `${defaultRead ? '+' : '-'}read, ${defaultWrite ? '+' : '-'}write, ${defaultUpload ? '+' : '-'}upload, ${defaultAccessible ? '+' : '-'}accessible`

  // TODO: add `dedent-js`
  console.log(`
${token}
${'='.repeat(token.length)}
Name: ${name}${description ? `\nDescription: ${description}` :''}
Messages: ${messages} (${messagesSize.toFixed(1)} MB)
Moderators: ${admins.length} admins (${hiddenAdmins} hidden), ${moderators.length} moderators (${hiddenModerators} hidden)`)
  /*Attachments: ${files} (${filesSize.toFixed(1)} MB)
Reactions: ${rTotal}; top 5: ${reactions.slice(0, 5).map(([r, c]) => `${r} (${c})`).join(', ')}
Active users: ${active[0]} (1d), ${active[1]} (7d), ${active[2]} (14d), ${active[3]} (30d)
Default permissions: ${perms}*/

  console.log()
}

function roomTokenValid(room) {
  const regex = /^[\w-]{1,64}$/
  if (!regex.test(room)) {
    console.error('Error: room tokens may only contain a-z, A-Z, 0-9, _, and - characters')
    process.exit(1)
  }
}

type PermsFlags = { [k in 'read' | 'write' | 'upload' | 'accessible']?: true | false | null }
function parseAndSetPermFlags(perms: PermsFlags, flags: string, permSetting: true | false | null) {
  const permFlagToWord = (char: string) => {
    switch (char) {
      case 'r':
        return 'read'
      case 'w':
        return 'write'
      case 'u':
        return 'upload'
      case 'a':
        return 'accessible'
      default:
        console.error(`Error: invalid permission flag '${char}'`)
        process.exit(1)
    }
  }

  for (const char of flags) {
    const permType = permFlagToWord(char)
    if (Object.hasOwn(perms, permType)) {
      console.error(`Error: permission flag '${char}' in more than one permission set (add/remove/clear)`)
      process.exit(1)
    }
    perms[permType] = permSetting
  }
  return perms
}
