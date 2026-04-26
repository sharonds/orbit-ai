import type { SQL } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import {
  IMPLEMENTED_TENANT_TABLES,
  BOOTSTRAP_TABLES,
} from '../../repositories/tenant-scope.js'
import {
  POSTGRES_SCHEMA_NAME,
  initializePostgresWave1Schema,
  initializePostgresWave2SliceESchema,
  applyPostgresRlsDdl,
  applyPostgresOrgLeadingIndexes,
} from './schema.js'

function render(statement: SQL) {
  return statement.toQuery({
    escapeName: (value) => value,
    escapeParam: () => '?',
    escapeString: (value) => JSON.stringify(value),
    casing: { getColumnCasing: (column) => column },
    inlineParams: false,
    paramStartIndex: { value: 0 },
  })
}

function createRecordingDb(statements: string[]) {
  return {
    async transaction<T>(fn: (tx: { execute(statement: SQL): Promise<void> }) => Promise<T>) {
      return fn({
        async execute(statement: SQL) {
          statements.push(render(statement).sql)
        },
      })
    },
  }
}

describe('initializePostgresWave1Schema', () => {
  it('emits the expected wave 1 bootstrap statements', async () => {
    const statements: string[] = []
    const db = createRecordingDb(statements)

    await initializePostgresWave1Schema(db as never)

    expect(statements).toHaveLength(28)
    expect(statements[0]).toContain(`create schema if not exists ${POSTGRES_SCHEMA_NAME}`)
    expect(statements[1]).toContain(`set local search_path to ${POSTGRES_SCHEMA_NAME}, pg_temp`)
    expect(statements[2]).toContain('create table if not exists organizations')
    expect(statements[3]).toContain('create table if not exists users')
    expect(statements[8]).toContain('create table if not exists api_keys')
    expect(statements.at(-1)).toContain('create index if not exists deals_company_idx')
  })
})

describe('bootstrap DDL drift detection', () => {
  it('bootstrap DDL covers every tenant table in the shared inventory', async () => {
    const statements: string[] = []
    const db = createRecordingDb(statements)

    await initializePostgresWave2SliceESchema(db as never)

    // Extract table names from CREATE TABLE statements
    const tablesInBootstrap = new Set<string>()
    for (const stmt of statements) {
      const match = stmt.match(/create table if not exists (\w+)/)
      if (match) tablesInBootstrap.add(match[1])
    }

    // Every tenant table must have a CREATE TABLE in the bootstrap DDL
    for (const table of IMPLEMENTED_TENANT_TABLES) {
      expect(tablesInBootstrap.has(table), `tenant table "${table}" missing from bootstrap DDL`).toBe(true)
    }

    // Every bootstrap table must also be present
    for (const table of BOOTSTRAP_TABLES) {
      expect(tablesInBootstrap.has(table), `bootstrap table "${table}" missing from bootstrap DDL`).toBe(true)
    }

    // No unexpected tables in the DDL beyond the known inventory
    const allKnownTables = new Set<string>([...IMPLEMENTED_TENANT_TABLES, ...BOOTSTRAP_TABLES])
    for (const table of tablesInBootstrap) {
      expect(allKnownTables.has(table), `unexpected table "${table}" in bootstrap DDL not in tenant-scope inventory`).toBe(true)
    }
  })

  it('slice E bootstrap includes schema setup, org indexes, and RLS by default', async () => {
    const statements: string[] = []
    const db = createRecordingDb(statements)

    await initializePostgresWave2SliceESchema(db as never)

    expect(statements[0]).toContain(`create schema if not exists ${POSTGRES_SCHEMA_NAME}`)
    expect(statements[1]).toContain(`set local search_path to ${POSTGRES_SCHEMA_NAME}, pg_temp`)
    expect(statements.some((statement) => statement.includes('create index if not exists schema_migrations_org_idx'))).toBe(true)
    const schemaMigrationsDdl = statements.find((statement) => statement.includes('create table if not exists schema_migrations'))
    expect(schemaMigrationsDdl).toContain('checksum text not null')
    expect(schemaMigrationsDdl).toContain('adapter jsonb not null')
    expect(schemaMigrationsDdl).toContain('forward_operations jsonb not null')
    expect(schemaMigrationsDdl).toContain('reverse_operations jsonb not null')
    expect(schemaMigrationsDdl).toContain('status text not null')
    expect(statements.some((statement) => statement.includes('schema_migrations_target_idx'))).toBe(true)
    expect(statements.some((statement) => statement.includes(`create or replace function ${POSTGRES_SCHEMA_NAME}.current_org_id()`))).toBe(true)
    expect(statements.some((statement) => statement.includes(`alter table ${POSTGRES_SCHEMA_NAME}.users enable row level security`))).toBe(true)
  })

  it('slice E bootstrap can skip RLS for test environments that do not support it', async () => {
    const statements: string[] = []
    const db = createRecordingDb(statements)

    await initializePostgresWave2SliceESchema(db as never, { includeRls: false })

    expect(statements.some((statement) => statement.includes('create schema if not exists orbit'))).toBe(true)
    expect(statements.some((statement) => statement.includes('schema_migrations_org_idx'))).toBe(true)
    expect(statements.some((statement) => statement.includes('create policy'))).toBe(false)
    expect(statements.some((statement) => statement.includes('row level security'))).toBe(false)
  })
})

