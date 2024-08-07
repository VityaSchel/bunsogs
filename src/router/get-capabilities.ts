import type { SogsResponse } from '@/router'

export function getCapabilities(): SogsResponse {
  return {
    status: 200,
    response: {
      'capabilities': [
        'blind',
        'reactions',
        'sogs'
      ]
    },
    contentType: 'application/json'
  }
}