import { describe, it, expect, vi } from 'vitest'
import { DirectTransport, resolveServiceKey } from '../transport/direct-transport.js'
import { SqliteStorageAdapter } from '@orbit-ai/core'
import type { StorageAdapter } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'

describe('DirectTransport', () => {
  it('requires adapter and context.orgId', () => {
    expect(() => new DirectTransport({} as any)).toThrow('Direct transport requires adapter and context.orgId')

    expect(() => new DirectTransport({ adapter: {} as any } as any)).toThrow(
      'Direct transport requires adapter and context.orgId',
    )

    expect(() => new DirectTransport({ context: { orgId: 'org_1' } } as any)).toThrow(
      'Direct transport requires adapter and context.orgId',
    )
  })

  it('constructor does not call runWithMigrationAuthority', () => {
    const mockAdapter = {
      name: 'sqlite' as const,
      dialect: 'sqlite' as const,
      runWithMigrationAuthority: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    }

    // DirectTransport will try to create core services with this adapter,
    // which may fail — but the key assertion is that runWithMigrationAuthority is NOT called.
    try {
      new DirectTransport({
        adapter: mockAdapter as any,
        context: { orgId: 'org_1' },
      })
    } catch {
      // Construction may fail with mock adapter — that is OK
    }

    expect(mockAdapter.runWithMigrationAuthority).not.toHaveBeenCalled()
  })

  it('request does not call runWithMigrationAuthority', async () => {
    const mockAdapter = {
      name: 'sqlite' as const,
      dialect: 'sqlite' as const,
      runWithMigrationAuthority: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    }

    let transport: DirectTransport | undefined
    try {
      transport = new DirectTransport({
        adapter: mockAdapter as any,
        context: { orgId: 'org_1' },
      })
    } catch {
      // Construction may fail with mock adapter
    }

    if (transport) {
      try {
        await transport.request({ method: 'GET', path: '/contacts/cid_1' })
      } catch {
        // Expected to fail with mock adapter
      }
    }

    expect(mockAdapter.runWithMigrationAuthority).not.toHaveBeenCalled()
  })
})

function createTestAdapter(): StorageAdapter {
  const runtimeDb = {
    async transaction<T>(fn: (tx: typeof runtimeDb) => Promise<T>) {
      return fn(runtimeDb)
    },
    async execute(_statement: unknown) {
      return undefined
    },
    async query() {
      return []
    },
  }

  return new SqliteStorageAdapter({ database: runtimeDb })
}

function makeDirectOptions(): OrbitClientOptions {
  return {
    adapter: createTestAdapter(),
    context: { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' },
    version: '2026-04-01',
  }
}

describe('resolveServiceKey', () => {
  it('maps sequence_steps to sequenceSteps', () => {
    expect(resolveServiceKey('sequence_steps')).toBe('sequenceSteps')
  })

  it('maps sequence_enrollments to sequenceEnrollments', () => {
    expect(resolveServiceKey('sequence_enrollments')).toBe('sequenceEnrollments')
  })

  it('maps sequence_events to sequenceEvents', () => {
    expect(resolveServiceKey('sequence_events')).toBe('sequenceEvents')
  })

  it('passes through non-underscored entities unchanged', () => {
    expect(resolveServiceKey('contacts')).toBe('contacts')
    expect(resolveServiceKey('deals')).toBe('deals')
    expect(resolveServiceKey('companies')).toBe('companies')
    expect(resolveServiceKey('pipelines')).toBe('pipelines')
    expect(resolveServiceKey('tags')).toBe('tags')
  })
})

describe('DirectTransport underscored entity dispatch', () => {
  it('routes GET /v1/sequence_steps to the sequenceSteps service', async () => {
    const transport = new DirectTransport(makeDirectOptions())
    const result = await transport.request({ method: 'GET', path: '/v1/sequence_steps' })
    expect(result.meta).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('routes GET /v1/sequence_enrollments to the sequenceEnrollments service', async () => {
    const transport = new DirectTransport(makeDirectOptions())
    const result = await transport.request({ method: 'GET', path: '/v1/sequence_enrollments' })
    expect(result.meta).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('routes GET /v1/sequence_events to the sequenceEvents service', async () => {
    const transport = new DirectTransport(makeDirectOptions())
    const result = await transport.request({ method: 'GET', path: '/v1/sequence_events' })
    expect(result.meta).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
  })
})
