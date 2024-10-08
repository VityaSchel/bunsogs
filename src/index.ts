import bencode from 'bencode'
import chalk from 'chalk'
import SJSON from 'secure-json-parse'
import { z } from 'zod'
import { loadServerKey } from '@/keypairs'
import { loadConfig } from '@/config'
import { loadRooms } from '@/room'
import { startBackgroundJobs } from '@/background-jobs'
import { parseBody } from '@/parser'
import { encryptChannelEncryption } from '@/crypto'
import { handleIncomingRequest, type SogsRequest } from '@/router'
import { auth } from '@/middlewares/auth'
import { nonceUsed } from '@/nonce'
import type { User } from '@/user'
import { TextDecoder } from 'util'
import { loadPlugins } from '@/plugins'
import packageJson from '../package.json'

if (process.env.BUNSOGS_DEV === 'true') {
  console.log()
  console.warn(chalk.bgYellow(chalk.black('You\'re running bunsogs in development mode which will produce a lot of unwanted logs for bunsogs developers. Make sure you\'re running `bun start`, not `bun run dev`')))
}

console.log()

const keys = await loadServerKey()
const config = await loadConfig()
const rooms = await loadRooms()
const plugins = await loadPlugins()

const port = process.env.PORT || config.port || 3000
const hostname = process.env.HOSTNAME || config.hostname

Bun.serve({
  port,
  hostname,
  development: process.env.BUNSOGS_DEV === 'true',
  async fetch(request: Request) {
    try {
      const endpoint = new URL(request.url).pathname
      if (endpoint === '/oxen/v4/lsrpc' && request.method === 'POST') {
        return await handleOnionConnection(request)
      } else {
        return await handleClearnetRequest(request)
      }
    } catch(e) {
      if (process.env.BUNSOGS_DEV === 'true') {
        console.error(e)
        throw e
      } else {
        return new Response(null, { status: 500 })
      }
    }
  }
})

const handleOnionConnection = async (request: Request) => {
  const requestBody = Buffer.from(await request.arrayBuffer())
  const { payload: payloadBencoded, encType, remotePk } = parseBody(requestBody)
  const payloadDecoded = bencode.decode(payloadBencoded) as [Uint8Array, Uint8Array | undefined]
  const payloadMetadata = SJSON.parse(new TextDecoder('utf-8').decode(payloadDecoded[0]))
  const payloadBody = payloadDecoded[1] ? Buffer.from(payloadDecoded[1]) : null
  const headers = 'headers' in payloadMetadata 
    ? Object.fromEntries(Object.entries(payloadMetadata.headers).map(([k,v]) => [k.toLowerCase(), v])) as Record<string, string>
    : {}

  if(process.env.BUNSOGS_DEV === 'true') {
    const request = new TextDecoder('utf-8').decode(payloadDecoded[0])
    try {
      const requestFormatted = JSON.parse(request)
      console.log('Request:\n', requestFormatted)
    } catch(e) {
      console.log('Request:\n', request)
    }
    const body = payloadBody && (payloadBody.length > 1000
      ? payloadBody.subarray(0, 1000).toString('utf-8') + '...'
      : payloadBody.toString('utf-8'))
    if (body) {
      try {
        const bodyFormatted = JSON.parse(body)
        console.log('Body:\n', bodyFormatted)
      } catch (e) {
        console.log('Body:\n', body)
      }
    } else {
      console.log('Body:', body)
    }
    console.log()
  }

  const isBatchRequest = typeof payloadMetadata === 'object' &&
    'endpoint' in payloadMetadata &&
    ['/batch', '/sequence'].includes(payloadMetadata.endpoint)
    
  let responseBody: any, status: number, contentType: string | undefined, responseHeaders: Record<string, string> = {}
  if (isBatchRequest) {
    if (payloadBody === null) {
      return new Response(null, { status: 400 })
    }

    const nonceAlreadyUsed = 'x-sogs-nonce' in headers && nonceUsed(headers['x-sogs-nonce'])
    if (nonceAlreadyUsed) return new Response(null, { status: 400 })

    status = 200
    responseBody = await handleBatchOnionRequest({ 
      metadata: payloadMetadata, 
      body: payloadBody,
      batchEndpoint: payloadMetadata.endpoint
    })
    contentType = 'application/json'
  } else {
    if ('x-sogs-nonce' in headers && nonceUsed(headers['x-sogs-nonce'])) {
      return new Response(null, { status: 400 })
    }
    const sogsRequest: Omit<SogsRequest, 'user'> = {
      ...payloadMetadata,
      body: payloadBody || null,
      headers
    }
    const authResult = await auth({
      endpoint: sogsRequest.endpoint,
      method: sogsRequest.method,
      headers: sogsRequest.headers,
      body: sogsRequest.body
    })
    if (authResult === 403) {
      return new Response(null, { status: 403 })
    }
    const response = await handleOnionRequest(
      sogsRequest,
      authResult
    )
    if (response.body === null) {
      return new Response(null, { status: response.status, headers: response.headers })
    } else {
      if (response.contentType === 'application/json') {
        responseBody = JSON.stringify(response.body)
      } else {
        responseBody = response.body
      }
      status = response.status
      contentType = response.contentType
      responseHeaders = response.headers ?? {}
    }
  }

  if (process.env.BUNSOGS_DEV === 'true') {
    try {
      const responseFormatted = JSON.parse(responseBody)
      console.log('Responded with', status, responseFormatted)
    } catch(e) {
      console.log('Responded with', status, responseBody)
    }
    console.log('-'.repeat(50))
  }

  const responseData = Buffer.from(responseBody)
  const responseMeta = Buffer.from(JSON.stringify({ 'code': status, 'headers': { 'content-type': contentType } }))
  const lenMeta = Buffer.from(`${responseMeta.length}:`)
  const lenData = Buffer.from(`${responseData.length}:`)
  const start = Buffer.from('l')
  const end = Buffer.from('e')

  const responseBencoded = Buffer.concat([start, lenMeta, responseMeta, lenData, responseData, end])
  const responseEncrypted = encryptChannelEncryption(encType, responseBencoded, remotePk)
  return new Response(responseEncrypted, {
    status: status === 201 ? 200 : status, 
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...responseHeaders
    } 
  })
}

