import { generateId } from '../../ids/generate-id.js'
import { assertFound } from '../../services/service-helpers.js'
import type { AdminEntityService, EntityService } from '../../services/entity-service.js'
import type { ApiKeyRepository } from './repository.js'
import {
  apiKeyCreateInputSchema,
  apiKeyRecordSchema,
  apiKeyUpdateInputSchema,
  sanitizeApiKeyRecord,
  type ApiKeyCreateInput,
  type ApiKeyRecord,
  type ApiKeyUpdateInput,
  type SanitizedApiKeyRecord,
} from './validators.js'

export function createApiKeyService(
  repository: ApiKeyRepository,
): EntityService<ApiKeyCreateInput, ApiKeyUpdateInput, SanitizedApiKeyRecord> {
  return {
    async create(ctx, input) {
      const parsed = apiKeyCreateInputSchema.parse(input)
      const now = new Date()

      const created = await repository.create(
        ctx,
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

      return sanitizeApiKeyRecord(created)
    },
    async get(ctx, id) {
      const record = await repository.get(ctx, id)
      return record ? sanitizeApiKeyRecord(record) : null
    },
    async update(ctx, id, input) {
      const parsed = apiKeyUpdateInputSchema.parse(input)
      assertFound(await repository.get(ctx, id), `API key ${id} not found`)

      const patch: Partial<ApiKeyRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.name !== undefined) patch.name = parsed.name
      if (parsed.scopes !== undefined) patch.scopes = parsed.scopes
      if (parsed.lastUsedAt !== undefined) patch.lastUsedAt = parsed.lastUsedAt
      if (parsed.expiresAt !== undefined) patch.expiresAt = parsed.expiresAt
      if (parsed.revokedAt !== undefined) patch.revokedAt = parsed.revokedAt
      if (parsed.createdByUserId !== undefined) patch.createdByUserId = parsed.createdByUserId

      return sanitizeApiKeyRecord(assertFound(await repository.update(ctx, id, patch), `API key ${id} not found`))
    },
    async delete(ctx, id) {
      const deleted = await repository.delete(ctx, id)
      if (!deleted) {
        throw new Error(`API key ${id} not found`)
      }
    },
    async list(ctx, query) {
      const result = await repository.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeApiKeyRecord),
      }
    },
    async search(ctx, query) {
      const result = await repository.search(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeApiKeyRecord),
      }
    },
  }
}

export function createApiKeyAdminService(repository: ApiKeyRepository): AdminEntityService<SanitizedApiKeyRecord> {
  return {
    async list(_ctx, query) {
      const result = await repository.listAll(query)
      return {
        ...result,
        data: result.data.map(sanitizeApiKeyRecord),
      }
    },
    async get(_ctx, id) {
      const record = await repository.getAny(id)
      return record ? sanitizeApiKeyRecord(record) : null
    },
  }
}
