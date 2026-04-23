import { describe, it, expect } from 'vitest'
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { TENANT_PROFILES } from '../profiles.js'

describe('seedOrganization', () => {
  it('creates an organization with the expected name, slug, and org_ prefix', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const org = await seedOrganization(adapter, TENANT_PROFILES.acme)
    expect(org.id).toMatch(/^org_/)
    expect(org.name).toBe('Acme Events')
    expect(org.slug).toBe('acme-events')
  })

  it('is idempotent: second call with the same profile returns the existing org', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const a = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const b = await seedOrganization(adapter, TENANT_PROFILES.beta)
    expect(a.id).toEqual(b.id)
  })
})
