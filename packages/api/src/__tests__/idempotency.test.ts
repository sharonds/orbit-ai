import { describe, it, expect } from 'vitest'

describe('idempotency middleware', () => {
  it.todo('same key + same route + same body replays stored response')
  it.todo('same key + different body returns 409 IDEMPOTENCY_CONFLICT')
  it.todo('GET requests are not subject to idempotency checks')
  it.todo('Idempotency-Key header is echoed in response')
  it.todo('expired idempotency keys are cleaned up')
})
