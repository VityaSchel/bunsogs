type SogsRequest = {
  endpoint: string
  method: string
  body: object | null
}

type SogsResponse = {
  status: number,
  response: string | null,
  contentType?: string
}

export async function handleIncomingRequest(req: SogsRequest): Promise<SogsResponse> {
  console.log('handled', req.endpoint, req.method, req.body) // TODO: remove
  if(req.endpoint === '/capabilities' && req.method === 'GET') {
    return getCapabilities()
  } else if(req.endpoint.startsWith('/room/') && req.method === 'GET') {
    return getRoom(req)
  } else {
    console.warn('Unknown route', req.method, req.endpoint)
    return {
      response: null, 
      status: 404
    }
  }
}

function getCapabilities(): SogsResponse {
  return {
    status: 200,
    response: JSON.stringify({
      'capabilities': [
        'blind',
        'reactions',
        'sogs'
      ]
    }),
    contentType: 'application/json'
  }
}

function getRoom(req: SogsRequest): SogsResponse {
  const roomName = req.endpoint.split('/')[2]
  console.log('roomName', roomName) // TODO: remove
  return {
    status: 200,
    response: JSON.stringify({
      'room': roomName,
      'messages': []
    }),
    contentType: 'application/json'
  }
}