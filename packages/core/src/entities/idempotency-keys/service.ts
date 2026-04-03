import type { AdminEntityService } from '../../services/entity-service.js'
import type { IdempotencyKeyRepository } from './repository.js'
import { sanitizeIdempotencyKeyRecord, type SanitizedIdempotencyKeyRecord } from './validators.js'

export function createIdempotencyKeyAdminService(
  repository: IdempotencyKeyRepository,
): AdminEntityService<SanitizedIdempotencyKeyRecord> {
  return {
    async list(ctx, query) {
      const result = await repository.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeIdempotencyKeyRecord),
      }
    },
    async get(ctx, id) {
      const record = await repository.get(ctx, id)
      return record ? sanitizeIdempotencyKeyRecord(record) : null
    },
  }
}
