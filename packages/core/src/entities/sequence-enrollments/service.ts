import { generateId } from '../../ids/generate-id.js'
import type { EntityService } from '../../services/entity-service.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { ContactRepository } from '../contacts/repository.js'
import type { SequenceEventRepository } from '../sequence-events/repository.js'
import type { SequenceRepository } from '../sequences/repository.js'
import type { SequenceEnrollmentRepository } from './repository.js'
import {
  sequenceEnrollmentCreateInputSchema,
  sequenceEnrollmentRecordSchema,
  sequenceEnrollmentUpdateInputSchema,
  type SequenceEnrollmentCreateInput,
  type SequenceEnrollmentRecord,
  type SequenceEnrollmentUpdateInput,
} from './validators.js'

async function assertEnrollmentRelations(
  ctx: Parameters<EntityService<SequenceEnrollmentCreateInput, SequenceEnrollmentUpdateInput, SequenceEnrollmentRecord>['create']>[0],
  deps: {
    sequences: SequenceRepository
    contacts: ContactRepository
  },
  input: {
    sequenceId?: string | undefined
    contactId?: string | undefined
  },
): Promise<void> {
  if (input.sequenceId !== undefined) {
    const sequence = await deps.sequences.get(ctx, input.sequenceId)
    if (!sequence) {
      throw createOrbitError({
        code: 'RELATION_NOT_FOUND',
        message: `Sequence ${input.sequenceId} not found for sequence enrollment`,
      })
    }
  }

  if (input.contactId !== undefined) {
    const contact = await deps.contacts.get(ctx, input.contactId)
    if (!contact) {
      throw createOrbitError({
        code: 'RELATION_NOT_FOUND',
        message: `Contact ${input.contactId} not found for sequence enrollment`,
      })
    }
  }
}

async function assertUniqueEnrollmentShape(
  ctx: Parameters<EntityService<SequenceEnrollmentCreateInput, SequenceEnrollmentUpdateInput, SequenceEnrollmentRecord>['create']>[0],
  repository: SequenceEnrollmentRepository,
  sequenceId: string,
  contactId: string,
  status: string,
  currentId?: string,
): Promise<void> {
  const existing = await repository.list(ctx, {
    filter: {
      sequence_id: sequenceId,
      contact_id: contactId,
      status,
    },
    limit: 2,
  })

  const conflict = existing.data.find((record) => record.id !== currentId)
  if (conflict) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Sequence enrollment already exists for sequence ${sequenceId}, contact ${contactId}, status ${status}`,
      field: 'status',
    })
  }
}

function assertEnrollmentState(input: {
  status: string
  exitedAt: Date | null
  exitReason: string | null
}): void {
  if (input.status === 'active' && input.exitedAt !== null) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: 'Active sequence enrollment cannot have exitedAt',
      field: 'exitedAt',
    })
  }

  if (input.exitReason !== null && input.exitedAt === null) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: 'Sequence enrollment exitReason requires exitedAt',
      field: 'exitReason',
    })
  }
}

function coerceSequenceEnrollmentConflict(
  error: unknown,
  sequenceId: string,
  contactId: string,
  status: string,
): never {
  if (
    error instanceof Error &&
    (
      error.message.includes('sequence_enrollments_active_idx') ||
      (error.message.toLowerCase().includes('unique') &&
        error.message.includes('sequence_id') &&
        error.message.includes('contact_id') &&
        error.message.includes('status'))
    )
  ) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Sequence enrollment already exists for sequence ${sequenceId}, contact ${contactId}, status ${status}`,
      field: 'status',
    })
  }

  throw error
}

async function assertEnrollmentHistoryMutable(
  ctx: Parameters<EntityService<SequenceEnrollmentCreateInput, SequenceEnrollmentUpdateInput, SequenceEnrollmentRecord>['create']>[0],
  sequenceEvents: SequenceEventRepository,
  enrollmentId: string,
  action: 'reparent' | 'delete',
): Promise<void> {
  const events = await sequenceEvents.list(ctx, {
    filter: {
      sequence_enrollment_id: enrollmentId,
    },
    limit: 1,
  })

  if (events.data.length > 0) {
    throw createOrbitError({
      code: 'CONFLICT',
      message:
        action === 'reparent'
          ? `Sequence enrollment ${enrollmentId} cannot change sequence or contact after history exists`
          : `Sequence enrollment ${enrollmentId} cannot be deleted while history exists`,
      field: 'id',
    })
  }
}

