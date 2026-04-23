import { describe, it, expect } from 'vitest'
import { createCoreServices, createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedCompanies } from './companies.js'
import { seedContacts } from './contacts.js'
import { seedActivities } from './activities.js'
import { TENANT_PROFILES } from '../profiles.js'
import { createPrng } from '../prng.js'

describe('seedActivities', () => {
  it('creates N activities within the history window', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const prng = createPrng('beta-v1')
    const companies = await seedCompanies(services, ctx, prng, 10)
    const contacts = await seedContacts(services, ctx, prng, companies, 50)
    const now = new Date('2026-04-23T12:00:00Z').getTime()
    const activities = await seedActivities(services, ctx, prng, contacts, 50, 14, now)
    expect(activities.length).toBe(50)
    const msInDay = 86_400_000
    for (const a of activities) {
      expect(a.id).toMatch(/^activity_/)
      expect(a.organizationId).toBe(org.id)
      const ts = new Date(a.occurredAt).getTime()
      expect(ts).toBeGreaterThanOrEqual(now - 14 * msInDay)
      expect(ts).toBeLessThanOrEqual(now)
    }
  })
})
