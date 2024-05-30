import { user_permission_overridesEntity } from '../src/schema'

export function formatSid(sessionID: string): string {
  if(sessionID.length !== 66) return sessionID
  return sessionID.slice(0, 8) + '…' + sessionID.slice(-8)
}

const strike = (strings, ...values) => `\x1b[9m${strings.flatMap((str, i) => [str, values[i] || '']).join('')}\x1b[39m\x1b[29m`
export function formatPermsOverride(permissionsRow: user_permission_overridesEntity) {
  let string = ''
  if(Boolean(permissionsRow.accessible) === true) string += 'a'
  else if (Boolean(permissionsRow.accessible) === false) string += strike`a`
  if(Boolean(permissionsRow.read) === true) string += 'r'
  else if (Boolean(permissionsRow.read) === false) string += strike`r`
  if(Boolean(permissionsRow.write) === true) string += 'w'
  else if (Boolean(permissionsRow.write) === false) string += strike`w`
  if(Boolean(permissionsRow.upload) === true) string += 'u'
  else if (Boolean(permissionsRow.upload) === false) string += strike`u`
  return string
}

export type PermsFlags = { [k in 'read' | 'write' | 'upload' | 'accessible']?: true | false | null }