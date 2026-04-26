import { newDb } from 'pg-mem'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { asMigrationDatabase } from '../adapters/interface.js'
import { createPostgresStorageAdapter } from '../adapters/postgres/adapter.js'
import { createPostgresOrbitDatabase } from '../adapters/postgres/database.js'
import { initializePostgresWave2SliceESchema } from '../adapters/postgres/schema.js'
import { IMPLEMENTED_TENANT_TABLES } from '../repositories/tenant-scope.js'
import {
  computeSchemaMigrationChecksum,
  type SchemaMigrationAdapterScope,
  type SchemaMigrationForwardOperation,
} from '../schema-engine/migrations.js'
import { generatePostgresRlsSql } from '../schema-engine/rls.js'
import { createPostgresApiKeyRepository } from '../entities/api-keys/repository.js'
import { createPostgresAuditLogRepository } from '../entities/audit-logs/repository.js'
import { createPostgresCustomFieldDefinitionRepository } from '../entities/custom-field-definitions/repository.js'
import { createPostgresIdempotencyKeyRepository } from '../entities/idempotency-keys/repository.js'
import { createPostgresOrganizationMembershipRepository } from '../entities/organization-memberships/repository.js'
import { createPostgresOrganizationRepository } from '../entities/organizations/repository.js'
import { createPostgresSchemaMigrationRepository } from '../entities/schema-migrations/repository.js'
import { createPostgresUserRepository } from '../entities/users/repository.js'
import { generateId } from '../ids/generate-id.js'
import { createCoreServices } from './index.js'

const ctxA = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
  userId: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const
const migrationAdapter = { name: 'postgres', dialect: 'postgres' } satisfies SchemaMigrationAdapterScope
const migrationForwardOperations = [{
  type: 'custom_field.add',
  entityType: 'contacts',
  fieldName: 'tier',
  fieldType: 'text',
}] satisfies SchemaMigrationForwardOperation[]
const migrationReverseOperations = [{
  type: 'custom_field.delete',
  entityType: 'contacts',
  fieldName: 'tier',
}] satisfies SchemaMigrationForwardOperation[]

async function createPostgresAdapter() {
  const memory = newDb()
  const { Pool } = memory.adapters.createPg()
  const pool = new Pool({ max: 1 })
  const database = createPostgresOrbitDatabase({ pool })
  await initializePostgresWave2SliceESchema(asMigrationDatabase(database), {
    // pg-mem does not implement RLS DDL, so persistence proofs exercise the
    // real bootstrap path with only the unsupported Postgres-specific steps
    // off. Also opt out of partial unique indexes because pg-mem has a
    // documented bug where rows with `is_default = false` become invisible
    // to SELECTs filtered by `organization_id` once the L8 partial unique
    // index exists. The L8 race is still covered by the in-memory
    // pipeline repo mirror and the coerce-conflict unit test.
    includeRls: false,
    includePartialUniqueIndexes: false,
  })

  const adapter = createPostgresStorageAdapter({
    database,
    getSchemaSnapshot: async () => ({
      customFields: [],
      tables: [
        'organizations',
        'users',
        'organization_memberships',
        'api_keys',
        'companies',
        'contacts',
        'pipelines',
        'stages',
        'deals',
        'activities',
        'tasks',
        'notes',
        'products',
        'payments',
        'contracts',
        'sequences',
        'sequence_steps',
        'sequence_enrollments',
        'sequence_events',
        'tags',
        'entity_tags',
        'imports',
        'webhooks',
        'webhook_deliveries',
        'custom_field_definitions',
        'audit_logs',
        'schema_migrations',
        'idempotency_keys',
      ],
    }),
  })

  return { adapter, pool }
}

