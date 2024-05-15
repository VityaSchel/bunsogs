import { encryptChannelEncryption } from '@/crypto'
import { loadServerKey } from '@/keypairs'
import { parseBody } from '@/parser'
import { handleIncomingRequest } from '@/router'
import bencode from 'bencode'
import SJSON from 'secure-json-parse'
import { z } from 'zod'
import chalk from 'chalk'
import { loadRooms } from '@/rooms'
import { loadConfig } from '@/config'

console.log()

const keys = await loadServerKey()
const config = await loadConfig()
const rooms = await loadRooms()

const port = process.env.PORT || config.port || 3000
const hostname = process.env.HOSTNAME || config.hostname

Bun.serve({
  port,
  hostname,
  async fetch(request: Request) {
    const endpoint = new URL(request.url).pathname
    if (endpoint === '/oxen/v4/lsrpc' && request.method === 'POST') {
      const body = Buffer.from(await request.arrayBuffer())
      const { payload: payloadBencoded, encType, remotePk } = parseBody(body)
      const payloadSerialized = bencode.decode(payloadBencoded, 'utf-8')[0]
      const payloadDeserialized = SJSON.parse(payloadSerialized)

      const payload = await z.object({
        endpoint: z.string(),
        method: z.string()
      }).safeParseAsync(payloadDeserialized)

      if(!payload.success) {
        return new Response(null, { status: 400 })
      }

      const { status, response, contentType } = await handleIncomingRequest({
        endpoint: payload.data.endpoint,
        method: payload.data.method, 
        body: null
      })

      if (response === null) {
        return new Response(null, { status })
      }

      const responseData = Buffer.from(response)
      const responseMeta = Buffer.from(JSON.stringify({ 'code': status, 'headers': { 'content-type': contentType }}))
      const lenMeta = Buffer.from(`${responseMeta.length}:`)
      const lenData = Buffer.from(`${responseData.length}:`)
      const start = Buffer.from('l')
      const end = Buffer.from('e')

      const responseBencoded = Buffer.concat([start, lenMeta, responseMeta, lenData, responseData, end])

      const responseEncrypted = response && encryptChannelEncryption(encType, responseBencoded, remotePk)
      return new Response(responseEncrypted, { status })
    } else {
      let body: Record<string, string> | null = null
      if (request.method === 'POST') {
        const bodyParsing = await z.record(z.string(), z.string())
          .safeParseAsync(await request.json())
        
        if(!bodyParsing.success) {
          return new Response(null, { status: 415 })
        }

        body = bodyParsing.data
      }
      
      const { response, status, contentType } = await handleIncomingRequest({
        endpoint,
        body,
        method: request.method
      })

      return new Response(response, { 
        status, 
        headers: { 
          ...(contentType && { 'content-type': contentType })
        } 
      })
    }
  }
})

console.log()
console.log(`  SOGS started at ${chalk.bold(`${hostname}:${port}`)}`)
console.log(`\n    Public links to rooms:${
  Array.from(rooms.values())
    .map(room => `\n      - ${
      chalk.bold(`http://${hostname}:${port}/${room.token}?public_key=${keys.publicKey.toString('hex')}`)}`
    ).join('')
}`)
console.log()
console.log()