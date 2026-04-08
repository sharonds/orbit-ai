import type { TransactionScope } from '../../adapters/interface.js'
import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import { createOrbitError } from '../../types/errors.js'
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

/**
 * Graph validation for create/update. Accepts a `graphDeps` bundle so the
 * caller can pass REBOUND repositories (inside a transaction) or the outer
 * unbound ones (in create, where no transaction is open). The cross-entity
 * "stage belongs to pipeline" check is NOT backed by a composite FK, so it
 * must run in the same transaction as the write or a concurrent stage move
 * can silently invalidate the validated graph.
 */
async function resolveDealGraph(
  ctx: Parameters<EntityService<DealCreateInput, DealUpdateInput, DealRecord>['create']>[0],
  graphDeps: {
    pipelines: PipelineRepository
    stages: StageRepository
    contacts: ContactRepository
    companies: CompanyRepository
  },
  input: {
    stageId?: string | null | undefined
    pipelineId?: string | null | undefined
    contactId?: string | null | undefined
    companyId?: string | null | undefined
  },
  current?: {
    stageId: string | null | undefined
    pipelineId: string | null | undefined
  },
): Promise<{ stageId: string | null; pipelineId: string | null }> {
  function relationNotFound(message: string) {
    return createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message,
    })
  }

  function validationFailed(message: string) {
    return createOrbitError({
      code: 'VALIDATION_FAILED',
      message,
    })
  }

  const pipelineChanged = input.pipelineId !== undefined && input.pipelineId !== current?.pipelineId
  let nextStageId = current?.stageId ?? null
  let nextPipelineId = current?.pipelineId ?? null

  if (input.stageId !== undefined) {
    nextStageId = input.stageId
  }

  if (input.pipelineId !== undefined) {
    nextPipelineId = input.pipelineId
  }

  if (input.pipelineId === null && input.stageId === undefined && current?.stageId) {
    throw validationFailed('Deal stage must be cleared or replaced when clearing pipeline')
  }

  if (pipelineChanged && input.stageId === undefined && current?.stageId) {
    throw validationFailed('Deal stage must be provided when changing pipeline')
  }

  if (nextStageId !== null) {
    const stage = await graphDeps.stages.get(ctx, nextStageId)
    if (!stage) {
      throw relationNotFound(`Stage ${nextStageId} not found for deal`)
    }

    if (nextPipelineId && stage.pipelineId !== nextPipelineId) {
      throw validationFailed(`Stage ${nextStageId} does not belong to pipeline ${nextPipelineId}`)
    }

    nextPipelineId = stage.pipelineId
  }

  if (nextPipelineId) {
    const pipeline = await graphDeps.pipelines.get(ctx, nextPipelineId)
    if (!pipeline) {
      throw relationNotFound(`Pipeline ${nextPipelineId} not found for deal`)
    }
  }

  if (input.contactId !== undefined && input.contactId !== null) {
    const contact = await graphDeps.contacts.get(ctx, input.contactId)
    if (!contact) {
      throw relationNotFound(`Contact ${input.contactId} not found for deal`)
    }
  }

  if (input.companyId !== undefined && input.companyId !== null) {
    const company = await graphDeps.companies.get(ctx, input.companyId)
    if (!company) {
      throw relationNotFound(`Company ${input.companyId} not found for deal`)
    }
  }

  return {
    stageId: nextStageId,
    pipelineId: nextPipelineId,
  }
}

export function createDealService(deps: {
  deals: DealRepository
  pipelines: PipelineRepository
  stages: StageRepository
  contacts: ContactRepository
  companies: CompanyRepository
  tx: TransactionScope
}): EntityService<DealCreateInput, DealUpdateInput, DealRecord> {
  function relationNotFound(message: string) {
    return createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message,
    })
  }

  return {
    async create(ctx, input) {
      const parsed = dealCreateInputSchema.parse(input)
      const graph = await resolveDealGraph(ctx, deps, {
        stageId: parsed.stageId,
        pipelineId: parsed.pipelineId,
        contactId: parsed.contactId,
        companyId: parsed.companyId,
      })

      const now = new Date()
      return deps.deals.create(
        ctx,
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
      // M7 (+ Codex follow-up): read the current deal, validate the
      // next graph state (stage belongs to pipeline, pipeline exists,
      // contact exists, company exists), and write — all inside one
      // transaction using REBOUND repos so a concurrent stage move or
      // relation delete cannot invalidate the validation between read
      // and write. The "stage belongs to pipeline" invariant is a
      // cross-entity consistency check with no backing composite FK, so
      // it MUST be read through the rebound view.
      return deps.tx.run(ctx, async (txDb) => {
        const txDeals = deps.deals.withDatabase(txDb)
        const txGraphDeps = {
          pipelines: deps.pipelines.withDatabase(txDb),
          stages: deps.stages.withDatabase(txDb),
          contacts: deps.contacts.withDatabase(txDb),
          companies: deps.companies.withDatabase(txDb),
        }
        const current = assertFound(await txDeals.get(ctx, id), `Deal ${id} not found`)
        const patch: Partial<DealRecord> = {
          updatedAt: new Date(),
        }

        if (parsed.stageId !== undefined || parsed.pipelineId !== undefined) {
          const graph = await resolveDealGraph(
            ctx,
            txGraphDeps,
            {
              stageId: parsed.stageId,
              pipelineId: parsed.pipelineId,
            },
            {
              stageId: current.stageId,
              pipelineId: current.pipelineId,
            },
          )

          patch.stageId = graph.stageId
          patch.pipelineId = graph.pipelineId
        }

        if (parsed.contactId !== undefined && parsed.contactId !== null) {
          const contact = await txGraphDeps.contacts.get(ctx, parsed.contactId)
          if (!contact) {
            throw relationNotFound(`Contact ${parsed.contactId} not found for deal`)
          }
        }

        if (parsed.companyId !== undefined && parsed.companyId !== null) {
          const company = await txGraphDeps.companies.get(ctx, parsed.companyId)
          if (!company) {
            throw relationNotFound(`Company ${parsed.companyId} not found for deal`)
          }
        }

        if (parsed.title !== undefined) patch.title = parsed.title
        if (parsed.value !== undefined) patch.value = parsed.value
        if (parsed.currency !== undefined) patch.currency = parsed.currency
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

        return assertFound(await txDeals.update(ctx, id, patch), `Deal ${id} not found`)
      })
    },
    async delete(ctx, id) {
      assertDeleted(await deps.deals.delete(ctx, id), `Deal ${id} not found`)
    },
    async list(ctx, query) {
      return deps.deals.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.deals.search(ctx, query)
    },
  }
}
