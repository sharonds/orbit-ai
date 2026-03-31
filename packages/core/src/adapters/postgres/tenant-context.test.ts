import { describe, expect, it, vi } from 'vitest'

import { buildClearTenantContextStatement, buildSetTenantContextStatement, withTenantContext } from './tenant-context.js'
import type { OrbitDatabase } from '../interface.js'

describe('withTenantContext', () => {
  it('sets and clears transaction-local org context around the callback', async () => {
    const execute = vi.fn(async () => undefined)
    const tx = { execute } as unknown as OrbitDatabase
    const db = {
      transaction: vi.fn(async (fn: (inner: OrbitDatabase) => Promise<string>) => fn(tx)),
    } as unknown as OrbitDatabase

    const result = await withTenantContext(db, { orgId: 'org_01ABCDEF0123456789ABCDEF01' }, async (inner) => {
      expect(inner).toBe(tx)
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenNthCalledWith(1, buildSetTenantContextStatement('org_01ABCDEF0123456789ABCDEF01'))
    expect(execute).toHaveBeenNthCalledWith(2, buildClearTenantContextStatement())
  })

  it('clears the org context even when the callback throws', async () => {
    const execute = vi.fn(async () => undefined)
    const tx = { execute } as unknown as OrbitDatabase
    const db = {
      transaction: vi.fn(async (fn: (inner: OrbitDatabase) => Promise<never>) => fn(tx)),
    } as unknown as OrbitDatabase

    await expect(
      withTenantContext(db, { orgId: 'org_01ABCDEF0123456789ABCDEF01' }, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(execute).toHaveBeenNthCalledWith(1, buildSetTenantContextStatement('org_01ABCDEF0123456789ABCDEF01'))
    expect(execute).toHaveBeenNthCalledWith(2, buildClearTenantContextStatement())
  })
})
