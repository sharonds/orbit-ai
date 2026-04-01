import { describe, expect, it } from 'vitest'

import { createInMemoryCompanyRepository } from '../companies/repository.js'
import { createInMemoryContactRepository } from '../contacts/repository.js'
import { createInMemoryDealRepository } from './repository.js'
import { createDealService } from './service.js'
import { createInMemoryPipelineRepository } from '../pipelines/repository.js'
import { createInMemoryStageRepository } from '../stages/repository.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
}

describe('deal service', () => {
  it('rejects pipeline-only updates that would leave a stale stage', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const contacts = createInMemoryContactRepository()
    const companies = createInMemoryCompanyRepository()
    const deals = createInMemoryDealRepository()

    const pipelineA = await pipelines.create({
      id: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Sales',
      isDefault: true,
      description: null,
      createdAt: new Date('2026-03-31T12:30:00.000Z'),
      updatedAt: new Date('2026-03-31T12:30:00.000Z'),
    })
    const pipelineB = await pipelines.create({
      id: 'pipeline_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      organizationId: ctx.orgId,
      name: 'Renewals',
      isDefault: false,
      description: null,
      createdAt: new Date('2026-03-31T12:31:00.000Z'),
      updatedAt: new Date('2026-03-31T12:31:00.000Z'),
    })
    const stage = await stages.create({
      id: 'stage_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      pipelineId: pipelineA.id,
      name: 'Qualified',
      stageOrder: 1,
      probability: 30,
      color: null,
      isWon: false,
      isLost: false,
      createdAt: new Date('2026-03-31T12:32:00.000Z'),
      updatedAt: new Date('2026-03-31T12:32:00.000Z'),
    })
    const dealService = createDealService({ deals, pipelines, stages, contacts, companies })
    const created = await dealService.create(ctx, {
      title: 'Expansion',
      pipelineId: pipelineA.id,
      stageId: stage.id,
    })

    await expect(dealService.update(ctx, created.id, { pipelineId: pipelineB.id })).rejects.toThrow(
      'Deal stage must be provided when changing pipeline',
    )
  })

  it('does not revalidate unchanged foreign keys on unrelated updates', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const contacts = createInMemoryContactRepository()
    const companies = createInMemoryCompanyRepository()
    const deals = createInMemoryDealRepository()

    const pipeline = await pipelines.create({
      id: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Sales',
      isDefault: true,
      description: null,
      createdAt: new Date('2026-03-31T13:00:00.000Z'),
      updatedAt: new Date('2026-03-31T13:00:00.000Z'),
    })
    const stage = await stages.create({
      id: 'stage_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      pipelineId: pipeline.id,
      name: 'Qualified',
      stageOrder: 1,
      probability: 30,
      color: null,
      isWon: false,
      isLost: false,
      createdAt: new Date('2026-03-31T13:01:00.000Z'),
      updatedAt: new Date('2026-03-31T13:01:00.000Z'),
    })
    const company = await companies.create({
      id: 'company_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Acme',
      domain: 'acme.test',
      industry: null,
      size: null,
      website: null,
      notes: null,
      assignedToUserId: null,
      customFields: {},
      createdAt: new Date('2026-03-31T13:02:00.000Z'),
      updatedAt: new Date('2026-03-31T13:02:00.000Z'),
    })
    const contact = await contacts.create({
      id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Taylor',
      email: 'taylor@example.com',
      phone: null,
      title: null,
      sourceChannel: null,
      status: 'lead',
      assignedToUserId: null,
      companyId: company.id,
      leadScore: 0,
      isHot: false,
      lastContactedAt: null,
      customFields: {},
      createdAt: new Date('2026-03-31T13:03:00.000Z'),
      updatedAt: new Date('2026-03-31T13:03:00.000Z'),
    })
    const dealService = createDealService({ deals, pipelines, stages, contacts, companies })
    const created = await dealService.create(ctx, {
      title: 'Expansion',
      pipelineId: pipeline.id,
      stageId: stage.id,
      contactId: contact.id,
      companyId: company.id,
    })

    await contacts.delete(ctx, contact.id)
    await companies.delete(ctx, company.id)

    const updated = await dealService.update(ctx, created.id, {
      title: 'Expansion renewed',
    })

    expect(updated.title).toBe('Expansion renewed')
    expect(updated.stageId).toBe(stage.id)
    expect(updated.pipelineId).toBe(pipeline.id)
  })
})
