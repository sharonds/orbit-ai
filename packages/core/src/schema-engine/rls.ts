/**
 * Postgres Row-Level Security DDL generation.
 *
 * SPEC DEVIATION (intentional): The frozen spec (docs/specs/01-core.md) defines a
 * module-local `TENANT_TABLES` const inside this file. This implementation instead
 * imports `IMPLEMENTED_TENANT_TABLES` from `../repositories/tenant-scope.js` so
 * that a single source of truth exists for the tenant-table inventory. All
 * hardening layers (RLS, bootstrap coverage, schema helpers) consume that same
 * list, and drift-detection tests ensure they stay in sync.
 */

import {
  BOOTSTRAP_TABLES,
  IMPLEMENTED_TENANT_TABLES,
} from '../repositories/tenant-scope.js'

/**
 * Generates idempotent Postgres RLS SQL statements for every implemented tenant
 * table. Emits:
 *
 * 1. A `current_org_id()` helper function (CREATE OR REPLACE — already idempotent).
 * 2. Per-table: ALTER TABLE … ENABLE ROW LEVEL SECURITY.
 * 3. Per-table per-operation: DROP POLICY IF EXISTS + CREATE POLICY for select,
 *    insert, update, and delete.
 *
 * Bootstrap tables (e.g. `organizations`) are intentionally excluded — they have
 * no `organization_id` column and must not receive tenant RLS policies.
 */
export function generatePostgresRlsSql(schema = 'orbit'): string[] {
  const statements: string[] = [
    `create or replace function ${schema}.current_org_id() returns text language sql stable as $$ select current_setting('app.current_org_id', true) $$;`,
  ]

  const bootstrapSet = new Set<string>(BOOTSTRAP_TABLES)

  for (const table of IMPLEMENTED_TENANT_TABLES) {
    // Safety: skip any table that somehow appears in both lists.
    if (bootstrapSet.has(table)) continue

    const fqn = `${schema}.${table}`
    const orgExpr = `${schema}.current_org_id()`

    statements.push(`alter table ${fqn} enable row level security;`)

    // select
    statements.push(
      `drop policy if exists ${table}_select on ${fqn};`,
      `create policy ${table}_select on ${fqn} for select using (organization_id = ${orgExpr});`,
    )

    // insert
    statements.push(
      `drop policy if exists ${table}_insert on ${fqn};`,
      `create policy ${table}_insert on ${fqn} for insert with check (organization_id = ${orgExpr});`,
    )

    // update
    statements.push(
      `drop policy if exists ${table}_update on ${fqn};`,
      `create policy ${table}_update on ${fqn} for update using (organization_id = ${orgExpr}) with check (organization_id = ${orgExpr});`,
    )

    // delete
    statements.push(
      `drop policy if exists ${table}_delete on ${fqn};`,
      `create policy ${table}_delete on ${fqn} for delete using (organization_id = ${orgExpr});`,
    )
  }

  return statements
}
