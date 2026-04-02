import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createSqliteStorageAdapter } from '../adapters/sqlite/adapter.js'
import { createSqliteOrbitDatabase } from '../adapters/sqlite/database.js'
import { initializeSqliteWave2SliceDSchema } from '../adapters/sqlite/schema.js'
import { createSqliteApiKeyRepository } from '../entities/api-keys/repository.js'
import { createSqliteOrganizationMembershipRepository } from '../entities/organization-memberships/repository.js'
import { createSqliteOrganizationRepository } from '../entities/organizations/repository.js'
import { createCoreServices } from './index.js'

const ctxA = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
  userId: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

async function createSqliteAdapter() {
  const database = createSqliteOrbitDatabase()
  await initializeSqliteWave2SliceDSchema(database)

  return createSqliteStorageAdapter({
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
      ],
    }),
  })
}

describe('sqlite persistence bridge', () => {
  it('persists Slice D records across service registries', async () => {
    const adapter = await createSqliteAdapter()
    const organizations = createSqliteOrganizationRepository(adapter)

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-03-31T14:00:00.000Z'),
      updatedAt: new Date('2026-03-31T14:00:00.000Z'),
    })

    const servicesA = createCoreServices(adapter)
    const company = await servicesA.companies.create(ctxA, {
      name: 'Acme',
      domain: 'acme.test',
    })
    const contact = await servicesA.contacts.create(ctxA, {
      name: 'Taylor',
      email: 'taylor@acme.test',
      companyId: company.id,
      lastContactedAt: new Date('2026-03-31T14:30:00.000Z'),
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
      occurredAt: new Date('2026-03-31T15:00:00.000Z'),
    })
    const task = await servicesA.tasks.create(ctxA, {
      title: 'Send recap',
      contactId: contact.id,
      dealId: deal.id,
      dueDate: new Date('2026-04-01T09:00:00.000Z'),
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
      externalId: 'pi_sqlite_123',
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
    })

    // Entity tag (via system admin for reads, repo directly for write)
    const { createSqliteEntityTagRepository } = await import('../entities/entity-tags/repository.js')
    const entityTagRepo = createSqliteEntityTagRepository(adapter)
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

    // Webhook delivery (via repo directly for write)
    const { createSqliteWebhookDeliveryRepository } = await import('../entities/webhook-deliveries/repository.js')
    const deliveryRepo = createSqliteWebhookDeliveryRepository(adapter)
    const delivery = await deliveryRepo.create(ctxA, {
      id: generateId('webhookDelivery'),
      organizationId: ctxA.orgId,
      webhookId: webhook.id,
      eventId: 'evt_sqlite_1',
      eventType: 'contact.created',
      payload: { contactId: contact.id },
      signature: 'sig_sqlite_1',
      idempotencyKey: 'idem_sqlite_1',
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
    expect(await servicesB.products.get(ctxB, product.id)).toBeNull()
    expect(await servicesB.payments.get(ctxB, payment.id)).toBeNull()
    expect(await servicesB.contracts.get(ctxB, contract.id)).toBeNull()
    expect(await servicesB.sequences.get(ctxB, sequence.id)).toBeNull()
    expect(await servicesB.sequenceSteps.get(ctxB, sequenceStep.id)).toBeNull()
    expect(await servicesB.sequenceEnrollments.get(ctxB, sequenceEnrollment.id)).toBeNull()
    expect(await servicesB.sequenceEvents.get(ctxB, sequenceEvent.id)).toBeNull()
    expect(await servicesB.tags.get(ctxA, tag.id)).toEqual(tag)
    expect(await servicesB.webhooks.get(ctxA, webhook.id)).toEqual(webhook)
    expect(await servicesB.imports.get(ctxA, importJob.id)).toEqual(importJob)
    expect(await servicesB.tags.get(ctxB, tag.id)).toBeNull()
    expect(await servicesB.webhooks.get(ctxB, webhook.id)).toBeNull()
    expect(await servicesB.imports.get(ctxB, importJob.id)).toBeNull()
    // Verify webhook sanitization on persist round-trip
    expect('secretEncrypted' in webhook).toBe(false)
    expect(webhook.secretLastFour).toBe('cret')
    expect('rollbackData' in importJob).toBe(false)
    // Verify entity tag and webhook delivery admin reads
    expect(await servicesB.system.entityTags.get(ctxA, entityTag.id)).toEqual(entityTag)
    expect(await servicesB.system.entityTags.get(ctxB, entityTag.id)).toBeNull()
    expect(await servicesB.system.webhookDeliveries.get(ctxA, delivery.id)).toMatchObject({
      id: delivery.id,
      webhookId: webhook.id,
      eventId: 'evt_sqlite_1',
      eventType: 'contact.created',
      status: 'succeeded',
      responseStatus: 200,
      attemptCount: 1,
      deliveredAt: new Date('2026-04-02T12:00:00.000Z'),
    })
    const sanitizedDelivery = await servicesB.system.webhookDeliveries.get(ctxA, delivery.id)
    expect('payload' in (sanitizedDelivery ?? {})).toBe(false)
    expect('signature' in (sanitizedDelivery ?? {})).toBe(false)
    expect('idempotencyKey' in (sanitizedDelivery ?? {})).toBe(false)
    expect('responseBody' in (sanitizedDelivery ?? {})).toBe(false)
    expect(await servicesB.system.webhookDeliveries.get(ctxB, delivery.id)).toBeNull()
    await expect(servicesB.companies.update(ctxB, company.id, { name: 'Beta' })).rejects.toThrow(
      'Company',
    )
    await expect(servicesB.companies.delete(ctxB, company.id)).rejects.toThrow('Company')

    const context = await servicesB.contactContext.getContactContext(ctxA, {
      contactId: contact.id,
    })

    expect(context?.company?.id).toBe(company.id)
    expect(context?.openDeals).toHaveLength(1)
    expect(context?.openTasks).toHaveLength(1)
    expect(context?.recentActivities).toHaveLength(1)
    expect(context?.lastContactDate).toBe('2026-03-31T15:00:00.000Z')
  })

  it('normalizes legacy webhook statuses on sqlite reads', async () => {
    const adapter = await createSqliteAdapter()
    const organizations = createSqliteOrganizationRepository(adapter)
    const now = '2026-04-02T12:00:00.000Z'
    const legacyWebhookId = 'webhook_01ARYZ6S41YYYYYYYYYYYYYYYY'

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date(now),
      updatedAt: new Date(now),
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
  })

  it('rejects cross-tenant Slice D relation writes on the sqlite adapter path', async () => {
    const adapter = await createSqliteAdapter()
    const organizations = createSqliteOrganizationRepository(adapter)
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

    const servicesA = createCoreServices(adapter)
    const tagB = await servicesA.tags.create(ctxB, { name: 'Other Org' })
    const webhookB = await servicesA.webhooks.create(ctxB, {
      url: 'https://example.com/other',
      secretEncrypted: 'enc_other_secret',
      secretLastFour: 'cret',
      events: ['contact.created'],
    })

    const { createSqliteEntityTagRepository } = await import('../entities/entity-tags/repository.js')
    const entityTagRepo = createSqliteEntityTagRepository(adapter)
    const { createSqliteWebhookDeliveryRepository } = await import('../entities/webhook-deliveries/repository.js')
    const deliveryRepo = createSqliteWebhookDeliveryRepository(adapter)
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
        eventId: 'evt_cross_org_sqlite',
        eventType: 'contact.created',
        payload: {},
        signature: 'sig_cross_org_sqlite',
        idempotencyKey: 'idem_cross_org_sqlite',
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
  })

  it('preserves payment external id conflicts on the sqlite adapter path', async () => {
    const adapter = await createSqliteAdapter()
    const organizations = createSqliteOrganizationRepository(adapter)

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-03-31T16:00:00.000Z'),
      updatedAt: new Date('2026-03-31T16:00:00.000Z'),
    })

    const services = createCoreServices(adapter)
    await services.payments.create(ctxA, {
      amount: '50.00',
      status: 'pending',
      externalId: 'pi_sqlite_conflict',
    })

    await expect(
      services.payments.create(ctxA, {
        amount: '75.00',
        status: 'pending',
        externalId: 'pi_sqlite_conflict',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'externalId',
    })
  })

  it('keeps tenant reads scoped while exposing admin/system records separately', async () => {
    const adapter = await createSqliteAdapter()
    const organizations = createSqliteOrganizationRepository(adapter)
    const memberships = createSqliteOrganizationMembershipRepository(adapter)
    const apiKeys = createSqliteApiKeyRepository(adapter)

    await organizations.create({
      id: ctxA.orgId,
      name: 'Acme',
      slug: 'acme',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-03-31T15:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z'),
    })
    await organizations.create({
      id: ctxB.orgId,
      name: 'Beta',
      slug: 'beta',
      plan: 'community',
      isActive: true,
      settings: {},
      createdAt: new Date('2026-03-31T15:05:00.000Z'),
      updatedAt: new Date('2026-03-31T15:05:00.000Z'),
    })
    await memberships.create(ctxA, {
      id: 'mbr_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctxA.orgId,
      userId: ctxA.userId,
      role: 'owner',
      invitedByUserId: null,
      joinedAt: null,
      createdAt: new Date('2026-03-31T15:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z'),
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
      createdAt: new Date('2026-03-31T15:00:00.000Z'),
      updatedAt: new Date('2026-03-31T15:00:00.000Z'),
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
  })
})
