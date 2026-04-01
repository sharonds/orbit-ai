import { generateId } from '../../ids/generate-id.js'
import { assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import type { PipelineRepository } from '../pipelines/repository.js'
import type { StageRepository } from './repository.js'
import {
  stageCreateInputSchema,
  stageRecordSchema,
  stageUpdateInputSchema,
  type StageCreateInput,
  type StageRecord,
  type StageUpdateInput,
} from './validators.js'

export function createStageService(deps: {
  stages: StageRepository
  pipelines: PipelineRepository
}): EntityService<StageCreateInput, StageUpdateInput, StageRecord> {
  return {
    async create(ctx, input) {
      const parsed = stageCreateInputSchema.parse(input)
      const pipeline = await deps.pipelines.get(ctx, parsed.pipelineId)
      if (!pipeline) {
        throw new Error(`Pipeline ${parsed.pipelineId} not found for stage`)
      }

      const now = new Date()
      return deps.stages.create(
        stageRecordSchema.parse({
          id: generateId('stage'),
          organizationId: ctx.orgId,
          pipelineId: parsed.pipelineId,
          name: parsed.name,
          stageOrder: parsed.stageOrder,
          probability: parsed.probability ?? 0,
          color: parsed.color ?? null,
          isWon: parsed.isWon ?? false,
          isLost: parsed.isLost ?? false,
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.stages.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = stageUpdateInputSchema.parse(input)
      const current = assertFound(await deps.stages.get(ctx, id), `Stage ${id} not found`)
      const nextPipelineId = parsed.pipelineId ?? current.pipelineId

      const pipeline = await deps.pipelines.get(ctx, nextPipelineId)
      if (!pipeline) {
        throw new Error(`Pipeline ${nextPipelineId} not found for stage`)
      }

      const patch: Partial<StageRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.pipelineId !== undefined) patch.pipelineId = parsed.pipelineId
      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.stageOrder !== undefined) patch.stageOrder = parsed.stageOrder
      if (parsed.probability !== undefined) patch.probability = parsed.probability
      if (parsed.color !== undefined) patch.color = parsed.color
      if (parsed.isWon !== undefined) patch.isWon = parsed.isWon
      if (parsed.isLost !== undefined) patch.isLost = parsed.isLost

      return assertFound(await deps.stages.update(ctx, id, patch), `Stage ${id} not found`)
    },
    async delete(ctx, id) {
      const deleted = await deps.stages.delete(ctx, id)
      if (!deleted) {
        throw new Error(`Stage ${id} not found`)
      }
    },
    async list(ctx, query) {
      return deps.stages.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.stages.search(ctx, query)
    },
  }
}
