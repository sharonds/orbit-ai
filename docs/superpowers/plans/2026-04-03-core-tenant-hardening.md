# Core Tenant Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Postgres-family tenant-isolation gaps by generating RLS DDL, wiring it into bootstrap, establishing a shared tenant-table allowlist with drift assertions, and auditing org-leading indexes.

**Architecture:** A new `schema-engine/rls.ts` module generates Postgres RLS SQL from the canonical tenant-table inventory in `tenant-scope.ts`. The Postgres bootstrap path (`adapters/postgres/schema.ts`) applies the generated RLS as part of its baseline provisioning. Drift assertion tests ensure tenant-scope registration, RLS generation, and bootstrap coverage stay in lockstep. Org-leading indexes are added where repository list/search patterns justify them; all other non-org-leading indexes are documented as intentional exceptions.

**Tech Stack:** TypeScript (strict), Vitest, Drizzle ORM `sql.raw()`, Postgres RLS DDL

**Branch:** `core-tenant-hardening` from `main`

**Depends on:**
- [core-tenant-hardening-plan.md](/docs/execution/core-tenant-hardening-plan.md) (scope and constraints)
- [01-core.md](/docs/specs/01-core.md) lines 1267-1366 (frozen RLS contract)
- [security-architecture.md](/docs/security/security-architecture.md)
- [database-hardening-checklist.md](/docs/security/database-hardening-checklist.md)

**Execution principles (from hardening plan):**
1. Do not widen the public service registry
2. Do not remove explicit repository tenant filters after RLS lands
3. Treat RLS as defense in depth, not a replacement for app-layer enforcement
4. Keep runtime authority and migration authority separate
5. Keep SQLite behavior unchanged
6. One shared source of truth for tenant-table names
7. Document intentional index exceptions rather than leaving silent drift

---

## Reconciliation: Tenant Table Lists

The spec (`01-core.md` lines 1311-1339) and `tenant-scope.ts` both list exactly **27 tenant tables**. They are identical in content, differing only in order. No drift exists. The canonical source for implementation is `IMPLEMENTED_TENANT_TABLES` in `tenant-scope.ts`.

**Bootstrap table (excluded from RLS):** `organizations`

**27 tenant tables (receive RLS):**
`users`, `organization_memberships`, `api_keys`, `companies`, `contacts`, `pipelines`, `stages`, `deals`, `activities`, `tasks`, `notes`, `products`, `payments`, `contracts`, `sequences`, `sequence_steps`, `sequence_enrollments`, `sequence_events`, `tags`, `entity_tags`, `imports`, `webhooks`, `webhook_deliveries`, `custom_field_definitions`, `audit_logs`, `schema_migrations`, `idempotency_keys`

---

## Index Audit Summary

Classification of all 32 non-org-leading indexes against actual repository access patterns:

**INTENTIONAL EXCEPTION — auth lookups (3 indexes):**
These serve pre-tenant cross-org auth lookups via `lookupApiKeyForAuth()` and must NOT be org-leading:
- `api_keys_hash_idx` on (key_hash)
- `api_keys_prefix_idx` on (key_prefix)
- `users_external_auth_idx` on (external_auth_id)

**INTENTIONAL EXCEPTION — FK constraint / parent-scoped navigation (15 indexes):**
These support FK constraint checks and join navigation where the parent entity is already org-scoped. Under RLS, the planner applies the org filter at the table scan level, and FK references are already constrained to the same org via parent validation. Adding org_id would break FK constraint usage without meaningful query benefit:
- `contacts_company_idx` on (company_id)
- `deals_stage_idx` on (stage_id)
- `deals_pipeline_idx` on (pipeline_id)
- `deals_contact_idx` on (contact_id)
- `deals_company_idx` on (company_id)
- `activities_contact_idx` on (contact_id)
- `activities_deal_idx` on (deal_id)
- `activities_company_idx` on (company_id)
- `notes_contact_idx` on (contact_id)
- `notes_deal_idx` on (deal_id)
- `sequence_steps_order_idx` on (sequence_id, step_order)
- `sequence_enrollments_active_idx` on (sequence_id, contact_id, status)
- `sequence_events_enrollment_idx` on (sequence_enrollment_id)
- `webhook_deliveries_event_idx` on (webhook_id, event_id)
- `stages_pipeline_order_idx` on (pipeline_id, stage_order)
- `stages_pipeline_name_idx` on (pipeline_id, name)

