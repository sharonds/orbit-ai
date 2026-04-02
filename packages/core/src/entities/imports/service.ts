import { generateId } from '../../ids/generate-id.js'
import type { OrbitAuthContext } from '../../adapters/interface.js'
import { assertFound } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'
import type { UserRepository } from '../users/repository.js'
import type { ImportRepository } from './repository.js'
import {
  importCreateInputSchema,
  importRecordSchema,
  importUpdateInputSchema,
  type ImportCreateInput,
  type ImportRecord,
  type ImportUpdateInput,
  type SanitizedImportRecord,
  sanitizeImportRecord,
} from './validators.js'

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing'],
  processing: ['completed', 'failed'],
}
const TERMINAL_IMPORT_STATUSES = new Set<ImportRecord['status']>(['completed', 'failed'])

function assertValidStatusTransition(currentStatus: string, newStatus: string): void {
  if (currentStatus === newStatus) {
    return
  }

  const allowed = VALID_STATUS_TRANSITIONS[currentStatus]
  if (!allowed || !allowed.includes(newStatus)) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
      field: 'status',
    })
  }
}

async function assertStartedByUserIdInTenant(
  ctx: OrbitAuthContext,
  users: UserRepository,
  startedByUserId: string,
): Promise<void> {
  const user = await users.get(ctx, startedByUserId)
  if (!user) {
    throw createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message: `User ${startedByUserId} not found in this organization`,
    })
  }
}

export interface ImportService {
  create(ctx: OrbitAuthContext, input: ImportCreateInput): Promise<SanitizedImportRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SanitizedImportRecord | null>
  update(ctx: OrbitAuthContext, id: string, input: ImportUpdateInput): Promise<SanitizedImportRecord>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SanitizedImportRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SanitizedImportRecord>>
}

export function createImportService(deps: {
  imports: ImportRepository
  users: UserRepository
}): ImportService {
  return {
    async create(ctx, input) {
      const parsed = importCreateInputSchema.parse(input)
      const now = new Date()

      if (parsed.startedByUserId) {
        await assertStartedByUserIdInTenant(ctx, deps.users, parsed.startedByUserId)
      }

      const record = await deps.imports.create(
        ctx,
        importRecordSchema.parse({
          id: generateId('importJob'),
          organizationId: ctx.orgId,
          entityType: parsed.entityType,
          fileName: parsed.fileName,
          totalRows: parsed.totalRows ?? 0,
          createdRows: 0,
          updatedRows: 0,
          skippedRows: 0,
          failedRows: 0,
          status: 'pending',
          rollbackData: {},
          startedByUserId: parsed.startedByUserId ?? null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        }),
      )

      return sanitizeImportRecord(record)
    },
    async get(ctx, id) {
      const record = await deps.imports.get(ctx, id)
      return record ? sanitizeImportRecord(record) : null
    },
    async update(ctx, id, input) {
      const parsed = importUpdateInputSchema.parse(input)
      const current = assertFound(await deps.imports.get(ctx, id), `Import ${id} not found`)
      const nextStatus = parsed.status ?? current.status
      let nextCompletedAt = parsed.completedAt !== undefined ? parsed.completedAt ?? null : current.completedAt

      const patch: Partial<ImportRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.status !== undefined) {
        assertValidStatusTransition(current.status, parsed.status)
        patch.status = parsed.status
      }

      if (parsed.entityType !== undefined) patch.entityType = parsed.entityType
      if (parsed.fileName !== undefined) patch.fileName = parsed.fileName

      const counterFields = ['totalRows', 'createdRows', 'updatedRows', 'skippedRows', 'failedRows'] as const
      for (const field of counterFields) {
        if (parsed[field] !== undefined) {
          if (parsed[field]! < 0) {
            throw createOrbitError({
              code: 'VALIDATION_FAILED',
              message: `${field} must be non-negative`,
              field,
            })
          }
          patch[field] = parsed[field]
        }
      }

      if (parsed.startedByUserId !== undefined) {
        if (parsed.startedByUserId) {
          await assertStartedByUserIdInTenant(ctx, deps.users, parsed.startedByUserId)
        }
        patch.startedByUserId = parsed.startedByUserId ?? null
      }

      if (TERMINAL_IMPORT_STATUSES.has(nextStatus)) {
        if (parsed.completedAt === null) {
          throw createOrbitError({
            code: 'VALIDATION_FAILED',
            message: `completedAt is required when import status is '${nextStatus}'`,
            field: 'completedAt',
          })
        }

        if (nextCompletedAt === null) {
          nextCompletedAt = new Date()
        }
      } else if (nextCompletedAt !== null) {
        throw createOrbitError({
          code: 'VALIDATION_FAILED',
          message: `completedAt must be null when import status is '${nextStatus}'`,
          field: 'completedAt',
        })
      }

      if (parsed.completedAt !== undefined || nextCompletedAt !== current.completedAt) {
        patch.completedAt = nextCompletedAt
      }

      const updated = assertFound(await deps.imports.update(ctx, id, patch), `Import ${id} not found`)
      return sanitizeImportRecord(updated)
    },
    async list(ctx, query) {
      const result = await deps.imports.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeImportRecord),
      }
    },
    async search(ctx, query) {
      const result = await deps.imports.search(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeImportRecord),
      }
    },
  }
}
