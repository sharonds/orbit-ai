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
  createPostgresPaymentRepository,
  createSqlitePaymentRepository,
  type PaymentRepository,
} from '../entities/payments/repository.js'
import { createPaymentService } from '../entities/payments/service.js'
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
  createPostgresProductRepository,
  createSqliteProductRepository,
  type ProductRepository,
} from '../entities/products/repository.js'
import { createProductService } from '../entities/products/service.js'
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
  createPostgresContractRepository,
  createSqliteContractRepository,
  type ContractRepository,
} from '../entities/contracts/repository.js'
import { createContractService } from '../entities/contracts/service.js'
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
  products?: ProductRepository
  payments?: PaymentRepository
  contracts?: ContractRepository
}

function resolveOptionalCoreRepository<T>({
  adapter,
  sqliteFactory,
  postgresFactory,
  override,
}: {
  adapter: StorageAdapter
  sqliteFactory: () => T
  postgresFactory?: () => T
  override: T | undefined
}): T | undefined {
  if (override) {
    return override
  }

  if (adapter instanceof SqliteStorageAdapter) {
    return sqliteFactory()
  }

  if (adapter instanceof PostgresStorageAdapter && postgresFactory) {
    return postgresFactory()
  }

  return undefined
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
  let activitiesRepository: ActivityRepository | null = null
  let tasksRepository: TaskRepository | null = null
  let notesRepository: NoteRepository | null = null
  let productsRepository: ProductRepository | null = null
  let paymentsRepository: PaymentRepository | null = null
  let contractsRepository: ContractRepository | null = null
  let optionalActivitiesRepository: ActivityRepository | undefined
  let optionalTasksRepository: TaskRepository | undefined
  let optionalProductsRepository: ProductRepository | undefined
  let optionalPaymentsRepository: PaymentRepository | undefined
  let optionalContractsRepository: ContractRepository | undefined
  let optionalActivitiesResolved = false
  let optionalTasksResolved = false
  let optionalProductsResolved = false
  let optionalPaymentsResolved = false
  let optionalContractsResolved = false

  function getActivitiesRepository(): ActivityRepository {
    if (activitiesRepository) {
      return activitiesRepository
    }

    activitiesRepository = resolveCoreRepository({
      adapter,
      override: overrides.activities,
      sqliteFactory: () => createSqliteActivityRepository(adapter),
      postgresFactory: () => createPostgresActivityRepository(adapter),
      name: 'activities repository',
    })

    return activitiesRepository
  }

  function getTasksRepository(): TaskRepository {
    if (tasksRepository) {
      return tasksRepository
    }

    tasksRepository = resolveCoreRepository({
      adapter,
      override: overrides.tasks,
      sqliteFactory: () => createSqliteTaskRepository(adapter),
      postgresFactory: () => createPostgresTaskRepository(adapter),
      name: 'tasks repository',
    })

    return tasksRepository
  }

  function getNotesRepository(): NoteRepository {
    if (notesRepository) {
      return notesRepository
    }

    notesRepository = resolveCoreRepository({
      adapter,
      override: overrides.notes,
      sqliteFactory: () => createSqliteNoteRepository(adapter),
      postgresFactory: () => createPostgresNoteRepository(adapter),
      name: 'notes repository',
    })

    return notesRepository
  }

  function getProductsRepository(): ProductRepository {
    if (productsRepository) {
      return productsRepository
    }

    productsRepository = resolveCoreRepository({
      adapter,
      override: overrides.products,
      sqliteFactory: () => createSqliteProductRepository(adapter),
      postgresFactory: () => createPostgresProductRepository(adapter),
      name: 'products repository',
    })

    return productsRepository
  }

  function getPaymentsRepository(): PaymentRepository {
    if (paymentsRepository) {
      return paymentsRepository
    }

    paymentsRepository = resolveCoreRepository({
      adapter,
      override: overrides.payments,
      sqliteFactory: () => createSqlitePaymentRepository(adapter),
      postgresFactory: () => createPostgresPaymentRepository(adapter),
      name: 'payments repository',
    })

    return paymentsRepository
  }

  function getContractsRepository(): ContractRepository {
    if (contractsRepository) {
      return contractsRepository
    }

    contractsRepository = resolveCoreRepository({
      adapter,
      override: overrides.contracts,
      sqliteFactory: () => createSqliteContractRepository(adapter),
      postgresFactory: () => createPostgresContractRepository(adapter),
      name: 'contracts repository',
    })

    return contractsRepository
  }

  function getOptionalActivitiesRepository(): ActivityRepository | undefined {
    if (optionalActivitiesResolved) {
      return optionalActivitiesRepository
    }

    optionalActivitiesRepository = resolveOptionalCoreRepository({
      adapter,
      override: overrides.activities,
      sqliteFactory: () => createSqliteActivityRepository(adapter),
      postgresFactory: () => createPostgresActivityRepository(adapter),
    })
    optionalActivitiesResolved = true

    return optionalActivitiesRepository
  }

  function getOptionalTasksRepository(): TaskRepository | undefined {
    if (optionalTasksResolved) {
      return optionalTasksRepository
    }

    optionalTasksRepository = resolveOptionalCoreRepository({
      adapter,
      override: overrides.tasks,
      sqliteFactory: () => createSqliteTaskRepository(adapter),
      postgresFactory: () => createPostgresTaskRepository(adapter),
    })
    optionalTasksResolved = true

    return optionalTasksRepository
  }

  function getOptionalProductsRepository(): ProductRepository | undefined {
    if (optionalProductsResolved) {
      return optionalProductsRepository
    }

    optionalProductsRepository = resolveOptionalCoreRepository({
      adapter,
      override: overrides.products,
      sqliteFactory: () => createSqliteProductRepository(adapter),
      postgresFactory: () => createPostgresProductRepository(adapter),
    })
    optionalProductsResolved = true

    return optionalProductsRepository
  }

  function getOptionalPaymentsRepository(): PaymentRepository | undefined {
    if (optionalPaymentsResolved) {
      return optionalPaymentsRepository
    }

    optionalPaymentsRepository = resolveOptionalCoreRepository({
      adapter,
      override: overrides.payments,
      sqliteFactory: () => createSqlitePaymentRepository(adapter),
      postgresFactory: () => createPostgresPaymentRepository(adapter),
    })
    optionalPaymentsResolved = true

    return optionalPaymentsRepository
  }

  function getOptionalContractsRepository(): ContractRepository | undefined {
    if (optionalContractsResolved) {
      return optionalContractsRepository
    }

    optionalContractsRepository = resolveOptionalCoreRepository({
      adapter,
      override: overrides.contracts,
      sqliteFactory: () => createSqliteContractRepository(adapter),
      postgresFactory: () => createPostgresContractRepository(adapter),
    })
    optionalContractsResolved = true

    return optionalContractsRepository
  }

  let activitiesService: ReturnType<typeof createActivityService> | undefined
  let tasksService: ReturnType<typeof createTaskService> | undefined
  let notesService: ReturnType<typeof createNoteService> | undefined
  let productsService: ReturnType<typeof createProductService> | undefined
  let paymentsService: ReturnType<typeof createPaymentService> | undefined
  let contractsService: ReturnType<typeof createContractService> | undefined
  let searchService: ReturnType<typeof createSearchService> | undefined
  let contactContextService: ReturnType<typeof createContactContextService> | undefined

  return {
    companies: createCompanyService(companies),
    contacts: createContactService({ contacts, companies }),
    pipelines: createPipelineService(pipelines),
    stages: createStageService({ stages, pipelines }),
    deals: createDealService({ deals, pipelines, stages, contacts, companies }),
    get activities() {
      activitiesService ??= createActivityService({
        activities: getActivitiesRepository(),
        contacts,
        companies,
        deals,
        users,
      })

      return activitiesService
    },
    get tasks() {
      tasksService ??= createTaskService({
        tasks: getTasksRepository(),
        contacts,
        companies,
        deals,
        users,
      })

      return tasksService
    },
    get notes() {
      notesService ??= createNoteService({
        notes: getNotesRepository(),
        contacts,
        companies,
        deals,
        users,
      })

      return notesService
    },
    get products() {
      productsService ??= createProductService({
        products: getProductsRepository(),
      })

      return productsService
    },
    get payments() {
      paymentsService ??= createPaymentService({
        payments: getPaymentsRepository(),
        contacts,
        deals,
      })

      return paymentsService
    },
    get contracts() {
      contractsService ??= createContractService({
        contracts: getContractsRepository(),
        contacts,
        companies,
        deals,
      })

      return contractsService
    },
    users: createUserService(users),
    get search() {
      const optionalProducts = getOptionalProductsRepository()
      const optionalPayments = getOptionalPaymentsRepository()
      const optionalContracts = getOptionalContractsRepository()

      searchService ??= createSearchService({
        companies,
        contacts,
        deals,
        pipelines,
        stages,
        users,
        ...(optionalProducts ? { products: optionalProducts } : {}),
        ...(optionalPayments ? { payments: optionalPayments } : {}),
        ...(optionalContracts ? { contracts: optionalContracts } : {}),
      })

      return searchService
    },
    schema: new OrbitSchemaEngine(),
    get contactContext() {
      const optionalActivities = getOptionalActivitiesRepository()
      const optionalTasks = getOptionalTasksRepository()

      contactContextService ??= createContactContextService({
        contacts,
        companies,
        deals,
        ...(optionalActivities ? { activities: optionalActivities } : {}),
        ...(optionalTasks ? { tasks: optionalTasks } : {}),
      })

      return contactContextService
    },
    system: {
      organizations: createOrganizationAdminService(organizations),
      organizationMemberships: createOrganizationMembershipAdminService(organizationMemberships),
      apiKeys: createApiKeyAdminService(apiKeys),
    },
  }
}

export type CoreServices = ReturnType<typeof createCoreServices>
