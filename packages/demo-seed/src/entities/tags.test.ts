import { describe, it, expect } from 'vitest'
import { createCoreServices, createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedTags } from './tags.js'
import { TENANT_PROFILES } from '../profiles.js'

describe('seedTags', () => {
  it('creates 5 tags scoped to the org', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const tags = await seedTags(services, ctx)
    expect(tags.length).toBe(5)
    const names = tags.map((t) => t.name).sort()
    expect(names).toEqual(['champion', 'enterprise', 'eu', 'hot-lead', 'partner'])
    for (const t of tags) {
      expect(t.id).toMatch(/^tag_/)
      expect(t.organizationId).toBe(org.id)
    }
  })
})
