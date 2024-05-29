import { loadServerKey } from '@/keypairs'
import { loadConfig } from '@/config'
import { loadRooms } from '@/room'
import { parseBody } from '@/parser'
import { encryptChannelEncryption } from '@/crypto'
import { handleIncomingRequest, type SogsRequest } from '@/router'
import { auth } from '@/middlewares/auth'
import bencode from 'bencode'
import SJSON from 'secure-json-parse'
import { z } from 'zod'
import chalk from 'chalk'
import { nonceUsed } from '@/nonce'
import type { User } from '@/user'

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
  // console.log('request', payloadsDeserialized) // TODO: remove

  const targetPayloadDeserialized = payloadsDeserialized[0]
  const isBatchRequest = typeof targetPayloadDeserialized === 'object' &&
    'endpoint' in targetPayloadDeserialized &&
    targetPayloadDeserialized.endpoint === '/batch'
  let responseBody: any, status: number, contentType: string | undefined
  if (isBatchRequest) {
    if ('headers' in payloadsDeserialized[0] && 'X-SOGS-Nonce' in payloadsDeserialized[0].headers && nonceUsed(payloadsDeserialized[0].headers['X-SOGS-Nonce'])) {
      return new Response(null, { status: 400 })
    }
    status = 200
    responseBody = await handleBatchOnionRequest(payloadsDeserialized)
    contentType = 'application/json'
  } else {
    const headers = payloadsDeserialized[0].headers
    if ('X-SOGS-Nonce' in headers && nonceUsed(headers['X-SOGS-Nonce'])) {
      return new Response(null, { status: 400 })
    }
    const sogsRequest: Omit<SogsRequest, 'user'> = {
      ...targetPayloadDeserialized,
      body: payloadsDeserialized[1] || null,
      headers
    }
    const authResult = await auth({
      endpoint: sogsRequest.endpoint,
      method: sogsRequest.method,
      headers: sogsRequest.headers,
      body: JSON.stringify(sogsRequest.body)
    })
    if (authResult === 403) {
      return new Response(null, { status: 403 })
    }
    const response = await handleOnionRequest(
      sogsRequest,
      authResult
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

  if (process.env.NODE_ENV === 'development') {
    console.log('responded with', responseBody) // TODO: remove
  }

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
      const authResult = await auth({
        endpoint: '/batch',
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payloadsDeserialized[1])
      })
      if (authResult === 403) {
        return { code: 403, body: null }
      }
      const { path, ...inc } = tpd
      const { status, body, contentType } = await handleOnionRequest(
        {
          endpoint: path,
          ...inc,
          headers,
          body: payloadsDeserialized[1]
        },
        authResult
      )
      return { code: status, body, headers: { 'content-type': contentType } }
    } catch(e) {
      if(process.env.NODE_ENV === 'development') {
        console.error(e)
      }
      return { body: null, status: 500 }
    }
  })) as Awaited<ReturnType<typeof handleOnionRequest>>[]
  return JSON.stringify(responses)
}

const handleOnionRequest = async (payloadDeserialized: Omit<SogsRequest, 'user'>, user: User | null) => {
  const payload = await z.object({
    endpoint: z.string(),
    method: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.any().optional()
  }).safeParseAsync(payloadDeserialized)

  if (!payload.success) {
    return { body: null, status: 400 }
  }

  const { status, response, contentType } = await handleIncomingRequest({
    endpoint: payload.data.endpoint,
    method: payload.data.method,
    body: payload.data.body || null,
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
  if ('X-SOGS-Nonce' in headers && nonceUsed(headers['X-SOGS-Nonce'])) {
    return new Response(null, { status: 400 })
  }
  const sogsRequest = {
    endpoint,
    body: body && SJSON.parse(body),
    method: request.method,
    headers
  }
  const authResult = await auth({
    method: request.method,
    endpoint,
    headers,
    body
  })
  if (authResult === 403) {
    return new Response(null, { status: 403 })
  }
  const { status, contentType, ...sogsResponse } = await handleIncomingRequest({
    ...sogsRequest,
    user: authResult
  })
  let response = sogsResponse.response
  if (contentType === 'application/json') {
    response = JSON.stringify(response)
  }

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