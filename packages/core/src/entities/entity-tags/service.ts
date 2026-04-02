import type { AdminEntityService } from '../../services/entity-service.js'
import type { EntityTagRepository } from './repository.js'
import type { EntityTagRecord } from './validators.js'

export function createEntityTagAdminService(repository: EntityTagRepository): AdminEntityService<EntityTagRecord> {
  return {
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
  }
}
