import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import { createOrbitError } from '../../types/errors.js'
import type { CompanyRepository } from '../companies/repository.js'
import type { ContactRepository } from '../contacts/repository.js'
import type { DealRepository } from '../deals/repository.js'
import type { UserRepository } from '../users/repository.js'
import type { NoteRepository } from './repository.js'
import {
  noteCreateInputSchema,
  noteRecordSchema,
  noteUpdateInputSchema,
  type NoteCreateInput,
  type NoteRecord,
  type NoteUpdateInput,
} from './validators.js'

async function assertNoteRelations(
  ctx: Parameters<EntityService<NoteCreateInput, NoteUpdateInput, NoteRecord>['create']>[0],
  deps: {
    contacts: ContactRepository
    companies: CompanyRepository
    deals: DealRepository
    users: UserRepository
  },
  input: {
    contactId?: string | null | undefined
    companyId?: string | null | undefined
    dealId?: string | null | undefined
    createdByUserId?: string | null | undefined
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
      throw relationNotFound(`Contact ${input.contactId} not found for note`)
    }
  }

  if (input.companyId !== undefined && input.companyId !== null) {
    const company = await deps.companies.get(ctx, input.companyId)
    if (!company) {
      throw relationNotFound(`Company ${input.companyId} not found for note`)
    }
  }

  if (input.dealId !== undefined && input.dealId !== null) {
    const deal = await deps.deals.get(ctx, input.dealId)
    if (!deal) {
      throw relationNotFound(`Deal ${input.dealId} not found for note`)
    }
  }

  if (input.createdByUserId !== undefined && input.createdByUserId !== null) {
    const user = await deps.users.get(ctx, input.createdByUserId)
    if (!user) {
      throw relationNotFound(`User ${input.createdByUserId} not found for note`)
    }
  }
}

export function createNoteService(deps: {
  notes: NoteRepository
  contacts: ContactRepository
  companies: CompanyRepository
  deals: DealRepository
  users: UserRepository
}): EntityService<NoteCreateInput, NoteUpdateInput, NoteRecord> {
  return {
    async create(ctx, input) {
      const parsed = noteCreateInputSchema.parse(input)
      await assertNoteRelations(ctx, deps, {
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
        createdByUserId: parsed.createdByUserId,
      })

      const now = new Date()
      return deps.notes.create(
        ctx,
        noteRecordSchema.parse({
          id: generateId('note'),
          organizationId: ctx.orgId,
          content: parsed.content,
          contactId: parsed.contactId ?? null,
          dealId: parsed.dealId ?? null,
          companyId: parsed.companyId ?? null,
          createdByUserId: parsed.createdByUserId ?? null,
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.notes.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = noteUpdateInputSchema.parse(input)
      assertFound(await deps.notes.get(ctx, id), `Note ${id} not found`)
      await assertNoteRelations(ctx, deps, {
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
        createdByUserId: parsed.createdByUserId,
      })

      const patch: Partial<NoteRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.content !== undefined) patch.content = parsed.content
      if (parsed.contactId !== undefined) patch.contactId = parsed.contactId ?? null
      if (parsed.dealId !== undefined) patch.dealId = parsed.dealId ?? null
      if (parsed.companyId !== undefined) patch.companyId = parsed.companyId ?? null
      if (parsed.createdByUserId !== undefined) patch.createdByUserId = parsed.createdByUserId ?? null
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(await deps.notes.update(ctx, id, patch), `Note ${id} not found`)
    },
    async delete(ctx, id) {
      assertDeleted(await deps.notes.delete(ctx, id), `Note ${id} not found`)
    },
    async list(ctx, query) {
      return deps.notes.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.notes.search(ctx, query)
    },
  }
}
