import type { AdminEntityService } from '../../services/entity-service.js'
import type { SchemaMigrationRepository } from './repository.js'
import {
  sanitizeSchemaMigrationRecord,
  type SanitizedSchemaMigrationRecord,
} from './validators.js'

export function createSchemaMigrationAdminService(
  repository: SchemaMigrationRepository,
): AdminEntityService<SanitizedSchemaMigrationRecord> {
  return {
    async list(ctx, query) {
      const result = await repository.list(ctx, query)
      return {
        ...result,
        data: result.data.map(sanitizeSchemaMigrationRecord),
      }
    },
    async get(ctx, id) {
      const record = await repository.get(ctx, id)
      return record ? sanitizeSchemaMigrationRecord(record) : null
    },
  }
}
