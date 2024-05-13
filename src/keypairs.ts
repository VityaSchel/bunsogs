import sodium from 'libsodium-wrappers'
import crypto from 'node:crypto'
import nacl from 'tweetnacl'

const hexRegex = /^[a-f0-9]+$/
const base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/
const base32regex = /^[A-Z2-7]+=*$/

export function parsePubkey(pubkey: string) {
  let pubkeyBytes: Buffer

  if (pubkey.length === 32) {
    // detail::load_from_bytes(pk.data(), 32, pubkey_in);
    throw new Error('Not implemented')
  } else if (pubkey.length === 64 && hexRegex.test(pubkey)) {
    // hex to bytes
    pubkeyBytes = Buffer.from(pubkey, 'hex')
  } else if (
    (pubkey.length === 43 || (pubkey.length === 44 && pubkey.at(-1) === '='))
    && base64regex.test(pubkey)
  ) {
    // oxenc::from_base64(pubkey_in.begin(), pubkey_in.end(), pk.begin());
    throw new Error('Not implemented')
  } else if (pubkey.length === 52 && base32regex.test(pubkey)) {
    // oxenc::from_base32z(pubkey_in.begin(), pubkey_in.end(), pk.begin());
    throw new Error('Not implemented')
  } else {
    throw new Error('Invalid pubkey format')
  }

  return pubkeyBytes
}

export function deriveSymmetricKey(privateKey: Buffer, publicKey: Buffer): Buffer {
  const secret = sodium.crypto_scalarmult(privateKey, publicKey)
  const hmac = crypto.createHmac('sha256', Buffer.from('LOKI'))
  hmac.update(secret)
  const key = hmac.digest()
  return key
}

let publicServerKey: Buffer
let privateServerKey: Buffer
export function getServerKey(): { privateKey: Buffer, publicKey: Buffer } {
  return {
    privateKey: privateServerKey,
    publicKey: publicServerKey
  }
}

export async function loadServerKey() {
  if (!privateServerKey || !publicServerKey) {
    const keypair = nacl.box.keyPair()
    publicServerKey = Buffer.from(keypair.publicKey)
    privateServerKey = Buffer.from(keypair.secretKey)
  }

  return {
    privateKey: privateServerKey,
    publicKey: publicServerKey
  }
}