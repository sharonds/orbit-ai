import { describe, expect, it, vi } from 'vitest'

import { createNoopTransactionScope } from '../../adapters/noop-transaction-scope.js'
import { generateId } from '../../ids/generate-id.js'
import { createInMemoryPaymentRepository, type PaymentRepository } from './repository.js'
import { createPaymentService } from './service.js'
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
  const payments = createInMemoryPaymentRepository()

  const companyService = createCompanyService(companies)
  const contactService = createContactService({ contacts, companies })
  const pipelineService = createPipelineService(pipelines)
  const stageService = createStageService({ stages, pipelines })
  const dealService = createDealService({ deals, pipelines, stages, contacts, companies, tx: createNoopTransactionScope() })
  const paymentService = createPaymentService({ payments, contacts, deals, tx: createNoopTransactionScope() })

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

  return { paymentService, contact, deal }
}

describe('payment service', () => {
  it('creates payments linked to contact and deal records', async () => {
    const { paymentService, contact, deal } = await createLinkedDealGraph()

    const payment = await paymentService.create(ctx, {
      amount: '1999.00',
      currency: 'usd',
      status: 'pending',
      contactId: contact.id,
      dealId: deal.id,
    })

    expect(payment.contactId).toBe(contact.id)
    expect(payment.dealId).toBe(deal.id)
    expect(payment.currency).toBe('USD')
  })

  it('rejects payments that reference out-of-scope linked records', async () => {
    const paymentService = createPaymentService({
      payments: createInMemoryPaymentRepository(),
      contacts: createInMemoryContactRepository(),
      deals: createInMemoryDealRepository(),
      tx: createNoopTransactionScope(),
    })

    await expect(
      paymentService.create(ctx, {
        amount: '50.00',
        status: 'pending',
        contactId: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('preserves external ID uniqueness within the tenant scope', async () => {
    const paymentService = createPaymentService({
      payments: createInMemoryPaymentRepository(),
      contacts: createInMemoryContactRepository(),
      deals: createInMemoryDealRepository(),
      tx: createNoopTransactionScope(),
    })

    await paymentService.create(ctx, {
      amount: '50.00',
      status: 'pending',
      externalId: 'stripe_session_123',
    })

    await expect(
      paymentService.create(ctx, {
        amount: '75.00',
        status: 'pending',
        externalId: 'stripe_session_123',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'externalId',
    })

    await expect(
      paymentService.create(otherCtx, {
        amount: '75.00',
        status: 'pending',
        externalId: 'stripe_session_123',
      }),
    ).resolves.toMatchObject({
      organizationId: otherCtx.orgId,
    })
  })

  it('preserves status transitions and auto-populates paidAt when a payment settles', async () => {
    const { paymentService } = await createLinkedDealGraph()
    const payment = await paymentService.create(ctx, {
      amount: '199.00',
      status: 'pending',
      externalId: 'stripe_session_456',
    })

    const paid = await paymentService.update(ctx, payment.id, {
      status: 'paid',
    })

    expect(paid.paidAt).toBeInstanceOf(Date)

    await expect(
      paymentService.update(ctx, payment.id, {
        status: 'pending',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'status',
    })
  })

  it('rejects refunded payments without a paid timestamp and rejects unsupported statuses', async () => {
    const { paymentService } = await createLinkedDealGraph()

    await expect(
      paymentService.create(ctx, {
        amount: '19.00',
        status: 'refunded',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'paidAt',
    })

    await expect(
      paymentService.create(ctx, {
        amount: '19.00',
        status: 'settled',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'status',
    })
  })

  it('lists and searches payments on revenue fields', async () => {
    const { paymentService } = await createLinkedDealGraph()

    await paymentService.create(ctx, {
      amount: '10.00',
      status: 'pending',
      method: 'ach',
      externalId: 'pay_ach',
    })
    await paymentService.create(ctx, {
      amount: '20.00',
      status: 'paid',
      method: 'card',
      externalId: 'pay_card',
      paidAt: new Date('2026-04-02T10:00:00.000Z'),
    })

    const search = await paymentService.search(ctx, {
      query: 'card',
      limit: 10,
    })

    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.externalId).toBe('pay_card')
  })

  it('maps repository unique-index violations to typed conflicts', async () => {
    const repository: PaymentRepository = {
      async create() {
        throw new Error('duplicate key value violates unique constraint "payments_external_id_idx"')
      },
      async get() {
        return null
      },
      async update() {
        return null
      },
      async delete() {
        return false
      },
      async list() {
        return {
          data: [],
          hasMore: false,
          nextCursor: null,
          totalCount: 0,
        }
      },
      async search() {
        return {
          data: [],
          hasMore: false,
          nextCursor: null,
          totalCount: 0,
        }
      },
      withDatabase() {
        return repository
      },
    }
    const paymentService = createPaymentService({
      payments: repository,
      contacts: createInMemoryContactRepository(),
      deals: createInMemoryDealRepository(),
      tx: createNoopTransactionScope(),
    })

    await expect(
      paymentService.create(ctx, {
        amount: '50.00',
        status: 'pending',
        externalId: 'stripe_session_789',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      field: 'externalId',
    })
  })

  it('deletes payments within the tenant scope', async () => {
    const { paymentService } = await createLinkedDealGraph()
    const payment = await paymentService.create(ctx, {
      amount: '10.00',
      status: 'pending',
    })

    await paymentService.delete(ctx, payment.id)
    expect(await paymentService.get(ctx, payment.id)).toBeNull()
  })

  it('rejects in-memory repository updates that try to mutate organizationId', async () => {
    const repository = createInMemoryPaymentRepository()
    const payment = await repository.create(ctx, {
      id: generateId('payment'),
      organizationId: ctx.orgId,
      amount: '50.00',
      currency: 'USD',
      status: 'pending',
      method: null,
      dealId: null,
      contactId: null,
      externalId: null,
      paidAt: null,
      metadata: {},
      customFields: {},
      createdAt: new Date('2026-04-02T12:00:00.000Z'),
      updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    })

    await expect(
      repository.update(ctx, payment.id, {
        organizationId: otherCtx.orgId,
      }),
    ).rejects.toThrow('Tenant record organization mismatch')
  })

  describe('transactional safety', () => {
    it('runs create inside a single transaction.run() call', async () => {
      const { paymentService: _service, contact, deal } = await createLinkedDealGraph()
      // Re-build with a spy scope
      const noop = createNoopTransactionScope()
      const runSpy = vi.fn(noop.run.bind(noop))
      const paymentService = createPaymentService({
        payments: createInMemoryPaymentRepository(),
        contacts: createInMemoryContactRepository(),
        deals: createInMemoryDealRepository(),
        tx: { run: runSpy },
      })

      // Use a payment with no relations so we don't need to set up the
      // full graph for this spy test (relation reads are outside the
      // transaction body anyway).
      await paymentService.create(ctx, {
        amount: '10.00',
        status: 'pending',
      })
      void contact
      void deal

      expect(runSpy).toHaveBeenCalledTimes(1)
      expect(runSpy).toHaveBeenCalledWith(ctx, expect.any(Function))
    })

    it('rebinds the payments repository to the transaction-scoped db handle', async () => {
      const base = createInMemoryPaymentRepository()
      const withDatabaseSpy = vi.fn<(db: never) => PaymentRepository>(() => base)
      const payments: PaymentRepository = {
        ...base,
        withDatabase: withDatabaseSpy,
      }
      const paymentService = createPaymentService({
        payments,
        contacts: createInMemoryContactRepository(),
        deals: createInMemoryDealRepository(),
        tx: createNoopTransactionScope(),
      })

      await paymentService.create(ctx, { amount: '5.00', status: 'pending' })
      expect(withDatabaseSpy).toHaveBeenCalledTimes(1)
    })
  })
})