export function createSequenceEnrollmentService(deps: {
  sequenceEnrollments: SequenceEnrollmentRepository
  sequences: SequenceRepository
  contacts: ContactRepository
  sequenceEvents: SequenceEventRepository
}): EntityService<SequenceEnrollmentCreateInput, SequenceEnrollmentUpdateInput, SequenceEnrollmentRecord> {
  return {
    async create(ctx, input) {
      const parsed = sequenceEnrollmentCreateInputSchema.parse(input)
      await assertEnrollmentRelations(ctx, deps, {
        sequenceId: parsed.sequenceId,
        contactId: parsed.contactId,
      })
      const now = new Date()
      const status = parsed.status ?? 'active'
      const exitedAt = parsed.exitedAt ?? null
      const exitReason = parsed.exitReason ?? null
      assertEnrollmentState({
        status,
        exitedAt,
        exitReason,
      })
      await assertUniqueEnrollmentShape(ctx, deps.sequenceEnrollments, parsed.sequenceId, parsed.contactId, status)

      try {
        return await deps.sequenceEnrollments.create(
          ctx,
          sequenceEnrollmentRecordSchema.parse({
            id: generateId('sequenceEnrollment'),
            organizationId: ctx.orgId,
            sequenceId: parsed.sequenceId,
            contactId: parsed.contactId,
            status,
            currentStepOrder: parsed.currentStepOrder ?? 0,
            enrolledAt: parsed.enrolledAt ?? now,
            exitedAt,
            exitReason,
            createdAt: now,
            updatedAt: now,
          }),
        )
      } catch (error) {
        coerceSequenceEnrollmentConflict(error, parsed.sequenceId, parsed.contactId, status)
      }
    },
    async get(ctx, id) {
      return deps.sequenceEnrollments.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = sequenceEnrollmentUpdateInputSchema.parse(input)
      const current = assertFound(await deps.sequenceEnrollments.get(ctx, id), `Sequence enrollment ${id} not found`)
      const nextSequenceId = parsed.sequenceId ?? current.sequenceId
      const nextContactId = parsed.contactId ?? current.contactId
      const nextStatus = parsed.status ?? current.status
      const nextExitedAt = parsed.exitedAt !== undefined ? parsed.exitedAt ?? null : current.exitedAt
      const nextExitReason = parsed.exitReason !== undefined ? parsed.exitReason ?? null : current.exitReason

      if (
        (parsed.sequenceId !== undefined && parsed.sequenceId !== current.sequenceId) ||
        (parsed.contactId !== undefined && parsed.contactId !== current.contactId)
      ) {
        await assertEnrollmentHistoryMutable(ctx, deps.sequenceEvents, id, 'reparent')
      }

      await assertEnrollmentRelations(ctx, deps, {
        sequenceId: parsed.sequenceId,
        contactId: parsed.contactId,
      })
      assertEnrollmentState({
        status: nextStatus,
        exitedAt: nextExitedAt,
        exitReason: nextExitReason,
      })
      await assertUniqueEnrollmentShape(ctx, deps.sequenceEnrollments, nextSequenceId, nextContactId, nextStatus, id)

      const patch: Partial<SequenceEnrollmentRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.sequenceId !== undefined) patch.sequenceId = parsed.sequenceId
      if (parsed.contactId !== undefined) patch.contactId = parsed.contactId
      if (parsed.status !== undefined) patch.status = parsed.status
      if (parsed.currentStepOrder !== undefined) patch.currentStepOrder = parsed.currentStepOrder
      if (parsed.enrolledAt !== undefined) patch.enrolledAt = parsed.enrolledAt
      if (parsed.exitedAt !== undefined) patch.exitedAt = parsed.exitedAt ?? null
      if (parsed.exitReason !== undefined) patch.exitReason = parsed.exitReason ?? null

      try {
        return assertFound(await deps.sequenceEnrollments.update(ctx, id, patch), `Sequence enrollment ${id} not found`)
      } catch (error) {
        coerceSequenceEnrollmentConflict(error, nextSequenceId, nextContactId, nextStatus)
      }
    },
    async delete(ctx, id) {
      await assertEnrollmentHistoryMutable(ctx, deps.sequenceEvents, id, 'delete')
      assertDeleted(await deps.sequenceEnrollments.delete(ctx, id), `Sequence enrollment ${id} not found`)
    },
    async list(ctx, query) {
      return deps.sequenceEnrollments.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.sequenceEnrollments.search(ctx, query)
    },
  }
}
