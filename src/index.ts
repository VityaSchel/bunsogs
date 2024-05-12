import { parseBody } from '@/parser'
import bencode from 'bencode'


const server = Bun.serve({
  port: 3000,
  async fetch(request) {
    const body = Buffer.from(await request.arrayBuffer())
    
    parseBody(body)

    // const decodedBody = bencode.decode(Buffer.from(body))
    // console.log(decodedBody)
    return new Response('ok')
  }
})

console.log(`Listening on localhost:${server.port}`)