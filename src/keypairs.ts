import sodium from 'libsodium-wrappers'
import crypto from 'node:crypto'
import nacl from 'tweetnacl'
import fs from 'fs/promises'
import chalk from 'chalk'

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

function generateNewKey(): nacl.BoxKeyPair {
  const keypair = nacl.box.keyPair()
  return keypair
}

export async function loadServerKey() {
  if (!privateServerKey || !publicServerKey) {
    let keypair: nacl.BoxKeyPair

    let keyfileExists = false
    try {
      await fs.access(__dirname + '/../key_x25519', fs.constants.F_OK)
      keyfileExists = true
    } catch {
      keyfileExists = false
    }

    let generatedNewKey = false
    if (keyfileExists) {
      let secretKey: Buffer
      try {
        secretKey = await fs.readFile(__dirname + '/../key_x25519')
      } catch(e) {
        console.error(chalk.bold(chalk.red('  [!] Failed to read key_x25519 [!]')))
        console.error(chalk.red('  File can be seen but cannot be read.'))
        console.error(chalk.red('  Please check file permissions.'))
        console.log()
        process.exit(0)
      }
      if (secretKey.length === 0) {
        keypair = generateNewKey()
        generatedNewKey = true
      } else if (secretKey.length > 0 && secretKey.length !== 32) {
        console.error(chalk.bold(chalk.red('  [!] File key_x25519 is corrupted [!]')))
        console.error(chalk.red('  File can be seen and read but its length is not 32 bytes.'))
        console.error(chalk.red('  Remove it and restart server to generate a new SOGS key.'))
        console.log()
        process.exit(0)
      } else {
        try {
          keypair = nacl.box.keyPair.fromSecretKey(secretKey)
        } catch {
          console.error(chalk.bold(chalk.red('  [!] File key_x25519 is corrupted [!]')))
          console.error(chalk.red('  File can be seen and read but its contents is not a valid key.'))
          console.error(chalk.red('  Remove it and restart server to generate a new SOGS key.'))
          console.log()
          process.exit(0)
        }
      }
    } else {
      keypair = generateNewKey()
      generatedNewKey = true
    }

    if (generatedNewKey) {
      try {
        await fs.writeFile(__dirname + '/../key_x25519', keypair.secretKey, { mode: 0o444 })
        console.log('  > Generated SOGS key and saved to ./key_x25519')
      } catch(e) {
        console.error(chalk.bold(chalk.red('  [!] Can\'t write new SOGS key to ./key_x25519 [!]')))
        if(e instanceof Error) {
          console.error(chalk.red('  Details:'))
          console.error(chalk.red(e.message))
        }
        console.log()
        process.exit(0)
      }
    }

    publicServerKey = Buffer.from(keypair.publicKey)
    privateServerKey = Buffer.from(keypair.secretKey)
  }

  return {
    privateKey: privateServerKey,
    publicKey: publicServerKey
  }
}