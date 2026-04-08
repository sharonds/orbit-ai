import type { TransactionScope } from '../../adapters/interface.js'
import { generateId } from '../../ids/generate-id.js'
import type { EntityService } from '../../services/entity-service.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SequenceEventRepository } from '../sequence-events/repository.js'
import type { SequenceRepository } from '../sequences/repository.js'
import type { SequenceStepRepository } from './repository.js'
import {
  sequenceStepCreateInputSchema,
  sequenceStepRecordSchema,
  sequenceStepUpdateInputSchema,
  type SequenceStepCreateInput,
  type SequenceStepRecord,
  type SequenceStepUpdateInput,
} from './validators.js'

async function assertSequenceExists(
  ctx: Parameters<EntityService<SequenceStepCreateInput, SequenceStepUpdateInput, SequenceStepRecord>['create']>[0],
  sequences: SequenceRepository,
  sequenceId: string,
): Promise<void> {
  const sequence = await sequences.get(ctx, sequenceId)
  if (!sequence) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `Sequence ${sequenceId} not found for sequence step`,
    })
  }
}

async function assertUniqueStepOrder(
  ctx: Parameters<EntityService<SequenceStepCreateInput, SequenceStepUpdateInput, SequenceStepRecord>['create']>[0],
  repository: SequenceStepRepository,
  sequenceId: string,
  stepOrder: number,
  currentId?: string,
): Promise<void> {
  const existing = await repository.list(ctx, {
    filter: {
      sequence_id: sequenceId,
      step_order: stepOrder,
    },
    limit: 2,
  })

  const conflict = existing.data.find((record) => record.id !== currentId)
  if (conflict) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Sequence step order ${stepOrder} already exists for sequence ${sequenceId}`,
      field: 'stepOrder',
    })
  }
}

function coerceSequenceStepConflict(error: unknown, sequenceId: string, stepOrder: number): never {
  if (
    error instanceof Error &&
    (
      error.message.includes('sequence_steps_order_idx') ||
      (error.message.toLowerCase().includes('unique') &&
        (error.message.includes('sequence_id') || error.message.includes('step_order')))
    )
  ) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Sequence step order ${stepOrder} already exists for sequence ${sequenceId}`,
      field: 'stepOrder',
    })
  }

  throw error
}

async function assertStepHistoryMutable(
  ctx: Parameters<EntityService<SequenceStepCreateInput, SequenceStepUpdateInput, SequenceStepRecord>['create']>[0],
  sequenceEvents: SequenceEventRepository,
  stepId: string,
  action: 'reparent' | 'delete',
): Promise<void> {
  const events = await sequenceEvents.list(ctx, {
    filter: {
      sequence_step_id: stepId,
    },
    limit: 1,
  })

  if (events.data.length > 0) {
    throw createOrbitError({
      code: 'CONFLICT',
      message:
        action === 'reparent'
          ? `Sequence step ${stepId} cannot change sequences after history exists`
          : `Sequence step ${stepId} cannot be deleted while history exists`,
      field: 'id',
    })
  }
}

