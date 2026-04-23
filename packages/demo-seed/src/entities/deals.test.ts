import { describe, it, expect } from 'vitest'
import { createCoreServices, createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedPipelinesAndStages } from './pipelines.js'
import { seedCompanies } from './companies.js'
import { seedContacts } from './contacts.js'
import { seedDeals } from './deals.js'
import { TENANT_PROFILES } from '../profiles.js'
import { createPrng } from '../prng.js'

describe('seedDeals', () => {
  it('creates N deals across stages with contact+company associations', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.acme)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const prng = createPrng('acme-v1')
    const { pipeline, stages } = await seedPipelinesAndStages(services, ctx)
    const companies = await seedCompanies(services, ctx, prng, 40)
    const contacts = await seedContacts(services, ctx, prng, companies, 200)
    const deals = await seedDeals(services, ctx, prng, pipeline, stages, companies, contacts, 15)
    expect(deals.length).toBe(15)
    for (const d of deals) {
      expect(d.id).toMatch(/^deal_/)
      expect(stages.map((s) => s.id)).toContain(d.stageId)
      expect(d.title).toMatch(/.+/)
    }
  })
})
