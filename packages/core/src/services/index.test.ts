import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { DataType, newDb } from 'pg-mem'

import type { StorageAdapter } from '../adapters/interface.js'
import { DEFAULT_ADAPTER_AUTHORITY_MODEL, asMigrationDatabase } from '../adapters/interface.js'
import { createPostgresStorageAdapter } from '../adapters/postgres/adapter.js'
import { createPostgresOrbitDatabase } from '../adapters/postgres/database.js'
import { initializePostgresWave2SliceASchema } from '../adapters/postgres/schema.js'
import { generateId } from '../ids/generate-id.js'
import { createInMemoryActivityRepository } from '../entities/activities/repository.js'
import { createInMemoryApiKeyRepository } from '../entities/api-keys/repository.js'
import { createInMemoryCompanyRepository } from '../entities/companies/repository.js'
import { createInMemoryContactRepository } from '../entities/contacts/repository.js'
import { createInMemoryDealRepository } from '../entities/deals/repository.js'
import { createInMemoryNoteRepository } from '../entities/notes/repository.js'
import { createInMemoryOrganizationMembershipRepository } from '../entities/organization-memberships/repository.js'
import { createInMemoryOrganizationRepository } from '../entities/organizations/repository.js'
import { createInMemoryPipelineRepository } from '../entities/pipelines/repository.js'
import { createInMemoryStageRepository } from '../entities/stages/repository.js'
import { createInMemoryTaskRepository } from '../entities/tasks/repository.js'
import { createInMemoryUserRepository } from '../entities/users/repository.js'
import { createPostgresActivityRepository } from '../entities/activities/repository.js'
import { createPostgresCompanyRepository } from '../entities/companies/repository.js'
import { createPostgresNoteRepository } from '../entities/notes/repository.js'
import { createPostgresOrganizationRepository } from '../entities/organizations/repository.js'
import { createPostgresPipelineRepository } from '../entities/pipelines/repository.js'
import { createPostgresStageRepository } from '../entities/stages/repository.js'
import { createPostgresTaskRepository } from '../entities/tasks/repository.js'
import { createPostgresUserRepository } from '../entities/users/repository.js'
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

function createPostgresTestAdapter() {
  const mem = newDb({ autoCreateForeignKeyIndices: true })
  mem.public.registerFunction({
    name: 'set_config',
    args: [DataType.text, DataType.text, DataType.bool],
    returns: DataType.text,
    implementation: (_name: string, value: string) => value,
  })

  const { Pool } = mem.adapters.createPg()
  const database = createPostgresOrbitDatabase({ pool: new Pool() })
  const adapter = createPostgresStorageAdapter({ database })

  return { database, adapter }
}