export function createSequenceStepService(deps: {
  sequenceSteps: SequenceStepRepository
  sequences: SequenceRepository
  sequenceEvents: SequenceEventRepository
  tx: TransactionScope
}): EntityService<SequenceStepCreateInput, SequenceStepUpdateInput, SequenceStepRecord> {
  return {
    async create(ctx, input) {
      const parsed = sequenceStepCreateInputSchema.parse(input)
      // Sequence existence read stays outside the rebound view — the FK
      // on sequence_steps.sequence_id catches a deletion race at insert.
      await assertSequenceExists(ctx, deps.sequences, parsed.sequenceId)

      const now = new Date()
      // Wrap the (sequence_id, step_order) uniqueness check + insert in
      // one transaction. `sequence_steps_order_idx` is the race-decider.
      return deps.tx.run(ctx, async (txDb) => {
        const txSequenceSteps = deps.sequenceSteps.withDatabase(txDb)
        await assertUniqueStepOrder(ctx, txSequenceSteps, parsed.sequenceId, parsed.stepOrder)

        try {
          return await txSequenceSteps.create(
            ctx,
            sequenceStepRecordSchema.parse({
              id: generateId('sequenceStep'),
              organizationId: ctx.orgId,
              sequenceId: parsed.sequenceId,
              stepOrder: parsed.stepOrder,
              actionType: parsed.actionType,
              delayMinutes: parsed.delayMinutes ?? 0,
              templateSubject: parsed.templateSubject ?? null,
              templateBody: parsed.templateBody ?? null,
              taskTitle: parsed.taskTitle ?? null,
              taskDescription: parsed.taskDescription ?? null,
              metadata: parsed.metadata ?? {},
              createdAt: now,
              updatedAt: now,
            }),
          )
        } catch (error) {
          coerceSequenceStepConflict(error, parsed.sequenceId, parsed.stepOrder)
        }
      })
    },
    async get(ctx, id) {
      return deps.sequenceSteps.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = sequenceStepUpdateInputSchema.parse(input)
      // Sequence existence read stays outside the rebound view —
      // FK on sequence_steps.sequence_id catches deletion races at update.
      if (parsed.sequenceId !== undefined) {
        await assertSequenceExists(ctx, deps.sequences, parsed.sequenceId)
      }

      // Phase 2 gate fix: the `current` get and the
      // assertStepHistoryMutable check (which decides whether a step
      // can be reparented based on whether any history events exist)
      // both run inside the rebound view. Reading current outside the
      // tx let two concurrent updates both pass the history-mutability
      // guard against the same stale event count.
      return deps.tx.run(ctx, async (txDb) => {
        const txSequenceSteps = deps.sequenceSteps.withDatabase(txDb)
        const current = assertFound(
          await txSequenceSteps.get(ctx, id),
          `Sequence step ${id} not found`,
        )
        const nextSequenceId = parsed.sequenceId ?? current.sequenceId
        const nextStepOrder = parsed.stepOrder ?? current.stepOrder

        if (parsed.sequenceId !== undefined && parsed.sequenceId !== current.sequenceId) {
          await assertStepHistoryMutable(ctx, deps.sequenceEvents, id, 'reparent')
        }

        await assertUniqueStepOrder(ctx, txSequenceSteps, nextSequenceId, nextStepOrder, id)

        const patch: Partial<SequenceStepRecord> = {
          updatedAt: new Date(),
        }

        if (parsed.sequenceId !== undefined) patch.sequenceId = parsed.sequenceId
        if (parsed.stepOrder !== undefined) patch.stepOrder = parsed.stepOrder
        if (parsed.actionType !== undefined) patch.actionType = parsed.actionType
        if (parsed.delayMinutes !== undefined) patch.delayMinutes = parsed.delayMinutes
        if (parsed.templateSubject !== undefined) patch.templateSubject = parsed.templateSubject ?? null
        if (parsed.templateBody !== undefined) patch.templateBody = parsed.templateBody ?? null
        if (parsed.taskTitle !== undefined) patch.taskTitle = parsed.taskTitle ?? null
        if (parsed.taskDescription !== undefined) patch.taskDescription = parsed.taskDescription ?? null
        if (parsed.metadata !== undefined) patch.metadata = parsed.metadata

        try {
          return assertFound(await txSequenceSteps.update(ctx, id, patch), `Sequence step ${id} not found`)
        } catch (error) {
          coerceSequenceStepConflict(error, nextSequenceId, nextStepOrder)
        }
      })
    },
    async delete(ctx, id) {
      await assertStepHistoryMutable(ctx, deps.sequenceEvents, id, 'delete')
      assertDeleted(await deps.sequenceSteps.delete(ctx, id), `Sequence step ${id} not found`)
    },
    async list(ctx, query) {
      return deps.sequenceSteps.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.sequenceSteps.search(ctx, query)
    },
  }
}
