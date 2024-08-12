import type { UserPermissions } from '@/room'
import path from 'path'
import { v4 as uuid } from 'uuid'

export function addSessionMessagePadding(data: any, length: number): string {
  let buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

  if (length > buffer.length) {
    const padding = Buffer.alloc(length - buffer.length, 0x00)
    padding[0] = 0x80
    buffer = Buffer.concat([buffer, padding])
  }

  return buffer.toString('base64')
}

/**
 * You can find detailed explanation in pysogs code, starting with "sometimes".
 * You know, I would rename Session messenger to Sometimes.
 * Sometimes we add padding, sometimes we don't
 * Sometimes Session works, sometimes it doesn't
 * Sometimes we publish update that breaks 1000 service nodes for two weeks
 * Sometimes we don't publish updates for months
 * y'know that "sometimes" in terms of our lovely Session
 * also pysogs has this comment to this function:
 * # Session code has a comment "This is dumb"
 * # describing all of this.  I concur.
 * And I agree to that.
 */
export function removeSessionMessagePadding(data: Buffer): Buffer {
  if (data && (data[data.length - 1] === 0x00 || data[data.length - 1] === 0x80)) {
    const lastNonZeroIndex = data.lastIndexOf(0x00) === -1 ? data.length : data.lastIndexOf(0x00) + 1
    const strippedData = data.subarray(0, lastNonZeroIndex)
    if (strippedData.length && strippedData[strippedData.length - 1] === 0x80) {
      data = strippedData.subarray(0, -1)
    }
  }
  return data
}

export function bindSqliteArray<T extends string[] | bigint[] | NodeJS.TypedArray[] | number[] | boolean[] | null[]>(items: T): { k: string, v: Record<string, T[number]> } {
  const keys = items.map((_, index) => `$_array_param${index}`)
  return {
    k: keys.join(','),
    v: items.reduce<Record<string, T[number]>>((acc, id, index) => {
      acc[keys[index]] = id
      return acc
    }, {})
  }
}

export function testPermission(userPermissions: UserPermissions, requiredPermissions: ('read' | 'upload' | 'write' | 'accessible')[]) {
  if (userPermissions.admin || userPermissions.moderator) {
    return true
  }
  if(userPermissions.banned) {
    return false
  }
  
  if (requiredPermissions.includes('accessible') && (!userPermissions.accessible || !userPermissions.read)) {
    return false
  }
  
  if (requiredPermissions.includes('read') && !userPermissions.read) {
    return false
  }
  
  if (requiredPermissions.includes('write') && !userPermissions.write) {
    return false
  }
  
  if (requiredPermissions.includes('upload') && !userPermissions.upload) {
    return false
  }

  return true
}

export function randomFilename(inheritExtension?: string) {
  let extension = inheritExtension ? path.extname(inheritExtension) : ''
  if (!isSafeFilename(extension)) extension = ''
  return uuid() + (extension ? '.' + extension : '')
}

export function isSafeFilename(filename: string) {
  const uploadsDirectory = path.resolve('./uploads')
  if (filename.includes('\0')) return false
  const fullPath = path.join(uploadsDirectory, filename)
  const normalizedPath = path.normalize(fullPath)
  const isSafe = normalizedPath.startsWith(path.resolve(uploadsDirectory))
  return isSafe
}