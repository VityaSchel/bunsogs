import { getServerKey } from '@/keypairs'
import { z } from 'zod'
import crypto from 'crypto'
import sodium from 'libsodium-wrappers'
import { User } from '@/user'

export async function auth({ method, endpoint, headers, body }: {
  method: string,
  endpoint: string,
  headers?: Record<string, string>,
  body: Buffer | null
}): Promise<User | null | 403> {
  try {
    const headersParsing = await z.object({
      'x-sogs-pubkey': z.string().length(66).regex(/^(00|15)[0-9a-f]+$/),
      'x-sogs-timestamp': z.coerce.number().int().positive(),
      'x-sogs-nonce': z.string().length(22).base64().or(z.string().length(24).base64()
        .or(z.string().length(32).regex(/^[0-9a-f]+$/))),
      'x-sogs-signature': z.string().length(88).base64()
    }).safeParseAsync(headers)
    if (!headersParsing.success) {
      console.log('Error while parsing auth', headers, headersParsing.error)
      return null
    }

    let sessionID: string
    const pubkeyHeader = Buffer.from(headersParsing.data['x-sogs-pubkey'], 'hex')
    const publicKeyRaw = pubkeyHeader.subarray(1)
    enum PubkeyHeaderPrefix {
      SESSION_ID = 0x00,
      BLINDED_ID = 0x15,
    }
    if (pubkeyHeader[0] === PubkeyHeaderPrefix.SESSION_ID) {
      sessionID = '05' + Buffer.from(sodium.crypto_sign_ed25519_pk_to_curve25519(publicKeyRaw)).toString('hex')
    } else if(pubkeyHeader[0] === PubkeyHeaderPrefix.BLINDED_ID) {
      sessionID = '15' + Buffer.from(publicKeyRaw).toString('hex')
    } else {
      throw new Error('Invalid pubkey header')
    }

    const user = new User({ sessionID })
    try {
      await user.refresh({ autovivify: true })
    } catch(e) {
      console.error(e)
      throw e
    }
    if (user.banned) {
      return 403
    }

    const pubkey = getServerKey().publicKey
    const nonce = Buffer.from(headersParsing.data['x-sogs-nonce'], 'base64')
    const timestamp = Buffer.from(String(headersParsing.data['x-sogs-timestamp']))
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
      Buffer.from(headersParsing.data['x-sogs-signature'], 'base64')
    )

    if (!signatureMatches) {
      if(process.env.NODE_ENV === 'development') {
        console.error('Request signature does not match. Expected:', computedSignature)
      }
      throw new Error('Invalid signature')
    }

    return user
  } catch {
    return null
  }
}

function hashBody(body: Buffer): Buffer {
  return Buffer.from(new Bun.CryptoHasher('blake2b512').update(body).digest().buffer)
}