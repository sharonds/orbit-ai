import { describe, expect, it } from 'vitest'

import { createSqliteStorageAdapter } from '../adapters/sqlite/adapter.js'
import { createSqliteOrbitDatabase } from '../adapters/sqlite/database.js'
import { initializeSqliteWave2SliceASchema } from '../adapters/sqlite/schema.js'
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
  await initializeSqliteWave2SliceASchema(database)

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
      ],
    }),
  })
}

describe('sqlite persistence bridge', () => {
  it('persists Slice A records across service registries', async () => {
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

    const servicesB = createCoreServices(adapter)
    expect(await servicesB.companies.get(ctxA, company.id)).toEqual(company)
    expect(await servicesB.contacts.get(ctxA, contact.id)).toEqual(contact)
    expect(await servicesB.deals.get(ctxA, deal.id)).toEqual(deal)
    expect(await servicesB.activities.get(ctxA, activity.id)).toEqual(activity)
    expect(await servicesB.tasks.get(ctxA, task.id)).toEqual(task)
    expect(await servicesB.notes.get(ctxA, note.id)).toEqual(note)
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
