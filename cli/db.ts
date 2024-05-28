/* eslint-disable quotes */
import { Database } from 'bun:sqlite'
import fs from 'fs/promises'
import path from 'path'

let dbPath: string
try {
  dbPath = path.resolve(process.env.BUNSOGS_DB || './db.sqlite3')
} catch(e) {
  console.error('Couldn\'t resolve abolute path to database')
  process.exit(1)
}

// try {
//   await fs.access(dbPath)
// } catch(e) {
//   console.error('Couldn\'t open database at ' + dbPath)
//   process.exit(1)
// }

export const db = new Database(dbPath, { create: false, readwrite: true })
