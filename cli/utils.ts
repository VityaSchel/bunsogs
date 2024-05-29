export function formatSid(sessionID: string): string {
  if(sessionID.length !== 66) return sessionID
  return sessionID.slice(0, 8) + '…' + sessionID.slice(-8)
}