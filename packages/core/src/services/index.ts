import type { StorageAdapter } from '../adapters/interface.js'
import { createApiKeyAdminService } from '../entities/api-keys/service.js'
import { SqliteStorageAdapter } from '../adapters/sqlite/adapter.js'
import { createSqliteApiKeyRepository, type ApiKeyRepository } from '../entities/api-keys/repository.js'
import { createSqliteCompanyRepository, type CompanyRepository } from '../entities/companies/repository.js'
import { createCompanyService } from '../entities/companies/service.js'
import { createSqliteContactRepository, type ContactRepository } from '../entities/contacts/repository.js'
import { createContactService } from '../entities/contacts/service.js'
import { createSqliteDealRepository, type DealRepository } from '../entities/deals/repository.js'
import { createDealService } from '../entities/deals/service.js'
import {
  createSqliteOrganizationMembershipRepository,
  type OrganizationMembershipRepository,
} from '../entities/organization-memberships/repository.js'
import { createOrganizationMembershipAdminService } from '../entities/organization-memberships/service.js'
import { createSqliteOrganizationRepository, type OrganizationRepository } from '../entities/organizations/repository.js'
import { createOrganizationAdminService } from '../entities/organizations/service.js'
import { createSqlitePipelineRepository, type PipelineRepository } from '../entities/pipelines/repository.js'
import { createPipelineService } from '../entities/pipelines/service.js'
import { createSqliteStageRepository, type StageRepository } from '../entities/stages/repository.js'
import { createStageService } from '../entities/stages/service.js'
import { createSqliteUserRepository, type UserRepository } from '../entities/users/repository.js'
import { createUserService } from '../entities/users/service.js'
import { OrbitSchemaEngine } from '../schema-engine/engine.js'
import { createOrbitError } from '../types/errors.js'
import { createContactContextService } from './contact-context.js'
import { createSearchService } from './search-service.js'

interface CoreRepositoryOverrides {
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

function resolveCoreRepository<T>({
  adapter,
  sqliteFactory,
  override,
  name,
}: {
  adapter: StorageAdapter
  sqliteFactory: () => T
  override: T | undefined
  name: string
}): T {
  if (override) {
    return override
  }

  if (adapter instanceof SqliteStorageAdapter) {
    return sqliteFactory()
  }

  throw createOrbitError({
    code: 'ADAPTER_UNAVAILABLE',
    message: `Adapter ${adapter.name} is not implemented for ${name} without explicit repository overrides`,
    hint: 'Use a real SqliteStorageAdapter for local execution or provide explicit repository overrides in tests.',
  })
}

export function createCoreServices(
  adapter: StorageAdapter,
  overrides: CoreRepositoryOverrides = {},
) {
  const organizations = resolveCoreRepository({
    adapter,
    override: overrides.organizations,
    sqliteFactory: () => createSqliteOrganizationRepository(adapter),
    name: 'organizations repository',
  })
  const organizationMemberships = resolveCoreRepository({
    adapter,
    override: overrides.organizationMemberships,
    sqliteFactory: () => createSqliteOrganizationMembershipRepository(adapter),
    name: 'organization memberships repository',
  })
  const apiKeys = resolveCoreRepository({
    adapter,
    override: overrides.apiKeys,
    sqliteFactory: () => createSqliteApiKeyRepository(adapter),
    name: 'api keys repository',
  })
  const users = resolveCoreRepository({
    adapter,
    override: overrides.users,
    sqliteFactory: () => createSqliteUserRepository(adapter),
    name: 'users repository',
  })
  const companies = resolveCoreRepository({
    adapter,
    override: overrides.companies,
    sqliteFactory: () => createSqliteCompanyRepository(adapter),
    name: 'companies repository',
  })
  const contacts = resolveCoreRepository({
    adapter,
    override: overrides.contacts,
    sqliteFactory: () => createSqliteContactRepository(adapter),
    name: 'contacts repository',
  })
  const pipelines = resolveCoreRepository({
    adapter,
    override: overrides.pipelines,
    sqliteFactory: () => createSqlitePipelineRepository(adapter),
    name: 'pipelines repository',
  })
  const stages = resolveCoreRepository({
    adapter,
    override: overrides.stages,
    sqliteFactory: () => createSqliteStageRepository(adapter),
    name: 'stages repository',
  })
  const deals = resolveCoreRepository({
    adapter,
    override: overrides.deals,
    sqliteFactory: () => createSqliteDealRepository(adapter),
    name: 'deals repository',
  })

  return {
    companies: createCompanyService(companies),
    contacts: createContactService({ contacts, companies }),
    pipelines: createPipelineService(pipelines),
    stages: createStageService({ stages, pipelines }),
    deals: createDealService({ deals, pipelines, stages, contacts, companies }),
    users: createUserService(users),
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
