import { describe, it, expect } from 'vitest'
import { createCoreServices, createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedCompanies } from './companies.js'
import { seedContacts } from './contacts.js'
import { seedNotes } from './notes.js'
import { TENANT_PROFILES } from '../profiles.js'
import { createPrng } from '../prng.js'

describe('seedNotes', () => {
  it('creates N notes attached to contacts', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const org = await seedOrganization(adapter, TENANT_PROFILES.beta)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const prng = createPrng('beta-v1')
    const companies = await seedCompanies(services, ctx, prng, 10)
    const contacts = await seedContacts(services, ctx, prng, companies, 50)
    const notes = await seedNotes(services, ctx, prng, contacts, 10)
    expect(notes.length).toBe(10)
    for (const n of notes) {
      expect(n.id).toMatch(/^note_/)
      expect(n.content).toMatch(/.+/)
      expect(n.organizationId).toBe(org.id)
    }
  })
})
