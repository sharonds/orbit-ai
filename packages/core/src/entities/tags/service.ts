import { generateId } from '../../ids/generate-id.js'
import type { EntityService } from '../../services/entity-service.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import { createOrbitError } from '../../types/errors.js'
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
}): EntityService<TagCreateInput, TagUpdateInput, TagRecord> {
  return {
    async create(ctx, input) {
      const parsed = tagCreateInputSchema.parse(input)
      const now = new Date()
      await assertUniqueTagName(ctx, deps.tags, parsed.name)

      try {
        return await deps.tags.create(
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
    },
    async get(ctx, id) {
      return deps.tags.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = tagUpdateInputSchema.parse(input)
      const current = assertFound(await deps.tags.get(ctx, id), `Tag ${id} not found`)
      const nextName = parsed.name ?? current.name
      await assertUniqueTagName(ctx, deps.tags, nextName, id)

      const patch: Partial<TagRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.color !== undefined) patch.color = parsed.color ?? null

      try {
        return assertFound(await deps.tags.update(ctx, id, patch), `Tag ${id} not found`)
      } catch (error) {
        coerceTagConflict(error, nextName)
      }
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
  }
}