**NEEDS ORG-LEADING — list/search access patterns (8 indexes):**
These are used in repository `list` and `search` queries where the primary access pattern is `WHERE organization_id = ? AND <column> = ?` or `WHERE organization_id = ? ORDER BY <column>`. Adding org-leading composites gives the planner a direct seek path under RLS:
- `companies_assigned_to_idx` → replace with `(organization_id, assigned_to_user_id)`
- `contacts_assigned_to_idx` → replace with `(organization_id, assigned_to_user_id)`
- `tasks_assigned_to_idx` → replace with `(organization_id, assigned_to_user_id)`
- `tasks_due_date_idx` → replace with `(organization_id, due_date)`
- `activities_occurred_at_idx` → replace with `(organization_id, occurred_at)`
- `imports_entity_type_idx` → replace with `(organization_id, entity_type)`
- `products_sort_order_idx` → replace with `(organization_id, sort_order)`
- `audit_logs_occurred_at_idx` → replace with `(organization_id, occurred_at)`

**LOW VALUE — status/low-cardinality without org-scoped list patterns (6 indexes):**
These filter on low-cardinality status columns. While repositories always include org_id, the status columns provide minimal selectivity gain over a table scan within the org. RLS already constrains to org. Not worth the write amplification:
- `payments_status_idx` on (status)
- `contracts_status_idx` on (status)
- `webhooks_status_idx` on (status)
- `webhook_deliveries_next_attempt_idx` on (next_attempt_at)
- `schema_migrations_applied_at_idx` on (applied_at)

---

## File Structure

**New files:**
- `packages/core/src/schema-engine/rls.ts` — RLS SQL generation from tenant-table inventory
- `packages/core/src/schema-engine/rls.test.ts` — RLS generation unit tests
- `packages/core/src/repositories/tenant-scope.test.ts` — Allowlist drift assertion tests

**Modified files:**
- `packages/core/src/repositories/tenant-scope.ts` — Export the canonical inventory for RLS consumption
- `packages/core/src/adapters/postgres/schema.ts` — Wire RLS DDL into bootstrap; replace 8 indexes with org-leading versions
- `packages/core/src/adapters/postgres/schema.test.ts` — Assert RLS DDL is part of bootstrap output
- `packages/core/src/schema-engine/engine.ts` — Re-export `generatePostgresRlsSql` from schema-engine barrel (optional, keeps engine.ts as entry)

**Documentation:**
- `docs/review/core-tenant-hardening-review.md` — Review artifact
- `docs/KB.md` — Update current status

---

## Task 1: Create Branch

**Files:**
- None (git operation only)

- [ ] **Step 1: Create the feature branch from main**

```bash
git checkout main && git pull && git checkout -b core-tenant-hardening
```

- [ ] **Step 2: Verify clean state**

```bash
pnpm --filter @orbit-ai/core test
```

Expected: 243 tests passing, exit 0

---

## Task 2: Tenant-Table Allowlist Drift Assertions

**Files:**
- Create: `packages/core/src/repositories/tenant-scope.test.ts`
- Read: `packages/core/src/repositories/tenant-scope.ts`
- Read: `packages/core/src/adapters/postgres/schema.ts`

This task establishes the safety net before any RLS or bootstrap changes. The tests enforce that every tenant table registered in `tenant-scope.ts` also appears in the Postgres bootstrap DDL, and that no bootstrap DDL tenant table is missing from the inventory.

- [ ] **Step 1: Write the drift assertion tests**

Create `packages/core/src/repositories/tenant-scope.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import {
  BOOTSTRAP_TABLES,
  IMPLEMENTED_TENANT_TABLES,
  getRepositoryTableScope,
} from './tenant-scope.js'

describe('tenant-table inventory', () => {
  it('bootstrap tables are not in the tenant list', () => {
    for (const table of BOOTSTRAP_TABLES) {
      expect(IMPLEMENTED_TENANT_TABLES as readonly string[]).not.toContain(table)
    }
  })

  it('tenant tables are not in the bootstrap list', () => {
    for (const table of IMPLEMENTED_TENANT_TABLES) {
      expect(BOOTSTRAP_TABLES as readonly string[]).not.toContain(table)
    }
  })

  it('getRepositoryTableScope classifies every table correctly', () => {
    for (const table of BOOTSTRAP_TABLES) {
      expect(getRepositoryTableScope(table)).toBe('bootstrap')
    }
    for (const table of IMPLEMENTED_TENANT_TABLES) {
      expect(getRepositoryTableScope(table)).toBe('tenant')
    }
  })

  it('organizations is the only bootstrap table', () => {
    expect([...BOOTSTRAP_TABLES]).toEqual(['organizations'])
  })

  it('tenant table count matches the frozen spec inventory (27 tables)', () => {
    expect(IMPLEMENTED_TENANT_TABLES).toHaveLength(27)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
pnpm --filter @orbit-ai/core test -- src/repositories/tenant-scope.test.ts
```

Expected: 5 tests pass

- [ ] **Step 3: Add bootstrap DDL cross-check test**

This test extracts table names from the Postgres bootstrap DDL and asserts they match the inventory. Append to the same test file:

