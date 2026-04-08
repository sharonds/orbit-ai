import { describe, expect, it } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
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
import { createInMemoryNoteRepository } from './repository.js'
import { createNoteService } from './service.js'

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
  const notes = createInMemoryNoteRepository()
  const users = createInMemoryUserRepository()

  const companyService = createCompanyService(companies)
  const contactService = createContactService({ contacts, companies })
  const pipelineService = createPipelineService({ pipelines, tx: createNoopTransactionScope() })
  const stageService = createStageService({ stages, pipelines })
  const dealService = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })
  const noteService = createNoteService({ notes, contacts, companies, deals, users })

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

  return { noteService, company, contact, deal }
}

describe('note service', () => {
  it('creates notes linked to contact and deal records', async () => {
    const { noteService, company, contact, deal } = await createLinkedDealGraph()

    const note = await noteService.create(ctx, {
      content: 'Strong expansion signal',
      contactId: contact.id,
      companyId: company.id,
      dealId: deal.id,
    })

    expect(note.contactId).toBe(contact.id)
    expect(note.companyId).toBe(company.id)
    expect(note.dealId).toBe(deal.id)
  })

  it('rejects notes that reference out-of-scope linked records', async () => {
    const noteService = createNoteService({
      notes: createInMemoryNoteRepository(),
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
    })

    await expect(
      noteService.create(ctx, {
        content: 'Bad relation',
        dealId: 'deal_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('lists and searches notes on content text', async () => {
    const { noteService } = await createLinkedDealGraph()

    await noteService.create(ctx, {
      content: 'Pricing approved',
    })
    await noteService.create(ctx, {
      content: 'Technical review scheduled',
    })

    const search = await noteService.search(ctx, {
      query: 'pricing',
      limit: 10,
    })

    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.content).toContain('Pricing')
  })

  it('rejects notes authored by users outside the tenant scope', async () => {
    const noteService = createNoteService({
      notes: createInMemoryNoteRepository(),
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
    })

    await expect(
      noteService.create(ctx, {
        content: 'Cross-tenant author',
        createdByUserId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })
})
