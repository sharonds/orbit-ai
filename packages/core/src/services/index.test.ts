import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { DataType, newDb } from 'pg-mem'

import type { StorageAdapter } from '../adapters/interface.js'
import { DEFAULT_ADAPTER_AUTHORITY_MODEL, asMigrationDatabase } from '../adapters/interface.js'
import { createPostgresStorageAdapter } from '../adapters/postgres/adapter.js'
import { createPostgresOrbitDatabase } from '../adapters/postgres/database.js'
import { initializePostgresWave2SliceDSchema } from '../adapters/postgres/schema.js'
import { generateId } from '../ids/generate-id.js'
import { createInMemoryActivityRepository } from '../entities/activities/repository.js'
import { createInMemoryApiKeyRepository } from '../entities/api-keys/repository.js'
import { createInMemoryCompanyRepository } from '../entities/companies/repository.js'
import { createInMemoryContractRepository } from '../entities/contracts/repository.js'
import { createInMemoryContactRepository } from '../entities/contacts/repository.js'
import { createInMemoryDealRepository } from '../entities/deals/repository.js'
import { createInMemoryNoteRepository } from '../entities/notes/repository.js'
import { createInMemoryOrganizationMembershipRepository } from '../entities/organization-memberships/repository.js'
import { createInMemoryOrganizationRepository } from '../entities/organizations/repository.js'
import { createInMemoryPaymentRepository } from '../entities/payments/repository.js'
import { createInMemoryPipelineRepository } from '../entities/pipelines/repository.js'
import { createInMemoryProductRepository } from '../entities/products/repository.js'
import { createInMemorySequenceEnrollmentRepository } from '../entities/sequence-enrollments/repository.js'
import { createInMemorySequenceEventRepository } from '../entities/sequence-events/repository.js'
import { createInMemorySequenceStepRepository } from '../entities/sequence-steps/repository.js'
import { createInMemorySequenceRepository } from '../entities/sequences/repository.js'
import { createInMemoryStageRepository } from '../entities/stages/repository.js'
import { createInMemoryTaskRepository } from '../entities/tasks/repository.js'
import { createInMemoryUserRepository } from '../entities/users/repository.js'
import { createInMemoryTagRepository } from '../entities/tags/repository.js'
import { createInMemoryEntityTagRepository } from '../entities/entity-tags/repository.js'
import { createInMemoryImportRepository } from '../entities/imports/repository.js'
import { createInMemoryWebhookRepository } from '../entities/webhooks/repository.js'
import { createInMemoryWebhookDeliveryRepository } from '../entities/webhook-deliveries/repository.js'
import { createInMemoryCustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import { createInMemoryAuditLogRepository } from '../entities/audit-logs/repository.js'
import { createInMemorySchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import { createInMemoryIdempotencyKeyRepository } from '../entities/idempotency-keys/repository.js'
import { createPostgresActivityRepository } from '../entities/activities/repository.js'
import { createPostgresCompanyRepository } from '../entities/companies/repository.js'
import { createPostgresContractRepository } from '../entities/contracts/repository.js'
import { createPostgresContactRepository } from '../entities/contacts/repository.js'
import { createPostgresNoteRepository } from '../entities/notes/repository.js'
import { createPostgresOrganizationRepository } from '../entities/organizations/repository.js'
import { createPostgresPaymentRepository } from '../entities/payments/repository.js'
import { createPostgresPipelineRepository } from '../entities/pipelines/repository.js'
import { createPostgresProductRepository } from '../entities/products/repository.js'
import { createPostgresSequenceEnrollmentRepository } from '../entities/sequence-enrollments/repository.js'
import { createPostgresSequenceEventRepository } from '../entities/sequence-events/repository.js'
import { createPostgresSequenceStepRepository } from '../entities/sequence-steps/repository.js'
import { createPostgresSequenceRepository } from '../entities/sequences/repository.js'
import { createPostgresStageRepository } from '../entities/stages/repository.js'
import { createPostgresTaskRepository } from '../entities/tasks/repository.js'
import { createPostgresUserRepository } from '../entities/users/repository.js'
import { createPostgresTagRepository } from '../entities/tags/repository.js'
import { createPostgresEntityTagRepository } from '../entities/entity-tags/repository.js'
import { createPostgresImportRepository } from '../entities/imports/repository.js'
import { createPostgresWebhookRepository } from '../entities/webhooks/repository.js'
import { createPostgresWebhookDeliveryRepository } from '../entities/webhook-deliveries/repository.js'
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
    beginTransaction() {
      return {
        async run(_ctx, fn) {
          return runtimeDb.transaction(fn)
        },
      }
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
  it('exposes the Slice D registry keys and keeps system reads separate', async () => {
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
    const products = createInMemoryProductRepository()
    const payments = createInMemoryPaymentRepository()
    const contracts = createInMemoryContractRepository()
    const sequences = createInMemorySequenceRepository()
    const sequenceSteps = createInMemorySequenceStepRepository()
    const sequenceEnrollments = createInMemorySequenceEnrollmentRepository()
    const sequenceEvents = createInMemorySequenceEventRepository()
    const users = createInMemoryUserRepository()
    const tags = createInMemoryTagRepository()
    const entityTags = createInMemoryEntityTagRepository()
    const imports = createInMemoryImportRepository()
    const webhooks = createInMemoryWebhookRepository()
    const webhookDeliveries = createInMemoryWebhookDeliveryRepository()

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
      products,
      payments,
      contracts,
      sequences,
      sequenceSteps,
      sequenceEnrollments,
      sequenceEvents,
      users,
      tags,
      entityTags,
      imports,
      webhooks,
      webhookDeliveries,
      customFieldDefinitions: createInMemoryCustomFieldDefinitionRepository(),
      auditLogs: createInMemoryAuditLogRepository(),
      schemaMigrations: createInMemorySchemaMigrationRepository(),
      idempotencyKeys: createInMemoryIdempotencyKeyRepository(),
    })

    expect(Object.keys(services).sort()).toEqual([
      'activities',
      'companies',
      'contactContext',
      'contacts',
      'contracts',
      'deals',
      'imports',
      'notes',
      'payments',
      'pipelines',
      'products',
      'schema',
      'search',
      'sequenceEnrollments',
      'sequenceEvents',
      'sequenceSteps',
      'sequences',
      'stages',
      'system',
      'tags',
      'tasks',
      'users',
      'webhooks',
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
    expect('create' in services.system.entityTags).toBe(false)
    expect('update' in services.system.entityTags).toBe(false)
    expect('delete' in services.system.entityTags).toBe(false)
    expect('create' in services.system.webhookDeliveries).toBe(false)
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
      entityTags: createInMemoryEntityTagRepository(),
      webhookDeliveries: createInMemoryWebhookDeliveryRepository(),
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
      entityTags: createInMemoryEntityTagRepository(),
      webhookDeliveries: createInMemoryWebhookDeliveryRepository(),
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
    expect(() => services.products).toThrow('is not implemented')
    expect(() => services.sequences).toThrow('is not implemented')
    expect(() => services.tags).toThrow('is not implemented')
    expect(() => services.webhooks).toThrow('is not implemented')
    expect(() => services.imports).toThrow('is not implemented')
  })

  it('can build the registry from a Postgres adapter and Postgres-backed repositories', async () => {
    const { database, adapter } = createPostgresTestAdapter()
    await initializePostgresWave2SliceDSchema(asMigrationDatabase(database))

    const organizations = createPostgresOrganizationRepository(adapter)
    const activities = createPostgresActivityRepository(adapter)
    const companies = createPostgresCompanyRepository(adapter)
    const contracts = createPostgresContractRepository(adapter)
    const contacts = createPostgresContactRepository(adapter)
    const notes = createPostgresNoteRepository(adapter)
    const payments = createPostgresPaymentRepository(adapter)
    const pipelines = createPostgresPipelineRepository(adapter)
    const products = createPostgresProductRepository(adapter)
    const sequenceEnrollments = createPostgresSequenceEnrollmentRepository(adapter)
    const sequenceEvents = createPostgresSequenceEventRepository(adapter)
    const sequenceSteps = createPostgresSequenceStepRepository(adapter)
    const sequences = createPostgresSequenceRepository(adapter)
    const stages = createPostgresStageRepository(adapter)
    const tasks = createPostgresTaskRepository(adapter)
    const users = createPostgresUserRepository(adapter)
    const tags = createPostgresTagRepository(adapter)
    const entityTags = createPostgresEntityTagRepository(adapter)
    const imports = createPostgresImportRepository(adapter)
    const webhooks = createPostgresWebhookRepository(adapter)
    const webhookDeliveries = createPostgresWebhookDeliveryRepository(adapter)

    const services = createCoreServices(adapter, {
      organizations,
      organizationMemberships: createInMemoryOrganizationMembershipRepository(),
      apiKeys: createInMemoryApiKeyRepository(),
      companies,
      contacts,
      pipelines,
      stages,
      deals: createInMemoryDealRepository(),
      activities,
      tasks,
      notes,
      products,
      payments,
      contracts,
      sequences,
      sequenceSteps,
      sequenceEnrollments,
      sequenceEvents,
      users,
      tags,
      entityTags,
      imports,
      webhooks,
      webhookDeliveries,
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
    const contact = await services.contacts.create(ctx, {
      name: 'Taylor',
      email: 'taylor@acme.test',
      companyId: company.id,
    })
    const product = await services.products.create(ctx, {
      name: 'Platform',
      price: '199.00',
      sortOrder: 1,
    })
    const sequence = await services.sequences.create(ctx, {
      name: 'Outbound',
    })
    const sequenceStep = await services.sequenceSteps.create(ctx, {
      sequenceId: sequence.id,
      stepOrder: 1,
      actionType: 'email',
    })
    const sequenceEnrollment = await services.sequenceEnrollments.create(ctx, {
      sequenceId: sequence.id,
      contactId: contact.id,
    })
    const sequenceEvent = await services.sequenceEvents.create(ctx, {
      sequenceEnrollmentId: sequenceEnrollment.id,
      sequenceStepId: sequenceStep.id,
      eventType: 'step.entered',
    })

    expect(await services.system.organizations.list(ctx, { limit: 10 })).toMatchObject({
      data: [{ id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' }],
    })
    expect(await services.companies.get(ctx, company.id)).toMatchObject({
      id: company.id,
      organizationId: ctx.orgId,
    })
    expect(await services.products.get(ctx, product.id)).toMatchObject({
      id: product.id,
      organizationId: ctx.orgId,
    })
    expect(await services.sequences.get(ctx, sequence.id)).toMatchObject({
      id: sequence.id,
      organizationId: ctx.orgId,
    })
    expect(await services.sequenceSteps.get(ctx, sequenceStep.id)).toMatchObject({
      id: sequenceStep.id,
      sequenceId: sequence.id,
    })
    expect(await services.sequenceEnrollments.get(ctx, sequenceEnrollment.id)).toMatchObject({
      id: sequenceEnrollment.id,
      contactId: contact.id,
    })
    expect(await services.sequenceEvents.get(ctx, sequenceEvent.id)).toMatchObject({
      id: sequenceEvent.id,
      sequenceEnrollmentId: sequenceEnrollment.id,
    })

    const tag = await services.tags.create(ctx, { name: 'VIP', color: '#ff0000' })
    expect(await services.tags.get(ctx, tag.id)).toMatchObject({
      id: tag.id,
      name: 'VIP',
    })

    const webhook = await services.webhooks.create(ctx, {
      url: 'https://example.com/hook',
      secretEncrypted: 'enc_test_secret',
      secretLastFour: 'cret',
      events: ['contact.created'],
    })
    expect(await services.webhooks.get(ctx, webhook.id)).toMatchObject({
      id: webhook.id,
      url: 'https://example.com/hook',
    })

    await database.close()
  })
})

describe('Wave 2 Slice E registry shape', () => {
  it('exposes all 9 system entries with get and list', () => {
    const customFieldDefinitions = createInMemoryCustomFieldDefinitionRepository()
    const auditLogs = createInMemoryAuditLogRepository()
    const schemaMigrations = createInMemorySchemaMigrationRepository()
    const idempotencyKeys = createInMemoryIdempotencyKeyRepository()

    const services = createCoreServices(createTestAdapter(), {
      organizations: createInMemoryOrganizationRepository(),
      organizationMemberships: createInMemoryOrganizationMembershipRepository(),
      apiKeys: createInMemoryApiKeyRepository(),
      companies: createInMemoryCompanyRepository(),
      contacts: createInMemoryContactRepository(),
      pipelines: createInMemoryPipelineRepository(),
      stages: createInMemoryStageRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
      entityTags: createInMemoryEntityTagRepository(),
      webhookDeliveries: createInMemoryWebhookDeliveryRepository(),
      customFieldDefinitions,
      auditLogs,
      schemaMigrations,
      idempotencyKeys,
    })

    // system has 5 eager keys + 4 lazy getters; check known eager keys
    const eagerSystemKeys = Object.keys(services.system).sort()
    expect(eagerSystemKeys).toContain('apiKeys')
    expect(eagerSystemKeys).toContain('entityTags')
    expect(eagerSystemKeys).toContain('organizationMemberships')
    expect(eagerSystemKeys).toContain('organizations')
    expect(eagerSystemKeys).toContain('webhookDeliveries')

    // All system entries have get and list
    expect(typeof services.system.customFieldDefinitions.get).toBe('function')
    expect(typeof services.system.customFieldDefinitions.list).toBe('function')
    expect(typeof services.system.auditLogs.get).toBe('function')
    expect(typeof services.system.auditLogs.list).toBe('function')
    expect(typeof services.system.schemaMigrations.get).toBe('function')
    expect(typeof services.system.schemaMigrations.list).toBe('function')
    expect(typeof services.system.idempotencyKeys.get).toBe('function')
    expect(typeof services.system.idempotencyKeys.list).toBe('function')

    // system.schemaMigrations is read-only metadata, not schema-engine execution
    expect(services.system.schemaMigrations).not.toHaveProperty('apply')
    expect(services.system.schemaMigrations).not.toHaveProperty('approve')
    expect(services.system.schemaMigrations).not.toHaveProperty('rollback')
    expect(services.system.schemaMigrations).not.toHaveProperty('preview')
  })
})
