import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import { createOrbitError } from '../../types/errors.js'
import type { CompanyRepository } from '../companies/repository.js'
import type { ContactRepository } from '../contacts/repository.js'
import type { DealRepository } from '../deals/repository.js'
import type { ContractRepository } from './repository.js'
import {
  contractCreateInputSchema,
  contractRecordSchema,
  contractUpdateInputSchema,
  type ContractCreateInput,
  type ContractRecord,
  type ContractUpdateInput,
} from './validators.js'

const KNOWN_CONTRACT_STATUSES = new Set(['draft', 'review', 'approved', 'sent', 'signed', 'expired', 'canceled'])

const CONTRACT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['draft', 'review', 'approved', 'sent', 'canceled'],
  review: ['review', 'draft', 'approved', 'sent', 'canceled'],
  approved: ['approved', 'review', 'sent', 'signed', 'expired', 'canceled'],
  sent: ['sent', 'approved', 'signed', 'expired', 'canceled'],
  signed: ['signed', 'expired'],
  expired: ['expired'],
  canceled: ['canceled'],
}

async function assertContractRelations(
  ctx: Parameters<EntityService<ContractCreateInput, ContractUpdateInput, ContractRecord>['create']>[0],
  deps: {
    contacts: ContactRepository
    companies: CompanyRepository
    deals: DealRepository
  },
  input: {
    contactId?: string | null | undefined
    companyId?: string | null | undefined
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
      throw relationNotFound(`Contact ${input.contactId} not found for contract`)
    }
  }

  if (input.companyId !== undefined && input.companyId !== null) {
    const company = await deps.companies.get(ctx, input.companyId)
    if (!company) {
      throw relationNotFound(`Company ${input.companyId} not found for contract`)
    }
  }

  if (input.dealId !== undefined && input.dealId !== null) {
    const deal = await deps.deals.get(ctx, input.dealId)
    if (!deal) {
      throw relationNotFound(`Deal ${input.dealId} not found for contract`)
    }
  }
}

function resolveSignedAt(input: {
  now: Date
  status: string
  signedAt: Date | null
  previousStatus?: string
  previousSignedAt?: Date | null
}): Date | null {
  if (input.status === 'signed') {
    if (input.signedAt !== null) {
      return input.signedAt
    }

    if (input.previousStatus === 'signed') {
      return input.previousSignedAt ?? null
    }

    return input.now
  }

  if (input.status === 'expired') {
    return input.signedAt ?? input.previousSignedAt ?? null
  }

  return input.signedAt
}

function assertContractTransition(currentStatus: string | undefined, nextStatus: string): void {
  if (!KNOWN_CONTRACT_STATUSES.has(nextStatus)) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: `Unsupported contract status ${nextStatus}`,
      field: 'status',
    })
  }

  if (
    currentStatus &&
    KNOWN_CONTRACT_STATUSES.has(currentStatus)
  ) {
    const allowed = CONTRACT_STATUS_TRANSITIONS[currentStatus] ?? [currentStatus]

    if (!allowed.includes(nextStatus)) {
      throw createOrbitError({
        code: 'VALIDATION_FAILED',
        message: `Contract status cannot transition from ${currentStatus} to ${nextStatus}`,
        field: 'status',
      })
    }
  }
}

function assertContractState(input: {
  nextStatus: string
  signedAt: Date | null
}): void {
  if (input.nextStatus === 'expired' && input.signedAt === null) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: 'Expired contract requires signedAt',
      field: 'signedAt',
    })
  }

  if (input.signedAt !== null && input.nextStatus !== 'signed' && input.nextStatus !== 'expired') {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: 'Contract signedAt requires status to be signed or expired',
      field: 'signedAt',
    })
  }
}

export function createContractService(deps: {
  contracts: ContractRepository
  contacts: ContactRepository
  companies: CompanyRepository
  deals: DealRepository
}): EntityService<ContractCreateInput, ContractUpdateInput, ContractRecord> {
  return {
    async create(ctx, input) {
      const parsed = contractCreateInputSchema.parse(input)
      await assertContractRelations(ctx, deps, {
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
      })

      const now = new Date()
      const status = parsed.status ?? 'draft'
      assertContractTransition(undefined, status)
      const signedAt = resolveSignedAt({
        now,
        status,
        signedAt: parsed.signedAt ?? null,
      })
      assertContractState({
        nextStatus: status,
        signedAt,
      })

      return deps.contracts.create(
        ctx,
        contractRecordSchema.parse({
          id: generateId('contract'),
          organizationId: ctx.orgId,
          title: parsed.title,
          content: parsed.content ?? null,
          status,
          signedAt,
          expiresAt: parsed.expiresAt ?? null,
          dealId: parsed.dealId ?? null,
          contactId: parsed.contactId ?? null,
          companyId: parsed.companyId ?? null,
          externalSignatureId: parsed.externalSignatureId ?? null,
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.contracts.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = contractUpdateInputSchema.parse(input)
      const current = assertFound(await deps.contracts.get(ctx, id), `Contract ${id} not found`)
      await assertContractRelations(ctx, deps, {
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
      })

      const nextStatus = parsed.status ?? current.status
      assertContractTransition(current.status, nextStatus)
      const nextSignedAt = resolveSignedAt({
        now: new Date(),
        status: nextStatus,
        signedAt: parsed.signedAt !== undefined ? parsed.signedAt ?? null : current.signedAt,
        previousStatus: current.status,
        previousSignedAt: current.signedAt,
      })
      assertContractState({
        nextStatus,
        signedAt: nextSignedAt,
      })

      const patch: Partial<ContractRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.title !== undefined) patch.title = parsed.title
      if (parsed.content !== undefined) patch.content = parsed.content ?? null
      if (parsed.status !== undefined) patch.status = parsed.status
      if (parsed.signedAt !== undefined || nextSignedAt !== current.signedAt) patch.signedAt = nextSignedAt
      if (parsed.expiresAt !== undefined) patch.expiresAt = parsed.expiresAt ?? null
      if (parsed.dealId !== undefined) patch.dealId = parsed.dealId ?? null
      if (parsed.contactId !== undefined) patch.contactId = parsed.contactId ?? null
      if (parsed.companyId !== undefined) patch.companyId = parsed.companyId ?? null
      if (parsed.externalSignatureId !== undefined) patch.externalSignatureId = parsed.externalSignatureId ?? null
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(await deps.contracts.update(ctx, id, patch), `Contract ${id} not found`)
    },
    async delete(ctx, id) {
      assertDeleted(await deps.contracts.delete(ctx, id), `Contract ${id} not found`)
    },
    async list(ctx, query) {
      return deps.contracts.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.contracts.search(ctx, query)
    },
  }
}
