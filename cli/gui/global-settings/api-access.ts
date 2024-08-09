import prompts from 'prompts'
import { clearLines, showError, showSuccess } from '../_utils'
import fs from 'fs/promises'
import { nanoid } from 'nanoid'

export const apiAccessMenu = async () => {
  const value = await drawApiAccessMenu()
  switch (value) {
    case 'enable':
      try {
        await fs.writeFile('./secret_admin_token', nanoid(64))
        await showSuccess('API access will be enabled after you restart bunsogs; \nset secret token from ./secret_admin_token file to `Authorization` header \nand add `x-sogs-auth-as` header with Session ID to impersonate user', 3)
      } catch {
        await showError('Failed to write to ./secret_admin_token file.')
      }
      break
    case 'disable':
      try {
        await fs.unlink('./secret_admin_token')
        return await showSuccess('API access will be disabled after you restart bunsogs')
      } catch {
        await showError('Failed to remove existing secret_admin_token file. Are you sure API access is enabled?')
      }
      break
    case 'back':
      return
    default: {
      process.exit(0)
    }
  }
}

const drawApiAccessMenu = async () => {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: 'Global settings ❯ API admin access',
    choices: [
      { title: 'Enable', value: 'enable', description: 'Write API access token to ./secret_admin_token file' },
      { title: 'Disable', value: 'disable', description: 'Remove ./secret_admin_token thus disable API access token' },
      { title: 'Go back', value: 'back' },
    ]
  })
  clearLines(1)
  return response.value
}