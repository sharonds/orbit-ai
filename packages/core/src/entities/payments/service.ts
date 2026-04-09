import type { TransactionScope } from '../../adapters/interface.js'
import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import { createOrbitError } from '../../types/errors.js'
import type { ContactRepository } from '../contacts/repository.js'
import type { DealRepository } from '../deals/repository.js'
import type { PaymentRepository } from './repository.js'
import {
  paymentCreateInputSchema,
  paymentRecordSchema,
  paymentUpdateInputSchema,
  type PaymentCreateInput,
  type PaymentRecord,
  type PaymentUpdateInput,
} from './validators.js'

const KNOWN_PAYMENT_STATUSES = new Set([
  'unpaid',
  'pending',
  'paid',
  'failed',
  'refunded',
  'canceled',
  'no_payment_required',
])

const PAYMENT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  unpaid: ['unpaid', 'pending', 'paid', 'failed', 'canceled', 'no_payment_required'],
  pending: ['pending', 'paid', 'failed', 'canceled', 'refunded'],
  paid: ['paid', 'refunded'],
  failed: ['failed', 'pending', 'paid', 'canceled'],
  refunded: ['refunded'],
  canceled: ['canceled'],
  no_payment_required: ['no_payment_required'],
}

async function assertPaymentRelations(
  ctx: Parameters<EntityService<PaymentCreateInput, PaymentUpdateInput, PaymentRecord>['create']>[0],
  deps: {
    contacts: ContactRepository
    deals: DealRepository
  },
  input: {
    contactId?: string | null | undefined
    dealId?: string | null | undefined
  },
): Promise<void> {
  function relationNotFound(message: string) {
    return createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message,
    })
  }

  if (input.contactId !== undefined && input.contactId !== null) {
    const contact = await deps.contacts.get(ctx, input.contactId)
    if (!contact) {
      throw relationNotFound(`Contact ${input.contactId} not found for payment`)
    }
  }

  if (input.dealId !== undefined && input.dealId !== null) {
    const deal = await deps.deals.get(ctx, input.dealId)
    if (!deal) {
      throw relationNotFound(`Deal ${input.dealId} not found for payment`)
    }
  }
}

async function assertUniqueExternalId(
  ctx: Parameters<EntityService<PaymentCreateInput, PaymentUpdateInput, PaymentRecord>['create']>[0],
  repository: PaymentRepository,
  externalId: string | null,
  currentId?: string,
): Promise<void> {
  if (externalId === null) {
    return
  }

  const existing = await repository.list(ctx, {
    filter: {
      external_id: externalId,
    },
    limit: 2,
  })

  const conflict = existing.data.find((record) => record.id !== currentId)

  if (conflict) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Payment externalId ${externalId} already exists in this organization`,
      field: 'externalId',
    })
  }
}

function resolvePaidAt(input: {
  now: Date
  status: string
  paidAt: Date | null
  previousStatus?: string
  previousPaidAt?: Date | null
}): Date | null {
  if (input.status === 'paid') {
    if (input.paidAt !== null) {
      return input.paidAt
    }

    if (input.previousStatus === 'paid') {
      return input.previousPaidAt ?? null
    }

    return input.now
  }

  if (input.status === 'refunded') {
    return input.paidAt ?? input.previousPaidAt ?? null
  }

  return input.paidAt
}

function assertPaymentTransition(currentStatus: string | undefined, nextStatus: string): void {
  if (!KNOWN_PAYMENT_STATUSES.has(nextStatus)) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: `Unsupported payment status ${nextStatus}`,
      field: 'status',
    })
  }

  if (
    currentStatus &&
    KNOWN_PAYMENT_STATUSES.has(currentStatus)
  ) {
    const allowed = PAYMENT_STATUS_TRANSITIONS[currentStatus] ?? [currentStatus]

    if (!allowed.includes(nextStatus)) {
      throw createOrbitError({
        code: 'VALIDATION_FAILED',
        message: `Payment status cannot transition from ${currentStatus} to ${nextStatus}`,
        field: 'status',
      })
    }
  }
}

function assertPaymentState(input: {
  nextStatus: string
  paidAt: Date | null
}): void {
  if (input.nextStatus === 'refunded' && input.paidAt === null) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: 'Refunded payment requires paidAt',
      field: 'paidAt',
    })
  }

  if (input.paidAt !== null && input.nextStatus !== 'paid' && input.nextStatus !== 'refunded') {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: 'Payment paidAt requires status to be paid or refunded',
      field: 'paidAt',
    })
  }
}

function coercePaymentConflict(error: unknown, externalId: string | null): never {
  if (
    error instanceof Error &&
    externalId !== null &&
    (
      error.message.includes('payments_external_id_idx') ||
      (error.message.toLowerCase().includes('unique') &&
        (error.message.includes('external_id') || error.message.includes('externalId')))
    )
  ) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Payment externalId ${externalId} already exists in this organization`,
      field: 'externalId',
    })
  }

  throw error
}

