const noncesUsed: Set<string> = new Set()
export function nonceUsed(nonce: string): boolean {
  if (noncesUsed.has(nonce)) return true
  else {
    noncesUsed.add(nonce)
    return false
  }
}