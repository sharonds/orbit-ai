import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import type { PipelineRepository } from './repository.js'
import {
  pipelineCreateInputSchema,
  pipelineRecordSchema,
  pipelineUpdateInputSchema,
  type PipelineCreateInput,
  type PipelineRecord,
  type PipelineUpdateInput,
} from './validators.js'

export function createPipelineService(repository: PipelineRepository): EntityService<PipelineCreateInput, PipelineUpdateInput, PipelineRecord> {
  return {
    async create(ctx, input) {
      const parsed = pipelineCreateInputSchema.parse(input)
      const now = new Date()

      return repository.create(
        ctx,
        pipelineRecordSchema.parse({
          id: generateId('pipeline'),
          organizationId: ctx.orgId,
          name: parsed.name,
          description: parsed.description ?? null,
          isDefault: parsed.isDefault ?? false,
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = pipelineUpdateInputSchema.parse(input)
      assertFound(await repository.get(ctx, id), `Pipeline ${id} not found`)

      const patch: Partial<PipelineRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.description !== undefined) patch.description = parsed.description
      if (parsed.isDefault !== undefined) patch.isDefault = parsed.isDefault

      return assertFound(await repository.update(ctx, id, patch), `Pipeline ${id} not found`)
    },
    async delete(ctx, id) {
      assertDeleted(await repository.delete(ctx, id), `Pipeline ${id} not found`)
    },
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async search(ctx, query) {
      return repository.search(ctx, query)
    },
  }
}