```typescript
import { POSTGRES_TENANT_TABLE_NAMES_FROM_DDL } from '../adapters/postgres/schema.js'

describe('tenant-table inventory drift detection', () => {
  it('every implemented tenant table appears in Postgres bootstrap DDL', () => {
    for (const table of IMPLEMENTED_TENANT_TABLES) {
      expect(
        POSTGRES_TENANT_TABLE_NAMES_FROM_DDL,
        `tenant table '${table}' missing from Postgres bootstrap DDL`,
      ).toContain(table)
    }
  })

  it('every Postgres bootstrap tenant table is in the canonical inventory', () => {
    for (const table of POSTGRES_TENANT_TABLE_NAMES_FROM_DDL) {
      expect(
        IMPLEMENTED_TENANT_TABLES as readonly string[],
        `Postgres bootstrap DDL table '${table}' not in tenant inventory`,
      ).toContain(table)
    }
  })
})
```

This test will fail until we export `POSTGRES_TENANT_TABLE_NAMES_FROM_DDL` from schema.ts in Task 3. That's expected — we write the assertion first.

- [ ] **Step 4: Commit the drift assertion tests**

```bash
git add packages/core/src/repositories/tenant-scope.test.ts
git commit -m "test(core): add tenant-table allowlist drift assertion tests"
```

---

## Task 3: Export Postgres Bootstrap Tenant Table Names

**Files:**
- Modify: `packages/core/src/adapters/postgres/schema.ts`

Extract the set of tenant table names from the Postgres DDL statements so drift tests can cross-check them against the canonical inventory.

- [ ] **Step 1: Add the derived tenant table name export**

At the top of `packages/core/src/adapters/postgres/schema.ts`, after the existing imports, add:

```typescript
/**
 * Derived set of tenant table names from the Postgres bootstrap DDL.
 * Used by drift assertion tests to verify bootstrap coverage matches
 * the canonical tenant-table inventory in tenant-scope.ts.
 */
function extractTenantTableNames(statements: readonly string[]): readonly string[] {
  const tablePattern = /create table if not exists (\w+)/
  const bootstrapTables = new Set(['organizations'])
  const tables: string[] = []

  for (const stmt of statements) {
    const match = stmt.match(tablePattern)
    if (match && !bootstrapTables.has(match[1])) {
      tables.push(match[1])
    }
  }

  return tables
}
```

Then, after the `POSTGRES_WAVE_2_SLICE_E_SCHEMA_STATEMENTS` constant (line ~465), add:

```typescript
export const POSTGRES_TENANT_TABLE_NAMES_FROM_DDL = extractTenantTableNames(
  POSTGRES_WAVE_2_SLICE_E_SCHEMA_STATEMENTS,
)
```

- [ ] **Step 2: Run the drift assertion tests**

```bash
pnpm --filter @orbit-ai/core test -- src/repositories/tenant-scope.test.ts
```

Expected: All 7 tests pass (the 5 from Task 2 + 2 new drift checks)

- [ ] **Step 3: Run full test suite**

```bash
pnpm --filter @orbit-ai/core test
```

Expected: All tests pass (243 + 7 new = 250)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/adapters/postgres/schema.ts packages/core/src/repositories/tenant-scope.test.ts
git commit -m "feat(core): export Postgres bootstrap tenant table names for drift detection"
```

---

## Task 4: RLS DDL Generator

**Files:**
- Create: `packages/core/src/schema-engine/rls.ts`
- Create: `packages/core/src/schema-engine/rls.test.ts`

Implement the RLS SQL generator matching the frozen contract in `01-core.md` lines 1341-1357. This is pure SQL string generation — no execution.

- [ ] **Step 1: Write the RLS generation tests**

Create `packages/core/src/schema-engine/rls.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import { IMPLEMENTED_TENANT_TABLES, BOOTSTRAP_TABLES } from '../repositories/tenant-scope.js'
import { generatePostgresRlsSql } from './rls.js'

