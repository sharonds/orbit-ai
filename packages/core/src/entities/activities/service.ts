import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import { createOrbitError } from '../../types/errors.js'
import type { CompanyRepository } from '../companies/repository.js'
import type { ContactRepository } from '../contacts/repository.js'
import type { DealRepository } from '../deals/repository.js'
import type { UserRepository } from '../users/repository.js'
import type { ActivityRepository } from './repository.js'
import {
  activityCreateInputSchema,
  activityRecordSchema,
  activityUpdateInputSchema,
  type ActivityCreateInput,
  type ActivityRecord,
  type ActivityUpdateInput,
} from './validators.js'

async function assertActivityRelations(
  ctx: Parameters<EntityService<ActivityCreateInput, ActivityUpdateInput, ActivityRecord>['create']>[0],
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
    loggedByUserId?: string | null | undefined
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
      throw relationNotFound(`Contact ${input.contactId} not found for activity`)
    }
  }

  if (input.companyId !== undefined && input.companyId !== null) {
    const company = await deps.companies.get(ctx, input.companyId)
    if (!company) {
      throw relationNotFound(`Company ${input.companyId} not found for activity`)
    }
  }

  if (input.dealId !== undefined && input.dealId !== null) {
    const deal = await deps.deals.get(ctx, input.dealId)
    if (!deal) {
      throw relationNotFound(`Deal ${input.dealId} not found for activity`)
    }
  }

  if (input.loggedByUserId !== undefined && input.loggedByUserId !== null) {
    const user = await deps.users.get(ctx, input.loggedByUserId)
    if (!user) {
      throw relationNotFound(`User ${input.loggedByUserId} not found for activity`)
    }
  }
}

export function createActivityService(deps: {
  activities: ActivityRepository
  contacts: ContactRepository
  companies: CompanyRepository
  deals: DealRepository
  users: UserRepository
}): EntityService<ActivityCreateInput, ActivityUpdateInput, ActivityRecord> {
  return {
    async create(ctx, input) {
      const parsed = activityCreateInputSchema.parse(input)
      await assertActivityRelations(ctx, deps, {
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
        loggedByUserId: parsed.loggedByUserId,
      })

      const now = new Date()
      return deps.activities.create(
        ctx,
        activityRecordSchema.parse({
          id: generateId('activity'),
          organizationId: ctx.orgId,
          type: parsed.type,
          subject: parsed.subject ?? null,
          body: parsed.body ?? null,
          direction: parsed.direction ?? 'internal',
          contactId: parsed.contactId ?? null,
          dealId: parsed.dealId ?? null,
          companyId: parsed.companyId ?? null,
          durationMinutes: parsed.durationMinutes ?? null,
          outcome: parsed.outcome ?? null,
          occurredAt: parsed.occurredAt,
          loggedByUserId: parsed.loggedByUserId ?? null,
          metadata: parsed.metadata ?? {},
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.activities.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = activityUpdateInputSchema.parse(input)
      assertFound(await deps.activities.get(ctx, id), `Activity ${id} not found`)
      await assertActivityRelations(ctx, deps, {
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
        loggedByUserId: parsed.loggedByUserId,
      })

      const patch: Partial<ActivityRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.type !== undefined) patch.type = parsed.type
      if (parsed.subject !== undefined) patch.subject = parsed.subject ?? null
      if (parsed.body !== undefined) patch.body = parsed.body ?? null
      if (parsed.direction !== undefined) patch.direction = parsed.direction
      if (parsed.contactId !== undefined) patch.contactId = parsed.contactId ?? null
      if (parsed.dealId !== undefined) patch.dealId = parsed.dealId ?? null
      if (parsed.companyId !== undefined) patch.companyId = parsed.companyId ?? null
      if (parsed.durationMinutes !== undefined) patch.durationMinutes = parsed.durationMinutes ?? null
      if (parsed.outcome !== undefined) patch.outcome = parsed.outcome ?? null
      if (parsed.occurredAt !== undefined) patch.occurredAt = parsed.occurredAt
      if (parsed.loggedByUserId !== undefined) patch.loggedByUserId = parsed.loggedByUserId ?? null
      if (parsed.metadata !== undefined) patch.metadata = parsed.metadata
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(await deps.activities.update(ctx, id, patch), `Activity ${id} not found`)
    },
    async delete(ctx, id) {
      assertDeleted(await deps.activities.delete(ctx, id), `Activity ${id} not found`)
    },
    async list(ctx, query) {
      return deps.activities.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.activities.search(ctx, query)
    },
  }
}
