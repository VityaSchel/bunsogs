import { deriveSymmetricKey, getServerKey } from '@/keypairs'
import crypto from 'node:crypto'
import { SignalService } from '@session.js/types/signal-bindings'

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

  // .final() will throw `Unsupported state or unable to authenticate data` if user provides bad public key
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

export function decryptMessageData(messageData: string): null | SignalService.Content {
  const makebuffer = (raw: string) => {
    // CREDIT to oxen team
    const b = Uint8Array.from(atob(raw), (v) => v.charCodeAt(0))
    // This data is padded with a 0x80 delimiter followed by any number of 0x00 bytes, but these are
    // *not* part of the protocol buffer encoding, so we need to strip it off.
    let realLength = b.length
    while (realLength > 0 && b[realLength - 1] == 0)
      realLength--
    if (realLength > 0 && b[realLength - 1] == 0x80)
      realLength--
    return b.subarray(0, realLength)
  }

  const data = makebuffer(messageData)
  const err = SignalService.Content.verify(data)
  if(err) {
    return null
  }
  return SignalService.Content.decode(data)
}