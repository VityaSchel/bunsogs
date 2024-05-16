export function addSessionMessagePadding(data: any, length: number): string {
  let buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

  if (length > buffer.length) {
    const padding = Buffer.alloc(length - buffer.length, 0x00)
    padding[0] = 0x80
    buffer = Buffer.concat([buffer, padding])
  }

  return buffer.toString('base64')
}