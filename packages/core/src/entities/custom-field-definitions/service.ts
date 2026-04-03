import type { AdminEntityService } from '../../services/entity-service.js'
import type { CustomFieldDefinitionRepository } from './repository.js'
import type { CustomFieldDefinitionRecord } from './validators.js'

export function createCustomFieldDefinitionAdminService(
  repository: CustomFieldDefinitionRepository,
): AdminEntityService<CustomFieldDefinitionRecord> {
  return {
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
  }
}
