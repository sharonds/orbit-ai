import { generateId } from '../../ids/generate-id.js'
import type { OrbitAuthContext } from '../../adapters/interface.js'
import { assertFound } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import { createOrbitError } from '../../types/errors.js'
import type { SequenceEnrollmentRepository } from '../sequence-enrollments/repository.js'
import type { SequenceStepRepository } from '../sequence-steps/repository.js'
import type { SequenceEventRepository } from './repository.js'
import { sequenceEventCreateInputSchema, sequenceEventRecordSchema, type SequenceEventCreateInput, type SequenceEventRecord } from './validators.js'

export interface SequenceEventService {
  create(ctx: OrbitAuthContext, input: SequenceEventCreateInput): Promise<SequenceEventRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SequenceEventRecord | null>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceEventRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceEventRecord>>
}

async function assertSequenceEventRelations(
  ctx: OrbitAuthContext,
  deps: {
    sequenceEnrollments: SequenceEnrollmentRepository
    sequenceSteps: SequenceStepRepository
  },
  input: {
    sequenceEnrollmentId: string
    sequenceStepId?: string | null | undefined
  },
): Promise<void> {
  const enrollment = await deps.sequenceEnrollments.get(ctx, input.sequenceEnrollmentId)
  if (!enrollment) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `Sequence enrollment ${input.sequenceEnrollmentId} not found for sequence event`,
    })
  }

  if (input.sequenceStepId !== undefined && input.sequenceStepId !== null) {
    const step = await deps.sequenceSteps.get(ctx, input.sequenceStepId)
    if (!step) {
      throw createOrbitError({
        code: 'RELATION_NOT_FOUND',
        message: `Sequence step ${input.sequenceStepId} not found for sequence event`,
      })
    }

    if (step.sequenceId !== enrollment.sequenceId) {
      throw createOrbitError({
        code: 'VALIDATION_FAILED',
        message: 'Sequence event step must belong to the same sequence as the enrollment',
        field: 'sequenceStepId',
      })
    }
  }
}

export function createSequenceEventService(deps: {
  sequenceEvents: SequenceEventRepository
  sequenceEnrollments: SequenceEnrollmentRepository
  sequenceSteps: SequenceStepRepository
}): SequenceEventService {
  return {
    async create(ctx, input) {
      const parsed = sequenceEventCreateInputSchema.parse(input)
      await assertSequenceEventRelations(ctx, deps, {
        sequenceEnrollmentId: parsed.sequenceEnrollmentId,
        sequenceStepId: parsed.sequenceStepId,
      })
      const now = new Date()

      return deps.sequenceEvents.create(
        ctx,
        sequenceEventRecordSchema.parse({
          id: generateId('sequenceEvent'),
          organizationId: ctx.orgId,
          sequenceEnrollmentId: parsed.sequenceEnrollmentId,
          sequenceStepId: parsed.sequenceStepId ?? null,
          eventType: parsed.eventType,
          payload: parsed.payload ?? {},
          occurredAt: parsed.occurredAt ?? now,
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.sequenceEvents.get(ctx, id)
    },
    async list(ctx, query) {
      return deps.sequenceEvents.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.sequenceEvents.search(ctx, query)
    },
  }
}
