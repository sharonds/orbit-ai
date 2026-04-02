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
} from './validators.js'

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing'],
  processing: ['completed', 'failed'],
}

function assertValidStatusTransition(currentStatus: string, newStatus: string): void {
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus]
  if (!allowed || !allowed.includes(newStatus)) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
      field: 'status',
    })
  }
}

export interface ImportService {
  create(ctx: OrbitAuthContext, input: ImportCreateInput): Promise<ImportRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<ImportRecord | null>
  update(ctx: OrbitAuthContext, id: string, input: ImportUpdateInput): Promise<ImportRecord>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ImportRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<ImportRecord>>
}

export function createImportService(deps: {
  imports: ImportRepository
  users: UserRepository
}): ImportService {
  return {
    async create(ctx, input) {
      const parsed = importCreateInputSchema.parse(input)
      const now = new Date()

      // Validate startedByUserId if provided
      if (parsed.startedByUserId) {
        const user = await deps.users.get(ctx, parsed.startedByUserId)
        if (!user) {
          throw createOrbitError({
            code: 'RELATION_NOT_FOUND',
            message: `User ${parsed.startedByUserId} not found in this organization`,
          })
        }
      }

      return deps.imports.create(
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
          startedByUserId: parsed.startedByUserId ?? null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.imports.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = importUpdateInputSchema.parse(input)
      const current = assertFound(await deps.imports.get(ctx, id), `Import ${id} not found`)

      const patch: Partial<ImportRecord> = {
        updatedAt: new Date(),
      }

      // Validate status transition
      if (parsed.status !== undefined) {
        assertValidStatusTransition(current.status, parsed.status)
        patch.status = parsed.status

        // Auto-set completedAt when transitioning to completed or failed
        if ((parsed.status === 'completed' || parsed.status === 'failed') && !current.completedAt) {
          patch.completedAt = parsed.completedAt ?? new Date()
        }
      }

      if (parsed.entityType !== undefined) patch.entityType = parsed.entityType
      if (parsed.fileName !== undefined) patch.fileName = parsed.fileName
      if (parsed.totalRows !== undefined) patch.totalRows = parsed.totalRows
      if (parsed.createdRows !== undefined) patch.createdRows = parsed.createdRows
      if (parsed.updatedRows !== undefined) patch.updatedRows = parsed.updatedRows
      if (parsed.skippedRows !== undefined) patch.skippedRows = parsed.skippedRows
      if (parsed.failedRows !== undefined) patch.failedRows = parsed.failedRows
      if (parsed.startedByUserId !== undefined) patch.startedByUserId = parsed.startedByUserId ?? null
      if (parsed.completedAt !== undefined && !patch.completedAt) patch.completedAt = parsed.completedAt ?? null

      return assertFound(await deps.imports.update(ctx, id, patch), `Import ${id} not found`)
    },
    async list(ctx, query) {
      return deps.imports.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.imports.search(ctx, query)
    },
  }
}
