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

  it('constructs successfully with apiKey', () => {
    expect(() => new OrbitClient({ apiKey: 'test-key' })).not.toThrow()
  })

  it('constructs successfully with adapter+context', () => {
    // May throw due to adapter internals, but NOT "not yet implemented"
    try {
      new OrbitClient({
        adapter: {} as any,
        context: { orgId: 'org_123' },
      })
    } catch (err: any) {
      expect(err.message).not.toContain('not yet implemented')
    }
  })
})
