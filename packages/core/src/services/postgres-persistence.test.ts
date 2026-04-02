import { describe, expect, it } from 'vitest'
import { newDb } from 'pg-mem'

import { createPostgresStorageAdapter } from '../adapters/postgres/adapter.js'
import { createPostgresOrbitDatabase } from '../adapters/postgres/database.js'
import { initializePostgresWave2SliceBSchema } from '../adapters/postgres/schema.js'
import { createPostgresApiKeyRepository } from '../entities/api-keys/repository.js'
import { createPostgresOrganizationMembershipRepository } from '../entities/organization-memberships/repository.js'
import { createPostgresOrganizationRepository } from '../entities/organizations/repository.js'
import { createPostgresUserRepository } from '../entities/users/repository.js'
import { createCoreServices } from './index.js'

const ctxA = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const ctxB = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
  userId: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

async function createPostgresAdapter() {
  const memory = newDb()
  const { Pool } = memory.adapters.createPg()
  const pool = new Pool({ max: 1 })
  const database = createPostgresOrbitDatabase({ pool })
  await initializePostgresWave2SliceBSchema(database)

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
      ],
    }),
  })

  return { adapter, pool }
}

describe('postgres persistence bridge', () => {
  it('persists Slice B records across fresh service registries', async () => {
    const { adapter, pool } = await createPostgresAdapter()
    const organizations = createPostgresOrganizationRepository(adapter)

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
    expect(await servicesB.products.get(ctxB, product.id)).toBeNull()
    expect(await servicesB.payments.get(ctxB, payment.id)).toBeNull()
    expect(await servicesB.contracts.get(ctxB, contract.id)).toBeNull()
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
})