describe('postgres persistence bridge', () => {
  it('persists Slice D records across fresh service registries', async () => {
    const { adapter, pool } = await createPostgresAdapter()
    const organizations = createPostgresOrganizationRepository(adapter)
    const users = createPostgresUserRepository(adapter)

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-04-01T11:00:00.000Z'),
      updatedAt: new Date('2026-04-01T11:00:00.000Z'),
    })

    const servicesA = createCoreServices(adapter)
    await users.create(ctxA, {
      id: ctxA.userId,
      organizationId: ctxA.orgId,
      email: 'owner@acme.test',
      name: 'Owner',
      role: 'owner',
      avatarUrl: null,
      externalAuthId: null,
      isActive: true,
      metadata: {},
      createdAt: new Date('2026-04-01T11:00:00.000Z'),
      updatedAt: new Date('2026-04-01T11:00:00.000Z'),
    })
    const company = await servicesA.companies.create(ctxA, {
      name: 'Acme',
      domain: 'acme.test',
    })
    const contact = await servicesA.contacts.create(ctxA, {
      name: 'Taylor',
      email: 'taylor@acme.test',
      companyId: company.id,
      lastContactedAt: new Date('2026-04-01T11:30:00.000Z'),
    })
    const pipeline = await servicesA.pipelines.create(ctxA, { name: 'Sales' })
    const stage = await servicesA.stages.create(ctxA, {
      pipelineId: pipeline.id,
      name: 'Qualified',
      stageOrder: 1,
      probability: 30,
    })
    const deal = await servicesA.deals.create(ctxA, {
      title: 'Expansion',
      contactId: contact.id,
      companyId: company.id,
      stageId: stage.id,
      status: 'open',
    })
    const activity = await servicesA.activities.create(ctxA, {
      type: 'call',
      subject: 'Discovery',
      contactId: contact.id,
      dealId: deal.id,
      companyId: company.id,
      occurredAt: new Date('2026-04-01T12:00:00.000Z'),
    })
    const task = await servicesA.tasks.create(ctxA, {
      title: 'Send recap',
      contactId: contact.id,
      dealId: deal.id,
      dueDate: new Date('2026-04-02T09:00:00.000Z'),
    })
    const note = await servicesA.notes.create(ctxA, {
      content: 'Expansion likely this quarter',
      contactId: contact.id,
      dealId: deal.id,
      companyId: company.id,
    })
    const product = await servicesA.products.create(ctxA, {
      name: 'Platform',
      price: '199.00',
      sortOrder: 1,
    })
    const payment = await servicesA.payments.create(ctxA, {
      amount: '199.00',
      status: 'paid',
      dealId: deal.id,
      contactId: contact.id,
      externalId: 'pi_pg_123',
    })
    const contract = await servicesA.contracts.create(ctxA, {
      title: 'MSA',
      status: 'signed',
      contactId: contact.id,
      companyId: company.id,
      dealId: deal.id,
    })
    const sequence = await servicesA.sequences.create(ctxA, {
      name: 'Outbound',
    })
    const sequenceStep = await servicesA.sequenceSteps.create(ctxA, {
      sequenceId: sequence.id,
      stepOrder: 1,
      actionType: 'email',
      templateSubject: 'Welcome to Orbit',
    })
    const sequenceEnrollment = await servicesA.sequenceEnrollments.create(ctxA, {
      sequenceId: sequence.id,
      contactId: contact.id,
    })
    const sequenceEvent = await servicesA.sequenceEvents.create(ctxA, {
      sequenceEnrollmentId: sequenceEnrollment.id,
      sequenceStepId: sequenceStep.id,
      eventType: 'step.entered',
    })
    const tag = await servicesA.tags.create(ctxA, {
      name: 'VIP',
      color: '#ff0000',
    })
    const webhook = await servicesA.webhooks.create(ctxA, {
      url: 'https://example.com/hook',
      secretEncrypted: 'enc_test_secret',
      secretLastFour: 'cret',
      events: ['contact.created'],
    })
    const importJob = await servicesA.imports.create(ctxA, {
      entityType: 'contacts',
      fileName: 'contacts.csv',
      startedByUserId: ctxA.userId,
    })

    const { createPostgresEntityTagRepository } = await import('../entities/entity-tags/repository.js')
    const entityTagRepo = createPostgresEntityTagRepository(adapter)
    const { generateId } = await import('../ids/generate-id.js')
    const entityTag = await entityTagRepo.create(ctxA, {
      id: generateId('entityTag'),
      organizationId: ctxA.orgId,
      tagId: tag.id,
      entityType: 'contacts',
      entityId: contact.id,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const { createPostgresWebhookDeliveryRepository } = await import('../entities/webhook-deliveries/repository.js')
    const deliveryRepo = createPostgresWebhookDeliveryRepository(adapter)
    const delivery = await deliveryRepo.create(ctxA, {
      id: generateId('webhookDelivery'),
      organizationId: ctxA.orgId,
      webhookId: webhook.id,
      eventId: 'evt_pg_1',
      eventType: 'contact.created',
      payload: { contactId: contact.id },
      signature: 'sig_pg_1',
      idempotencyKey: 'idem_pg_1',
      status: 'succeeded',
      responseStatus: 200,
      responseBody: '{"ok":true}',
      attemptCount: 1,
      nextAttemptAt: null,
      deliveredAt: new Date('2026-04-02T12:00:00.000Z'),
      lastError: null,
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    const servicesB = createCoreServices(adapter)
    expect(await servicesB.companies.get(ctxA, company.id)).toEqual(company)
    expect(await servicesB.contacts.get(ctxA, contact.id)).toEqual(contact)
    expect(await servicesB.deals.get(ctxA, deal.id)).toEqual(deal)
    expect(await servicesB.activities.get(ctxA, activity.id)).toEqual(activity)
    expect(await servicesB.tasks.get(ctxA, task.id)).toEqual(task)
    expect(await servicesB.notes.get(ctxA, note.id)).toEqual(note)
    expect(await servicesB.products.get(ctxA, product.id)).toEqual(product)
    expect(await servicesB.payments.get(ctxA, payment.id)).toEqual(payment)
    expect(await servicesB.contracts.get(ctxA, contract.id)).toEqual(contract)
    expect(await servicesB.sequences.get(ctxA, sequence.id)).toEqual(sequence)
    expect(await servicesB.sequenceSteps.get(ctxA, sequenceStep.id)).toEqual(sequenceStep)
    expect(await servicesB.sequenceEnrollments.get(ctxA, sequenceEnrollment.id)).toEqual(sequenceEnrollment)
    expect(await servicesB.sequenceEvents.get(ctxA, sequenceEvent.id)).toEqual(sequenceEvent)
    expect(await servicesB.tags.get(ctxA, tag.id)).toEqual(tag)
    expect(await servicesB.webhooks.get(ctxA, webhook.id)).toEqual(webhook)
    expect(await servicesB.imports.get(ctxA, importJob.id)).toEqual(importJob)
    expect(await servicesB.products.get(ctxB, product.id)).toBeNull()
    expect(await servicesB.payments.get(ctxB, payment.id)).toBeNull()
    expect(await servicesB.contracts.get(ctxB, contract.id)).toBeNull()
    expect(await servicesB.sequences.get(ctxB, sequence.id)).toBeNull()
    expect(await servicesB.sequenceSteps.get(ctxB, sequenceStep.id)).toBeNull()
    expect(await servicesB.sequenceEnrollments.get(ctxB, sequenceEnrollment.id)).toBeNull()
    expect(await servicesB.sequenceEvents.get(ctxB, sequenceEvent.id)).toBeNull()
    expect(await servicesB.tags.get(ctxB, tag.id)).toBeNull()
    expect(await servicesB.webhooks.get(ctxB, webhook.id)).toBeNull()
    expect(await servicesB.imports.get(ctxB, importJob.id)).toBeNull()
    expect('secretEncrypted' in webhook).toBe(false)
    expect('rollbackData' in importJob).toBe(false)
    expect(await servicesB.system.entityTags.get(ctxA, entityTag.id)).toEqual(entityTag)
    const sanitizedDelivery = await servicesB.system.webhookDeliveries.get(ctxA, delivery.id)
    expect(sanitizedDelivery).toMatchObject({
      id: delivery.id,
      webhookId: webhook.id,
      eventId: 'evt_pg_1',
      eventType: 'contact.created',
      status: 'succeeded',
      responseStatus: 200,
      attemptCount: 1,
      deliveredAt: new Date('2026-04-02T12:00:00.000Z'),
    })
    expect('payload' in (sanitizedDelivery ?? {})).toBe(false)
    expect('signature' in (sanitizedDelivery ?? {})).toBe(false)
    expect('idempotencyKey' in (sanitizedDelivery ?? {})).toBe(false)
    expect('responseBody' in (sanitizedDelivery ?? {})).toBe(false)
    await expect(servicesB.companies.update(ctxB, company.id, { name: 'Beta' })).rejects.toThrow('Company')
    await expect(servicesB.companies.delete(ctxB, company.id)).rejects.toThrow('Company')

    const context = await servicesB.contactContext.getContactContext(ctxA, {
      contactId: contact.id,
    })

    expect(context?.company?.id).toBe(company.id)
    expect(context?.openDeals).toHaveLength(1)
    expect(context?.openTasks).toHaveLength(1)
    expect(context?.recentActivities).toHaveLength(1)
    expect(context?.lastContactDate).toBe('2026-04-01T12:00:00.000Z')

    await pool.end()
  })

  it('normalizes legacy webhook statuses on postgres reads', async () => {
    const { adapter, pool } = await createPostgresAdapter()
    const organizations = createPostgresOrganizationRepository(adapter)
    const now = new Date('2026-04-02T12:00:00.000Z')
    const legacyWebhookId = 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY'

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    })

    await adapter.execute(sql`
      insert into webhooks (
        id,
        organization_id,
        url,
        description,
        events,
        secret_encrypted,
        secret_last_four,
        secret_created_at,
        status,
        last_triggered_at,
        created_at,
        updated_at
      ) values (
        ${legacyWebhookId},
        ${ctxA.orgId},
        ${'https://example.com/legacy'},
        ${null},
        ${JSON.stringify([])},
        ${'enc_legacy'},
        ${'gacy'},
        ${now},
        ${'inactive'},
        ${null},
        ${now},
        ${now}
      )
    `)

    const services = createCoreServices(adapter)
    const webhook = await services.webhooks.get(ctxA, legacyWebhookId)

    expect(webhook?.status).toBe('disabled')
    expect('secretEncrypted' in (webhook ?? {})).toBe(false)

    const search = await services.webhooks.search(ctxA, { query: 'legacy', limit: 10 })
    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.status).toBe('disabled')

    await pool.end()
  })

  it('rejects cross-tenant Slice D relation writes on the postgres adapter path', async () => {
    const { adapter, pool } = await createPostgresAdapter()
    const organizations = createPostgresOrganizationRepository(adapter)
    const users = createPostgresUserRepository(adapter)
    const now = new Date('2026-04-02T12:00:00.000Z')

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    })
    await organizations.create({
      id: ctxB.orgId,
      name: 'Beta',
      slug: 'beta',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    })
    await users.create(ctxA, {
      id: ctxA.userId,
      organizationId: ctxA.orgId,
      email: 'owner@acme.test',
      name: 'Owner',
      role: 'owner',
      avatarUrl: null,
      externalAuthId: null,
      isActive: true,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })

    const services = createCoreServices(adapter)
    const tagB = await services.tags.create(ctxB, { name: 'Other Org' })
    const webhookB = await services.webhooks.create(ctxB, {
      url: 'https://example.com/other',
      secretEncrypted: 'enc_other_secret',
      secretLastFour: 'cret',
      events: ['contact.created'],
    })

    const { createPostgresEntityTagRepository } = await import('../entities/entity-tags/repository.js')
    const entityTagRepo = createPostgresEntityTagRepository(adapter)
    const { createPostgresWebhookDeliveryRepository } = await import('../entities/webhook-deliveries/repository.js')
    const deliveryRepo = createPostgresWebhookDeliveryRepository(adapter)
    const { generateId } = await import('../ids/generate-id.js')

    await expect(
      entityTagRepo.create(ctxA, {
        id: generateId('entityTag'),
        organizationId: ctxA.orgId,
        tagId: tagB.id,
        entityType: 'contacts',
        entityId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toMatchObject({ code: 'RELATION_NOT_FOUND' })

    await expect(
      deliveryRepo.create(ctxA, {
        id: generateId('webhookDelivery'),
        organizationId: ctxA.orgId,
        webhookId: webhookB.id,
        eventId: 'evt_cross_org_pg',
        eventType: 'contact.created',
        payload: {},
        signature: 'sig_cross_org_pg',
        idempotencyKey: 'idem_cross_org_pg',
        status: 'pending',
        responseStatus: null,
        responseBody: null,
        attemptCount: 0,
        nextAttemptAt: null,
        deliveredAt: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toMatchObject({ code: 'RELATION_NOT_FOUND' })

    await pool.end()
  })

  it('preserves payment external id conflicts on the postgres adapter path', async () => {
    const { adapter, pool } = await createPostgresAdapter()
    const organizations = createPostgresOrganizationRepository(adapter)

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-04-01T12:30:00.000Z'),
      updatedAt: new Date('2026-04-01T12:30:00.000Z'),
    })

    const services = createCoreServices(adapter)
    await services.payments.create(ctxA, {
      amount: '50.00',
      status: 'pending',
      externalId: 'pi_pg_conflict',
    })

    await expect(
      services.payments.create(ctxA, {
        amount: '75.00',
        status: 'pending',
        externalId: 'pi_pg_conflict',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'externalId',
    })

    await pool.end()
  })

  it('persists Slice E system entries through the real Postgres adapter registry', async () => {
    const { adapter, pool } = await createPostgresAdapter()
    const organizations = createPostgresOrganizationRepository(adapter)
    const now = new Date('2026-04-02T14:00:00.000Z')

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    })
    await organizations.create({
      id: ctxB.orgId,
      name: 'Beta',
      slug: 'beta',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    })

    const customFieldDefinitions = createPostgresCustomFieldDefinitionRepository(adapter)
    const auditLogs = createPostgresAuditLogRepository(adapter)
    const schemaMigrations = createPostgresSchemaMigrationRepository(adapter)
    const idempotencyKeys = createPostgresIdempotencyKeyRepository(adapter)

    const customField = await customFieldDefinitions.create(ctxA, {
      id: generateId('customField'),
      organizationId: ctxA.orgId,
      entityType: 'contacts',
      fieldName: 'tier',
      fieldType: 'text',
      label: 'Tier',
      description: null,
      isRequired: false,
      isIndexed: false,
      isPromoted: false,
      promotedColumnName: null,
      defaultValue: null,
      options: [],
      validation: {},
      createdAt: now,
      updatedAt: now,
    })

    const auditLog = await auditLogs.create(ctxA, {
      id: generateId('auditLog'),
      organizationId: ctxA.orgId,
      actorUserId: null,
      actorApiKeyId: null,
      entityType: 'contacts',
      entityId: 'contact_pg_test_01',
      action: 'updated',
      before: { name: 'Old Name' },
      after: { name: 'New Name' },
      requestId: null,
      metadata: {},
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    })

    const schemaMigration = await schemaMigrations.create(ctxA, {
      id: generateId('migration'),
      organizationId: ctxA.orgId,
      checksum: computeSchemaMigrationChecksum({
        adapter: migrationAdapter,
        orgId: ctxA.orgId,
        operations: migrationForwardOperations,
      }),
      adapter: migrationAdapter,
      description: 'Add tier field',
      entityType: 'contacts',
      operationType: 'add_column',
      forwardOperations: migrationForwardOperations,
      reverseOperations: migrationReverseOperations,
      destructive: false,
      status: 'applied',
      sqlStatements: ['ALTER TABLE contacts ADD COLUMN tier TEXT'],
      rollbackStatements: ['ALTER TABLE contacts DROP COLUMN tier'],
      appliedBy: ctxA.userId,
      appliedByUserId: null,
      approvedByUserId: null,
      startedAt: now,
      appliedAt: now,
      rolledBackAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    })

    const idempotencyKey = await idempotencyKeys.create(ctxA, {
      id: generateId('idempotencyKey'),
      organizationId: ctxA.orgId,
      key: 'idem-pg-key-001',
      method: 'POST',
      path: '/v1/companies',
      requestHash: 'sha256:def456',
      responseCode: 201,
      responseBody: { id: 'company_pg_test_01' },
      lockedUntil: null,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    expect(await idempotencyKeys.get(ctxA, idempotencyKey.id)).toMatchObject({
      id: idempotencyKey.id,
      responseBody: { id: 'company_pg_test_01' },
    })

    await expect(schemaMigrations.get(ctxA, schemaMigration.id)).resolves.toMatchObject({
      id: schemaMigration.id,
      checksum: schemaMigration.checksum,
      adapter: migrationAdapter,
      forwardOperations: migrationForwardOperations,
      reverseOperations: migrationReverseOperations,
      destructive: false,
      status: 'applied',
      appliedBy: ctxA.userId,
    })

    const services = createCoreServices(adapter)

    const fetchedCustomField = await services.system.customFieldDefinitions.get(ctxA, customField.id)
    expect(fetchedCustomField).toMatchObject({
      id: customField.id,
      organizationId: ctxA.orgId,
      entityType: 'contacts',
      fieldName: 'tier',
    })

    // auditLogs: before/after are stripped by sanitization
    const fetchedAuditLog = await services.system.auditLogs.get(ctxA, auditLog.id)
    expect(fetchedAuditLog).toMatchObject({
      id: auditLog.id,
      organizationId: ctxA.orgId,
      entityType: 'contacts',
      action: 'updated',
    })
    expect('before' in (fetchedAuditLog ?? {})).toBe(false)
    expect('after' in (fetchedAuditLog ?? {})).toBe(false)

    const fetchedSchemaMigration = await services.system.schemaMigrations.get(ctxA, schemaMigration.id)
    expect(fetchedSchemaMigration).toMatchObject({
      id: schemaMigration.id,
      organizationId: ctxA.orgId,
      description: 'Add tier field',
      operationType: 'add_column',
      checksum: schemaMigration.checksum,
      adapter: migrationAdapter,
      destructive: false,
      status: 'applied',
    })
    expect('sqlStatements' in (fetchedSchemaMigration ?? {})).toBe(false)
    expect('rollbackStatements' in (fetchedSchemaMigration ?? {})).toBe(false)
    expect('forwardOperations' in (fetchedSchemaMigration ?? {})).toBe(false)
    expect('reverseOperations' in (fetchedSchemaMigration ?? {})).toBe(false)

    // idempotencyKeys: requestHash/responseBody are stripped by sanitization
    const fetchedIdempotencyKey = await services.system.idempotencyKeys.get(ctxA, idempotencyKey.id)
    expect(fetchedIdempotencyKey).toMatchObject({
      id: idempotencyKey.id,
      organizationId: ctxA.orgId,
      key: 'idem-pg-key-001',
      method: 'POST',
      path: '/v1/companies',
    })
    expect('requestHash' in (fetchedIdempotencyKey ?? {})).toBe(false)
    expect('responseBody' in (fetchedIdempotencyKey ?? {})).toBe(false)

    // Tenant isolation: ctxB cannot see ctxA's records
    expect(await services.system.customFieldDefinitions.get(ctxB, customField.id)).toBeNull()
    expect(await services.system.auditLogs.get(ctxB, auditLog.id)).toBeNull()
    expect(await services.system.schemaMigrations.get(ctxB, schemaMigration.id)).toBeNull()
    expect(await services.system.idempotencyKeys.get(ctxB, idempotencyKey.id)).toBeNull()

    // list also scoped by org
    const customFieldsA = await services.system.customFieldDefinitions.list(ctxA, { limit: 10 })
    const customFieldsB = await services.system.customFieldDefinitions.list(ctxB, { limit: 10 })
    expect(customFieldsA.data).toHaveLength(1)
    expect(customFieldsB.data).toHaveLength(0)

    // schemaMigrations is read-only (no apply/approve/rollback)
    expect(services.system.schemaMigrations).not.toHaveProperty('apply')
    expect(services.system.schemaMigrations).not.toHaveProperty('rollback')

    await pool.end()
  })

  it('preserves Slice E nullable JSON and uniqueness on the postgres adapter path', async () => {
    const { adapter, pool } = await createPostgresAdapter()
    const organizations = createPostgresOrganizationRepository(adapter)
    const now = new Date('2026-04-02T16:00:00.000Z')

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    })

    const customFieldDefinitions = createPostgresCustomFieldDefinitionRepository(adapter)
    const idempotencyKeys = createPostgresIdempotencyKeyRepository(adapter)

    await customFieldDefinitions.create(ctxA, {
      id: generateId('customField'),
      organizationId: ctxA.orgId,
      entityType: 'contacts',
      fieldName: 'tier',
      fieldType: 'text',
      label: 'Tier',
      description: null,
      isRequired: false,
      isIndexed: false,
      isPromoted: false,
      promotedColumnName: null,
      defaultValue: null,
      options: [],
      validation: {},
      createdAt: now,
      updatedAt: now,
    })

    await expect(
      customFieldDefinitions.create(ctxA, {
        id: generateId('customField'),
        organizationId: ctxA.orgId,
        entityType: 'contacts',
        fieldName: 'tier',
        fieldType: 'text',
        label: 'Tier Duplicate',
        description: null,
        isRequired: false,
        isIndexed: false,
        isPromoted: false,
        promotedColumnName: null,
        defaultValue: null,
        options: [],
        validation: {},
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'fieldName',
    })

    const idempotencyKey = await idempotencyKeys.create(ctxA, {
      id: generateId('idempotencyKey'),
      organizationId: ctxA.orgId,
      key: 'idem-pg-null',
      method: 'POST',
      path: '/v1/customers',
      requestHash: 'sha256:pg-null',
      responseCode: null,
      responseBody: null,
      lockedUntil: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    expect(await idempotencyKeys.get(ctxA, idempotencyKey.id)).toMatchObject({
      id: idempotencyKey.id,
      responseBody: null,
    })

    await expect(
      idempotencyKeys.create(ctxA, {
        id: generateId('idempotencyKey'),
        organizationId: ctxA.orgId,
        key: 'idem-pg-null',
        method: 'POST',
        path: '/v1/customers',
        requestHash: 'sha256:pg-null-dup',
        responseCode: 201,
        responseBody: { ok: true },
        lockedUntil: null,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'key',
    })

    await pool.end()
  })

  it('keeps tenant reads scoped while exposing admin/system records separately', async () => {
    const { adapter, pool } = await createPostgresAdapter()
    const organizations = createPostgresOrganizationRepository(adapter)
    const memberships = createPostgresOrganizationMembershipRepository(adapter)
    const apiKeys = createPostgresApiKeyRepository(adapter)
    const users = createPostgresUserRepository(adapter)

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      updatedAt: new Date('2026-04-01T12:00:00.000Z'),
    })
    await organizations.create({
      id: ctxB.orgId,
      name: 'Beta',
      slug: 'beta',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-04-01T12:05:00.000Z'),
      updatedAt: new Date('2026-04-01T12:05:00.000Z'),
    })
    await users.create(ctxA, {
      id: ctxA.userId,
      organizationId: ctxA.orgId,
      email: 'owner@acme.test',
      name: 'Owner',
      role: 'owner',
      avatarUrl: null,
      externalAuthId: null,
      isActive: true,
      metadata: {},
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      updatedAt: new Date('2026-04-01T12:00:00.000Z'),
    })
    await memberships.create(ctxA, {
      id: 'mbr_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctxA.orgId,
      userId: ctxA.userId,
      role: 'owner',
      invitedByUserId: null,
      joinedAt: null,
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      updatedAt: new Date('2026-04-01T12:00:00.000Z'),
    })
    await apiKeys.create(ctxA, {
      id: 'key_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctxA.orgId,
      name: 'Server',
      keyHash: 'hashed-server',
      keyPrefix: 'orbt_live',
      scopes: ['contacts:read'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdByUserId: null,
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      updatedAt: new Date('2026-04-01T12:00:00.000Z'),
    })

    const services = createCoreServices(adapter)
    const company = await services.companies.create(ctxA, { name: 'Acme' })

    expect(await services.companies.get(ctxB, company.id)).toBeNull()

    const orgs = await services.system.organizations.list(ctxA, { limit: 10 })
    const membership = await services.system.organizationMemberships.get(ctxA, 'mbr_01ARYZ6S41YYYYYYYYYYYYYYYY')
    const membershipOtherOrg = await services.system.organizationMemberships.get(
      ctxB,
      'mbr_01ARYZ6S41YYYYYYYYYYYYYYYY',
    )
    const membershipsOtherOrg = await services.system.organizationMemberships.list(ctxB, { limit: 10 })
    const apiKey = await services.system.apiKeys.get(ctxA, 'key_01ARYZ6S41YYYYYYYYYYYYYYYY')

    expect(orgs.data).toHaveLength(2)
    expect(membership?.userId).toBe(ctxA.userId)
    expect(membershipOtherOrg).toBeNull()
    expect(membershipsOtherOrg.data).toHaveLength(0)
    expect(apiKey?.keyPrefix).toBe('orbt_live')
    expect('keyHash' in (apiKey ?? {})).toBe(false)

    await pool.end()
  })

  it('RLS DDL generator covers every tenant table used in persistence tests (drift detection)', () => {
    // Extract table names referenced in the RLS DDL output
    const rlsStatements = generatePostgresRlsSql()
    const rlsTableSet = new Set<string>()
    for (const stmt of rlsStatements) {
      // Match "alter table orbit.<table> enable row level security"
      const alterMatch = stmt.match(/alter table orbit\.(\w+) enable row level security/)
      if (alterMatch) rlsTableSet.add(alterMatch[1])
    }

    // Every table in IMPLEMENTED_TENANT_TABLES must have RLS coverage
    const missingFromRls = IMPLEMENTED_TENANT_TABLES.filter(
      (table) => !rlsTableSet.has(table),
    )
    expect(missingFromRls).toEqual([])

    // Every table the RLS generator covers must be in IMPLEMENTED_TENANT_TABLES
    const tenantTableSet = new Set<string>(IMPLEMENTED_TENANT_TABLES)
    const extraInRls = [...rlsTableSet].filter(
      (table) => !tenantTableSet.has(table),
    )
    expect(extraInRls).toEqual([])

    // Confirm the persistence test's adapter snapshot covers all tenant tables
    // (the createPostgresAdapter helper lists them explicitly)
    const persistenceTableList = [
      'organizations',
      'users',
      'organization_memberships',
      'api_keys',
      'companies',
      'contacts',
      'pipelines',
      'stages',
      'deals',
      'activities',
      'tasks',
      'notes',
      'products',
      'payments',
      'contracts',
      'sequences',
      'sequence_steps',
      'sequence_enrollments',
      'sequence_events',
      'tags',
      'entity_tags',
      'imports',
      'webhooks',
      'webhook_deliveries',
      'custom_field_definitions',
      'audit_logs',
      'schema_migrations',
      'idempotency_keys',
    ]

    const missingFromPersistence = IMPLEMENTED_TENANT_TABLES.filter(
      (table) => !persistenceTableList.includes(table),
    )
    expect(missingFromPersistence).toEqual([])
  })
})
