import { describe, it, expect } from 'vitest'
import { createCoreServices, createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedCompanies } from './companies.js'
import { TENANT_PROFILES } from '../profiles.js'
import { createPrng } from '../prng.js'

describe('seedCompanies', () => {
  it('creates N companies with unique names scoped to the org', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const companies = await seedCompanies(services, ctx, createPrng('beta-v1'), 10)
    expect(companies.length).toBe(10)
    expect(new Set(companies.map((c) => c.name)).size).toBe(10)
    for (const c of companies) {
      expect(c.id).toMatch(/^company_/)
      expect(c.organizationId).toBe(org.id)
      expect(c.domain).toBeTypeOf('string')
    }
  })
})
