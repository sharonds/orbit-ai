import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, StorageAdapter } from '../../adapters/interface.js'
import { assertTenantPatchOrganizationInvariant } from '../tenant-guards.js'
import { assertOrgContext, runArrayQuery } from '../../services/service-helpers.js'
import type { SearchQuery } from '../../types/api.js'
import type { InternalPaginatedResult } from '../../types/pagination.js'

type PostgresPrimitive = string | number | boolean | Date | object | null

interface TenantRepositoryShape<TRecord extends { id: string } & Record<string, unknown>> {
  create(ctx: OrbitAuthContext, record: TRecord): Promise<TRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<TRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<TRecord>): Promise<TRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<TRecord>>
}

interface AdminRepositoryShape<TRecord extends { id: string } & Record<string, unknown>> {
  create(record: TRecord): Promise<TRecord>
  get(id: string): Promise<TRecord | null>
  list(query: SearchQuery): Promise<InternalPaginatedResult<TRecord>>
}

interface PostgresRepositoryConfig<TRecord extends { id: string } & Record<string, unknown>> {
  tableName: string
  columns: readonly string[]
  searchableFields: string[]
  filterableFields?: string[]
  defaultSort: SearchQuery['sort']
  serialize(record: TRecord): Record<string, PostgresPrimitive>
  deserialize(row: Record<string, unknown>): TRecord
  onCreateError?(error: unknown, record: TRecord): never
}

function buildInsertStatement(
  tableName: string,
  row: Record<string, PostgresPrimitive>,
  columns: readonly string[],
) {
  const columnSql = sql.join(columns.map((column) => sql.raw(column)), sql`, `)
  const valueSql = sql.join(columns.map((column) => sql`${row[column] ?? null}`), sql`, `)

  return sql`insert into ${sql.raw(tableName)} (${columnSql}) values (${valueSql})`
}

function buildUpdateStatement(
  tableName: string,
  row: Record<string, PostgresPrimitive>,
  columns: readonly string[],
  predicate: ReturnType<typeof sql.join>,
) {
  const assignmentColumns = columns.filter((column) => column !== 'id')
  const assignmentSql = sql.join(
    assignmentColumns.map((column) => sql`${sql.raw(column)} = ${row[column] ?? null}`),
    sql`, `,
  )

  return sql`update ${sql.raw(tableName)} set ${assignmentSql} where ${predicate}`
}

function buildSelectByIdStatement(tableName: string, predicate: ReturnType<typeof sql.join>) {
  return sql`select * from ${sql.raw(tableName)} where ${predicate} limit 1`
}

function buildTenantSelectStatement(tableName: string, predicate: ReturnType<typeof sql.join>) {
  return sql`select * from ${sql.raw(tableName)} where ${predicate}`
}

function buildBootstrapSelectStatement(tableName: string) {
  return sql`select * from ${sql.raw(tableName)}`
}

function buildDeleteStatement(tableName: string, predicate: ReturnType<typeof sql.join>) {
  return sql`delete from ${sql.raw(tableName)} where ${predicate}`
}

function buildTenantPredicate(ctx: OrbitAuthContext, id?: string) {
  const orgId = assertOrgContext(ctx)
  const clauses = [sql`organization_id = ${orgId}`]

  if (id) {
    clauses.unshift(sql`id = ${id}`)
  }

  return sql.join(clauses, sql` and `)
}

function buildIdPredicate(id: string) {
  return sql.join([sql`id = ${id}`], sql` and `)
}

export function createTenantPostgresRepository<
  TRecord extends { id: string } & Record<string, unknown>,