describe('generatePostgresRlsSql', () => {
  const statements = generatePostgresRlsSql()

  it('emits the current_org_id() helper function first', () => {
    expect(statements[0]).toContain('create or replace function orbit.current_org_id()')
    expect(statements[0]).toContain("current_setting('app.current_org_id', true)")
    expect(statements[0]).toContain('language sql stable')
  })

  it('generates 4 policies per tenant table plus 1 enable-rls statement', () => {
    // 1 helper function + (27 tables * 5 statements each) = 136
    expect(statements).toHaveLength(1 + IMPLEMENTED_TENANT_TABLES.length * 5)
  })

  it('emits enable-rls for every tenant table', () => {
    for (const table of IMPLEMENTED_TENANT_TABLES) {
      expect(statements).toContainEqual(
        expect.stringContaining(`alter table orbit.${table} enable row level security`),
      )
    }
  })

  it('emits select, insert, update, and delete policies for every tenant table', () => {
    for (const table of IMPLEMENTED_TENANT_TABLES) {
      const tableStatements = statements.filter((s) => s.includes(`orbit.${table}`))
      // enable rls + 4 policies
      expect(tableStatements).toHaveLength(5)

      expect(tableStatements).toContainEqual(
        expect.stringContaining(`create policy ${table}_select on orbit.${table} for select`),
      )
      expect(tableStatements).toContainEqual(
        expect.stringContaining(`create policy ${table}_insert on orbit.${table} for insert`),
      )
      expect(tableStatements).toContainEqual(
        expect.stringContaining(`create policy ${table}_update on orbit.${table} for update`),
      )
      expect(tableStatements).toContainEqual(
        expect.stringContaining(`create policy ${table}_delete on orbit.${table} for delete`),
      )
    }
  })

  it('select policy uses USING clause with org check', () => {
    const selectPolicy = statements.find((s) => s.includes('users_select'))!
    expect(selectPolicy).toContain('using (organization_id = orbit.current_org_id())')
    expect(selectPolicy).not.toContain('with check')
  })

  it('insert policy uses WITH CHECK clause with org check', () => {
    const insertPolicy = statements.find((s) => s.includes('users_insert'))!
    expect(insertPolicy).toContain('with check (organization_id = orbit.current_org_id())')
    expect(insertPolicy).not.toContain('using (')
  })

  it('update policy uses both USING and WITH CHECK clauses', () => {
    const updatePolicy = statements.find((s) => s.includes('users_update'))!
    expect(updatePolicy).toContain('using (organization_id = orbit.current_org_id())')
    expect(updatePolicy).toContain('with check (organization_id = orbit.current_org_id())')
  })

  it('delete policy uses USING clause only', () => {
    const deletePolicy = statements.find((s) => s.includes('users_delete'))!
    expect(deletePolicy).toContain('using (organization_id = orbit.current_org_id())')
    expect(deletePolicy).not.toContain('with check')
  })

  it('does not generate policies for bootstrap tables', () => {
    for (const table of BOOTSTRAP_TABLES) {
      const bootstrapStatements = statements.filter((s) =>
        s.includes(`orbit.${table} `) || s.includes(`${table}_select`),
      )
      expect(bootstrapStatements).toHaveLength(0)
    }
  })

  it('supports a custom schema name', () => {
    const custom = generatePostgresRlsSql('custom_schema')
    expect(custom[0]).toContain('custom_schema.current_org_id()')
    expect(custom[1]).toContain('custom_schema.users')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @orbit-ai/core test -- src/schema-engine/rls.test.ts
```

Expected: FAIL — module `./rls.js` not found

- [ ] **Step 3: Implement the RLS generator**

Create `packages/core/src/schema-engine/rls.ts`:

```typescript
import { IMPLEMENTED_TENANT_TABLES } from '../repositories/tenant-scope.js'

/**
 * Generates Postgres-family RLS DDL for all implemented tenant tables.
 *
 * Produces:
 * 1. A `current_org_id()` helper function reading the transaction-local
 *    `app.current_org_id` setting
 * 2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for each tenant table
 * 3. Four policies per table: select, insert, update, delete
 *
 * This is pure SQL generation — no execution. The caller is responsible
 * for applying the returned statements through the appropriate adapter.
 *
 * Contract frozen in docs/specs/01-core.md lines 1341-1357.
 */
export function generatePostgresRlsSql(schema = 'orbit'): string[] {
  const statements: string[] = [
    `create or replace function ${schema}.current_org_id() returns text language sql stable as $$ select current_setting('app.current_org_id', true) $$;`,
  ]

  for (const table of IMPLEMENTED_TENANT_TABLES) {
    statements.push(
      `alter table ${schema}.${table} enable row level security;`,
      `create policy ${table}_select on ${schema}.${table} for select using (organization_id = ${schema}.current_org_id());`,
      `create policy ${table}_insert on ${schema}.${table} for insert with check (organization_id = ${schema}.current_org_id());`,
      `create policy ${table}_update on ${schema}.${table} for update using (organization_id = ${schema}.current_org_id()) with check (organization_id = ${schema}.current_org_id());`,
      `create policy ${table}_delete on ${schema}.${table} for delete using (organization_id = ${schema}.current_org_id());`,
    )
  }

  return statements
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @orbit-ai/core test -- src/schema-engine/rls.test.ts
```

Expected: All 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schema-engine/rls.ts packages/core/src/schema-engine/rls.test.ts
git commit -m "feat(core): add Postgres RLS DDL generator from tenant-table inventory"
```

---

## Task 5: RLS-to-Inventory Drift Assertion

**Files:**
- Modify: `packages/core/src/repositories/tenant-scope.test.ts`

Add a drift assertion that verifies the RLS generator covers exactly the same tables as the tenant-scope inventory. This closes the three-way allowlist contract: tenant-scope ↔ bootstrap DDL ↔ RLS generation.

- [ ] **Step 1: Add the RLS drift test**

Append to `packages/core/src/repositories/tenant-scope.test.ts`:

```typescript
import { generatePostgresRlsSql } from '../schema-engine/rls.js'

describe('tenant-table inventory RLS drift detection', () => {
  it('RLS generator covers every implemented tenant table', () => {
    const rlsStatements = generatePostgresRlsSql()

    for (const table of IMPLEMENTED_TENANT_TABLES) {
      const hasEnableRls = rlsStatements.some((s) =>
        s.includes(`alter table orbit.${table} enable row level security`),
      )
      expect(hasEnableRls, `RLS not generated for tenant table '${table}'`).toBe(true)
    }
  })

  it('RLS generator does not cover bootstrap tables', () => {
    const rlsStatements = generatePostgresRlsSql()

    for (const table of BOOTSTRAP_TABLES) {
      const hasPolicy = rlsStatements.some(
        (s) => s.includes(`orbit.${table} `) && s.includes('policy'),
      )
      expect(hasPolicy, `RLS incorrectly generated for bootstrap table '${table}'`).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run the drift tests**

```bash
pnpm --filter @orbit-ai/core test -- src/repositories/tenant-scope.test.ts
```

Expected: All 9 tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/repositories/tenant-scope.test.ts
git commit -m "test(core): add RLS-to-inventory drift assertion"
```

---

## Task 6: Wire RLS into Postgres Bootstrap

**Files:**
- Modify: `packages/core/src/adapters/postgres/schema.ts`
- Modify: `packages/core/src/adapters/postgres/schema.test.ts`

Integrate the RLS DDL into the Postgres bootstrap path so provisioning includes both table/index DDL and RLS policies.

- [ ] **Step 1: Update schema.ts to include RLS in bootstrap**

In `packages/core/src/adapters/postgres/schema.ts`, add the import at the top:

```typescript
import { generatePostgresRlsSql } from '../../schema-engine/rls.js'
```

Then modify the `initializePostgresWave2SliceESchema` function (the current top-level bootstrap function) to also apply RLS:

```typescript
export async function initializePostgresWave2SliceESchema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_2_SLICE_E_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }

  const rlsStatements = generatePostgresRlsSql()
  for (const statement of rlsStatements) {
    await db.execute(sql.raw(statement))
  }
}
```

Also update every earlier wave bootstrap function to include RLS for consistency (each wave function is a complete bootstrap):

```typescript
export async function initializePostgresWave1Schema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_1_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }

  const rlsStatements = generatePostgresRlsSql()
  for (const statement of rlsStatements) {
    await db.execute(sql.raw(statement))
  }
}
```

Apply the same pattern to `initializePostgresWave2SliceASchema`, `initializePostgresWave2SliceBSchema`, `initializePostgresWave2SliceCSchema`, and `initializePostgresWave2SliceDSchema`.

- [ ] **Step 2: Update schema.test.ts to assert RLS coverage**

Replace the existing `schema.test.ts` with:

```typescript
import type { SQL } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { IMPLEMENTED_TENANT_TABLES } from '../../repositories/tenant-scope.js'
import { initializePostgresWave1Schema, initializePostgresWave2SliceESchema } from './schema.js'

function collectStatements(
  initFn: (db: never) => Promise<void>,
): Promise<string[]> {
  const statements: string[] = []
  const db = {
    async execute(statement: SQL) {
      statements.push(
        statement.toQuery({
          escapeName: (v: string) => v,
          escapeParam: () => '?',
          escapeString: (v: string) => JSON.stringify(v),
          casing: { getColumnCasing: (c: unknown) => c },
          inlineParams: false,
          paramStartIndex: { value: 0 },
        }).sql,
      )
    },
  }
  return initFn(db as never).then(() => statements)
}

describe('initializePostgresWave1Schema', () => {
  it('emits table DDL followed by RLS DDL', async () => {
    const statements = await collectStatements(initializePostgresWave1Schema)

    // Wave 1 has 26 table/index statements
    expect(statements.slice(0, 26).some((s) => s.includes('create table'))).toBe(true)

    // RLS: 1 helper + 27 tables * 5 = 136 statements
    expect(statements.length).toBe(26 + 1 + IMPLEMENTED_TENANT_TABLES.length * 5)
    expect(statements[26]).toContain('current_org_id()')
    expect(statements[27]).toContain('enable row level security')
  })
})

describe('initializePostgresWave2SliceESchema', () => {
  it('emits table/index DDL for all waves plus RLS DDL', async () => {
    const statements = await collectStatements(initializePostgresWave2SliceESchema)

    // Table/index DDL exists
    expect(statements.some((s) => s.includes('create table if not exists organizations'))).toBe(true)
    expect(statements.some((s) => s.includes('create table if not exists idempotency_keys'))).toBe(true)

    // RLS helper exists
    expect(statements.some((s) => s.includes('current_org_id()'))).toBe(true)

    // Every tenant table gets enable-rls and 4 policies
    for (const table of IMPLEMENTED_TENANT_TABLES) {
      expect(
        statements.some((s) => s.includes(`orbit.${table} enable row level security`)),
        `missing enable RLS for ${table}`,
      ).toBe(true)
      expect(
        statements.some((s) => s.includes(`${table}_select`)),
        `missing select policy for ${table}`,
      ).toBe(true)
      expect(
        statements.some((s) => s.includes(`${table}_insert`)),
        `missing insert policy for ${table}`,
      ).toBe(true)
      expect(
        statements.some((s) => s.includes(`${table}_update`)),
        `missing update policy for ${table}`,
      ).toBe(true)
      expect(
        statements.some((s) => s.includes(`${table}_delete`)),
        `missing delete policy for ${table}`,
      ).toBe(true)
    }
  })

  it('does not generate RLS for bootstrap table organizations', async () => {
    const statements = await collectStatements(initializePostgresWave2SliceESchema)

    expect(
      statements.some((s) => s.includes('organizations enable row level security')),
    ).toBe(false)
    expect(
      statements.some((s) => s.includes('organizations_select')),
    ).toBe(false)
  })

  it('bootstrap remains idempotent (CREATE IF NOT EXISTS and CREATE OR REPLACE)', async () => {
    const statements = await collectStatements(initializePostgresWave2SliceESchema)

    const tableDdl = statements.filter((s) => s.includes('create table'))
    for (const s of tableDdl) {
      expect(s).toContain('if not exists')
    }

    const indexDdl = statements.filter((s) => s.includes('create') && s.includes('index'))
    for (const s of indexDdl) {
      expect(s).toContain('if not exists')
    }

    // RLS helper uses CREATE OR REPLACE
    const helperFn = statements.find((s) => s.includes('current_org_id'))!
    expect(helperFn).toContain('create or replace function')
  })
})
```

- [ ] **Step 3: Run the schema tests**

```bash
pnpm --filter @orbit-ai/core test -- src/adapters/postgres/schema.test.ts
```

Expected: All tests pass

- [ ] **Step 4: Run full test suite**

```bash
pnpm --filter @orbit-ai/core test
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/adapters/postgres/schema.ts packages/core/src/adapters/postgres/schema.test.ts
git commit -m "feat(core): wire RLS DDL into Postgres bootstrap path"
```

---

## Task 7: Org-Leading Index Hardening

**Files:**
- Modify: `packages/core/src/adapters/postgres/schema.ts`

Replace 8 non-org-leading indexes with org-leading composites where repository list/search patterns justify the change. See the Index Audit Summary above for the full classification.

- [ ] **Step 1: Replace the 8 indexes in the DDL statements**

In `packages/core/src/adapters/postgres/schema.ts`, make these replacements:

**In POSTGRES_WAVE_1_SCHEMA_STATEMENTS:**

Replace:
```
`create index if not exists companies_assigned_to_idx on companies (assigned_to_user_id)`
```
With:
```
`create index if not exists companies_assigned_to_idx on companies (organization_id, assigned_to_user_id)`
```

Replace:
```
`create index if not exists contacts_assigned_to_idx on contacts (assigned_to_user_id)`
```
With:
```
`create index if not exists contacts_assigned_to_idx on contacts (organization_id, assigned_to_user_id)`
```

**In POSTGRES_WAVE_2_SLICE_A_SCHEMA_STATEMENTS:**

Replace:
```
`create index if not exists activities_occurred_at_idx on activities (occurred_at)`
```
With:
```
`create index if not exists activities_occurred_at_idx on activities (organization_id, occurred_at)`
```

Replace:
```
`create index if not exists tasks_due_date_idx on tasks (due_date)`
```
With:
```
`create index if not exists tasks_due_date_idx on tasks (organization_id, due_date)`
```

Replace:
```
`create index if not exists tasks_assigned_to_idx on tasks (assigned_to_user_id)`
```
With:
```
`create index if not exists tasks_assigned_to_idx on tasks (organization_id, assigned_to_user_id)`
```

**In POSTGRES_WAVE_2_SLICE_B_SCHEMA_STATEMENTS:**

Replace:
```
`create index if not exists products_sort_order_idx on products (sort_order)`
```
With:
```
`create index if not exists products_sort_order_idx on products (organization_id, sort_order)`
```

**In POSTGRES_WAVE_2_SLICE_D_SCHEMA_STATEMENTS:**

Replace:
```
`create index if not exists imports_entity_type_idx on imports (entity_type)`
```
With:
```
`create index if not exists imports_entity_type_idx on imports (organization_id, entity_type)`
```

**In POSTGRES_WAVE_2_SLICE_E_SCHEMA_STATEMENTS:**

Replace:
```
`create index if not exists audit_logs_occurred_at_idx on audit_logs (occurred_at)`
```
With:
```
`create index if not exists audit_logs_occurred_at_idx on audit_logs (organization_id, occurred_at)`
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm --filter @orbit-ai/core test
```

Expected: All tests pass. The Wave 1 schema test will still pass because the statement count hasn't changed — we replaced indexes, not added new ones.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/adapters/postgres/schema.ts
git commit -m "feat(core): replace 8 indexes with org-leading composites for tenant query patterns"
```

---

## Task 8: Index Audit Schema Assertions

**Files:**
- Modify: `packages/core/src/adapters/postgres/schema.test.ts`

Add explicit assertions that the 8 replaced indexes are now org-leading, and that the 3 auth-exception indexes remain non-org-leading.

- [ ] **Step 1: Add index audit assertions**

Append to `packages/core/src/adapters/postgres/schema.test.ts`:

```typescript
describe('org-leading index audit', () => {
  it('replaced indexes are org-leading', async () => {
    const statements = await collectStatements(initializePostgresWave2SliceESchema)

    const orgLeadingExpected = [
      'companies_assigned_to_idx on companies (organization_id, assigned_to_user_id)',
      'contacts_assigned_to_idx on contacts (organization_id, assigned_to_user_id)',
      'activities_occurred_at_idx on activities (organization_id, occurred_at)',
      'tasks_due_date_idx on tasks (organization_id, due_date)',
      'tasks_assigned_to_idx on tasks (organization_id, assigned_to_user_id)',
      'products_sort_order_idx on products (organization_id, sort_order)',
      'imports_entity_type_idx on imports (organization_id, entity_type)',
      'audit_logs_occurred_at_idx on audit_logs (organization_id, occurred_at)',
    ]

    for (const expected of orgLeadingExpected) {
      expect(
        statements.some((s) => s.includes(expected)),
        `missing org-leading index: ${expected}`,
      ).toBe(true)
    }
  })

  it('auth-exception indexes remain non-org-leading by design', async () => {
    const statements = await collectStatements(initializePostgresWave2SliceESchema)

    // These MUST stay non-org-leading for cross-tenant auth lookups
    expect(statements.some((s) => s.includes('api_keys_hash_idx on api_keys (key_hash)'))).toBe(true)
    expect(statements.some((s) => s.includes('api_keys_prefix_idx on api_keys (key_prefix)'))).toBe(true)
    expect(statements.some((s) => s.includes('users_external_auth_idx on users (external_auth_id)'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @orbit-ai/core test -- src/adapters/postgres/schema.test.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/adapters/postgres/schema.test.ts
git commit -m "test(core): add org-leading index audit assertions"
```

---

## Task 9: Typecheck, Build, and Diff Validation

**Files:**
- None (validation only)

- [ ] **Step 1: Run full test suite**

```bash
pnpm --filter @orbit-ai/core test
```

Expected: All tests pass

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter @orbit-ai/core typecheck
```

Expected: exit 0

- [ ] **Step 3: Run build**

```bash
pnpm --filter @orbit-ai/core build
```

Expected: exit 0

- [ ] **Step 4: Check for whitespace/diff issues**

```bash
git diff --check
```

Expected: no output (clean diff)

---

## Task 10: Review Artifact and KB Update

**Files:**
- Create: `docs/review/core-tenant-hardening-review.md`
- Modify: `docs/KB.md`

- [ ] **Step 1: Create the review artifact**

Create `docs/review/core-tenant-hardening-review.md`:

```markdown
# Core Tenant Hardening Review

Date: 2026-04-03
Branch: `core-tenant-hardening`
Scope: [core-tenant-hardening-plan.md](/docs/execution/core-tenant-hardening-plan.md)

## What Landed

1. **Shared tenant-table allowlist** — drift assertion tests enforce lockstep between `tenant-scope.ts`, Postgres bootstrap DDL, and RLS generation
2. **Postgres RLS DDL generator** — `schema-engine/rls.ts` generates `current_org_id()` helper + 4 policies per tenant table for all 27 tenant tables
3. **Bootstrap integration** — all Postgres wave bootstrap functions now emit RLS DDL after table/index DDL
4. **Org-leading index hardening** — 8 indexes replaced with org-leading composites for list/search access patterns

## Index Audit Summary

### Replaced with org-leading (8):
- `companies_assigned_to_idx` → (organization_id, assigned_to_user_id)
- `contacts_assigned_to_idx` → (organization_id, assigned_to_user_id)
- `activities_occurred_at_idx` → (organization_id, occurred_at)
- `tasks_due_date_idx` → (organization_id, due_date)
- `tasks_assigned_to_idx` → (organization_id, assigned_to_user_id)
- `products_sort_order_idx` → (organization_id, sort_order)
- `imports_entity_type_idx` → (organization_id, entity_type)
- `audit_logs_occurred_at_idx` → (organization_id, occurred_at)

### Intentional exceptions — auth lookups (3):
- `api_keys_hash_idx` on (key_hash) — cross-tenant auth lookup
- `api_keys_prefix_idx` on (key_prefix) — cross-tenant auth lookup
- `users_external_auth_idx` on (external_auth_id) — cross-tenant auth lookup

### Intentional exceptions — FK/parent-scoped (15):
- `contacts_company_idx`, `deals_stage_idx`, `deals_pipeline_idx`, `deals_contact_idx`, `deals_company_idx`
- `activities_contact_idx`, `activities_deal_idx`, `activities_company_idx`
- `notes_contact_idx`, `notes_deal_idx`
- `sequence_steps_order_idx`, `sequence_enrollments_active_idx`, `sequence_events_enrollment_idx`
- `webhook_deliveries_event_idx`
- `stages_pipeline_order_idx`, `stages_pipeline_name_idx`

Rationale: These support FK constraint checks and join navigation. The parent entity is already org-scoped, and RLS applies at the table scan level. Org-leading would break FK usage.

### Low-value — not replaced (6):
- `payments_status_idx`, `contracts_status_idx`, `webhooks_status_idx` — low cardinality
- `webhook_deliveries_next_attempt_idx` — background retry scan
- `schema_migrations_applied_at_idx` — low query volume

## What Did NOT Land (confirmed out of scope)

- No API route implementation
- No SDK transport work
- No schema-engine execution/apply/rollback
- No audit or idempotency middleware
- No Supabase/Neon-specific specialization
- SQLite remains application-enforced only
- Explicit repository org filters preserved (RLS is defense in depth)
- Runtime/migration authority boundary unchanged

## Security Review Questions

1. **Does every implemented tenant table receive RLS coverage?** Yes — 27/27, verified by drift assertions
2. **Can request-path code bypass tenant isolation?** No — `withTenantContext` still required, RLS adds database-layer enforcement
3. **Does the allowlist make missing registration a test failure?** Yes — three-way drift assertions
4. **Did bootstrap changes widen migration authority?** No — RLS DDL executes through the same `db.execute(sql.raw())` path
5. **Are new indexes justified?** Yes — 8 indexes tied to list/search repository patterns; 24 exceptions documented
```

- [ ] **Step 2: Update KB.md**

Add to the "Completed" section:
```
- `@orbit-ai/core` tenant hardening (RLS DDL, allowlist assertions, org-leading indexes)
```

Update the "Current focus" section to reflect tenant hardening is complete.

Add to the Decision Log:
```
- 2026-04-03: Executed the tenant hardening follow-up on branch `core-tenant-hardening`, adding Postgres RLS DDL generation for all 27 tenant tables, three-way allowlist drift assertions, bootstrap RLS integration, and 8 org-leading index replacements. 24 non-org-leading indexes documented as intentional exceptions (3 auth lookups, 15 FK/parent-scoped, 6 low-value).
```

- [ ] **Step 3: Commit**

```bash
git add docs/review/core-tenant-hardening-review.md docs/KB.md
git commit -m "docs(core): add tenant hardening review artifact and KB update"
```

---

## Task 11: Required Skill Reviews

After the integrated branch lands locally with all tests passing, run these mandatory review gates per the hardening plan:

- [ ] **Step 1: Run `orbit-tenant-safety-review`**

Focus: RLS generation, tenant-context safety, cross-tenant deny behavior, allowlist drift

- [ ] **Step 2: Run `orbit-core-slice-review`**

Focus: confirm branch contains only tenant-hardening scope, no service-surface or API drift

- [ ] **Step 3: Run `orbit-schema-change`**

Focus: bootstrap SQL changes, generated policy behavior

- [ ] **Step 4: Run independent code review**

Use `feature-dev:code-reviewer` sub-agent on the integrated diff

- [ ] **Step 5: Address any blocking findings and re-run validation**

```bash
pnpm --filter @orbit-ai/core test && pnpm --filter @orbit-ai/core typecheck && pnpm --filter @orbit-ai/core build && git diff --check
```

---

## Validation Checklist (Done Condition)

From the hardening plan section 12:

- [ ] All 27 Postgres-family tenant tables have generated RLS SQL coverage
- [ ] Postgres bootstrap applies RLS SQL as part of the tested baseline
- [ ] Shared tenant-table allowlist assertion prevents drift across hardening layers
- [ ] Org-leading index gaps are either fixed (8) or documented as exceptions (24)
- [ ] Runtime repositories still include explicit org filters
- [ ] Adapter authority boundaries remain intact
- [ ] Full core test, typecheck, build, and diff checks pass
- [ ] Core review and security review report no unresolved blocking findings