export function createPaymentService(deps: {
  payments: PaymentRepository
  contacts: ContactRepository
  deals: DealRepository
  tx: TransactionScope
}): EntityService<PaymentCreateInput, PaymentUpdateInput, PaymentRecord> {
  return {
    async create(ctx, input) {
      const parsed = paymentCreateInputSchema.parse(input)
      // Relation reads (`contacts`, `deals`) stay outside the rebound view —
      // FK constraints catch any deletion races at insert time.
      await assertPaymentRelations(ctx, deps, {
        contactId: parsed.contactId,
        dealId: parsed.dealId,
      })

      const now = new Date()
      const status = parsed.status
      assertPaymentTransition(undefined, status)
      const paidAt = resolvePaidAt({
        now,
        status,
        paidAt: parsed.paidAt ?? null,
      })
      assertPaymentState({
        nextStatus: status,
        paidAt,
      })

      // Wrap external_id uniqueness check + insert in one transaction so
      // `payments_external_id_idx` is the race-decider.
      return deps.tx.run(ctx, async (txDb) => {
        const txPayments = deps.payments.withDatabase(txDb)
        await assertUniqueExternalId(ctx, txPayments, parsed.externalId ?? null)

        try {
          return await txPayments.create(
            ctx,
            paymentRecordSchema.parse({
              id: generateId('payment'),
              organizationId: ctx.orgId,
              amount: parsed.amount,
              currency: parsed.currency ?? 'USD',
              status,
              method: parsed.method ?? null,
              dealId: parsed.dealId ?? null,
              contactId: parsed.contactId ?? null,
              externalId: parsed.externalId ?? null,
              paidAt,
              metadata: parsed.metadata ?? {},
              customFields: parsed.customFields ?? {},
              createdAt: now,
              updatedAt: now,
            }),
          )
        } catch (error) {
          coercePaymentConflict(error, parsed.externalId ?? null)
        }
      })
    },
    async get(ctx, id) {
      return deps.payments.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = paymentUpdateInputSchema.parse(input)
      // Relation reads (contacts, deals) stay outside the rebound view —
      // FK constraints catch deletion races at update time.
      await assertPaymentRelations(ctx, deps, {
        contactId: parsed.contactId,
        dealId: parsed.dealId,
      })

      // Phase 2 gate fix: the `current` get and the
      // assertPaymentTransition / resolvePaidAt / assertPaymentState
      // checks must run inside the rebound transaction. Reading
      // `current.status` outside the transaction lets two concurrent
      // updates both validate against the same stale state and both
      // commit a forbidden transition (e.g. paid → refunded || canceled).
      // The transition guard is a logical invariant that no DB constraint
      // can rescue, so the check MUST share the transaction with the
      // write.
      return deps.tx.run(ctx, async (txDb) => {
        const txPayments = deps.payments.withDatabase(txDb)
        const current = assertFound(await txPayments.get(ctx, id), `Payment ${id} not found`)

        const nextStatus = parsed.status ?? current.status
        assertPaymentTransition(current.status, nextStatus)
        const nextPaidAt = resolvePaidAt({
          now: new Date(),
          status: nextStatus,
          paidAt: parsed.paidAt !== undefined ? parsed.paidAt ?? null : current.paidAt,
          previousStatus: current.status,
          previousPaidAt: current.paidAt,
        })
        assertPaymentState({
          nextStatus,
          paidAt: nextPaidAt,
        })

        await assertUniqueExternalId(ctx, txPayments, parsed.externalId ?? current.externalId, id)

        const patch: Partial<PaymentRecord> = {
          updatedAt: new Date(),
        }

        if (parsed.amount !== undefined) patch.amount = parsed.amount
        if (parsed.currency !== undefined) patch.currency = parsed.currency
        if (parsed.status !== undefined) patch.status = parsed.status
        if (parsed.method !== undefined) patch.method = parsed.method ?? null
        if (parsed.dealId !== undefined) patch.dealId = parsed.dealId ?? null
        if (parsed.contactId !== undefined) patch.contactId = parsed.contactId ?? null
        if (parsed.externalId !== undefined) patch.externalId = parsed.externalId ?? null
        if (parsed.paidAt !== undefined || nextPaidAt !== current.paidAt) patch.paidAt = nextPaidAt
        if (parsed.metadata !== undefined) patch.metadata = parsed.metadata
        if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

        try {
          return assertFound(await txPayments.update(ctx, id, patch), `Payment ${id} not found`)
        } catch (error) {
          coercePaymentConflict(error, parsed.externalId ?? current.externalId)
        }
      })
    },
    async delete(ctx, id) {
      assertDeleted(await deps.payments.delete(ctx, id), `Payment ${id} not found`)
    },
    async list(ctx, query) {
      return deps.payments.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.payments.search(ctx, query)
    },
  }
}
