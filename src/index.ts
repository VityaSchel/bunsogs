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
      const payloadsSerialized = bencode.decode(payloadBencoded, 'utf-8') as string[]
      const payloadsDeserialized = payloadsSerialized.map(p => SJSON.parse(p))

      const handleRequest = async (payloadDeserialized: any) => {
        const payload = await z.object({
          endpoint: z.string(),
          method: z.string()
        }).safeParseAsync(payloadDeserialized)

        if(!payload.success) {
          return { body: null, status: 400 }
        }

        const { status, response, contentType } = await handleIncomingRequest({
          endpoint: payload.data.endpoint,
          method: payload.data.method,
          body: null
        })

        if (response === null) {
          return { body: null, status }
        } else {
          return { body: response, status, contentType }
        }
      }

      let targetPayloadDeserialized = payloadsDeserialized[0]
      const isBatchRequest = typeof targetPayloadDeserialized === 'object' &&
        'endpoint' in targetPayloadDeserialized &&
        targetPayloadDeserialized.endpoint === '/batch'
      let responseBody: any, status: number, contentType: string | undefined
      if (isBatchRequest) {
        targetPayloadDeserialized = payloadsDeserialized[1] as Array<any>
        const responses = await Promise.all(targetPayloadDeserialized.map(async (tpd: any) => {
          try {
            const { path, ...inc } = tpd
            const { status, ...resp } = await handleRequest({ endpoint: path, ...inc })
            return { code: status, ...resp }
          } catch {
            return { body: null, status: 500 }
          }
        })) as ReturnType<typeof handleRequest>[]
        status = 200
        responseBody = JSON.stringify(responses)
      } else {
        const response = await handleRequest(targetPayloadDeserialized)
        if (response.body === null) {
          return new Response(null, { status: response.status })
        } else {
          if (response.contentType === 'application/json') {
            responseBody = JSON.stringify(response.body)
          } else {
            responseBody = response.body
          }
          status = response.status
          contentType = response.contentType
        }
      }

      console.log('responded with', responseBody)

      const responseData = Buffer.from(responseBody)
      const responseMeta = Buffer.from(JSON.stringify({ 'code': status, 'headers': { 'content-type': contentType }}))
      const lenMeta = Buffer.from(`${responseMeta.length}:`)
      const lenData = Buffer.from(`${responseData.length}:`)
      const start = Buffer.from('l')
      const end = Buffer.from('e')

      const responseBencoded = Buffer.concat([start, lenMeta, responseMeta, lenData, responseData, end])

      const responseEncrypted = encryptChannelEncryption(encType, responseBencoded, remotePk)
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