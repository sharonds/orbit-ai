import type { AdapterDialect, OrbitAuthContext } from '../adapters/interface.js'
import { decodeCursorWithOrgCheck, type CursorPayload } from '../query/cursor.js'
import { normalizeListQuery, type NormalizedListQuery } from '../query/list-query.js'
import type { SortSpec } from '../types/api.js'
import {
  buildTenantScopePlan,
  type ImplementedTableName,
  type RepositoryFilter,
  type RepositoryTableScope,
} from './tenant-scope.js'

export interface RepositoryContext extends Pick<OrbitAuthContext, 'orgId'> {
  dialect: AdapterDialect
}

export interface RepositoryListPlan {
  tableName: ImplementedTableName
  scope: RepositoryTableScope
  filters: RepositoryFilter[]
  include: string[]
  limit: number
  sort: SortSpec[]
  cursor: CursorPayload | null
  requiresAppLevelTenantFilter: boolean
  requiresPostgresTenantContext: boolean
}

export interface RepositoryGetPlan {
  tableName: ImplementedTableName
  scope: RepositoryTableScope
  filters: RepositoryFilter[]
  id: string
  requiresAppLevelTenantFilter: boolean
  requiresPostgresTenantContext: boolean
}

export function buildRepositoryListPlan(input: {
  tableName: ImplementedTableName
  context: RepositoryContext
  query?: Parameters<typeof normalizeListQuery>[0]
  defaultSort?: SortSpec[]
  defaultLimit?: number
}): RepositoryListPlan {
  const normalizationOptions = {
    ...(input.defaultSort ? { defaultSort: input.defaultSort } : {}),
    ...(input.defaultLimit ? { defaultLimit: input.defaultLimit } : {}),
  }
  const normalized: NormalizedListQuery = normalizeListQuery(input.query, normalizationOptions)
  const scopePlan = buildTenantScopePlan(input.tableName, input.context)

  return {
    tableName: input.tableName,
    scope: scopePlan.scope,
    filters: scopePlan.filters,
    include: normalized.include,
    limit: normalized.limit,
    sort: normalized.sort,
    cursor: normalized.cursor ? decodeCursorWithOrgCheck(normalized.cursor, input.context.orgId) : null,
    requiresAppLevelTenantFilter: scopePlan.requiresAppLevelTenantFilter,
    requiresPostgresTenantContext: scopePlan.requiresPostgresTenantContext,
  }
}

export function buildRepositoryGetPlan(input: {
  tableName: ImplementedTableName
  context: RepositoryContext
  id: string
}): RepositoryGetPlan {
  const scopePlan = buildTenantScopePlan(input.tableName, input.context)

  return {
    tableName: input.tableName,
    scope: scopePlan.scope,
    filters: scopePlan.filters,
    id: input.id,
    requiresAppLevelTenantFilter: scopePlan.requiresAppLevelTenantFilter,
    requiresPostgresTenantContext: scopePlan.requiresPostgresTenantContext,
  }
}
