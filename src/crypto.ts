import { generateBlindedId } from '@/blinding'
import { deriveSymmetricKey, getServerKey } from '@/keypairs'
import crypto from 'node:crypto'

export enum EncryptionType {
  xchacha20,
  gcm,
  cbc
}

export function decryptChannelEncryption(encryptionType: EncryptionType, ciphertext: Buffer, remote_pk: Buffer) {
  switch(encryptionType) {
    case EncryptionType.xchacha20:
      throw new Error('Not implemented')
    case EncryptionType.gcm:
      return decryptGCM(ciphertext, remote_pk)
    case EncryptionType.cbc:
      throw new Error('Not implemented')
  }
}

function decryptGCM(ciphertext: Buffer, remote_pk: Buffer) {
  const derivedSymmetricKey = deriveSymmetricKey(getServerKey().privateKey, remote_pk)
  return decryptOpenSSL('aes-256-gcm', 16, ciphertext, derivedSymmetricKey)
}

// CREDIT: https://github.com/majestrate/libonionrequests/blob/dev/onionreq/channel_encryption.cpp#L246
function decryptOpenSSL(cipherName: string, tagLength: number, ciphertext: Buffer, key: Buffer) {
  if (ciphertext.length < tagLength) {
    throw new Error('Encrypted value is too short')
  }

  const ivLength = 12
  const iv = ciphertext.subarray(0, ivLength)

  // Extract the tag which is assumed to be appended to the ciphertext
  const tag = ciphertext.subarray(ciphertext.length - tagLength)
  ciphertext = ciphertext.subarray(ivLength, ciphertext.length - tagLength)

  // Create the decryption cipher
  const decipher = crypto.createDecipheriv(cipherName, key, iv) as crypto.DecipherCCM
  decipher.setAuthTag(tag)

  // Decrypt the ciphertext
  const decrypted = decipher.update(ciphertext)
  return Buffer.concat([decrypted, decipher.final()])
}

export function encryptChannelEncryption(encryptionType: EncryptionType, plain: Buffer, remote_pk: Buffer): Buffer {
  switch (encryptionType) {
    case EncryptionType.xchacha20:
      throw new Error('Not implemented')
    case EncryptionType.gcm:
      return encryptGCM(plain, remote_pk)
    case EncryptionType.cbc:
      throw new Error('Not implemented')
  }
}

function encryptGCM(plain: Buffer, key: Buffer): Buffer {
  const derivedSymmetricKey = deriveSymmetricKey(getServerKey().privateKey, key)
  return encryptOpenSSL('aes-256-gcm', 16, plain, derivedSymmetricKey)
}

function encryptOpenSSL(algorithm: string, taglen: number, plain: Buffer, key: Buffer) {
  const ivLength = 12

  // Generate a random IV
  const iv = crypto.randomBytes(ivLength)
  const cipher = crypto.createCipheriv(algorithm, key, iv) as crypto.CipherGCM

  // Encrypt the plaintext
  const encrypted = Buffer.concat([
    cipher.update(plain),
    cipher.final()
  ])

  let tag = Buffer.alloc(0)
  if (taglen > 0) {
    tag = cipher.getAuthTag()
  }

  return Buffer.concat([iv, encrypted, tag])
}

export function blindSessionID(sessionID: string | Buffer): string {
  const idHex = typeof sessionID === 'string'
    ? sessionID
    : sessionID.toString('hex')
  
  return generateBlindedId(idHex, getServerKey().publicKey.toString('hex'))
}