import { describe, it, expect } from 'vitest'
import { createCoreServices, createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedCompanies } from './companies.js'
import { seedContacts } from './contacts.js'
import { TENANT_PROFILES } from '../profiles.js'
import { createPrng } from '../prng.js'

describe('seedContacts', () => {
  it('creates N contacts with unique emails associated with seeded companies', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const org = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const prng = createPrng('beta-v1')
    const companies = await seedCompanies(services, ctx, prng, 10)
    const contacts = await seedContacts(services, ctx, prng, companies, 50)
    expect(contacts.length).toBe(50)
    expect(new Set(contacts.map((c) => c.email)).size).toBe(50)
    const companyIds = new Set(companies.map((c) => c.id))
    for (const contact of contacts) {
      expect(contact.id).toMatch(/^contact_/)
      expect(contact.organizationId).toBe(org.id)
      expect(companyIds.has(contact.companyId ?? '')).toBe(true)
    }
  })
})
