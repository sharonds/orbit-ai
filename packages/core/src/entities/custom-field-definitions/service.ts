import type { AdminEntityService } from '../../services/entity-service.js'
import type { CustomFieldDefinitionRepository } from './repository.js'
import type { CustomFieldDefinitionRecord } from './validators.js'

export interface CustomFieldDefinitionAdminService extends AdminEntityService<CustomFieldDefinitionRecord> {
  update(
    ctx: Parameters<CustomFieldDefinitionRepository['update']>[0],
    id: string,
    patch: Partial<CustomFieldDefinitionRecord>,
  ): Promise<CustomFieldDefinitionRecord | null>
  delete(ctx: Parameters<CustomFieldDefinitionRepository['delete']>[0], id: string): Promise<boolean>
}

export function createCustomFieldDefinitionAdminService(
  repository: CustomFieldDefinitionRepository,
): CustomFieldDefinitionAdminService {
  return {
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
    async update(ctx, id, patch) {
      return repository.update(ctx, id, patch)
    },
    async delete(ctx, id) {
      return repository.delete(ctx, id)
    },
  }
}
