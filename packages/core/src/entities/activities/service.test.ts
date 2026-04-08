import { describe, expect, it } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
import { createInMemoryActivityRepository } from './repository.js'
import { createActivityService } from './service.js'
import { createInMemoryCompanyRepository } from '../companies/repository.js'
import { createCompanyService } from '../companies/service.js'
import { createInMemoryContactRepository } from '../contacts/repository.js'
import { createContactService } from '../contacts/service.js'
import { createInMemoryDealRepository } from '../deals/repository.js'
import { createDealService } from '../deals/service.js'
import { createInMemoryPipelineRepository } from '../pipelines/repository.js'
import { createPipelineService } from '../pipelines/service.js'
import { createInMemoryStageRepository } from '../stages/repository.js'
import { createStageService } from '../stages/service.js'
import { createInMemoryUserRepository } from '../users/repository.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

async function createLinkedDealGraph() {
  const companies = createInMemoryCompanyRepository()
  const contacts = createInMemoryContactRepository()
  const pipelines = createInMemoryPipelineRepository()
  const stages = createInMemoryStageRepository()
  const deals = createInMemoryDealRepository()
  const activities = createInMemoryActivityRepository()
  const users = createInMemoryUserRepository()

  const companyService = createCompanyService(companies)
  const contactService = createContactService({ contacts, companies })
  const pipelineService = createPipelineService(pipelines)
  const stageService = createStageService({ stages, pipelines })
  const dealService = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })
  const activityService = createActivityService({ activities, contacts, companies, deals, users })

  const company = await companyService.create(ctx, { name: 'Orbit Labs' })
  const contact = await contactService.create(ctx, {
    name: 'Taylor',
    email: 'taylor@orbit.test',
    companyId: company.id,
  })
  const pipeline = await pipelineService.create(ctx, { name: 'Sales' })
  const stage = await stageService.create(ctx, {
    pipelineId: pipeline.id,
    name: 'Qualified',
    stageOrder: 1,
    probability: 30,
  })
  const deal = await dealService.create(ctx, {
    title: 'Expansion',
    companyId: company.id,
    contactId: contact.id,
    stageId: stage.id,
  })

  return { activityService, company, contact, deal }
}

describe('activity service', () => {
  it('creates activities linked to contact, company, and deal records', async () => {
    const { activityService, company, contact, deal } = await createLinkedDealGraph()

    const activity = await activityService.create(ctx, {
      type: 'call',
      subject: 'Discovery call',
      contactId: contact.id,
      companyId: company.id,
      dealId: deal.id,
      occurredAt: new Date('2026-04-02T09:00:00.000Z'),
    })

    expect(activity.contactId).toBe(contact.id)
    expect(activity.companyId).toBe(company.id)
    expect(activity.dealId).toBe(deal.id)
  })

  it('rejects activities that reference out-of-scope linked records', async () => {
    const activities = createInMemoryActivityRepository()
    const activityService = createActivityService({
      activities,
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
    })

    await expect(
      activityService.create(ctx, {
        type: 'email',
        contactId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
        occurredAt: new Date('2026-04-02T09:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('lists and searches activities by engagement fields', async () => {
    const { activityService } = await createLinkedDealGraph()

    await activityService.create(ctx, {
      type: 'call',
      subject: 'Discovery call',
      body: 'Introduced Orbit AI',
      occurredAt: new Date('2026-04-02T09:00:00.000Z'),
    })
    await activityService.create(ctx, {
      type: 'email',
      subject: 'Follow-up',
      body: 'Sent pricing deck',
      occurredAt: new Date('2026-04-02T10:00:00.000Z'),
    })

    const search = await activityService.search(ctx, {
      query: 'pricing',
      limit: 10,
    })

    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.type).toBe('email')
  })

  it('rejects activities assigned to users outside the tenant scope', async () => {
    const activityService = createActivityService({
      activities: createInMemoryActivityRepository(),
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
    })

    await expect(
      activityService.create(ctx, {
        type: 'call',
        loggedByUserId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
        occurredAt: new Date('2026-04-02T09:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })
})
