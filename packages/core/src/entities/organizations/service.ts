import type { AdminEntityService } from '../../services/entity-service.js'
import type { OrganizationRepository } from './repository.js'
import type { OrganizationRecord } from './validators.js'

export function createOrganizationAdminService(repository: OrganizationRepository): AdminEntityService<OrganizationRecord> {
  return {
    async list(_ctx, query) {
      return repository.list(query)
    },
    async get(_ctx, id) {
      return repository.get(id)
    },
  }
}
