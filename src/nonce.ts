export const noncesUsed: Set<string> = new Set()
export const noncesExpirations: Map<string, number> = new Map()
export function nonceUsed(nonce: string): boolean {
  if (noncesUsed.has(nonce)) return true
  else {
    noncesUsed.add(nonce)
    noncesExpirations.set(nonce, Date.now() + 24 * 60 * 60 * 1000)
    return false
  }
}