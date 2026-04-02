import type { StorageAdapter } from '../adapters/interface.js'
import { PostgresStorageAdapter } from '../adapters/postgres/adapter.js'
import { createActivityService } from '../entities/activities/service.js'
import {
  createPostgresActivityRepository,
  createSqliteActivityRepository,
  type ActivityRepository,
} from '../entities/activities/repository.js'
import { createApiKeyAdminService } from '../entities/api-keys/service.js'
import { SqliteStorageAdapter } from '../adapters/sqlite/adapter.js'
import {
  createPostgresApiKeyRepository,
  createSqliteApiKeyRepository,
  type ApiKeyRepository,
} from '../entities/api-keys/repository.js'
import {
  createPostgresCompanyRepository,
  createSqliteCompanyRepository,
  type CompanyRepository,
} from '../entities/companies/repository.js'
import { createCompanyService } from '../entities/companies/service.js'
import {
  createPostgresContactRepository,
  createSqliteContactRepository,
  type ContactRepository,
} from '../entities/contacts/repository.js'
import { createContactService } from '../entities/contacts/service.js'
import {
  createPostgresDealRepository,
  createSqliteDealRepository,
  type DealRepository,
} from '../entities/deals/repository.js'
import { createDealService } from '../entities/deals/service.js'
import {
  createPostgresNoteRepository,
  createSqliteNoteRepository,
  type NoteRepository,
} from '../entities/notes/repository.js'
import { createNoteService } from '../entities/notes/service.js'
import {
  createPostgresOrganizationMembershipRepository,
  createSqliteOrganizationMembershipRepository,
  type OrganizationMembershipRepository,
} from '../entities/organization-memberships/repository.js'
import { createOrganizationMembershipAdminService } from '../entities/organization-memberships/service.js'
import {
  createPostgresOrganizationRepository,
  createSqliteOrganizationRepository,
  type OrganizationRepository,
} from '../entities/organizations/repository.js'
import { createOrganizationAdminService } from '../entities/organizations/service.js'
import {
  createPostgresPipelineRepository,
  createSqlitePipelineRepository,
  type PipelineRepository,
} from '../entities/pipelines/repository.js'
import { createPipelineService } from '../entities/pipelines/service.js'
import {
  createPostgresStageRepository,
  createSqliteStageRepository,
  type StageRepository,
} from '../entities/stages/repository.js'
import { createStageService } from '../entities/stages/service.js'
import {
  createPostgresTaskRepository,
  createSqliteTaskRepository,
  type TaskRepository,
} from '../entities/tasks/repository.js'
import { createTaskService } from '../entities/tasks/service.js'
import {
  createPostgresUserRepository,
  createSqliteUserRepository,
  type UserRepository,
} from '../entities/users/repository.js'
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
  activities?: ActivityRepository
  tasks?: TaskRepository
  notes?: NoteRepository
}

function resolveCoreRepository<T>({
  adapter,
  sqliteFactory,
  postgresFactory,
  override,
  name,
}: {
  adapter: StorageAdapter
  sqliteFactory: () => T
  postgresFactory?: () => T
  override: T | undefined
  name: string
}): T {
  if (override) {
    return override
  }

  if (adapter instanceof SqliteStorageAdapter) {
    return sqliteFactory()
  }

  if (adapter instanceof PostgresStorageAdapter && postgresFactory) {
    return postgresFactory()
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
    postgresFactory: () => createPostgresOrganizationRepository(adapter),
    name: 'organizations repository',
  })
  const organizationMemberships = resolveCoreRepository({
    adapter,
    override: overrides.organizationMemberships,
    sqliteFactory: () => createSqliteOrganizationMembershipRepository(adapter),
    postgresFactory: () => createPostgresOrganizationMembershipRepository(adapter),
    name: 'organization memberships repository',
  })
  const apiKeys = resolveCoreRepository({
    adapter,
    override: overrides.apiKeys,
    sqliteFactory: () => createSqliteApiKeyRepository(adapter),
    postgresFactory: () => createPostgresApiKeyRepository(adapter),
    name: 'api keys repository',
  })
  const users = resolveCoreRepository({
    adapter,
    override: overrides.users,
    sqliteFactory: () => createSqliteUserRepository(adapter),
    postgresFactory: () => createPostgresUserRepository(adapter),
    name: 'users repository',
  })
  const companies = resolveCoreRepository({
    adapter,
    override: overrides.companies,
    sqliteFactory: () => createSqliteCompanyRepository(adapter),
    postgresFactory: () => createPostgresCompanyRepository(adapter),
    name: 'companies repository',
  })
  const contacts = resolveCoreRepository({
    adapter,
    override: overrides.contacts,
    sqliteFactory: () => createSqliteContactRepository(adapter),
    postgresFactory: () => createPostgresContactRepository(adapter),
    name: 'contacts repository',
  })
  const pipelines = resolveCoreRepository({
    adapter,
    override: overrides.pipelines,
    sqliteFactory: () => createSqlitePipelineRepository(adapter),
    postgresFactory: () => createPostgresPipelineRepository(adapter),
    name: 'pipelines repository',
  })
  const stages = resolveCoreRepository({
    adapter,
    override: overrides.stages,
    sqliteFactory: () => createSqliteStageRepository(adapter),
    postgresFactory: () => createPostgresStageRepository(adapter),
    name: 'stages repository',
  })
  const deals = resolveCoreRepository({
    adapter,
    override: overrides.deals,
    sqliteFactory: () => createSqliteDealRepository(adapter),
    postgresFactory: () => createPostgresDealRepository(adapter),
    name: 'deals repository',
  })
  const activities = resolveCoreRepository({
    adapter,
    override: overrides.activities,
    sqliteFactory: () => createSqliteActivityRepository(adapter),
    postgresFactory: () => createPostgresActivityRepository(adapter),
    name: 'activities repository',
  })
  const tasks = resolveCoreRepository({
    adapter,
    override: overrides.tasks,
    sqliteFactory: () => createSqliteTaskRepository(adapter),
    postgresFactory: () => createPostgresTaskRepository(adapter),
    name: 'tasks repository',
  })
  const notes = resolveCoreRepository({
    adapter,
    override: overrides.notes,
    sqliteFactory: () => createSqliteNoteRepository(adapter),
    postgresFactory: () => createPostgresNoteRepository(adapter),
    name: 'notes repository',
  })

  return {
    companies: createCompanyService(companies),
    contacts: createContactService({ contacts, companies }),
    pipelines: createPipelineService(pipelines),
    stages: createStageService({ stages, pipelines }),
    deals: createDealService({ deals, pipelines, stages, contacts, companies }),
    activities: createActivityService({ activities, contacts, companies, deals, users }),
    tasks: createTaskService({ tasks, contacts, companies, deals, users }),
    notes: createNoteService({ notes, contacts, companies, deals, users }),
    users: createUserService(users),
    search: createSearchService({ companies, contacts, deals, pipelines, stages, users }),
    schema: new OrbitSchemaEngine(),
    contactContext: createContactContextService({ contacts, companies, deals, activities, tasks }),
    system: {
      organizations: createOrganizationAdminService(organizations),
      organizationMemberships: createOrganizationMembershipAdminService(organizationMemberships),
      apiKeys: createApiKeyAdminService(apiKeys),
    },
  }
}

export type CoreServices = ReturnType<typeof createCoreServices>
