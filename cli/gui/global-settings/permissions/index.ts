import { showError } from '../../_utils'

export const globalPermissionOverridesMenu = async () => {
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