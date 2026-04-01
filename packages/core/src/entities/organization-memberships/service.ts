import type { AdminEntityService } from '../../services/entity-service.js'
import type { OrganizationMembershipRepository } from './repository.js'
import type { OrganizationMembershipRecord } from './validators.js'

export function createOrganizationMembershipAdminService(
  repository: OrganizationMembershipRepository,
): AdminEntityService<OrganizationMembershipRecord> {
  return {
    async list(_ctx, query) {
      return repository.list(query)
    },
    async get(_ctx, id) {
      return repository.get(id)
    },
  }
}
