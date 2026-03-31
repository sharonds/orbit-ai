import { generateId } from '../../ids/generate-id.js'
import { assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import type { CompanyRepository } from '../companies/repository.js'
import type { ContactRepository } from '../contacts/repository.js'
import type { PipelineRepository } from '../pipelines/repository.js'
import type { StageRepository } from '../stages/repository.js'
import type { DealRepository } from './repository.js'
import {
  dealCreateInputSchema,
  dealRecordSchema,
  dealUpdateInputSchema,
  type DealCreateInput,
  type DealRecord,
  type DealUpdateInput,
} from './validators.js'

async function resolveDealGraph(
  ctx: Parameters<EntityService<DealCreateInput, DealUpdateInput, DealRecord>['create']>[0],
  deps: {
    pipelines: PipelineRepository
    stages: StageRepository
    contacts: ContactRepository
    companies: CompanyRepository
  },
  input: {
    stageId: string | null | undefined
    pipelineId: string | null | undefined
    contactId: string | null | undefined
    companyId: string | null | undefined
  },
): Promise<{ stageId: string | null; pipelineId: string | null }> {
  let pipelineId = input.pipelineId ?? null

  if (input.stageId) {
    const stage = await deps.stages.get(ctx, input.stageId)
    if (!stage) {
      throw new Error(`Stage ${input.stageId} not found for deal`)
    }

    if (pipelineId && stage.pipelineId !== pipelineId) {
      throw new Error(`Stage ${input.stageId} does not belong to pipeline ${pipelineId}`)
    }

    pipelineId = stage.pipelineId
  }

  if (pipelineId) {
    const pipeline = await deps.pipelines.get(ctx, pipelineId)
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found for deal`)
    }
  }

  if (input.contactId) {
    const contact = await deps.contacts.get(ctx, input.contactId)
    if (!contact) {
      throw new Error(`Contact ${input.contactId} not found for deal`)
    }
  }

  if (input.companyId) {
    const company = await deps.companies.get(ctx, input.companyId)
    if (!company) {
      throw new Error(`Company ${input.companyId} not found for deal`)
    }
  }

  return {
    stageId: input.stageId ?? null,
    pipelineId,
  }
}

export function createDealService(deps: {
  deals: DealRepository
  pipelines: PipelineRepository
  stages: StageRepository
  contacts: ContactRepository
  companies: CompanyRepository
}): EntityService<DealCreateInput, DealUpdateInput, DealRecord> {
  return {
    async create(ctx, input) {
      const parsed = dealCreateInputSchema.parse(input)
      const graph = await resolveDealGraph(ctx, deps, {
        stageId: parsed.stageId ?? null,
        pipelineId: parsed.pipelineId ?? null,
        contactId: parsed.contactId ?? null,
        companyId: parsed.companyId ?? null,
      })

      const now = new Date()
      return deps.deals.create(
        dealRecordSchema.parse({
          id: generateId('deal'),
          organizationId: ctx.orgId,
          title: parsed.title,
          value: parsed.value ?? null,
          currency: parsed.currency ?? 'USD',
          stageId: graph.stageId,
          pipelineId: graph.pipelineId,
          probability: parsed.probability ?? 0,
          expectedCloseDate: parsed.expectedCloseDate ?? null,
          contactId: parsed.contactId ?? null,
          companyId: parsed.companyId ?? null,
          assignedToUserId: parsed.assignedToUserId ?? null,
          status: parsed.status ?? 'open',
          wonAt: parsed.wonAt ?? null,
          lostAt: parsed.lostAt ?? null,
          lostReason: parsed.lostReason ?? null,
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.deals.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = dealUpdateInputSchema.parse(input)
      const current = assertFound(await deps.deals.get(ctx, id), `Deal ${id} not found`)
      const graph = await resolveDealGraph(ctx, deps, {
        stageId: parsed.stageId ?? current.stageId,
        pipelineId: parsed.pipelineId ?? current.pipelineId,
        contactId: parsed.contactId ?? current.contactId,
        companyId: parsed.companyId ?? current.companyId,
      })

      const patch: Partial<DealRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.title !== undefined) patch.title = parsed.title
      if (parsed.value !== undefined) patch.value = parsed.value
      if (parsed.currency !== undefined) patch.currency = parsed.currency
      if (parsed.stageId !== undefined || parsed.pipelineId !== undefined) {
        patch.stageId = graph.stageId
        patch.pipelineId = graph.pipelineId
      }
      if (parsed.probability !== undefined) patch.probability = parsed.probability
      if (parsed.expectedCloseDate !== undefined) patch.expectedCloseDate = parsed.expectedCloseDate
      if (parsed.contactId !== undefined) patch.contactId = parsed.contactId ?? null
      if (parsed.companyId !== undefined) patch.companyId = parsed.companyId ?? null
      if (parsed.assignedToUserId !== undefined) patch.assignedToUserId = parsed.assignedToUserId ?? null
      if (parsed.status !== undefined) patch.status = parsed.status
      if (parsed.wonAt !== undefined) patch.wonAt = parsed.wonAt ?? null
      if (parsed.lostAt !== undefined) patch.lostAt = parsed.lostAt ?? null
      if (parsed.lostReason !== undefined) patch.lostReason = parsed.lostReason ?? null
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(await deps.deals.update(ctx, id, patch), `Deal ${id} not found`)
    },
    async delete(ctx, id) {
      const deleted = await deps.deals.delete(ctx, id)
      if (!deleted) {
        throw new Error(`Deal ${id} not found`)
      }
    },
    async list(ctx, query) {
      return deps.deals.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.deals.search(ctx, query)
    },
  }
}
