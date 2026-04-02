import { generateId } from '../../ids/generate-id.js'
import type { EntityService } from '../../services/entity-service.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { SequenceRepository } from './repository.js'
import {
  sequenceCreateInputSchema,
  sequenceRecordSchema,
  sequenceUpdateInputSchema,
  type SequenceCreateInput,
  type SequenceRecord,
  type SequenceUpdateInput,
} from './validators.js'

export function createSequenceService(deps: {
  sequences: SequenceRepository
}): EntityService<SequenceCreateInput, SequenceUpdateInput, SequenceRecord> {
  return {
    async create(ctx, input) {
      const parsed = sequenceCreateInputSchema.parse(input)
      const now = new Date()

      return deps.sequences.create(
        ctx,
        sequenceRecordSchema.parse({
          id: generateId('sequence'),
          organizationId: ctx.orgId,
          name: parsed.name,
          description: parsed.description ?? null,
          triggerEvent: parsed.triggerEvent ?? null,
          status: parsed.status ?? 'draft',
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.sequences.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = sequenceUpdateInputSchema.parse(input)
      assertFound(await deps.sequences.get(ctx, id), `Sequence ${id} not found`)

      const patch: Partial<SequenceRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.description !== undefined) patch.description = parsed.description ?? null
      if (parsed.triggerEvent !== undefined) patch.triggerEvent = parsed.triggerEvent ?? null
      if (parsed.status !== undefined) patch.status = parsed.status
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(await deps.sequences.update(ctx, id, patch), `Sequence ${id} not found`)
    },
    async delete(ctx, id) {
      assertDeleted(await deps.sequences.delete(ctx, id), `Sequence ${id} not found`)
    },
    async list(ctx, query) {
      return deps.sequences.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.sequences.search(ctx, query)
    },
  }
}
