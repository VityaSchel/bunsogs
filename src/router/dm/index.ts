import { db } from '@/db'
import type { inboxEntity } from '@/schema'
import { User } from '@/user'

export async function getDmMessagesFrom({ senderId, since, limit }: {
  senderId: number
  since?: number
  limit?: number
}) {
  const inbox = await db.query<inboxEntity, { $sender: number, $sinceId?: number, $limit?: number }>(`
    SELECT * FROM inbox WHERE sender = $sender
    ${since !== undefined ? 'AND id > $sinceId' : ''}
    ORDER BY id
    ${limit !== undefined ? 'LIMIT $limit' : ''}
  `).all({ 
    $sender: senderId, 
    ...(since !== undefined && { $sinceId: since }),
    ...(limit !== undefined && { $limit: limit })
  })
  return inbox
}

export async function getDmMessagesFor({ recipientId, since, limit }: {
  recipientId: number
  since?: number
  limit?: number
}) {
  const inbox = await db.query<inboxEntity, { $recipient: number, $sinceId?: number, $limit?: number }>(`
    SELECT * FROM inbox WHERE recipient = $recipient
    ${since !== undefined ? 'AND id > $sinceId' : ''}
    ORDER BY id
    ${limit !== undefined ? 'LIMIT $limit' : ''}
  `).all({ 
    $recipient: recipientId, 
    ...(since !== undefined && { $sinceId: since }),
    ...(limit !== undefined && { $limit: limit })
  })
  return inbox
}

export async function serializeMessage(inboxEntity: inboxEntity, includeMessage = true) {
  const sender = new User({ id: inboxEntity.sender })
  await sender.refresh({ autovivify: false })
  const recipient = new User({ id: inboxEntity.sender })
  await recipient.refresh({ autovivify: false })

  const message: {
    id: number | null
    posted_at: number | null
    expires_at: number | null
    sender: string
    recipient: string
    message?: string
  } = {
    id: inboxEntity.id,
    posted_at: inboxEntity.posted_at,
    expires_at: inboxEntity.expiry,
    sender: sender.sessionID,
    recipient: recipient.sessionID
  }
  if (includeMessage) {
    message.message = Buffer.from(inboxEntity.body).toString('base64')
  }
  return message
}

export async function deleteInbox({ type, id }: {
  type: 'recipient' | 'sender',
  id: number
}) {
  const results = await db.query<{ 'COUNT(*)': number }, { $id: number }>(`
    SELECT COUNT(*) FROM inbox WHERE ${type} = $id
  `).get({ $id: id })
  await db.query<null, { $id: number }>(`
    DELETE FROM inbox WHERE ${type} = $id
  `).run({ $id: id })
  return results?.['COUNT(*)'] ?? 0
}