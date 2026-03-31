import { describe, expect, it } from 'vitest'

import { encodeCursor } from '../query/cursor.js'
import { buildRepositoryGetPlan, buildRepositoryListPlan } from './base-repository.js'

const organizationId = 'org_01ARYZ6S41YYYYYYYYYYYYYYYY'

describe('repository primitives', () => {
  it('injects tenant filters for tenant-scoped list operations', () => {
    const plan = buildRepositoryListPlan({
      tableName: 'contacts',
      context: { orgId: organizationId, dialect: 'postgres' },
      query: {},
    })

    expect(plan.scope).toBe('tenant')
    expect(plan.filters).toEqual([
      {
        field: 'organizationId',
        operator: 'eq',
        value: organizationId,
        source: 'tenant_context',
      },
    ])
    expect(plan.requiresAppLevelTenantFilter).toBe(true)
    expect(plan.requiresPostgresTenantContext).toBe(true)
  })

  it('keeps bootstrap table lookups outside tenant filters', () => {
    const plan = buildRepositoryGetPlan({
      tableName: 'organizations',
      context: { orgId: organizationId, dialect: 'postgres' },
      id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
    })

    expect(plan.scope).toBe('bootstrap')
    expect(plan.filters).toEqual([])
    expect(plan.requiresAppLevelTenantFilter).toBe(false)
    expect(plan.requiresPostgresTenantContext).toBe(false)
  })

  it('preserves explicit app-level org filtering on sqlite', () => {
    const plan = buildRepositoryListPlan({
      tableName: 'companies',
      context: { orgId: organizationId, dialect: 'sqlite' },
      query: {},
    })

    expect(plan.filters).toHaveLength(1)
    expect(plan.requiresAppLevelTenantFilter).toBe(true)
    expect(plan.requiresPostgresTenantContext).toBe(false)
  })

  it('decodes cursors before repository code consumes them', () => {
    const cursor = encodeCursor({
      version: 1,
      id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      sort: [{ field: 'created_at', direction: 'desc' }],
      values: { created_at: '2026-03-31T10:00:00.000Z' },
    })

    const plan = buildRepositoryListPlan({
      tableName: 'contacts',
      context: { orgId: organizationId, dialect: 'postgres' },
      query: { cursor },
    })

    expect(plan.cursor).toEqual({
      version: 1,
      id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      sort: [{ field: 'created_at', direction: 'desc' }],
      values: { created_at: '2026-03-31T10:00:00.000Z' },
    })
  })
})
