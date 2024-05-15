import { loadServerKey } from '@/keypairs'
import { loadConfig } from '@/config'
import { loadRooms } from '@/rooms'
import { parseBody } from '@/parser'
import { encryptChannelEncryption } from '@/crypto'
import { handleIncomingRequest, type SogsRequest } from '@/router'
import { auth, type SogsRequestUser } from '@/middlewares/auth'
import { loadGlobalSettings } from '@/global-settings'
import bencode from 'bencode'
import SJSON from 'secure-json-parse'
import { z } from 'zod'
import chalk from 'chalk'

console.log()

const keys = await loadServerKey()
const config = await loadConfig()
const rooms = await loadRooms()
await loadGlobalSettings()

const port = process.env.PORT || config.port || 3000
const hostname = process.env.HOSTNAME || config.hostname

Bun.serve({
  port,
  hostname,
  async fetch(request: Request) {
    const endpoint = new URL(request.url).pathname
    if (endpoint === '/oxen/v4/lsrpc' && request.method === 'POST') {
      return await handleOnionConnection(request)
    } else {
      return await handleClearnetRequest(request)
    }
  }
})

const handleOnionConnection = async (request: Request) => {
  const body = Buffer.from(await request.arrayBuffer())
  const { payload: payloadBencoded, encType, remotePk } = parseBody(body)
  const payloadsSerialized = bencode.decode(payloadBencoded, 'utf-8') as string[]
  const payloadsDeserialized = payloadsSerialized.map(p => SJSON.parse(p))

  const targetPayloadDeserialized = payloadsDeserialized[0]
  const isBatchRequest = typeof targetPayloadDeserialized === 'object' &&
    'endpoint' in targetPayloadDeserialized &&
    targetPayloadDeserialized.endpoint === '/batch'
  let responseBody: any, status: number, contentType: string | undefined
  if (isBatchRequest) {
    status = 200
    responseBody = await handleBatchOnionRequest(payloadsDeserialized)
  } else {
    const sogsRequest: Omit<SogsRequest, 'user'> = {
      ...targetPayloadDeserialized,
      headers: Object.fromEntries(request.headers.entries())
    }
    const response = await handleOnionRequest(
      sogsRequest,
      await auth(sogsRequest)
    )
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
  const responseMeta = Buffer.from(JSON.stringify({ 'code': status, 'headers': { 'content-type': contentType } }))
  const lenMeta = Buffer.from(`${responseMeta.length}:`)
  const lenData = Buffer.from(`${responseData.length}:`)
  const start = Buffer.from('l')
  const end = Buffer.from('e')

  const responseBencoded = Buffer.concat([start, lenMeta, responseMeta, lenData, responseData, end])

  const responseEncrypted = encryptChannelEncryption(encType, responseBencoded, remotePk)
  return new Response(responseEncrypted, { status })
}

const handleBatchOnionRequest = async (payloadsDeserialized: any[]) => {
  const headers = z.record(z.string(), z.string()).optional().parse(payloadsDeserialized[0].headers)
  const payload = payloadsDeserialized[1] as Array<any>
  const responses = await Promise.all(payload.map(async (tpd: any) => {
    try {
      const { path, ...inc } = tpd
      const { status, ...resp } = await handleOnionRequest(
        {
          endpoint: path,
          ...inc,
          headers
        },
        await auth({
          endpoint: '/batch',
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payloadsDeserialized[1])
        })
      )
      return { code: status, ...resp }
    } catch {
      return { body: null, status: 500 }
    }
  })) as Awaited<ReturnType<typeof handleOnionRequest>>[]
  return JSON.stringify(responses)
}

const handleOnionRequest = async (payloadDeserialized: Omit<SogsRequest, 'user'>, user: SogsRequestUser | null) => {
  const payload = await z.object({
    endpoint: z.string(),
    method: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
  }).safeParseAsync(payloadDeserialized)

  if (!payload.success) {
    return { body: null, status: 400 }
  }

  const { status, response, contentType } = await handleIncomingRequest({
    endpoint: payload.data.endpoint,
    method: payload.data.method,
    body: null,
    headers: payload.data.headers,
    user
  })

  if (response === null) {
    return { body: null, status }
  } else {
    return { body: response, status, contentType }
  }
}

const handleClearnetRequest = async (request: Request) => {
  let body: string | null = null
  if (request.method === 'POST') {
    body = await request.text()
  }

  const endpoint = new URL(request.url).pathname
  const headers = Object.fromEntries(request.headers.entries())
  const sogsRequest = {
    endpoint,
    body,
    method: request.method,
    headers
  }

  const { response, status, contentType } = await handleIncomingRequest({
    ...sogsRequest,
    user: await auth(sogsRequest)
  })

  return new Response(response, {
    status,
    headers: {
      ...(contentType && { 'content-type': contentType })
    }
  })
}

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