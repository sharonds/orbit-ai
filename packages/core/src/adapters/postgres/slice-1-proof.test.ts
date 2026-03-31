import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'

import type { OrbitDatabase } from '../interface.js'
import { buildClearTenantContextStatement, buildSetTenantContextStatement, withTenantContext } from './tenant-context.js'
import { apiKeys, organizationMemberships, organizations, users } from '../../schema/tables.js'

describe('slice 1 postgres-family proof', () => {
  it('combines bootstrap schema coverage with transaction-bound tenant context', async () => {
    const schemaTables = [
      getTableConfig(organizations),
      getTableConfig(users),
      getTableConfig(organizationMemberships),
      getTableConfig(apiKeys),
    ].map((config) => `${config.schema}.${config.name}`)

    expect(schemaTables).toEqual([
      'orbit.organizations',
      'orbit.users',
      'orbit.organization_memberships',
      'orbit.api_keys',
    ])

    const execute = vi.fn(async () => undefined)
    const tx = { execute } as unknown as OrbitDatabase
    const db = {
      transaction: vi.fn(async (fn: (inner: OrbitDatabase) => Promise<string>) => fn(tx)),
    } as unknown as OrbitDatabase

    const result = await withTenantContext(db, { orgId: 'org_01ABCDEF0123456789ABCDEF01' }, async (inner) => {
      expect(inner).toBe(tx)
      expect(schemaTables).toContain('orbit.users')
      return 'orbit.users'
    })

    expect(result).toBe('orbit.users')
    expect(execute).toHaveBeenNthCalledWith(1, buildSetTenantContextStatement('org_01ABCDEF0123456789ABCDEF01'))
    expect(execute).toHaveBeenNthCalledWith(2, buildClearTenantContextStatement())
  })
})
