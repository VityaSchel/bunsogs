export class BadPermission extends Error {
  constructor(message?: string) {
    super(message)
  }
}

export class PostRejected extends Error {
  constructor(message?: string) {
    super(message)
  }
}


export class PostRateLimited extends PostRejected {
  constructor(message?: string) {
    super(message)
  }
}

