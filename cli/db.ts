/* eslint-disable quotes */
import { Database } from 'bun:sqlite'
import fs from 'fs/promises'
import path from 'path'
import nacl from 'tweetnacl'

export let dbPath: string
try {
  dbPath = path.resolve(path.join(process.env.BUNSOGS_DIR || './', './db.sqlite3'))
} catch(e) {
  console.error('Couldn\'t resolve absolute path to bunsogs directory')
  process.exit(1)
}

try {
  await fs.access(dbPath)
} catch(e) {
  try {
    await fs.access(path.resolve('../db.sqlite3'))
    dbPath = path.resolve('../db.sqlite3')
  } catch (e) {
    console.error('Couldn\'t open database at ' + dbPath)
    process.exit(1)
  }
}

export let keyPath: string
try {
  keyPath = path.resolve(path.join(process.env.BUNSOGS_DIR || './', './key_x25519'))
} catch (e) {
  console.error('Couldn\'t resolve absolute path to bunsogs directory')
  process.exit(1)
}

let secretKey: Buffer
try {
  await fs.access(keyPath)
} catch (e) {
  try {
    await fs.access(path.resolve('../key_x25519'))
    keyPath = path.resolve('../key_x25519')
  } catch (e) {
    console.error('Couldn\'t open key_x25519 at ' + keyPath)
    process.exit(1)
  }
}
try {
  secretKey = await fs.readFile(keyPath)
  if(secretKey.length !== 32) {
    console.error('key_x25519 file is corrupted')
    process.exit(1)
  }
} catch {
  console.error('Couldn\'t read key_x25519 at ' + keyPath)
  process.exit(1)
}

export const db = new Database(dbPath, { create: false, readwrite: true })
export const key = nacl.box.keyPair.fromSecretKey(secretKey)
