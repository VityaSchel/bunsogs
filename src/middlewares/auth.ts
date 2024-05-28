import { getServerKey } from '@/keypairs'
import { z } from 'zod'
import crypto from 'crypto'
import sodium from 'libsodium-wrappers'
import { User } from '@/user'

export async function auth({ method, endpoint, headers, body }: {
  method: string,
  endpoint: string,
  headers?: Record<string, string>,
  body: string | null
}): Promise<User | null | 403> {
  try {
    const headersParsing = await z.object({
      'X-SOGS-Pubkey': z.string().length(66).regex(/^(00|15)[0-9a-f]+$/),
      'X-SOGS-Timestamp': z.coerce.number().int().positive(),
      'X-SOGS-Nonce': z.string().length(22).base64().or(z.string().length(24).base64()
        .or(z.string().length(32).regex(/^[0-9a-f]+$/))),
      'X-SOGS-Signature': z.string().length(88).base64()
    }).safeParseAsync(headers)
    if (!headersParsing.success) {
      return null
    }

    let sessionID: string
    const pubkeyHeader = Buffer.from(headersParsing.data['X-SOGS-Pubkey'], 'hex')
    const publicKeyRaw = pubkeyHeader.subarray(1)
    enum PubkeyHeaderPrefix {
      SESSION_ID = 0x00,
      BLINDED_ID = 0x15,
    }
    if (pubkeyHeader[0] === PubkeyHeaderPrefix.SESSION_ID) {
      sessionID = '05' + Buffer.from(sodium.crypto_sign_ed25519_pk_to_curve25519(publicKeyRaw)).toString('hex')
    } else if(pubkeyHeader[0] === PubkeyHeaderPrefix.BLINDED_ID) {
      throw new Error('Not implemented')
    } else {
      throw new Error('Invalid pubkey header')
    }

    const user = new User({ sessionID })
    await user.refresh()
    if (user.banned) {
      return 403
    }

    const pubkey = getServerKey().publicKey
    const nonce = Buffer.from(headersParsing.data['X-SOGS-Nonce'], 'base64')
    const timestamp = Buffer.from(String(headersParsing.data['X-SOGS-Timestamp']))
    const methodBuf = Buffer.from(method)
    const path = Buffer.from(decodeURI(endpoint), 'utf-8')
    let computedSignature = Buffer.concat([pubkey, nonce, timestamp, methodBuf, path])

    if (body) {
      computedSignature = Buffer.concat([computedSignature, hashBody(body)])
    }

    const derPrefix = Buffer.from('302a300506032b6570032100', 'hex')
    const userPubKey = crypto.createPublicKey({
      key: Buffer.concat([derPrefix, publicKeyRaw]),
      format: 'der'
    })

    const signatureMatches = crypto.verify(null,
      computedSignature,
      userPubKey,
      Buffer.from(headersParsing.data['X-SOGS-Signature'], 'base64')
    )

    if (!signatureMatches) {
      throw new Error('Invalid signature')
    }

    return user
  } catch {
    return null
  }
}

function hashBody(body: string): Buffer {
  return Buffer.from(new Bun.CryptoHasher('blake2b512').update(body).digest().buffer)
}