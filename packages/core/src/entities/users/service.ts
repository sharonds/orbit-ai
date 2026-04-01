import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import { createOrbitError } from '../../types/errors.js'
import type { UserRepository } from './repository.js'
import {
  sanitizeUserRecord,
  userCreateInputSchema,
  userRecordSchema,
  userUpdateInputSchema,
  type UserCreateInput,
  type SanitizedUserRecord,
  type UserUpdateInput,
} from './validators.js'

export function createUserService(
  repository: UserRepository,
): EntityService<UserCreateInput, UserUpdateInput, SanitizedUserRecord> {
  function validationFailed(message: string) {
    return createOrbitError({
      code: 'VALIDATION_FAILED',
      message,
    })
  }

  return {
    async create(ctx, input) {
      const parsed = userCreateInputSchema.parse(input)
      const now = new Date()

      const created = await repository.create(
        ctx,
        userRecordSchema.parse({
          id: generateId('user'),
          organizationId: ctx.orgId,
          email: parsed.email,
          name: parsed.name,
          role: parsed.role ?? 'viewer',
          avatarUrl: parsed.avatarUrl ?? null,
          externalAuthId: parsed.externalAuthId ?? null,
          isActive: parsed.isActive ?? true,
          metadata: parsed.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )

      return sanitizeUserRecord(created)
    },
    async get(ctx, id) {
      const record = await repository.get(ctx, id)
      return record ? sanitizeUserRecord(record) : null
    },
    async update(ctx, id, input) {
      const parsed = userUpdateInputSchema.parse(input)
      assertFound(await repository.get(ctx, id), `User ${id} not found`)

      if (parsed.email === null) {
        throw validationFailed('User email cannot be null')
      }

      const patch: Partial<ReturnType<typeof userRecordSchema.parse>> = {
        updatedAt: new Date(),
      }

      if (parsed.email !== undefined && parsed.email !== null) patch.email = parsed.email
      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.role !== undefined) patch.role = parsed.role
      if (parsed.avatarUrl !== undefined) patch.avatarUrl = parsed.avatarUrl
      if (parsed.isActive !== undefined) patch.isActive = parsed.isActive
      if (parsed.metadata !== undefined) patch.metadata = parsed.metadata

      return sanitizeUserRecord(assertFound(await repository.update(ctx, id, patch), `User ${id} not found`))
    },
    async delete(ctx, id) {
      assertDeleted(await repository.delete(ctx, id), `User ${id} not found`)
    },
    async list(ctx, query) {
      const result = await repository.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeUserRecord),
      }
    },
    async search(ctx, query) {
      const result = await repository.search(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeUserRecord),
      }
    },
  }
}
