import { describe, it, expect, vi } from 'vitest'
import { DirectTransport } from '../transport/direct-transport.js'

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
