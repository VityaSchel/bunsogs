import prompts from 'prompts'
import { roomsEntity } from '../../../../../src/schema'
import { clearLines, showError } from '../../../_utils'
import { setRoomDefaultPermissions } from '../../../../rooms'

export const editRoomDefaultPermissions = async (room: roomsEntity) => {
  const { permissions } = await prompts({
    type: 'multiselect',
    name: 'permissions',
    message: `Rooms ❯ ${room.name} (@${room.token}) ❯ General settings ❯ Default permissions`,
    instructions: '\nToggle selection: ←/→/[space], go back: ctrl+c, submit: [enter]',
    choices: [
      { title: 'Accessible', description: 'Allow users to see this room', value: 'accessible', selected: Boolean(room.accessible) },
      { title: 'Read', description: 'Allow users to read messages', value: 'read', selected: Boolean(room.read) },
      { title: 'Write', description: 'Allow users to send messages', value: 'write', selected: Boolean(room.write) },
      { title: 'Upload', description: 'Allow users to upload files such as images', value: 'upload', selected: Boolean(room.upload) }
    ]
  })
  clearLines(1)
  if (permissions !== undefined) {
    try {
      await setRoomDefaultPermissions({
        roomId: room.id,
        permissions: {
          accessible: permissions.includes('accessible'),
          read: permissions.includes('read'),
          write: permissions.includes('write'),
          upload: permissions.includes('upload')
        }
      })
      room.accessible = permissions.includes('accessible')
      room.read = permissions.includes('read')
      room.write = permissions.includes('write')
      room.upload = permissions.includes('upload')
    } catch (e) {
      await showError(e)
    }
  }
  return
}