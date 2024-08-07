import type { SogsRequest, SogsResponse } from '@/router'
import { deleteInbox } from '@/router/dm'

export async function deleteDmInbox(req: SogsRequest): Promise<SogsResponse> {
  if (!req.user) {
    return {
      status: 401,
      response: null
    }
  }
  
  const deleted = await deleteInbox({
    type: 'recipient',
    id: req.user.id
  })

  return {
    status: 200,
    response: { deleted },
    contentType: 'application/json'
  }
}