describe('applyPostgresRlsDdl', () => {
  it('emits the expected RLS bootstrap statements', async () => {
    const statements: string[] = []
    const db = {
      async execute(statement: SQL) {
        statements.push(render(statement).sql)
      },
    }

    await applyPostgresRlsDdl(db as never)

    // 1 helper function + 27 tenant tables × 9 statements each = 244
    expect(statements).toHaveLength(244)

    // Helper function
    expect(statements[0]).toContain('create or replace function')
    expect(statements[0]).toContain('current_org_id')
    expect(statements[0]).toContain(`${POSTGRES_SCHEMA_NAME}.current_org_id()`)

    // First tenant table (users): enable RLS + 4 ops × (drop + create) = 9 statements
    expect(statements[1]).toContain('alter table')
    expect(statements[1]).toContain('enable row level security')

    // Verify select policy pair (drop + create)
    expect(statements[2]).toContain('drop policy if exists')
    expect(statements[3]).toContain('create policy')
    expect(statements[3]).toContain('for select')

    // Verify insert policy pair
    expect(statements[4]).toContain('drop policy if exists')
    expect(statements[5]).toContain('create policy')
    expect(statements[5]).toContain('for insert')

    // Verify update policy pair
    expect(statements[6]).toContain('drop policy if exists')
    expect(statements[7]).toContain('create policy')
    expect(statements[7]).toContain('for update')

    // Verify delete policy pair
    expect(statements[8]).toContain('drop policy if exists')
    expect(statements[9]).toContain('create policy')
    expect(statements[9]).toContain('for delete')

    // Verify last statement is for the last tenant table (idempotency_keys)
    expect(statements.at(-1)).toContain('idempotency_keys')
    expect(statements.at(-1)).toContain('for delete')
  })
})

describe('applyPostgresOrgLeadingIndexes', () => {
  it('emits org-leading indexes for tables without them', async () => {
    const statements: string[] = []
    const db = {
      async execute(statement: SQL) {
        statements.push(render(statement).sql)
      },
    }

    await applyPostgresOrgLeadingIndexes(db as never)

    expect(statements).toHaveLength(15)
    // All statements are CREATE INDEX IF NOT EXISTS
    for (const stmt of statements) {
      expect(stmt).toMatch(/^create index if not exists \w+_org_idx/)
      expect(stmt).toContain('(organization_id)')
    }
    // Spot check specific tables
    expect(statements[0]).toContain('api_keys')
    expect(statements.at(-1)).toContain('schema_migrations')
  })
})
