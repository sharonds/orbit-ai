import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'

import { apiKeys, organizationMemberships, organizations, users } from './tables.js'

describe('bootstrap schema slice 1', () => {
  it('keeps organizations bootstrap-scoped in orbit schema', () => {
    const config = getTableConfig(organizations)

    expect(config.schema).toBe('orbit')
    expect(config.name).toBe('organizations')
    expect(config.foreignKeys).toHaveLength(0)
  })

  it('keeps users org-scoped with a single organization foreign key', () => {
    const config = getTableConfig(users)

    expect(config.schema).toBe('orbit')
    expect(config.name).toBe('users')
    expect(config.foreignKeys).toHaveLength(1)
  })

  it('keeps organization memberships org-scoped with membership links', () => {
    const config = getTableConfig(organizationMemberships)

    expect(config.schema).toBe('orbit')
    expect(config.name).toBe('organization_memberships')
    expect(config.foreignKeys.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps api keys org-scoped and hashed for auth lookup', () => {
    const config = getTableConfig(apiKeys)

    expect(config.schema).toBe('orbit')
    expect(config.name).toBe('api_keys')
    expect(config.foreignKeys.length).toBeGreaterThanOrEqual(1)
    expect(config.indexes.length).toBeGreaterThanOrEqual(2)
  })
})
