import { getServerKey } from '@/keypairs'
import type { SogsRequest } from '@/router'
import { z } from 'zod'
import crypto from 'crypto'
import sodium from 'libsodium-wrappers'

export type SogsRequestUser = string

export async function auth(req: Omit<SogsRequest, 'user'>): Promise<SogsRequestUser | null> {
  try {
    const headersParsing = await z.object({
      'X-SOGS-Pubkey': z.string().length(66).regex(/^(00|15)[0-9a-f]+$/),
      'X-SOGS-Timestamp': z.coerce.number().int().positive(),
      'X-SOGS-Nonce': z.string().length(22).base64().or(z.string().length(24).base64()
        .or(z.string().length(32).regex(/^[0-9a-f]+$/))),
      'X-SOGS-Signature': z.string().length(88).base64()
    }).safeParseAsync(req.headers)
    if (!headersParsing.success) {
      return null
    }

    const pubkey = getServerKey().publicKey
    const nonce = Buffer.from(headersParsing.data['X-SOGS-Nonce'], 'base64')
    const timestamp = Buffer.from(String(headersParsing.data['X-SOGS-Timestamp']))
    const method = Buffer.from(req.method)
    const path = Buffer.from(decodeURI(req.endpoint), 'utf-8')
    let computedSignature = Buffer.concat([pubkey, nonce, timestamp, method, path])

    if(req.body) {
      computedSignature = Buffer.concat([computedSignature, hashBody(req.body)])
    }

    const publicKeyRaw = Buffer.from(headersParsing.data['X-SOGS-Pubkey'], 'hex').subarray(1)
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
      console.log('Invalid signature, expected', computedSignature.toString('hex'), 'got', headersParsing.data['X-SOGS-Signature'])
      return null
    }

    const sessionID = '05' + Buffer.from(sodium.crypto_sign_ed25519_pk_to_curve25519(publicKeyRaw)).toString('hex')
    return sessionID
  } catch {
    return null
  }
}

function hashBody(body: string): Buffer {
  return Buffer.from(new Bun.CryptoHasher('blake2b512').update(body).digest().buffer)
}