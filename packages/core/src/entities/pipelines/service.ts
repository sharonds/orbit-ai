import type { TransactionScope } from '../../adapters/interface.js'
import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import { createOrbitError } from '../../types/errors.js'
import type { PipelineRepository } from './repository.js'
import {
  pipelineCreateInputSchema,
  pipelineRecordSchema,
  pipelineUpdateInputSchema,
  type PipelineCreateInput,
  type PipelineRecord,
  type PipelineUpdateInput,
} from './validators.js'

/**
 * Translate a DB unique-index violation on `pipelines_org_default_unique_idx`
 * into a typed CONFLICT. The app-level `demoteOtherDefaults` closes the
 * same-transaction race; this coercer handles the case where two
 * concurrent transactions both passed their own demote check and then
 * both tried to write `is_default = true`, leaving the DB partial
 * unique index to decide.
 */
function coercePipelineConflict(error: unknown): never {
  if (
    error instanceof Error &&
    (error.message.includes('pipelines_org_default_unique_idx') ||
      (error.message.toLowerCase().includes('unique') &&
        error.message.includes('is_default')))
  ) {
    throw createOrbitError({
      code: 'CONFLICT',
      message:
        'Another default pipeline already exists in this organization. Retry after confirming the current default.',
      field: 'isDefault',
    })
  }
  throw error
}

/**
 * Find every other pipeline (in this org) currently marked `isDefault: true`
 * and clear the flag. Used by create/update when the caller asks for the new
 * record to become the default — at most one pipeline per org should ever be
 * the default. In normal operation a tenant has at most a handful, but we
 * still page through every match so a degenerate org with > MAX_LIST_LIMIT
 * legacy defaults is repaired correctly instead of being half-demoted.
 */
async function demoteOtherDefaults(
  ctx: Parameters<EntityService<PipelineCreateInput, PipelineUpdateInput, PipelineRecord>['create']>[0],
  repo: PipelineRepository,
  excludeId: string | null,
): Promise<void> {
  // Collect all IDs first, THEN update. Mutating rows while paginating
  // with a cursor on the same filtered set (is_default=true) can
  // invalidate the cursor — the row count changes between pages.
  const idsToUpdate: string[] = []
  let cursor: string | undefined
  do {
    const page = await repo.list(ctx, {
      filter: { is_default: true },
      limit: 100,
      ...(cursor !== undefined ? { cursor } : {}),
    })
    for (const record of page.data) {
      if (excludeId !== null && record.id === excludeId) continue
      if (record.isDefault) idsToUpdate.push(record.id)
    }
    cursor = page.hasMore && page.nextCursor ? page.nextCursor : undefined
  } while (cursor !== undefined)

  for (const id of idsToUpdate) {
    try {
      await repo.update(ctx, id, { isDefault: false, updatedAt: new Date() })
    } catch {
      // Pipeline may have been deleted between collection and update.
      // Skip it — a deleted pipeline can't be the default anyway.
    }
  }
}

export function createPipelineService(deps: {
  pipelines: PipelineRepository
  tx: TransactionScope
}): EntityService<PipelineCreateInput, PipelineUpdateInput, PipelineRecord> {
  return {
    async create(ctx, input) {
      const parsed = pipelineCreateInputSchema.parse(input)
      const now = new Date()
      const isDefault = parsed.isDefault ?? false

      // L8: when creating a pipeline as the new default, demote any existing
      // default in the same transaction so we never have two defaults at once.
      // No-default creates skip the transaction wrap entirely.
      if (!isDefault) {
        return deps.pipelines.create(
          ctx,
          pipelineRecordSchema.parse({
            id: generateId('pipeline'),
            organizationId: ctx.orgId,
            name: parsed.name,
            description: parsed.description ?? null,
            isDefault: false,
            createdAt: now,
            updatedAt: now,
          }),
        )
      }

      return deps.tx.run(ctx, async (txDb) => {
        const txPipelines = deps.pipelines.withDatabase(txDb)
        await demoteOtherDefaults(ctx, txPipelines, null)
        try {
          return await txPipelines.create(
            ctx,
            pipelineRecordSchema.parse({
              id: generateId('pipeline'),
              organizationId: ctx.orgId,
              name: parsed.name,
              description: parsed.description ?? null,
              isDefault: true,
              createdAt: now,
              updatedAt: now,
            }),
          )
        } catch (error) {
          coercePipelineConflict(error)
        }
      })
    },
    async get(ctx, id) {
      return deps.pipelines.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = pipelineUpdateInputSchema.parse(input)

      // Same shape as create: only wrap in tx when the update would create a
      // new default. Other updates stay outside the transaction.
      if (parsed.isDefault !== true) {
        assertFound(await deps.pipelines.get(ctx, id), `Pipeline ${id} not found`)

        const patch: Partial<PipelineRecord> = {
          updatedAt: new Date(),
        }

        if (parsed.name !== undefined) patch.name = parsed.name
        if (parsed.description !== undefined) patch.description = parsed.description
        if (parsed.isDefault !== undefined) patch.isDefault = parsed.isDefault

        return assertFound(await deps.pipelines.update(ctx, id, patch), `Pipeline ${id} not found`)
      }

      return deps.tx.run(ctx, async (txDb) => {
        const txPipelines = deps.pipelines.withDatabase(txDb)
        assertFound(await txPipelines.get(ctx, id), `Pipeline ${id} not found`)
        await demoteOtherDefaults(ctx, txPipelines, id)

        const patch: Partial<PipelineRecord> = {
          updatedAt: new Date(),
          isDefault: true,
        }

        if (parsed.name !== undefined) patch.name = parsed.name
        if (parsed.description !== undefined) patch.description = parsed.description

        try {
          return assertFound(await txPipelines.update(ctx, id, patch), `Pipeline ${id} not found`)
        } catch (error) {
          coercePipelineConflict(error)
        }
      })
    },
    async delete(ctx, id) {
      assertDeleted(await deps.pipelines.delete(ctx, id), `Pipeline ${id} not found`)
    },
    async list(ctx, query) {
      return deps.pipelines.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.pipelines.search(ctx, query)
    },
  }
}
