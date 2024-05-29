export function addSessionMessagePadding(data: any, length: number): string {
  let buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

  if (length > buffer.length) {
    const padding = Buffer.alloc(length - buffer.length, 0x00)
    padding[0] = 0x80
    buffer = Buffer.concat([buffer, padding])
  }

  return buffer.toString('base64')
}

export function removeSessionMessagePadding(data: Buffer): Buffer {
  const paddingIndex = data.indexOf(0x80)
  return data.subarray(0, paddingIndex)
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