>(
  adapter: StorageAdapter,
  config: PostgresRepositoryConfig<TRecord>,
): TenantRepositoryShape<TRecord> {
  async function listScopedRows(ctx: OrbitAuthContext): Promise<TRecord[]> {
    return adapter.withTenantContext(ctx, async (db) => {
      const rows = await db.query<Record<string, unknown>>(
        buildTenantSelectStatement(config.tableName, buildTenantPredicate(ctx)),
      )
      return rows.map((row) => config.deserialize(row))
    })
  }

  return {
    async create(ctx, record) {
      const organizationId = assertOrgContext(ctx)
      if ((record as { organizationId?: string }).organizationId !== organizationId) {
        throw new Error('Tenant record organization mismatch')
      }

      const row = config.serialize(record)
      try {
        await adapter.withTenantContext(ctx, async (db) => {
          await db.execute(buildInsertStatement(config.tableName, row, config.columns))
        })
      } catch (error) {
        config.onCreateError?.(error, record)
        throw error
      }
      return record
    },
    async get(ctx, id) {
      return adapter.withTenantContext(ctx, async (db) => {
        const rows = await db.query<Record<string, unknown>>(
          buildSelectByIdStatement(config.tableName, buildTenantPredicate(ctx, id)),
        )
        return rows[0] ? config.deserialize(rows[0]) : null
      })
    },
    async update(ctx, id, patch) {
      return adapter.withTenantContext(ctx, async (db) => {
        const rows = await db.query<Record<string, unknown>>(
          buildSelectByIdStatement(config.tableName, buildTenantPredicate(ctx, id)),
        )
        const current = rows[0] ? config.deserialize(rows[0]) : null
        if (!current) {
          return null
        }

        assertTenantPatchOrganizationInvariant((current as { organizationId?: unknown }).organizationId, patch)

        const next = {
          ...current,
          ...patch,
        } as TRecord
        const row = config.serialize(next)

        await db.execute(buildUpdateStatement(config.tableName, row, config.columns, buildTenantPredicate(ctx, id)))
        return next
      })
    },
    async delete(ctx, id) {
      return adapter.withTenantContext(ctx, async (db) => {
        const rows = await db.query<Record<string, unknown>>(
          buildSelectByIdStatement(config.tableName, buildTenantPredicate(ctx, id)),
        )
        if (!rows[0]) {
          return false
        }

        await db.execute(buildDeleteStatement(config.tableName, buildTenantPredicate(ctx, id)))
        return true
      })
    },
    async list(ctx, query) {
      const options = {
        searchableFields: config.searchableFields,
        ...(config.defaultSort ? { defaultSort: config.defaultSort } : {}),
      }
      return runArrayQuery(await listScopedRows(ctx), query, {
        ...options,
        ...(config.filterableFields ? { filterableFields: config.filterableFields } : {}),
      })
    },
    async search(ctx, query) {
      const options = {
        searchableFields: config.searchableFields,
        ...(config.defaultSort ? { defaultSort: config.defaultSort } : {}),
      }
      return runArrayQuery(await listScopedRows(ctx), query, {
        ...options,
        ...(config.filterableFields ? { filterableFields: config.filterableFields } : {}),
      })
    },
  }
}

export function createBootstrapPostgresRepository<
  TRecord extends { id: string } & Record<string, unknown>,
>(
  adapter: StorageAdapter,
  config: PostgresRepositoryConfig<TRecord>,
): AdminRepositoryShape<TRecord> {
  async function listRows(): Promise<TRecord[]> {
    const rows = await adapter.query<Record<string, unknown>>(buildBootstrapSelectStatement(config.tableName))
    return rows.map((row) => config.deserialize(row))
  }

  return {
    async create(record) {
      const row = config.serialize(record)
      await adapter.transaction(async (db) => {
        await db.execute(buildInsertStatement(config.tableName, row, config.columns))
      })
      return record
    },
    async get(id) {
      const rows = await adapter.query<Record<string, unknown>>(
        buildSelectByIdStatement(config.tableName, buildIdPredicate(id)),
      )
      return rows[0] ? config.deserialize(rows[0]) : null
    },
    async list(query) {
      const options = {
        searchableFields: config.searchableFields,
        ...(config.defaultSort ? { defaultSort: config.defaultSort } : {}),
      }
      return runArrayQuery(await listRows(), query, {
        ...options,
        ...(config.filterableFields ? { filterableFields: config.filterableFields } : {}),
      })
    },
  }
}

export function fromPostgresDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value
  }

  return typeof value === 'string' && value.length > 0 ? new Date(value) : null
}

export function fromPostgresBoolean(value: unknown): boolean {
  return value === true || value === 't' || value === 1
}

export function fromPostgresJson<T>(value: unknown, fallback: T): T {
  if (value === null) {
    // Distinct from `undefined`: SQL NULL is a meaningful value when the
    // jsonb column allows it. Callers that pass a non-null fallback can
    // still distinguish via the typed shape.
    return null as unknown as T
  }
  if (value === undefined) {
    return fallback
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  // L10: scalar primitives stored in jsonb columns (numbers, booleans)
  // were previously dropped to the fallback. Postgres `jsonb` accepts
  // any valid JSON document, including bare numbers and booleans, so
  // these are legitimate values and must round-trip cleanly.
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value as unknown as T
  }

  if (typeof value === 'object') {
    return value as T
  }

  return fallback
}
