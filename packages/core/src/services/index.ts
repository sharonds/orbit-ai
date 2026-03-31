import type { StorageAdapter } from '../adapters/interface.js'
import { createApiKeyAdminService, createApiKeyService } from '../entities/api-keys/service.js'
import { createInMemoryApiKeyRepository, type ApiKeyRepository } from '../entities/api-keys/repository.js'
import { createInMemoryCompanyRepository, type CompanyRepository } from '../entities/companies/repository.js'
import { createCompanyService } from '../entities/companies/service.js'
import { createInMemoryContactRepository, type ContactRepository } from '../entities/contacts/repository.js'
import { createContactService } from '../entities/contacts/service.js'
import { createInMemoryDealRepository, type DealRepository } from '../entities/deals/repository.js'
import { createDealService } from '../entities/deals/service.js'
import { createInMemoryOrganizationMembershipRepository, type OrganizationMembershipRepository } from '../entities/organization-memberships/repository.js'
import { createOrganizationMembershipAdminService } from '../entities/organization-memberships/service.js'
import { createInMemoryOrganizationRepository, type OrganizationRepository } from '../entities/organizations/repository.js'
import { createOrganizationAdminService } from '../entities/organizations/service.js'
import { createInMemoryPipelineRepository, type PipelineRepository } from '../entities/pipelines/repository.js'
import { createPipelineService } from '../entities/pipelines/service.js'
import { createInMemoryStageRepository, type StageRepository } from '../entities/stages/repository.js'
import { createStageService } from '../entities/stages/service.js'
import { createInMemoryUserRepository, type UserRepository } from '../entities/users/repository.js'
import { createUserService } from '../entities/users/service.js'
import { OrbitSchemaEngine } from '../schema-engine/engine.js'
import { createContactContextService } from './contact-context.js'
import { createSearchService } from './search-service.js'

export interface CoreRepositoryOverrides {
  companies?: CompanyRepository
  contacts?: ContactRepository
  pipelines?: PipelineRepository
  stages?: StageRepository
  deals?: DealRepository
  users?: UserRepository
  apiKeys?: ApiKeyRepository
  organizations?: OrganizationRepository
  organizationMemberships?: OrganizationMembershipRepository
}

export function createCoreServices(
  adapter: StorageAdapter,
  overrides: CoreRepositoryOverrides = {},
) {
  void adapter

  const organizations = overrides.organizations ?? createInMemoryOrganizationRepository()
  const organizationMemberships =
    overrides.organizationMemberships ?? createInMemoryOrganizationMembershipRepository()
  const apiKeys = overrides.apiKeys ?? createInMemoryApiKeyRepository()
  const users = overrides.users ?? createInMemoryUserRepository()
  const companies = overrides.companies ?? createInMemoryCompanyRepository()
  const contacts = overrides.contacts ?? createInMemoryContactRepository()
  const pipelines = overrides.pipelines ?? createInMemoryPipelineRepository()
  const stages = overrides.stages ?? createInMemoryStageRepository()
  const deals = overrides.deals ?? createInMemoryDealRepository()

  return {
    companies: createCompanyService(companies),
    contacts: createContactService({ contacts, companies }),
    pipelines: createPipelineService(pipelines),
    stages: createStageService({ stages, pipelines }),
    deals: createDealService({ deals, pipelines, stages, contacts, companies }),
    users: createUserService(users),
    apiKeys: createApiKeyService(apiKeys),
    search: createSearchService({ companies, contacts, deals, pipelines, stages, users }),
    schema: new OrbitSchemaEngine(),
    contactContext: createContactContextService({ contacts, companies, deals }),
    system: {
      organizations: createOrganizationAdminService(organizations),
      organizationMemberships: createOrganizationMembershipAdminService(organizationMemberships),
      apiKeys: createApiKeyAdminService(apiKeys),
    },
  }
}

export type CoreServices = ReturnType<typeof createCoreServices>
