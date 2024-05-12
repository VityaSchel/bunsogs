import { EncryptionType, decryptChannelEncryption } from '@/crypto'
import { parsePubkey } from '@/keypairs'
import SJSON from 'secure-json-parse'

export function parseBody(body: Buffer) {
  const encryptedDataLength = body.subarray(0, 4).readUInt32LE(0)
  const encryptedData = Buffer.from(body).subarray(4)
  const ciphertext = encryptedData.subarray(0, encryptedDataLength)
  const metadata = SJSON.parse(encryptedData.subarray(encryptedDataLength).toString('utf-8'))

  let encryptionType: EncryptionType = EncryptionType.gcm
  const enc_type = metadata.enc_type
  if (enc_type) {
    if (enc_type == 'xchacha20' || enc_type == 'xchacha20-poly1305')
      encryptionType = EncryptionType.xchacha20
    else if (enc_type == 'aes-gcm' || enc_type == 'gcm')
      encryptionType = EncryptionType.gcm
    else if (enc_type == 'aes-cbc' || enc_type == 'cbc')
      encryptionType = EncryptionType.cbc
    else
      throw new Error('Unsupported encryption type: ' + enc_type)
  }

  if (!metadata.ephemeral_key) {
    throw new Error('Missing ephemeral key')
  }
  const remote_pk = parsePubkey(metadata.ephemeral_key)

  const payload = decryptChannelEncryption(encryptionType, ciphertext, remote_pk)
  console.log(payload)
}