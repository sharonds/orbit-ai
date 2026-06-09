import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asMigrationDatabase } from '../interface.js'
import { IMPLEMENTED_TENANT_TABLES } from '../../repositories/tenant-scope.js'
import { createPostgresStorageAdapter } from './adapter.js'
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
const shouldRunAuthorityRoles = shouldRun && process.env.ORBIT_TEST_POSTGRES_AUTHORITY_ROLES === '1'

const orgA = 'org_01ARYZ6S41YYYYYYYYYYYYYYYY'
const orgB = 'org_01ARYZ6S41ZZZZZZZZZZZZZZZZ'

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function roleConnectionString(role: string, password: string): string {
  const url = new URL(connectionString!)
  url.username = role
  url.password = password
  return url.toString()
}

async function seedAuthorityBoundaryRows(db: ReturnType<typeof createPostgresOrbitDatabase>) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into organizations (id, name, slug, plan, is_active, settings, created_at, updated_at)
      values
        (${orgA}, ${'Alpha'}, ${'alpha'}, ${'community'}, ${true}, ${{}}, ${new Date('2026-04-01T00:00:00.000Z')}, ${new Date('2026-04-01T00:00:00.000Z')}),
        (${orgB}, ${'Beta'}, ${'beta'}, ${'community'}, ${true}, ${{}}, ${new Date('2026-04-01T00:00:00.000Z')}, ${new Date('2026-04-01T00:00:00.000Z')})
      on conflict (id) do nothing
    `)

    await tx.execute(sql`
      insert into custom_field_definitions (
        id,
        organization_id,
        entity_type,
        field_name,
        field_type,
        label,
        options,
        validation,
        created_at,
        updated_at
      ) values
        (
          ${'cfd_authority_a'},
          ${orgA},
          ${'contacts'},
          ${'alpha_field'},
          ${'text'},
          ${'Alpha field'},
          ${sql.raw(`'[]'::jsonb`)},
          ${sql.raw(`'{}'::jsonb`)},
          ${new Date('2026-04-01T00:00:00.000Z')},
          ${new Date('2026-04-01T00:00:00.000Z')}
        ),
        (
          ${'cfd_authority_b'},
          ${orgB},
          ${'contacts'},
          ${'beta_field'},
          ${'text'},
          ${'Beta field'},
          ${sql.raw(`'[]'::jsonb`)},
          ${sql.raw(`'{}'::jsonb`)},
          ${new Date('2026-04-01T00:00:00.000Z')},
          ${new Date('2026-04-01T00:00:00.000Z')}
        )
      on conflict (id) do nothing
    `)

    await tx.execute(sql`
      insert into schema_migrations (
        id,
        organization_id,
        checksum,
        adapter,
        description,
        operation_type,
        forward_operations,
        reverse_operations,
        status,
        sql_statements,
        rollback_statements,
        created_at,
        updated_at
      ) values
        (
          ${'migration_authority_a'},
          ${orgA},
          ${'checksum-a'},
          ${sql.raw(`'{"name":"postgres","dialect":"postgres"}'::jsonb`)},
          ${'Alpha migration'},
          ${'custom_field'},
          ${sql.raw(`'[]'::jsonb`)},
          ${sql.raw(`'[]'::jsonb`)},
          ${'applied'},
          ${sql.raw(`'[]'::jsonb`)},
          ${sql.raw(`'[]'::jsonb`)},
          ${new Date('2026-04-01T00:00:00.000Z')},
          ${new Date('2026-04-01T00:00:00.000Z')}
        ),
        (
          ${'migration_authority_b'},
          ${orgB},
          ${'checksum-b'},
          ${sql.raw(`'{"name":"postgres","dialect":"postgres"}'::jsonb`)},
          ${'Beta migration'},
          ${'custom_field'},
          ${sql.raw(`'[]'::jsonb`)},
          ${sql.raw(`'[]'::jsonb`)},
          ${'applied'},
          ${sql.raw(`'[]'::jsonb`)},
          ${sql.raw(`'[]'::jsonb`)},
          ${new Date('2026-04-01T00:00:00.000Z')},
          ${new Date('2026-04-01T00:00:00.000Z')}
        )
      on conflict (id) do nothing
    `)
  })
}

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
    await pool.end()
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

describe.skipIf(!shouldRunAuthorityRoles)('live postgres migration/runtime authority boundary', () => {
  let adminPool: Pool
  let migrationPool: Pool
  let runtimePool: Pool
  let migrationDatabase: ReturnType<typeof createPostgresOrbitDatabase>
  let runtimeDatabase: ReturnType<typeof createPostgresOrbitDatabase>
  let migrationRole: string
  let runtimeRole: string
  let migrationPassword: string
  let runtimePassword: string

  beforeAll(async () => {
    adminPool = new Pool({ connectionString })
    const suffix = `${process.pid}_${Date.now().toString(36)}`
    migrationRole = `orb_mig_${suffix}`
    runtimeRole = `orb_run_${suffix}`
    migrationPassword = `migration_${suffix}`
    runtimePassword = `runtime_${suffix}`

    await adminPool.query(`drop schema if exists ${POSTGRES_SCHEMA_NAME} cascade`)
    await adminPool.query(`create role ${quoteIdent(migrationRole)} login password ${quoteLiteral(migrationPassword)}`)
    await adminPool.query(`create role ${quoteIdent(runtimeRole)} login password ${quoteLiteral(runtimePassword)}`)

    const databaseResult = await adminPool.query<{ database_name: string }>('select current_database() as database_name')
    const databaseName = databaseResult.rows[0]?.database_name
    if (!databaseName) {
      throw new Error('Could not resolve live Postgres test database name')
    }

    await adminPool.query(`grant connect on database ${quoteIdent(databaseName)} to ${quoteIdent(migrationRole)}`)
    await adminPool.query(`grant connect on database ${quoteIdent(databaseName)} to ${quoteIdent(runtimeRole)}`)
    await adminPool.query(`grant create on database ${quoteIdent(databaseName)} to ${quoteIdent(migrationRole)}`)
    await adminPool.query(`revoke create on database ${quoteIdent(databaseName)} from ${quoteIdent(runtimeRole)}`)

    migrationPool = new Pool({ connectionString: roleConnectionString(migrationRole, migrationPassword), max: 1 })
    runtimePool = new Pool({ connectionString: roleConnectionString(runtimeRole, runtimePassword), max: 1 })
    migrationDatabase = createPostgresOrbitDatabase({ pool: migrationPool })
    runtimeDatabase = createPostgresOrbitDatabase({ pool: runtimePool })

    const adapter = createPostgresStorageAdapter({
      database: runtimeDatabase,
      migrationDatabase: asMigrationDatabase(migrationDatabase),
    })
    await adapter.migrate()

    await migrationDatabase.transaction(async (tx) => {
      await tx.execute(sql.raw(`grant usage on schema ${POSTGRES_SCHEMA_NAME} to ${quoteIdent(runtimeRole)}`))
      await tx.execute(sql.raw(
        `grant select, insert, update, delete on all tables in schema ${POSTGRES_SCHEMA_NAME} to ${quoteIdent(runtimeRole)}`,
      ))
    })
    await seedAuthorityBoundaryRows(migrationDatabase)
  })

  afterAll(async () => {
    await runtimePool?.end()
    await migrationPool?.end()

    if (adminPool) {
      await adminPool.query(`drop schema if exists ${POSTGRES_SCHEMA_NAME} cascade`)
      if (runtimeRole) {
        await adminPool.query(`drop owned by ${quoteIdent(runtimeRole)}`)
        await adminPool.query(`drop role if exists ${quoteIdent(runtimeRole)}`)
      }
      if (migrationRole) {
        await adminPool.query(`drop owned by ${quoteIdent(migrationRole)}`)
        await adminPool.query(`drop role if exists ${quoteIdent(migrationRole)}`)
      }
      await adminPool.end()
    }
  })

  it('runs bootstrap migrations through the migration role authority', async () => {
    const ownerRows = await adminPool.query<{ tableowner: string }>(
      `select tableowner
       from pg_tables
       where schemaname = $1 and tablename = 'schema_migrations'`,
      [POSTGRES_SCHEMA_NAME],
    )

    expect(ownerRows.rows[0]?.tableowner).toBe(migrationRole)
  })

  it('prevents the runtime role from executing schema or policy DDL', async () => {
    await expect(
      runtimeDatabase.execute(sql.raw('create schema runtime_schema_probe')),
    ).rejects.toThrow()

    await expect(
      runtimeDatabase.execute(sql.raw(`create table ${POSTGRES_SCHEMA_NAME}.runtime_ddl_probe (id text primary key)`)),
    ).rejects.toThrow()

    await expect(
      runtimeDatabase.execute(sql.raw(`alter table ${POSTGRES_SCHEMA_NAME}.custom_field_definitions add column runtime_probe text`)),
    ).rejects.toThrow()

    await expect(
      runtimeDatabase.execute(sql.raw(`alter table ${POSTGRES_SCHEMA_NAME}.custom_field_definitions disable row level security`)),
    ).rejects.toThrow()
  })

  it('enforces RLS for runtime custom field and schema migration metadata reads', async () => {
    const outsideCustomFields = await runtimeDatabase.query<{ id: string }>(
      sql`select id from custom_field_definitions order by id asc`,
    )
    const outsideSchemaMigrations = await runtimeDatabase.query<{ id: string }>(
      sql`select id from schema_migrations order by id asc`,
    )

    const customFieldsForOrgA = await withTenantContext(runtimeDatabase, { orgId: orgA }, async (tx) =>
      tx.query<{ id: string }>(sql`select id from custom_field_definitions order by id asc`)
    )
    const schemaMigrationsForOrgA = await withTenantContext(runtimeDatabase, { orgId: orgA }, async (tx) =>
      tx.query<{ id: string }>(sql`select id from schema_migrations order by id asc`)
    )

    await expect(withTenantContext(runtimeDatabase, { orgId: orgA }, async (tx) =>
      tx.execute(sql`
        insert into custom_field_definitions (
          id,
          organization_id,
          entity_type,
          field_name,
          field_type,
          label,
          options,
          validation,
          created_at,
          updated_at
        ) values (
          ${'cfd_cross_tenant_insert'},
          ${orgB},
          ${'contacts'},
          ${'cross_tenant'},
          ${'text'},
          ${'Cross tenant'},
          ${sql.raw(`'[]'::jsonb`)},
          ${sql.raw(`'{}'::jsonb`)},
          ${new Date('2026-04-01T00:00:00.000Z')},
          ${new Date('2026-04-01T00:00:00.000Z')}
        )
      `)
    )).rejects.toThrow()

    await expect(runtimeDatabase.transaction(async (tx) => {
      await tx.execute(sql.raw('set local row_security = off'))
      await tx.query<{ id: string }>(sql`select id from custom_field_definitions`)
    })).rejects.toThrow()

    expect(outsideCustomFields).toEqual([])
    expect(outsideSchemaMigrations).toEqual([])
    expect(customFieldsForOrgA.map((row) => row.id)).toEqual(['cfd_authority_a'])
    expect(schemaMigrationsForOrgA.map((row) => row.id)).toEqual(['migration_authority_a'])
  })

  it('keeps runtime tenant context transaction-local for distinct runtime roles', async () => {
    const inside = await withTenantContext(runtimeDatabase, { orgId: orgA }, async (tx) =>
      tx.query<{ current_org_id: string | null }>(
        sql`select current_setting('app.current_org_id', true) as current_org_id`,
      )
    )

    const after = await runtimeDatabase.query<{ current_org_id: string | null }>(
      sql`select current_setting('app.current_org_id', true) as current_org_id`,
    )

    expect(inside[0]?.current_org_id).toBe(orgA)
    expect(after[0]?.current_org_id ?? null).toBeNull()
  })
})
