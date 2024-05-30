// export const changeUserGlobalPermissionsOverridesMenu = async (userSessionId?: string) => {
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