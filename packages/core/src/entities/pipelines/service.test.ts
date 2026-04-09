import { describe, expect, it } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
import { createInMemoryCompanyRepository } from '../companies/repository.js'
import { createCompanyService } from '../companies/service.js'
import { createInMemoryContactRepository } from '../contacts/repository.js'
import { createContactService } from '../contacts/service.js'
import { createInMemoryDealRepository } from '../deals/repository.js'
import { createDealService } from '../deals/service.js'
import { createInMemoryPipelineRepository } from './repository.js'
import { createPipelineService } from './service.js'
import { createInMemoryStageRepository } from '../stages/repository.js'
import { createStageService } from '../stages/service.js'

const orgA = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' }
const orgB = { orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ' }

describe('pipeline, stage, and deal services', () => {
  it('creates pipeline graph records and enforces stage pipeline consistency', async () => {
    const pipelineService = createPipelineService({
      pipelines: createInMemoryPipelineRepository(),
      tx: createNoopTransactionScope(),
    })
    const stageService = createStageService({
      stages: createInMemoryStageRepository(),
      pipelines: createInMemoryPipelineRepository(),
    })

    const ownedPipelines = createInMemoryPipelineRepository()
    const ownedStages = createInMemoryStageRepository()
    const companies = createInMemoryCompanyRepository()
    const contacts = createInMemoryContactRepository()
    const deals = createInMemoryDealRepository()

    const pipelineSvc = createPipelineService({ pipelines: ownedPipelines, tx: createNoopTransactionScope() })
    const stageSvc = createStageService({ stages: ownedStages, pipelines: ownedPipelines })
    const companySvc = createCompanyService(companies)
    const contactSvc = createContactService({ contacts, companies })
    const dealSvc = createDealService({
      deals,
      pipelines: ownedPipelines,
      stages: ownedStages,
      contacts,
      companies,
      tx: createNoopTransactionScope(),
    })

    const pipeline = await pipelineSvc.create(orgA, { name: 'Sales' })
    const stage = await stageSvc.create(orgA, {
      pipelineId: pipeline.id,
      name: 'Qualified',
      stageOrder: 1,
      probability: 25,
    })
    const company = await companySvc.create(orgA, { name: 'Acme' })
    const contact = await contactSvc.create(orgA, {
      name: 'Taylor',
      email: 'taylor@acme.test',
      companyId: company.id,
    })

    const deal = await dealSvc.create(orgA, {
      title: 'Expansion',
      stageId: stage.id,
      contactId: contact.id,
      companyId: company.id,
      probability: 25,
    })

    expect(deal.pipelineId).toBe(pipeline.id)
    await expect(
      dealSvc.create(orgA, {
        title: 'Invalid',
        pipelineId: 'pipeline_01ARYZ6S41AAAAAAAAAAAAAAAA',
        stageId: stage.id,
      }),
    ).rejects.toThrow(`Stage ${stage.id} does not belong to pipeline pipeline_01ARYZ6S41AAAAAAAAAAAAAAAA`)

    expect(await pipelineSvc.get(orgB, pipeline.id)).toBeNull()
    expect(await dealSvc.get(orgB, deal.id)).toBeNull()

    void pipelineService
    void stageService
  })

  it('supports stage search and deal updates inside the tenant boundary', async () => {
    const pipelines = createInMemoryPipelineRepository()
    const stages = createInMemoryStageRepository()
    const deals = createInMemoryDealRepository()
    const contacts = createInMemoryContactRepository()
    const companies = createInMemoryCompanyRepository()

    const pipelineSvc = createPipelineService({ pipelines, tx: createNoopTransactionScope() })
    const stageSvc = createStageService({ stages, pipelines })
    const dealSvc = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })

    const pipeline = await pipelineSvc.create(orgA, { name: 'Support' })
    const stage = await stageSvc.create(orgA, {
      pipelineId: pipeline.id,
      name: 'Negotiation',
      stageOrder: 2,
      probability: 75,
      color: 'amber',
    })
    const deal = await dealSvc.create(orgA, {
      title: 'Renewal',
      pipelineId: pipeline.id,
      stageId: stage.id,
      status: 'open',
    })

    const search = await stageSvc.search(orgA, { query: 'nego', limit: 10 })
    expect(search.data.map((item) => item.id)).toEqual([stage.id])

    const updated = await dealSvc.update(orgA, deal.id, {
      status: 'won',
      wonAt: new Date('2026-03-31T12:00:00.000Z'),
    })
    expect(updated.status).toBe('won')
    expect(updated.wonAt?.toISOString()).toBe('2026-03-31T12:00:00.000Z')
  })

  describe('isDefault uniqueness (T9/L8)', () => {
    it('demotes the prior default when creating a new default pipeline', async () => {
      const pipelines = createInMemoryPipelineRepository()
      const pipelineSvc = createPipelineService({ pipelines, tx: createNoopTransactionScope() })

      const first = await pipelineSvc.create(orgA, { name: 'First', isDefault: true })
      expect(first.isDefault).toBe(true)

      const second = await pipelineSvc.create(orgA, { name: 'Second', isDefault: true })
      expect(second.isDefault).toBe(true)

      const refreshedFirst = await pipelineSvc.get(orgA, first.id)
      expect(refreshedFirst?.isDefault).toBe(false)
    })

    it('demotes the prior default when updating an existing pipeline to default', async () => {
      const pipelines = createInMemoryPipelineRepository()
      const pipelineSvc = createPipelineService({ pipelines, tx: createNoopTransactionScope() })

      const a = await pipelineSvc.create(orgA, { name: 'A', isDefault: true })
      const b = await pipelineSvc.create(orgA, { name: 'B' })

      const promoted = await pipelineSvc.update(orgA, b.id, { isDefault: true })
      expect(promoted.isDefault).toBe(true)

      const refreshedA = await pipelineSvc.get(orgA, a.id)
      expect(refreshedA?.isDefault).toBe(false)
    })

    it('serial default creates — each new default demotes the prior', async () => {
      const pipelines = createInMemoryPipelineRepository()
      const pipelineSvc = createPipelineService({ pipelines, tx: createNoopTransactionScope() })

      await pipelineSvc.create(orgA, { name: 'A', isDefault: true })
      await pipelineSvc.create(orgA, { name: 'B', isDefault: true })
      await pipelineSvc.create(orgA, { name: 'C', isDefault: true })

      const all = await pipelines.list(orgA, { filter: { is_default: true }, limit: 100 })
      expect(all.data.filter((p) => p.isDefault).length).toBe(1)
      expect(all.data.find((p) => p.isDefault)?.name).toBe('C')
    })

    it('concurrent default creates — DB/in-memory partial unique index is the race-decider', async () => {
      // The application-level `demoteOtherDefaults` closes the same-
      // transaction race. The multi-transaction race is closed by the
      // `pipelines_org_default_unique_idx` partial unique index. The
      // in-memory repo mirrors that index so the test exercises the
      // real production behavior: when three requests race to become
      // the default, exactly one succeeds and the others surface as
      // CONFLICT via `coercePipelineConflict`.
      const pipelines = createInMemoryPipelineRepository()
      const pipelineSvc = createPipelineService({ pipelines, tx: createNoopTransactionScope() })

      const results = await Promise.allSettled([
        pipelineSvc.create(orgA, { name: 'A', isDefault: true }),
        pipelineSvc.create(orgA, { name: 'B', isDefault: true }),
        pipelineSvc.create(orgA, { name: 'C', isDefault: true }),
      ])

      const fulfilled = results.filter((r) => r.status === 'fulfilled')
      const rejected = results.filter((r) => r.status === 'rejected')
      expect(fulfilled.length).toBe(1)
      expect(rejected.length).toBe(2)
      for (const r of rejected) {
        if (r.status === 'rejected') {
          expect(r.reason).toMatchObject({ code: 'CONFLICT', field: 'isDefault' })
        }
      }

      const all = await pipelines.list(orgA, { filter: { is_default: true }, limit: 100 })
      expect(all.data.filter((p) => p.isDefault).length).toBe(1)
    })

    it('coerces a repository partial-unique-index violation into a typed CONFLICT', async () => {
      // Mock repo whose create throws the DB-level partial-unique-index
      // error. This simulates the case where two concurrent Postgres
      // transactions both pass their own application-level demote
      // check (because each reads a snapshot without the other's
      // in-flight write) and then both try to insert a default — the
      // partial unique index `pipelines_org_default_unique_idx` fires
      // on the second transaction, and `coercePipelineConflict`
      // translates the raw DB error into an OrbitError CONFLICT.
      const base = createInMemoryPipelineRepository()
      const indexError = new Error(
        'duplicate key value violates unique constraint "pipelines_org_default_unique_idx" on organization_id where is_default = true',
      )
      const pipelines = {
        ...base,
        async create() {
          throw indexError
        },
        withDatabase() {
          return pipelines
        },
      }
      const pipelineSvc = createPipelineService({
        pipelines,
        tx: createNoopTransactionScope(),
      })

      await expect(
        pipelineSvc.create(orgA, { name: 'Racer', isDefault: true }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        field: 'isDefault',
      })
    })
  })
})