describe('core services registry', () => {
  it('exposes the Slice A registry keys and keeps system reads separate', async () => {
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
    const companies = createInMemoryCompanyRepository()
    const contacts = createInMemoryContactRepository()
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const deals = createInMemoryDealRepository()
    const activities = createInMemoryActivityRepository()
    const tasks = createInMemoryTaskRepository()
    const notes = createInMemoryNoteRepository()
    const users = createInMemoryUserRepository()

    const services = createCoreServices(createTestAdapter(), {
      organizations,
      organizationMemberships,
      apiKeys,
      companies,
      contacts,
      pipelines,
      stages,
      deals,
      activities,
      tasks,
      notes,
      users,
    })

    expect(Object.keys(services).sort()).toEqual([
      'activities',
      'companies',
      'contactContext',
      'contacts',
      'deals',
      'notes',
      'pipelines',
      'schema',
      'search',
      'stages',
      'system',
      'tasks',
      'users',
    ])

    const organizationsPage = await services.system.organizations.list(ctx, { limit: 10 })
    const membershipsPage = await services.system.organizationMemberships.list(ctx, { limit: 10 })
    const apiKey = await services.system.apiKeys.get(ctx, 'key_01ARYZ6S41YYYYYYYYYYYYYYYY')

    expect(organizationsPage.data).toHaveLength(1)
    expect(membershipsPage.data).toHaveLength(1)
    expect(apiKey?.keyPrefix).toBe('orbt_live')
    expect('keyHash' in apiKey!).toBe(false)
    expect('create' in services.system.apiKeys).toBe(false)
    expect('update' in services.system.apiKeys).toBe(false)
    expect('delete' in services.system.apiKeys).toBe(false)
  })

  it('builds search and contact context from the Wave 1 entity set', async () => {
    const companies = createInMemoryCompanyRepository()
    const contacts = createInMemoryContactRepository()
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const deals = createInMemoryDealRepository()
    const activities = createInMemoryActivityRepository()
    const tasks = createInMemoryTaskRepository()
    const notes = createInMemoryNoteRepository()
    const users = createInMemoryUserRepository()

    const services = createCoreServices(createTestAdapter(), {
      organizations: createInMemoryOrganizationRepository(),
      organizationMemberships: createInMemoryOrganizationMembershipRepository(),
      apiKeys: createInMemoryApiKeyRepository(),
      companies,
      contacts,
      pipelines,
      stages,
      deals,
      activities,
      tasks,
      notes,
      users,
    })
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
    await services.activities.create(ctx, {
      type: 'call',
      subject: 'Discovery call',
      contactId: contact.id,
      occurredAt: new Date('2026-03-31T11:00:00.000Z'),
    })
    await services.tasks.create(ctx, {
      title: 'Send recap',
      contactId: contact.id,
      dueDate: new Date('2026-04-01T08:00:00.000Z'),
    })
    await services.notes.create(ctx, {
      content: 'Strong champion signal',
      contactId: contact.id,
    })

    const search = await services.search.search(ctx, { query: 'acme', limit: 20 })
    const context = await services.contactContext.getContactContext(ctx, { contactId: contact.id })

    expect(search.data.some((item) => item.objectType === 'company')).toBe(true)
    expect(search.data.some((item) => item.objectType === 'contact')).toBe(true)
    expect(context?.company?.id).toBe(company.id)
    expect(context?.openDeals).toHaveLength(1)
    expect(context?.openTasks).toHaveLength(1)
    expect(context?.recentActivities).toHaveLength(1)
    expect(context?.tags).toEqual([])
    expect(context?.lastContactDate).toBe('2026-03-31T11:00:00.000Z')
  })

  it('fails loudly when an adapter has no implemented repository bridge and no overrides', () => {
    expect(() => createCoreServices(createTestAdapter())).toThrow('is not implemented')
  })

  it('preserves Wave 1 compatibility until Slice A services are explicitly accessed', async () => {
    const companies = createInMemoryCompanyRepository()
    const contacts = createInMemoryContactRepository()
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const deals = createInMemoryDealRepository()
    const users = createInMemoryUserRepository()

    const services = createCoreServices(createTestAdapter(), {
      organizations: createInMemoryOrganizationRepository(),
      organizationMemberships: createInMemoryOrganizationMembershipRepository(),
      apiKeys: createInMemoryApiKeyRepository(),
      companies,
      contacts,
      pipelines,
      stages,
      deals,
      users,
    })

    const company = await services.companies.create(ctx, { name: 'Acme' })
    const contact = await services.contacts.create(ctx, {
      name: 'Taylor',
      email: 'taylor@acme.test',
      companyId: company.id,
      lastContactedAt: new Date('2026-03-31T10:00:00.000Z'),
    })

    const context = await services.contactContext.getContactContext(ctx, { contactId: contact.id })

    expect(context?.openTasks).toEqual([])
    expect(context?.recentActivities).toEqual([])
    expect(() => services.activities).toThrow('is not implemented')
  })

  it('can build the registry from a Postgres adapter and Postgres-backed repositories', async () => {
    const { database, adapter } = createPostgresTestAdapter()
    await initializePostgresWave2SliceASchema(database)

    const organizations = createPostgresOrganizationRepository(adapter)
    const activities = createPostgresActivityRepository(adapter)
    const companies = createPostgresCompanyRepository(adapter)
    const notes = createPostgresNoteRepository(adapter)
    const pipelines = createPostgresPipelineRepository(adapter)
    const stages = createPostgresStageRepository(adapter)
    const tasks = createPostgresTaskRepository(adapter)
    const users = createPostgresUserRepository(adapter)

    const services = createCoreServices(adapter, {
      organizations,
      organizationMemberships: createInMemoryOrganizationMembershipRepository(),
      apiKeys: createInMemoryApiKeyRepository(),
      companies,
      contacts: createInMemoryContactRepository(),
      pipelines,
      stages,
      deals: createInMemoryDealRepository(),
      activities,
      tasks,
      notes,
      users,
    })

    await organizations.create({
      id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-04-01T08:00:00.000Z'),
      updatedAt: new Date('2026-04-01T08:00:00.000Z'),
    })
    const company = await services.companies.create(ctx, {
      name: 'Acme',
      domain: 'acme.test',
    })

    expect(await services.system.organizations.list(ctx, { limit: 10 })).toMatchObject({
      data: [{ id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' }],
    })
    expect(await services.companies.get(ctx, company.id)).toMatchObject({
      id: company.id,
      organizationId: ctx.orgId,
    })

    await database.close()
  })
})
