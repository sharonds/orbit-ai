import { generateId } from '../../ids/generate-id.js'
import { assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import type { CompanyRepository } from '../companies/repository.js'
import type { ContactRepository } from './repository.js'
import {
  contactCreateInputSchema,
  contactRecordSchema,
  contactUpdateInputSchema,
  type ContactCreateInput,
  type ContactRecord,
  type ContactUpdateInput,
} from './validators.js'

export function createContactService(deps: {
  contacts: ContactRepository
  companies: CompanyRepository
}): EntityService<ContactCreateInput, ContactUpdateInput, ContactRecord> {
  return {
    async create(ctx, input) {
      const parsed = contactCreateInputSchema.parse(input)

      if (parsed.companyId) {
        const company = await deps.companies.get(ctx, parsed.companyId)
        if (!company) {
          throw new Error(`Company ${parsed.companyId} not found for contact`)
        }
      }

      const now = new Date()
      return deps.contacts.create(
        contactRecordSchema.parse({
          id: generateId('contact'),
          organizationId: ctx.orgId,
          name: parsed.name,
          email: parsed.email ?? null,
          phone: parsed.phone ?? null,
          title: parsed.title ?? null,
          sourceChannel: parsed.sourceChannel ?? null,
          status: parsed.status ?? 'lead',
          assignedToUserId: parsed.assignedToUserId ?? null,
          companyId: parsed.companyId ?? null,
          leadScore: parsed.leadScore ?? 0,
          isHot: parsed.isHot ?? false,
          lastContactedAt: parsed.lastContactedAt ?? null,
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.contacts.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = contactUpdateInputSchema.parse(input)
      const current = assertFound(await deps.contacts.get(ctx, id), `Contact ${id} not found`)

      const nextCompanyId = parsed.companyId ?? current.companyId
      if (nextCompanyId) {
        const company = await deps.companies.get(ctx, nextCompanyId)
        if (!company) {
          throw new Error(`Company ${nextCompanyId} not found for contact`)
        }
      }

      const patch: Partial<ContactRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.email !== undefined) patch.email = parsed.email
      if (parsed.phone !== undefined) patch.phone = parsed.phone
      if (parsed.title !== undefined) patch.title = parsed.title
      if (parsed.sourceChannel !== undefined) patch.sourceChannel = parsed.sourceChannel
      if (parsed.status !== undefined) patch.status = parsed.status
      if (parsed.assignedToUserId !== undefined) patch.assignedToUserId = parsed.assignedToUserId
      if (parsed.companyId !== undefined) patch.companyId = parsed.companyId
      if (parsed.leadScore !== undefined) patch.leadScore = parsed.leadScore
      if (parsed.isHot !== undefined) patch.isHot = parsed.isHot
      if (parsed.lastContactedAt !== undefined) patch.lastContactedAt = parsed.lastContactedAt
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(
        await deps.contacts.update(ctx, id, patch),
        `Contact ${id} not found`,
      )
    },
    async delete(ctx, id) {
      const deleted = await deps.contacts.delete(ctx, id)
      if (!deleted) {
        throw new Error(`Contact ${id} not found`)
      }
    },
    async list(ctx, query) {
      return deps.contacts.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.contacts.search(ctx, query)
    },
  }
}
