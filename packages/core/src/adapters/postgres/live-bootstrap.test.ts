import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IMPLEMENTED_TENANT_TABLES } from '../../repositories/tenant-scope.js'
import { createPostgresOrbitDatabase } from './database.js'
import { withTenantContext } from './tenant-context.js'
import {
  initializePostgresWave2SliceESchema,
  POSTGRES_SCHEMA_NAME,
  POSTGRES_SCHEMA_SEARCH_PATH,
} from './schema.js'

const connectionString = process.env.ORBIT_TEST_POSTGRES_URL
const allowSchemaReset = process.env.ORBIT_TEST_POSTGRES_ALLOW_SCHEMA_RESET === '1'
const shouldRun = Boolean(connectionString && allowSchemaReset)

describe.skipIf(!shouldRun)('live postgres tenant hardening bootstrap', () => {
  let pool: Pool
  let database: ReturnType<typeof createPostgresOrbitDatabase>

  beforeAll(async () => {
    pool = new Pool({ connectionString })
    database = createPostgresOrbitDatabase({ pool })

    // This suite is opt-in and intended for a dedicated test database only.
    await pool.query(`drop schema if exists ${POSTGRES_SCHEMA_NAME} cascade`)
    await initializePostgresWave2SliceESchema(database)
  })

  afterAll(async () => {
    await pool.query(`drop schema if exists ${POSTGRES_SCHEMA_NAME} cascade`)
    await database.close()
  })

  it('applies tenant tables, org-leading indexes, and RLS policies to a real Postgres instance', async () => {
    const tablesResult = await pool.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = $1
       order by table_name asc`,
      [POSTGRES_SCHEMA_NAME],
    )
    const policyResult = await pool.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname
       from pg_policies
       where schemaname = $1
       order by tablename asc, policyname asc`,
      [POSTGRES_SCHEMA_NAME],
    )
    const indexesResult = await pool.query<{ tablename: string; indexname: string }>(
      `select tablename, indexname
       from pg_indexes
       where schemaname = $1
       order by tablename asc, indexname asc`,
      [POSTGRES_SCHEMA_NAME],
    )

    const tables = new Set(tablesResult.rows.map((row) => row.table_name))
    const policyNamesByTable = new Map<string, Set<string>>()
    for (const row of policyResult.rows) {
      const names = policyNamesByTable.get(row.tablename) ?? new Set<string>()
      names.add(row.policyname)
      policyNamesByTable.set(row.tablename, names)
    }
    const indexNames = new Set(indexesResult.rows.map((row) => `${row.tablename}:${row.indexname}`))

    for (const table of IMPLEMENTED_TENANT_TABLES) {
      expect(tables.has(table), `missing table ${table}`).toBe(true)
      expect(policyNamesByTable.get(table)).toEqual(
        new Set([
          `${table}_select`,
          `${table}_insert`,
          `${table}_update`,
          `${table}_delete`,
        ]),
      )
    }

    expect(indexNames.has('schema_migrations:schema_migrations_org_idx')).toBe(true)
    expect(indexNames.has('webhook_deliveries:webhook_deliveries_org_idx')).toBe(true)
  })

  it('pins search_path and preserves transaction-local tenant context on a real Postgres instance', async () => {
    const outside = await database.query<{ search_path: string }>(
      sql`select current_setting('search_path') as search_path`,
    )

    const inside = await withTenantContext(
      database,
      { orgId: 'org_01ABCDEF0123456789ABCDEF01' },
      async (tx) =>
        tx.query<{ search_path: string; current_org_id: string | null }>(
          sql`select
                current_setting('search_path') as search_path,
                current_setting('app.current_org_id', true) as current_org_id`,
        ),
    )

    const after = await database.query<{ current_org_id: string | null }>(
      sql`select current_setting('app.current_org_id', true) as current_org_id`,
    )

    expect(outside[0]?.search_path).toBe(POSTGRES_SCHEMA_SEARCH_PATH)
    expect(inside[0]?.search_path).toBe(POSTGRES_SCHEMA_SEARCH_PATH)
    expect(inside[0]?.current_org_id).toBe('org_01ABCDEF0123456789ABCDEF01')
    expect(after[0]?.current_org_id ?? null).toBeNull()
  })
})
