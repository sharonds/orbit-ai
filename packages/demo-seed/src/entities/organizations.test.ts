import { describe, it, expect } from 'vitest'
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { TENANT_PROFILES } from '../profiles.js'

describe('seedOrganization', () => {
  it('creates an organization with the expected name, slug, and org_ prefix, and reports created=true', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const result = await seedOrganization(adapter, TENANT_PROFILES.acme)
    expect(result.created).toBe(true)
    expect(result.organization.id).toMatch(/^org_/)
    expect(result.organization.name).toBe('Acme Events')
    expect(result.organization.slug).toBe('acme-events')
  })

  it('is idempotent: second call with the same profile returns the existing org and reports created=false', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const a = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const b = await seedOrganization(adapter, TENANT_PROFILES.beta)
    expect(a.created).toBe(true)
    expect(b.created).toBe(false)
    expect(a.organization.id).toEqual(b.organization.id)
  })
})
