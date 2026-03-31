import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'

import type { StorageAdapter } from '../adapters/interface.js'
import { DEFAULT_ADAPTER_AUTHORITY_MODEL, asMigrationDatabase } from '../adapters/interface.js'
import { generateId } from '../ids/generate-id.js'
import { createInMemoryApiKeyRepository } from '../entities/api-keys/repository.js'
import { createInMemoryOrganizationMembershipRepository } from '../entities/organization-memberships/repository.js'
import { createInMemoryOrganizationRepository } from '../entities/organizations/repository.js'
import { createCoreServices } from './index.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
}

function createTestAdapter(): StorageAdapter {
  const runtimeDb = {
    async transaction<T>(fn: (tx: typeof runtimeDb) => Promise<T>) {
      return fn(runtimeDb)
    },
    async execute(_statement: ReturnType<typeof sql>) {
      return undefined
    },
    async query() {
      return []
    },
  }

  return {
    name: 'sqlite',
    dialect: 'sqlite',
    supportsRls: false,
    supportsBranching: false,
    supportsJsonbIndexes: false,
    authorityModel: DEFAULT_ADAPTER_AUTHORITY_MODEL,
    unsafeRawDatabase: runtimeDb,
    users: {
      async resolveByExternalAuthId() {
        return null
      },
      async upsertFromAuth() {
        return generateId('user')
      },
    },
    async connect() {},
    async disconnect() {},
    async migrate() {},
    async runWithMigrationAuthority(fn) {
      return fn(asMigrationDatabase(runtimeDb))
    },
    async lookupApiKeyForAuth() {
      return null
    },
    async transaction(fn) {
      return runtimeDb.transaction(fn)
    },
    async execute(statement) {
      return runtimeDb.execute(statement)
    },
    async query(statement) {
      return runtimeDb.query(statement)
    },
    async withTenantContext(_context, fn) {
      return fn(runtimeDb)
    },
    async getSchemaSnapshot() {
      return {
        customFields: [],
        tables: [],
      }
    },
  }
}

describe('core services registry', () => {
  it('exposes the Wave 1 registry keys and keeps system reads separate', async () => {
    const organizations = createInMemoryOrganizationRepository([
      {
        id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Acme',
        slug: 'acme',
        plan: 'community',
        isActive: true,
        settings: {},
        createdAt: new Date('2026-03-31T09:00:00.000Z'),
        updatedAt: new Date('2026-03-31T09:00:00.000Z'),
      },
    ])
    const organizationMemberships = createInMemoryOrganizationMembershipRepository([
      {
        id: 'mbr_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
        role: 'owner',
        invitedByUserId: null,
        joinedAt: null,
        createdAt: new Date('2026-03-31T09:00:00.000Z'),
        updatedAt: new Date('2026-03-31T09:00:00.000Z'),
      },
    ])
    const apiKeys = createInMemoryApiKeyRepository([
      {
        id: 'key_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Server',
        keyHash: 'hashed',
        keyPrefix: 'orbt_live',
        scopes: ['contacts:read'],
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdByUserId: null,
        createdAt: new Date('2026-03-31T09:00:00.000Z'),
        updatedAt: new Date('2026-03-31T09:00:00.000Z'),
      },
    ])

    const services = createCoreServices(createTestAdapter(), {
      organizations,
      organizationMemberships,
      apiKeys,
    })

    expect(Object.keys(services).sort()).toEqual([
      'apiKeys',
      'companies',
      'contactContext',
      'contacts',
      'deals',
      'pipelines',
      'schema',
      'search',
      'stages',
      'system',
      'users',
    ])

    const organizationsPage = await services.system.organizations.list(ctx, { limit: 10 })
    const membershipsPage = await services.system.organizationMemberships.list(ctx, { limit: 10 })
    const apiKey = await services.system.apiKeys.get(ctx, 'key_01ARYZ6S41YYYYYYYYYYYYYYYY')

    expect(organizationsPage.data).toHaveLength(1)
    expect(membershipsPage.data).toHaveLength(1)
    expect(apiKey?.keyPrefix).toBe('orbt_live')
  })

  it('builds search and contact context from the Wave 1 entity set', async () => {
    const services = createCoreServices(createTestAdapter())
    const company = await services.companies.create(ctx, {
      name: 'Acme',
      domain: 'acme.test',
    })
    const contact = await services.contacts.create(ctx, {
      name: 'Taylor',
      email: 'taylor@acme.test',
      companyId: company.id,
      lastContactedAt: new Date('2026-03-31T10:00:00.000Z'),
    })
    const pipeline = await services.pipelines.create(ctx, { name: 'Sales' })
    const stage = await services.stages.create(ctx, {
      pipelineId: pipeline.id,
      name: 'Qualified',
      stageOrder: 1,
      probability: 30,
    })
    await services.deals.create(ctx, {
      title: 'Expansion',
      contactId: contact.id,
      companyId: company.id,
      stageId: stage.id,
      status: 'open',
    })

    const search = await services.search.search(ctx, { query: 'acme', limit: 20 })
    const context = await services.contactContext.getContactContext(ctx, { contactId: contact.id })

    expect(search.data.some((item) => item.objectType === 'company')).toBe(true)
    expect(search.data.some((item) => item.objectType === 'contact')).toBe(true)
    expect(context?.company?.id).toBe(company.id)
    expect(context?.openDeals).toHaveLength(1)
    expect(context?.openTasks).toEqual([])
    expect(context?.recentActivities).toEqual([])
    expect(context?.tags).toEqual([])
    expect(context?.lastContactDate).toBe('2026-03-31T10:00:00.000Z')
  })
})
