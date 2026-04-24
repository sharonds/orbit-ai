import type { TransactionScope } from '../../adapters/interface.js'
import { generateId } from '../../ids/generate-id.js'
import type { EntityService } from '../../services/entity-service.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
import type { EntityTagRepository } from '../entity-tags/repository.js'
import { entityTagRecordSchema, type EntityTagRecord } from '../entity-tags/validators.js'
import type { TagRepository } from './repository.js'
import {
  tagCreateInputSchema,
  tagRecordSchema,
  tagUpdateInputSchema,
  type TagCreateInput,
  type TagRecord,
  type TagUpdateInput,
} from './validators.js'

async function assertUniqueTagName(
  ctx: Parameters<EntityService<TagCreateInput, TagUpdateInput, TagRecord>['create']>[0],
  repository: TagRepository,
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
      message: `Tag name ${name} already exists in this organization`,
      field: 'name',
    })
  }
}

function coerceTagConflict(error: unknown, name: string): never {
  if (
    error instanceof Error &&
    (
      error.message.includes('tags_org_name_idx') ||
      (error.message.toLowerCase().includes('unique') &&
        (error.message.includes('organization_id') || error.message.includes('organizationId')) &&
        error.message.includes('name'))
    )
  ) {
    throw createOrbitError({
      code: 'CONFLICT',
      message: `Tag name ${name} already exists in this organization`,
      field: 'name',
    })
  }

  throw error
}

export function createTagService(deps: {
  tags: TagRepository
  entityTags: EntityTagRepository
  tx: TransactionScope
}): EntityService<TagCreateInput, TagUpdateInput, TagRecord> & {
  attach(ctx: Parameters<EntityService<TagCreateInput, TagUpdateInput, TagRecord>['create']>[0], id: string, input: Record<string, unknown>): Promise<EntityTagRecord>
  detach(ctx: Parameters<EntityService<TagCreateInput, TagUpdateInput, TagRecord>['create']>[0], id: string, input: Record<string, unknown>): Promise<{ id: string; detached: true }>
} {
  function parseEntityTagInput(input: Record<string, unknown>): { entityType: string; entityId: string } {
    const entityType = input.entityType ?? input.entity_type
    const entityId = input.entityId ?? input.entity_id

    if (typeof entityType !== 'string' || entityType.length === 0) {
      throw createOrbitError({
        code: 'VALIDATION_FAILED',
        message: 'Tag attachment entityType is required',
        field: 'entityType',
      })
    }
    if (typeof entityId !== 'string' || entityId.length === 0) {
      throw createOrbitError({
        code: 'VALIDATION_FAILED',
        message: 'Tag attachment entityId is required',
        field: 'entityId',
      })
    }

    return { entityType, entityId }
  }

  return {
    async create(ctx, input) {
      const parsed = tagCreateInputSchema.parse(input)
      const now = new Date()
      // See sequences/service.ts for the transaction-wrap rationale.
      // Tag uniqueness is `(organization_id, name)` enforced by
      // `tags_org_name_idx`; we wrap the read+write so the DB constraint
      // is the only race-decider.
      return deps.tx.run(ctx, async (txDb) => {
        const txTags = deps.tags.withDatabase(txDb)
        await assertUniqueTagName(ctx, txTags, parsed.name)

        try {
          return await txTags.create(
            ctx,
            tagRecordSchema.parse({
              id: generateId('tag'),
              organizationId: ctx.orgId,
              name: parsed.name,
              color: parsed.color ?? null,
              createdAt: now,
              updatedAt: now,
            }),
          )
        } catch (error) {
          coerceTagConflict(error, parsed.name)
        }
      })
    },
    async get(ctx, id) {
      return deps.tags.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = tagUpdateInputSchema.parse(input)
      return deps.tx.run(ctx, async (txDb) => {
        const txTags = deps.tags.withDatabase(txDb)
        const current = assertFound(await txTags.get(ctx, id), `Tag ${id} not found`)
        const nextName = parsed.name ?? current.name
        await assertUniqueTagName(ctx, txTags, nextName, id)

        const patch: Partial<TagRecord> = {
          updatedAt: new Date(),
        }

        if (parsed.name !== undefined) patch.name = parsed.name
        if (parsed.color !== undefined) patch.color = parsed.color ?? null

        try {
          return assertFound(await txTags.update(ctx, id, patch), `Tag ${id} not found`)
        } catch (error) {
          coerceTagConflict(error, nextName)
        }
      })
    },
    async delete(ctx, id) {
      assertDeleted(await deps.tags.delete(ctx, id), `Tag ${id} not found`)
    },
    async list(ctx, query) {
      return deps.tags.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.tags.search(ctx, query)
    },
    async attach(ctx, id, input) {
      assertFound(await deps.tags.get(ctx, id), `Tag ${id} not found`)
      const parsed = parseEntityTagInput(input)
      const now = new Date()

      return deps.entityTags.create(
        ctx,
        entityTagRecordSchema.parse({
          id: generateId('entityTag'),
          organizationId: ctx.orgId,
          tagId: id,
          entityType: parsed.entityType,
          entityId: parsed.entityId,
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async detach(ctx, id, input) {
      assertFound(await deps.tags.get(ctx, id), `Tag ${id} not found`)
      const parsed = parseEntityTagInput(input)
      const existing = await deps.entityTags.list(ctx, {
        filter: {
          tag_id: id,
          entity_type: parsed.entityType,
          entity_id: parsed.entityId,
        },
        limit: 1,
      })
      const current = existing.data[0]
      if (!current) {
        throw createOrbitError({
          code: 'RESOURCE_NOT_FOUND',
          message: `Tag ${id} is not attached to ${parsed.entityType}:${parsed.entityId}`,
        })
      }

      assertDeleted(await deps.entityTags.delete(ctx, current.id), `Entity tag ${current.id} not found`)
      return { id: current.id, detached: true }
    },
  }
}
