import { generateId } from '../../ids/generate-id.js'
import { assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import type { CompanyRepository } from './repository.js'
import {
  companyCreateInputSchema,
  companyRecordSchema,
  companyUpdateInputSchema,
  type CompanyCreateInput,
  type CompanyRecord,
  type CompanyUpdateInput,
} from './validators.js'

export function createCompanyService(repository: CompanyRepository): EntityService<CompanyCreateInput, CompanyUpdateInput, CompanyRecord> {
  return {
    async create(ctx, input) {
      const parsed = companyCreateInputSchema.parse(input)
      const now = new Date()

      return repository.create(
        ctx,
        companyRecordSchema.parse({
          id: generateId('company'),
          organizationId: ctx.orgId,
          name: parsed.name,
          domain: parsed.domain ?? null,
          industry: parsed.industry ?? null,
          size: parsed.size ?? null,
          website: parsed.website ?? null,
          notes: parsed.notes ?? null,
          assignedToUserId: parsed.assignedToUserId ?? null,
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = companyUpdateInputSchema.parse(input)
      assertFound(await repository.get(ctx, id), `Company ${id} not found`)
      const patch: Partial<CompanyRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.domain !== undefined) patch.domain = parsed.domain
      if (parsed.industry !== undefined) patch.industry = parsed.industry
      if (parsed.size !== undefined) patch.size = parsed.size
      if (parsed.website !== undefined) patch.website = parsed.website
      if (parsed.notes !== undefined) patch.notes = parsed.notes
      if (parsed.assignedToUserId !== undefined) patch.assignedToUserId = parsed.assignedToUserId
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(
        await repository.update(ctx, id, patch),
        `Company ${id} not found`,
      )
    },
    async delete(ctx, id) {
      const deleted = await repository.delete(ctx, id)
      if (!deleted) {
        throw new Error(`Company ${id} not found`)
      }
    },
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async search(ctx, query) {
      return repository.search(ctx, query)
    },
  }
}
