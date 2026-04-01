import type { AdminEntityService } from '../../services/entity-service.js'
import type { OrganizationMembershipRepository } from './repository.js'
import type { OrganizationMembershipRecord } from './validators.js'

export function createOrganizationMembershipAdminService(
  repository: OrganizationMembershipRepository,
): AdminEntityService<OrganizationMembershipRecord> {
  return {
    async list(ctx, query) {
      return repository.list(ctx, query)
    },
    async get(ctx, id) {
      return repository.get(ctx, id)
    },
  }
}
