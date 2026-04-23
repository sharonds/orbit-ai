import { describe, it, expect } from 'vitest'
import {
  createCoreServices,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedUsers } from './users.js'
import { TENANT_PROFILES } from '../profiles.js'
import { createPrng } from '../prng.js'

describe('seedUsers', () => {
  it('creates 3 users scoped to the target org', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const org = await seedOrganization(adapter, TENANT_PROFILES.acme)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const users = await seedUsers(services, ctx, createPrng('users-test'), 3)
    expect(users.length).toBe(3)
    for (const u of users) {
      expect(u.id).toMatch(/^user_/)
      expect(u.email).toMatch(/@/)
      expect(u.organizationId).toBe(org.id)
    }
  })

  it('assigns the first user the admin role and the rest member', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const org = await seedOrganization(adapter, TENANT_PROFILES.acme)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const users = await seedUsers(services, ctx, createPrng('users-test'), 3)
    expect(users[0]!.role).toBe('admin')
    expect(users[1]!.role).toBe('member')
    expect(users[2]!.role).toBe('member')
  })
})
