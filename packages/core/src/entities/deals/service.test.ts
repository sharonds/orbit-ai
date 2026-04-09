import { describe, expect, it, vi } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
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
  it('rejects missing relations with typed relation errors', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const contacts = createInMemoryContactRepository()
    const companies = createInMemoryCompanyRepository()
    const deals = createInMemoryDealRepository()
    const dealService = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })

    await expect(
      dealService.create(ctx, {
        title: 'Expansion',
        stageId: 'stage_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('rejects pipeline-only updates that would leave a stale stage', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const contacts = createInMemoryContactRepository()
    const companies = createInMemoryCompanyRepository()
    const deals = createInMemoryDealRepository()

    const pipelineA = await pipelines.create(ctx, {
      id: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Sales',
      isDefault: true,
      description: null,
      createdAt: new Date('2026-03-31T12:30:00.000Z'),
      updatedAt: new Date('2026-03-31T12:30:00.000Z'),
    })
    const pipelineB = await pipelines.create(ctx, {
      id: 'pipeline_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
      organizationId: ctx.orgId,
      name: 'Renewals',
      isDefault: false,
      description: null,
      createdAt: new Date('2026-03-31T12:31:00.000Z'),
      updatedAt: new Date('2026-03-31T12:31:00.000Z'),
    })
    const stage = await stages.create(ctx, {
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
    const dealService = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })
    const created = await dealService.create(ctx, {
      title: 'Expansion',
      pipelineId: pipelineA.id,
      stageId: stage.id,
    })

    await expect(dealService.update(ctx, created.id, { pipelineId: pipelineB.id })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('rejects clearing pipeline while keeping an existing stage', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const contacts = createInMemoryContactRepository()
    const companies = createInMemoryCompanyRepository()
    const deals = createInMemoryDealRepository()

    const pipeline = await pipelines.create(ctx, {
      id: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Sales',
      isDefault: true,
      description: null,
      createdAt: new Date('2026-03-31T12:30:00.000Z'),
      updatedAt: new Date('2026-03-31T12:30:00.000Z'),
    })
    const stage = await stages.create(ctx, {
      id: 'stage_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      pipelineId: pipeline.id,
      name: 'Qualified',
      stageOrder: 1,
      probability: 30,
      color: null,
      isWon: false,
      isLost: false,
      createdAt: new Date('2026-03-31T12:32:00.000Z'),
      updatedAt: new Date('2026-03-31T12:32:00.000Z'),
    })
    const dealService = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })
    const created = await dealService.create(ctx, {
      title: 'Expansion',
      pipelineId: pipeline.id,
      stageId: stage.id,
    })

    await expect(dealService.update(ctx, created.id, { pipelineId: null })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('does not revalidate unchanged foreign keys on unrelated updates', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const contacts = createInMemoryContactRepository()
    const companies = createInMemoryCompanyRepository()
    const deals = createInMemoryDealRepository()

    const pipeline = await pipelines.create(ctx, {
      id: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctx.orgId,
      name: 'Sales',
      isDefault: true,
      description: null,
      createdAt: new Date('2026-03-31T13:00:00.000Z'),
      updatedAt: new Date('2026-03-31T13:00:00.000Z'),
    })
    const stage = await stages.create(ctx, {
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
    const company = await companies.create(ctx, {
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
    const contact = await contacts.create(ctx, {
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
    const dealService = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })
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

  describe('transactional safety (T7)', () => {
    it('runs deals.update inside exactly one tx.run() call', async () => {
      const deals = createInMemoryDealRepository()
      const pipelines = createInMemoryPipelineRepository()
      const stages = createInMemoryStageRepository()
      const contacts = createInMemoryContactRepository()
      const companies = createInMemoryCompanyRepository()

      const noop = createNoopTransactionScope()
      const runSpy = vi.fn(noop.run.bind(noop))
      const dealService = createDealService({
        deals,
        pipelines,
        stages,
        contacts,
        companies,
        tx: { run: runSpy },
      })

      // create a deal first — create() does not yet wrap in tx, so the
      // spy should still be at zero after this.
      const created = await dealService.create(ctx, { title: 'To rename' })
      expect(runSpy).not.toHaveBeenCalled()

      await dealService.update(ctx, created.id, { title: 'Renamed' })
      expect(runSpy).toHaveBeenCalledTimes(1)
      expect(runSpy).toHaveBeenCalledWith(ctx, expect.any(Function))
    })

    it('rebinds the deals repository to the transaction-scoped db handle', async () => {
      const baseDeals = createInMemoryDealRepository()
      const withDatabaseSpy = vi.fn(() => baseDeals)
      const deals = {
        ...baseDeals,
        withDatabase: withDatabaseSpy,
      }
      const dealService = createDealService({
        deals,
        pipelines: createInMemoryPipelineRepository(),
        stages: createInMemoryStageRepository(),
        contacts: createInMemoryContactRepository(),
        companies: createInMemoryCompanyRepository(),
        tx: createNoopTransactionScope(),
      })

      const created = await dealService.create(ctx, { title: 'Rebound' })
      // Reset the spy: only update() should call withDatabase in T7 scope.
      withDatabaseSpy.mockClear()
      await dealService.update(ctx, created.id, { title: 'Renamed' })
      expect(withDatabaseSpy).toHaveBeenCalledTimes(1)
    })
  })
})