const handleBatchOnionRequest = async ({ metadata, body, batchEndpoint }: { metadata: any, body: Buffer, batchEndpoint: string }) => {
  const headers = z.record(z.string(), z.union([z.string(), z.number().transform(String)])).optional().parse(metadata.headers)
  const payload = z.array(z.record(z.string(), z.any())).parse(SJSON.parse(body.toString('utf-8')))
  const responses = await Promise.all(payload.map(async (tpd: any) => {
    try {
      const authResult = await auth({
        endpoint: batchEndpoint,
        method: 'POST',
        headers: headers && Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
        body
      })
      if (authResult === 403) {
        return { code: 403, body: null }
      }
      const { path, ...inc } = tpd
      const { status, body: response, contentType, headers: responseHeaders } = await handleOnionRequest(
        {
          endpoint: path,
          ...inc,
          headers,
          body
        },
        authResult
      )
      return { code: status, body: response, headers: { 'content-type': contentType, ...responseHeaders } }
    } catch(e) {
      if (process.env.BUNSOGS_DEV === 'true') {
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
    headers: z.record(z.string(), z.union([z.string(), z.number().transform(String)])).optional(),
    body: z.any().optional(),
    json: z.any().optional()
  }).safeParseAsync(payloadDeserialized)

  if (!payload.success) {
    if (process.env.BUNSOGS_DEV === 'true') {
      console.error('Error while parsing onion request body', payload.error)
    }
    return { body: null, status: 400 }
  }

  const { status, response, headers, contentType } = await handleIncomingRequest({
    endpoint: payload.data.endpoint,
    method: payload.data.method,
    body: (payload.data.json ?? payload.data.body) || null,
    headers: payload.data.headers,
    user
  })

  if (response === null) {
    return { body: null, status, headers: {} }
  } else {
    return { body: response, status, contentType, headers }
  }
}

const handleClearnetRequest = async (request: Request) => {
  let body: Buffer | null = null
  if (request.method === 'POST') {
    body = Buffer.from(await request.arrayBuffer())
  }

  const endpoint = new URL(request.url).pathname
  const headers = Object.fromEntries(Array.from(request.headers.entries()).map(([k,v]) => [k.toLowerCase(), v]))
  if ('x-sogs-nonce' in headers && nonceUsed(headers['x-sogs-nonce'])) {
    return new Response(null, { status: 400 })
  }
  const sogsRequest = {
    endpoint,
    body: body && SJSON.parse(body),
    files: [], // TODO: handle clearnet request files
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
    status: status === 201 ? 200 : status,
    headers: {
      ...(contentType && { 'content-type': contentType }),
      ...sogsResponse.headers
    }
  })
}

console.log()
console.log(`  Bunsogs v${packageJson.version}`)
if(plugins.length > 0) console.log(chalk.gray(`\n    ${plugins.length} plugin${plugins.length !== 1 ? 's' : ''} loaded`))
console.log(`\n  SOGS started at ${chalk.bold(`${hostname}:${port}`)}`)
const roomsList = Array.from(rooms.values())
console.log(
  roomsList.length 
    ? `\n    Public links to rooms:${
      roomsList.map(room => `\n      - ${
        chalk.bold(`${config.url}/${room.token}?public_key=${keys.publicKey.toString('hex')}`)}`
      ).join('')
    }`
    : chalk.bold('    You have no public rooms yet. Create your first room with bunsogs-cli!')
)
console.log()
console.log()

startBackgroundJobs()