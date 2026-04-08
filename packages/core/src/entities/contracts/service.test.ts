import { describe, expect, it } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
import { generateId } from '../../ids/generate-id.js'
import { createInMemoryContractRepository } from './repository.js'
import { createContractService } from './service.js'
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

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

const otherCtx = {
  orgId: 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
  userId: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
} as const

async function createLinkedDealGraph() {
  const companies = createInMemoryCompanyRepository()
  const contacts = createInMemoryContactRepository()
  const pipelines = createInMemoryPipelineRepository()
  const stages = createInMemoryStageRepository()
  const deals = createInMemoryDealRepository()
  const contracts = createInMemoryContractRepository()

  const companyService = createCompanyService(companies)
  const contactService = createContactService({ contacts, companies })
  const pipelineService = createPipelineService(pipelines)
  const stageService = createStageService({ stages, pipelines })
  const dealService = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })
  const contractService = createContractService({ contracts, contacts, companies, deals })

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

  return { contractService, company, contact, deal }
}

describe('contract service', () => {
  it('creates contracts linked to contact, company, and deal records', async () => {
    const { contractService, company, contact, deal } = await createLinkedDealGraph()

    const contract = await contractService.create(ctx, {
      title: 'Master Services Agreement',
      contactId: contact.id,
      companyId: company.id,
      dealId: deal.id,
    })

    expect(contract.contactId).toBe(contact.id)
    expect(contract.companyId).toBe(company.id)
    expect(contract.dealId).toBe(deal.id)
    expect(contract.status).toBe('draft')
  })

  it('rejects contracts that reference out-of-scope linked records', async () => {
    const contractService = createContractService({
      contracts: createInMemoryContractRepository(),
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
    })

    await expect(
      contractService.create(ctx, {
        title: 'NDA',
        companyId: 'company_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('preserves status transitions and auto-populates signedAt when signing', async () => {
    const { contractService } = await createLinkedDealGraph()
    const contract = await contractService.create(ctx, {
      title: 'Order Form',
      status: 'approved',
    })

    const signed = await contractService.update(ctx, contract.id, {
      status: 'signed',
    })

    expect(signed.signedAt).toBeInstanceOf(Date)

    await expect(
      contractService.update(ctx, contract.id, {
        status: 'draft',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'status',
    })
  })

  it('rejects expired contracts without a signed timestamp and rejects unsupported statuses', async () => {
    const { contractService } = await createLinkedDealGraph()

    await expect(
      contractService.create(ctx, {
        title: 'Legacy Order Form',
        status: 'expired',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'signedAt',
    })

    await expect(
      contractService.create(ctx, {
        title: 'Legacy Order Form',
        status: 'void',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'status',
    })
  })

  it('lists and searches contracts on document fields', async () => {
    const { contractService } = await createLinkedDealGraph()

    await contractService.create(ctx, {
      title: 'MSA',
      content: 'Master services agreement for annual plan',
    })
    await contractService.create(ctx, {
      title: 'DPA',
      content: 'Data processing addendum',
      externalSignatureId: 'esign_123',
    })

    const search = await contractService.search(ctx, {
      query: 'processing',
      limit: 10,
    })

    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.title).toBe('DPA')
  })

  it('deletes contracts within the tenant scope', async () => {
    const { contractService } = await createLinkedDealGraph()
    const contract = await contractService.create(ctx, {
      title: 'SOW',
    })

    await contractService.delete(ctx, contract.id)
    expect(await contractService.get(ctx, contract.id)).toBeNull()
  })

  it('rejects in-memory repository updates that try to mutate organizationId', async () => {
    const repository = createInMemoryContractRepository()
    const contract = await repository.create(ctx, {
      id: generateId('contract'),
      organizationId: ctx.orgId,
      title: 'MSA',
      content: null,
      status: 'draft',
      signedAt: null,
      expiresAt: null,
      dealId: null,
      contactId: null,
      companyId: null,
      externalSignatureId: null,
      customFields: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.update(ctx, contract.id, {
        organizationId: otherCtx.orgId,
      }),
    ).rejects.toThrow('Tenant record organization mismatch')
  })
})
