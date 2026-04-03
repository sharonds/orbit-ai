import { describe, it, expect } from 'vitest'
import { OrbitClient } from '../client.js'

describe('OrbitClient', () => {
  it('throws if neither apiKey nor adapter is provided', () => {
    expect(() => new OrbitClient({})).toThrow(
      'OrbitClient requires either apiKey (API mode) or adapter + context (direct mode)',
    )
  })

  it('throws if both apiKey and adapter are provided', () => {
    expect(
      () =>
        new OrbitClient({
          apiKey: 'test-key',
          adapter: {} as any,
          context: { orgId: 'org_123' },
        }),
    ).toThrow('exactly one mode')
  })

  it('throws "not yet implemented" for apiKey-only mode', () => {
    expect(() => new OrbitClient({ apiKey: 'test-key' })).toThrow(
      'HTTP transport not yet implemented',
    )
  })

  it('throws "not yet implemented" for adapter+context mode', () => {
    expect(
      () =>
        new OrbitClient({
          adapter: {} as any,
          context: { orgId: 'org_123' },
        }),
    ).toThrow('Direct transport not yet implemented')
  })
})
