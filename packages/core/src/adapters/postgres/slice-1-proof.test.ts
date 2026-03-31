import type { SQL } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'

import type { OrbitDatabase } from '../interface.js'
import { buildSetTenantContextStatement, withTenantContext } from './tenant-context.js'
import { apiKeys, organizationMemberships, organizations, users } from '../../schema/tables.js'

function getTenantContextParam(statement: SQL): string | null {
  const query = statement.toQuery({
    escapeName: (value) => value,
    escapeParam: () => '?',
    escapeString: (value) => JSON.stringify(value),
    casing: { getColumnCasing: (column) => column },
    inlineParams: false,
    paramStartIndex: { value: 0 },
  })

  if (!query.sql.includes("set_config('app.current_org_id'") || query.params.length === 0) {
    return null
  }

  return String(query.params[0])
}

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

    const state = { outsideCurrentOrgId: null as string | null }
    const execute = vi.fn(async (statement: SQL) => {
      const orgId = getTenantContextParam(statement)

      if (orgId) {
        txState.currentOrgId = orgId
      }
    })
    const txState = { currentOrgId: null as string | null }
    const tx = {
      execute,
      readCurrentOrgId() {
        return txState.currentOrgId
      },
    } as unknown as OrbitDatabase & { readCurrentOrgId(): string | null }
    const db = {
      async transaction(fn: (inner: OrbitDatabase) => Promise<string>) {
        state.outsideCurrentOrgId = null

        try {
          return await fn(tx)
        } finally {
          txState.currentOrgId = null
          state.outsideCurrentOrgId = null
        }
      },
      execute: vi.fn(async () => undefined),
      readCurrentOrgId() {
        return state.outsideCurrentOrgId
      },
    } as unknown as OrbitDatabase & { readCurrentOrgId(): string | null }

    const result = await withTenantContext(db, { orgId: 'org_01ABCDEF0123456789ABCDEF01' }, async (inner) => {
      expect(inner).toBe(tx)
      expect(schemaTables).toContain('orbit.users')
      expect((inner as typeof tx).readCurrentOrgId()).toBe('org_01ABCDEF0123456789ABCDEF01')
      return 'orbit.users'
    })

    expect(result).toBe('orbit.users')
    expect(execute).toHaveBeenNthCalledWith(1, buildSetTenantContextStatement('org_01ABCDEF0123456789ABCDEF01'))
    expect(execute).toHaveBeenCalledTimes(1)
    expect(db.readCurrentOrgId()).toBeNull()
  })
})
