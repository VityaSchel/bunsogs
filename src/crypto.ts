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
  const privateKey = getPrivateKey()
  const derivedSymmetricKey = deriveSymmetricKey(privateKey, remote_pk)
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
  let decrypted = decipher.update(ciphertext, undefined, 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}