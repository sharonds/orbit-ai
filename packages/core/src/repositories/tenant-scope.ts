import { assertOrbitId } from '../ids/parse-id.js'
import type { AdapterDialect, OrbitAuthContext } from '../adapters/interface.js'

export const BOOTSTRAP_TABLES = ['organizations'] as const
export const IMPLEMENTED_TENANT_TABLES = [
  'users',
  'organization_memberships',
  'api_keys',
  'companies',
  'contacts',
  'pipelines',
  'stages',
  'deals',
  'activities',
  'tasks',
  'notes',
  'products',
  'payments',
  'contracts',
  'sequences',
  'sequence_steps',
  'sequence_enrollments',
  'sequence_events',
  'tags',
  'entity_tags',
  'imports',
  'webhooks',
  'webhook_deliveries',
] as const

export type BootstrapTableName = (typeof BOOTSTRAP_TABLES)[number]
export type ImplementedTenantTableName = (typeof IMPLEMENTED_TENANT_TABLES)[number]
export type ImplementedTableName = BootstrapTableName | ImplementedTenantTableName
export type RepositoryTableScope = 'bootstrap' | 'tenant'

export interface RepositoryScopeContext extends Pick<OrbitAuthContext, 'orgId'> {
  dialect: AdapterDialect
}

export interface RepositoryFilter {
  field: string
  operator: 'eq'
  value: string
  source: 'tenant_context'
}

export interface TenantScopePlan {
  tableName: ImplementedTableName
  scope: RepositoryTableScope
  filters: RepositoryFilter[]
  requiresAppLevelTenantFilter: boolean
  requiresPostgresTenantContext: boolean
}

export function getRepositoryTableScope(tableName: ImplementedTableName): RepositoryTableScope {
  return (BOOTSTRAP_TABLES as readonly string[]).includes(tableName) ? 'bootstrap' : 'tenant'
}

export function buildTenantScopePlan(
  tableName: ImplementedTableName,
  context: RepositoryScopeContext,
): TenantScopePlan {
  const scope = getRepositoryTableScope(tableName)

  if (scope === 'bootstrap') {
    return {
      tableName,
      scope,
      filters: [],
      requiresAppLevelTenantFilter: false,
      requiresPostgresTenantContext: false,
    }
  }

  const organizationId = assertOrbitId(context.orgId, 'organization')

  return {
    tableName,
    scope,
    filters: [
      {
        field: 'organizationId',
        operator: 'eq',
        value: organizationId,
        source: 'tenant_context',
      },
    ],
    requiresAppLevelTenantFilter: true,
    requiresPostgresTenantContext: context.dialect === 'postgres',
  }
}
