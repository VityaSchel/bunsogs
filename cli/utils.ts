import { user_permission_overridesEntity } from '../src/schema'

export function formatSid(sessionID: string): string {
  if(sessionID.length !== 66) return sessionID
  return sessionID.slice(0, 8) + '…' + sessionID.slice(-8)
}

const strike = (strings, ...values) => `\x1b[9m${strings.flatMap((str, i) => [str, values[i] || '']).join('')}\x1b[39m\x1b[29m`
export function formatPermsOverride(permissionsRow: user_permission_overridesEntity) {
  let string = ''
  const accessible = permissionsRow.accessible === null ? null : Boolean(permissionsRow.accessible)
  const read = permissionsRow.read === null ? null : Boolean(permissionsRow.read)
  const write = permissionsRow.write === null ? null : Boolean(permissionsRow.write)
  const upload = permissionsRow.upload === null ? null : Boolean(permissionsRow.upload)
  if(accessible === true) string += 'a'
  else if (accessible === false) string += strike`a`
  if(read === true) string += 'r'
  else if (read === false) string += strike`r`
  if(write === true) string += 'w'
  else if (write === false) string += strike`w`
  if(upload === true) string += 'u'
  else if (upload === false) string += strike`u`
  return string
}

export type PermsFlags = { [k in 'read' | 'write' | 'upload' | 'accessible']?: true | false | null }