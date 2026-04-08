import type { TransactionScope } from '../../adapters/interface.js'
import { generateId } from '../../ids/generate-id.js'
import type { EntityService } from '../../services/entity-service.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SequenceEnrollmentRepository } from '../sequence-enrollments/repository.js'
import type { SequenceStepRepository } from '../sequence-steps/repository.js'
import type { SequenceRepository } from './repository.js'
import {
  sequenceCreateInputSchema,
  sequenceRecordSchema,
  sequenceUpdateInputSchema,
  type SequenceCreateInput,
  type SequenceRecord,
  type SequenceUpdateInput,
} from './validators.js'

async function assertSequenceDeleteAllowed(
  ctx: Parameters<EntityService<SequenceCreateInput, SequenceUpdateInput, SequenceRecord>['create']>[0],
  deps: {
    sequenceSteps: SequenceStepRepository
    sequenceEnrollments: SequenceEnrollmentRepository
  },
  sequenceId: string,
): Promise<void> {
  const [steps, enrollments] = await Promise.all([
    deps.sequenceSteps.list(ctx, {
      filter: {
        sequence_id: sequenceId,
      },
      limit: 1,
    }),
    deps.sequenceEnrollments.list(ctx, {
      filter: {
        sequence_id: sequenceId,
      },
      limit: 1,
    }),
  ])

  if (steps.data.length > 0 || enrollments.data.length > 0) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Sequence ${sequenceId} cannot be deleted while steps or enrollments exist`,
      field: 'id',
    })
  }
}

async function assertUniqueSequenceName(
  ctx: Parameters<EntityService<SequenceCreateInput, SequenceUpdateInput, SequenceRecord>['create']>[0],
  repository: SequenceRepository,
  name: string,
  currentId?: string,
): Promise<void> {
  const existing = await repository.list(ctx, {
    filter: {
      name,
    },
    limit: 2,
  })

  const conflict = existing.data.find((record) => record.id !== currentId)
  if (conflict) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Sequence name ${name} already exists in this organization`,
      field: 'name',
    })
  }
}

function coerceSequenceConflict(error: unknown, name: string): never {
  if (
    error instanceof Error &&
    (
      error.message.includes('sequences_org_name_idx') ||
      (error.message.toLowerCase().includes('unique') &&
        (error.message.includes('organization_id') || error.message.includes('organizationId')) &&
        error.message.includes('name'))
    )
  ) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Sequence name ${name} already exists in this organization`,
      field: 'name',
    })
  }

  throw error
}

export function createSequenceService(deps: {
  sequences: SequenceRepository
  sequenceSteps: SequenceStepRepository
  sequenceEnrollments: SequenceEnrollmentRepository
  tx: TransactionScope
}): EntityService<SequenceCreateInput, SequenceUpdateInput, SequenceRecord> {
  return {
    async create(ctx, input) {
      const parsed = sequenceCreateInputSchema.parse(input)
      const now = new Date()
      // Wrap the uniqueness check + insert in one transaction so a concurrent
      // create cannot slip in between the check and the write. The DB unique
      // index `sequences_org_name_idx` is the source of truth and will fire if
      // a true race makes it past the application-level guard; we then coerce
      // its error into the typed CONFLICT response.
      return deps.tx.run(ctx, async (txDb) => {
        const txSequences = deps.sequences.withDatabase(txDb)
        await assertUniqueSequenceName(ctx, txSequences, parsed.name)

        try {
          return await txSequences.create(
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
        } catch (error) {
          coerceSequenceConflict(error, parsed.name)
        }
      })
    },
    async get(ctx, id) {
      return deps.sequences.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = sequenceUpdateInputSchema.parse(input)
      return deps.tx.run(ctx, async (txDb) => {
        const txSequences = deps.sequences.withDatabase(txDb)
        const current = assertFound(await txSequences.get(ctx, id), `Sequence ${id} not found`)
        const nextName = parsed.name ?? current.name
        await assertUniqueSequenceName(ctx, txSequences, nextName, id)

        const patch: Partial<SequenceRecord> = {
          updatedAt: new Date(),
        }

        if (parsed.name !== undefined) patch.name = parsed.name
        if (parsed.description !== undefined) patch.description = parsed.description ?? null
        if (parsed.triggerEvent !== undefined) patch.triggerEvent = parsed.triggerEvent ?? null
        if (parsed.status !== undefined) patch.status = parsed.status
        if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

        try {
          return assertFound(await txSequences.update(ctx, id, patch), `Sequence ${id} not found`)
        } catch (error) {
          coerceSequenceConflict(error, nextName)
        }
      })
    },
    async delete(ctx, id) {
      await assertSequenceDeleteAllowed(ctx, deps, id)
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
