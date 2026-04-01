import { generateId } from '../../ids/generate-id.js'
import { assertFound } from '../../services/service-helpers.js'
import type { AdminEntityService, EntityService } from '../../services/entity-service.js'
import type { ApiKeyRepository } from './repository.js'
import {
  apiKeyCreateInputSchema,
  apiKeyRecordSchema,
  apiKeyUpdateInputSchema,
  type ApiKeyCreateInput,
  type ApiKeyRecord,
  type ApiKeyUpdateInput,
} from './validators.js'

export function createApiKeyService(repository: ApiKeyRepository): EntityService<ApiKeyCreateInput, ApiKeyUpdateInput, ApiKeyRecord> {
  return {
    async create(ctx, input) {
      const parsed = apiKeyCreateInputSchema.parse(input)
      const now = new Date()

      return repository.create(
        apiKeyRecordSchema.parse({
          id: generateId('apiKey'),
          organizationId: ctx.orgId,
          name: parsed.name,
          keyHash: parsed.keyHash,
          keyPrefix: parsed.keyPrefix,
          scopes: parsed.scopes ?? [],
          lastUsedAt: parsed.lastUsedAt ?? null,
          expiresAt: parsed.expiresAt ?? null,
          revokedAt: parsed.revokedAt ?? null,
          createdByUserId: parsed.createdByUserId ?? null,
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = apiKeyUpdateInputSchema.parse(input)
      assertFound(await repository.get(ctx, id), `API key ${id} not found`)

      const patch: Partial<ApiKeyRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.keyHash !== undefined) patch.keyHash = parsed.keyHash
      if (parsed.keyPrefix !== undefined) patch.keyPrefix = parsed.keyPrefix
      if (parsed.scopes !== undefined) patch.scopes = parsed.scopes
      if (parsed.lastUsedAt !== undefined) patch.lastUsedAt = parsed.lastUsedAt
      if (parsed.expiresAt !== undefined) patch.expiresAt = parsed.expiresAt
      if (parsed.revokedAt !== undefined) patch.revokedAt = parsed.revokedAt
      if (parsed.createdByUserId !== undefined) patch.createdByUserId = parsed.createdByUserId

      return assertFound(await repository.update(ctx, id, patch), `API key ${id} not found`)
    },
    async delete(ctx, id) {
      const deleted = await repository.delete(ctx, id)
      if (!deleted) {
        throw new Error(`API key ${id} not found`)
      }
    },
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async search(ctx, query) {
      return repository.search(ctx, query)
    },
  }
}

export function createApiKeyAdminService(repository: ApiKeyRepository): AdminEntityService<ApiKeyRecord> {
  return {
    async list(_ctx, query) {
      return repository.listAll(query)
    },
    async get(_ctx, id) {
      return repository.getAny(id)
    },
  }
}
