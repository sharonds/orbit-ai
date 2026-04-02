import type { AdminEntityService } from '../../services/entity-service.js'
import type { SchemaMigrationRepository } from './repository.js'
import type { SchemaMigrationRecord } from './validators.js'

export function createSchemaMigrationAdminService(
  repository: SchemaMigrationRepository,
): AdminEntityService<SchemaMigrationRecord> {
  return {
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
  }
}
