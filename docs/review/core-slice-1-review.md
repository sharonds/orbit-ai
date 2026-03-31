# Core Slice 1 Review Report

Date: 2026-03-31
Reviewers: Code review agent, Security review agent, Plan-vs-execution agent
Scope: `packages/core/src/` — all source and test files
Baseline: commit `020fd59` (docs: update kb for core slice 1)

## 1. Executive Summary

Core slice 1 is substantially complete against the execution plan. Milestones 0, 1, 2 (bootstrap tables), and 4 (authority boundary) are implemented with spec-exact type signatures, table definitions, and export surface. Test coverage exists for all required validation gates.

The review found 2 critical security issues, 3 high security issues, 2 critical code quality issues, 5 important code quality issues, and 2 minor test gaps. The most urgent fix is the `permissions`/`scopes` naming mismatch, flagged independently by all three reviews. Two security-critical fixes (`withTenantContext` input validation and `finally` block removal) should also be resolved before Milestone 3.

## 2. Plan vs Execution

### 2.1 Implemented as Planned

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| M0 | `package.json` (name, ESM, deps, scripts) | Exact |
| M0 | `tsconfig.json`, `vitest.config.ts` | Exact |
| M0 | `src/index.ts` export surface | Matches spec Section 2 exactly |
| M1 | `ids/prefixes.ts` — 28 entity kinds | Spec-exact |
| M1 | `ids/generate-id.ts` — `generateId(kind)` | Spec-exact |
| M1 | `ids/parse-id.ts` — `assertOrbitId(value, kind)` | Spec-exact |
| M1 | `types/errors.ts` — error codes, `OrbitErrorShape` | Spec-exact |
| M1 | `types/pagination.ts` — envelopes, `toWirePageMeta()` | Spec-exact |
| M1 | `types/api.ts` — sort, filter, list, search types | Spec-exact |
| M1 | `types/entities.ts` — 27-member `OrbitObjectType` union | Spec-exact |
| M1 | ID generation + parsing + pagination tests | All required cases present |
| M2 | `schema/helpers.ts` — pgSchema, timestamps, column helpers | Spec-exact |
| M2 | `schema/tables.ts` — 4 bootstrap tables with correct columns/indexes | Spec-exact |
| M2 | `schema/relations.ts` — bootstrap relations | Present (has disambiguation issue, see 3.7) |
| M2 | Bootstrap schema tests | Present — org-scoped vs tenant-scoped classification tested |
| M4 | `adapters/interface.ts` — `StorageAdapter`, authority model, contracts | Present with correct `requestPathMayUseElevatedCredentials: false` |
| M4 | `adapters/postgres/tenant-context.ts` — `withTenantContext()` | Present with transaction-local `set_config` |
| M4 | `withTenantContext` transaction-bound tests | Present — success and throw paths |
| M4 | `lookupApiKeyForAuth` contract tests | Present — shape validation |
| M4 | Runtime vs migration authority contract tests | Present |
| Slice 1 | `slice-1-proof.test.ts` integration harness | Present |

### 2.2 Partially Implemented (Intentional Placeholders)

| File | Status | Reason |
|------|--------|--------|
| `schema/zod.ts` | Placeholder constant `'pending-milestone-3'` | Milestone 3 scope |
| `schema-engine/engine.ts` | Stub class, `preview()` throws not-implemented | Milestone 8 scope |
| `services/contact-context.ts` | Stub function, throws not-implemented | Milestone 7 scope |

These are correct — the export surface slots are held, and the stubs prevent import errors.

### 2.3 Missing from Slice 1

| Item | Plan Reference | Impact |
|------|---------------|--------|
| SQLite adapter (`adapters/sqlite/`) | M4, "first implementation targets" | SQLite was a slice 1 target alongside Postgres. No adapter exists. |
| `orbit-tenant-safety-review` outcome artifact | Slice 1 definition of done | Review gate not recorded in repo |
| `orbit-core-slice-review` outcome artifact | Slice 1 definition of done | Review gate not recorded in repo |
| `utils/cursor.ts`, `utils/dates.ts`, `utils/json.ts` | Spec Section 2 package structure | Minor structural gap |

### 2.4 Deviations from Plan

| Deviation | Files | Assessment |
|-----------|-------|------------|
| `apiKeys.scopes` (table) vs `ApiKeyAuthLookup.permissions` (DTO) | `tables.ts`, `interface.ts` | Naming conflict — must resolve before concrete adapter |
| `sql` import missing from `tables.ts` | `tables.ts` | Will be needed for domain table defaults |
| Dead `customFieldsColumn` and `integer` imports | `tables.ts` | Cleanup needed |
| `withTenantContext` is a free function export, but interface declares it as a method with different arity | `tenant-context.ts`, `interface.ts` | Will need alignment when concrete adapter class is written |

### 2.5 Items Beyond Slice 1 Scope (Acceptable)

| Item | Belongs To | Assessment |
|------|-----------|------------|
| `PluginSchemaExtension`, `PluginSchemaRegistry` | Milestone 9 | Type-only, needed for interface compilation |
| `IUserResolver` | Milestone 5 | Type-only, on adapter interface |
| `getSchemaSnapshot()`, `SchemaSnapshot` | Milestone 8-9 | Type-only, on adapter interface |
| `types/schema.ts` (`CustomFieldType`, `CustomFieldDefinition`) | Not in M1 workstream B file list | Required dependency of `adapters/interface.ts` |

All are harmless type declarations that were pulled forward because the adapter interface depends on them.

## 3. Code Quality Findings

### 3.1 CRITICAL — `permissions` vs `scopes` naming mismatch

**File:** `adapters/interface.ts:35`, `schema/tables.ts:59`

`ApiKeyAuthLookup` declares `permissions: string[]` but the `apiKeys` table column is `scopes: jsonb('scopes')`. Every adapter implementing `lookupApiKeyForAuth` must manually map `scopes` → `permissions`, or will silently return undefined. Since this is the single auth hot-path, the mismatch will produce broken authentication.

`OrbitAuthContext.scopes` (line 17) already uses `scopes`, making `permissions` inconsistent across the entire auth chain.

**Fix:** Rename `permissions` to `scopes` in `ApiKeyAuthLookup`. Update the test fixture in `interface.test.ts`.

### 3.2 CRITICAL — `withTenantContext` `finally` block is redundant and harmful

**File:** `adapters/postgres/tenant-context.ts:18-25`

The `finally` block calls `tx.execute(buildClearTenantContextStatement())` inside the already-open transaction. When the callback throws, Postgres rolls back the transaction before `finally` runs. Executing `set_config` on a rolled-back transaction throws a second error, masking the original.

`set_config(..., true)` sets the GUC for the current transaction only. Once the transaction ends (commit or rollback), the GUC is automatically cleared. The `finally` clear is operationally redundant and structurally dangerous.

The test only mocks `execute` as never-throwing, so it does not catch this failure mode.

**Fix:** Remove the `finally` block entirely. The `true` argument to `set_config` already makes the GUC transaction-local.

### 3.3 IMPORTANT — `ID_PREFIXES` and `OrbitIdKind` not exported from `index.ts`

**File:** `src/index.ts`

`generate-id.ts` and `parse-id.ts` are exported but `prefixes.ts` is not. External consumers cannot reference `ID_PREFIXES` or `OrbitIdKind` without reaching into internal module paths, violating the project's cross-package import rule.

**Fix:** Add `export * from './ids/prefixes.js'` to `src/index.ts`.

### 3.4 IMPORTANT — `updatedAt` never auto-updates on writes

**File:** `schema/helpers.ts:20`

`updatedAt` is defined as `.defaultNow().notNull()`. In Drizzle ORM, `defaultNow()` only sets the value at INSERT time. For UPDATE operations, `updatedAt` will remain frozen at the insert timestamp unless application code explicitly sets it or a database trigger exists. Drizzle provides `.$onUpdateFn(() => new Date())` for this purpose.

**Fix:** Add `.$onUpdateFn(() => new Date())` to the `updatedAt` definition.

### 3.5 IMPORTANT — `pgTable` re-export creates footgun

**File:** `schema/helpers.ts:29`

`pgTable` is re-exported from `helpers.ts` but all tables use `orbit.table(...)` (the schema-qualified variant). Any code importing `pgTable` from helpers would create tables outside the `orbit` schema, bypassing RLS policies.

**Fix:** Remove `pgTable` from the re-export.

### 3.6 IMPORTANT — Dead imports in `tables.ts`

**File:** `schema/tables.ts:1`

`customFieldsColumn` and `integer` are imported but unused in the current bootstrap tables.

**Fix:** Remove unused imports.

### 3.7 IMPORTANT — Ambiguous multi-relation to `users` in `relations.ts`

**File:** `schema/relations.ts:10-31`

`organizationMemberships` references `users` via two foreign keys: `userId` and `invitedByUserId`. Drizzle requires `relationName` disambiguation when a table has multiple relations to the same target. Without it, Drizzle will throw at runtime when traversing relations.

**Fix:** Add `relationName` to both `one(users, ...)` calls and to the `many(organizationMemberships)` in `usersRelations`.

### 3.8 MINOR — No lowercase ULID rejection test

**File:** `ids/parse-id.test.ts`

The ULID regex is case-sensitive (`[0-9A-HJKMNP-TV-Z]`) but no test verifies lowercase ULIDs are rejected.

**Fix:** Add test: `expect(() => assertOrbitId('contact_01aryz6s41yyyyyyyyyyyyyyyy', 'contact')).toThrow()`.

### 3.9 MINOR — No ID uniqueness assertion test

**File:** `ids/generate-id.test.ts`

Only checks prefix and length. No test that successive calls return different values.

**Fix:** Add: `expect(generateId('contact')).not.toBe(generateId('contact'))`.

## 4. Security Findings

### 4.1 CRITICAL — `withTenantContext` accepts unvalidated `orgId`

**File:** `adapters/postgres/tenant-context.ts:5-7, 13-26`
**Threat:** T1 (Cross-Tenant Read/Write)

`buildSetTenantContextStatement` passes `orgId` directly into `set_config` with no validation. `OrbitAuthContext.orgId` is a bare `string` — an empty string, whitespace, or malformed value would set a broken tenant boundary.

Concrete risk: `orgId: ''` produces `set_config('app.current_org_id', '', true)`, which is indistinguishable from the cleared state. Depending on RLS policy authorship, this may match no tenant (silently broken) or all tenants (catastrophic).

The `assertOrbitId` function already exists in `parse-id.ts` and validates the `org_` prefix and ULID body.

**Fix:** Add `assertOrbitId(context.orgId, 'organization')` as the first line of `withTenantContext`, before opening the transaction. Throw synchronously if validation fails.

### 4.2 CRITICAL — `OrbitDatabase.transaction` has no real BEGIN/COMMIT enforcement

**File:** `adapters/interface.ts:8-11`, `adapters/postgres/tenant-context.ts:13`
**Threat:** T1 (Cross-Tenant Read/Write)

`set_config(..., true)` makes the GUC transaction-local, but `OrbitDatabase.transaction` is a generic interface with no enforcement that a real SQL `BEGIN`/`COMMIT` is issued. A pgBouncer transaction-mode pool, or a broken adapter, could silently invalidate the tenant isolation guarantee.

The only test uses a mock that calls `fn(tx)` directly without verifying real transaction boundaries. The database hardening checklist requires "behavior is tested under pooled connections."

**Fix:** Document on `OrbitDatabase.transaction` that implementors MUST issue a real BEGIN/COMMIT. Add an integration test that verifies `set_config` is not visible outside the transaction boundary using a real database connection.

### 4.3 HIGH — `runWithMigrationAuthority` yields `OrbitDatabase`, not a distinct type

**File:** `adapters/interface.ts:76`
**Threat:** T2 (Privileged Credential Misuse)

The migration callback receives `OrbitDatabase` — the same type used for runtime operations. Nothing in the type system prevents passing the elevated handle into `withTenantContext` or a service call. The threat model says "any escape from the runtime role model collapses RLS and tenant isolation."

**Fix:** Introduce a branded `MigrationDatabase` type distinct from `OrbitDatabase`. `runWithMigrationAuthority` yields `MigrationDatabase`; normal service code rejects it at compile time.

### 4.4 HIGH — No RLS generation code exists

**File:** `schema-engine/engine.ts`, `schema/tables.ts`
**Threat:** T1 (Cross-Tenant Read/Write)

Tenant tables are defined but no RLS policies are generated or tested. The `OrbitSchemaEngine` is a stub. The database hardening checklist requires RLS on every tenant table as a release blocker.

This is expected for slice 1 (RLS generation is Milestone 9), but no test asserts the expected policy SQL shape, which would catch regressions when the generator is built.

**Fix:** Track as a Milestone 9 deliverable. Optionally add a forward-looking test that asserts the tenant-scoped table list.

### 4.5 HIGH — `scopes` vs `permissions` field divergence risks auth bypass

**File:** `adapters/interface.ts:35`, `schema/tables.ts:59`
**Threat:** T2 (Privileged Credential Misuse)

Same issue as code quality finding 3.1. If an adapter returns `scopes` instead of aliasing to `permissions`, authorization checks reading `lookup.permissions` get `undefined`. Depending on downstream check style, this silently authorizes everything or throws.

**Fix:** Rename `permissions` to `scopes` in `ApiKeyAuthLookup`.

### 4.6 MEDIUM — No prefix uniqueness/collision test for `ID_PREFIXES`

**File:** `ids/prefixes.ts`

All 28 prefixes are currently unique and non-overlapping, but no test enforces this invariant. A future addition of a prefix that is a substring of another (e.g., `seq` alongside `seqstep`) could cause `assertOrbitId` to accept wrong-type IDs if checked in the wrong order. The `_` separator prevents the current set from colliding, but the invariant is not tested.

Also: `assertOrbitId` is a format check, not a proof-of-issuance check. No code comment clarifies this.

**Fix:** Add a test asserting all prefix values are unique and no prefix is a prefix of another. Add a comment on `assertOrbitId` clarifying it must be paired with a database lookup for authorization.

### 4.7 MEDIUM — `OrbitErrorShape.details` has no redaction contract

**File:** `types/errors.ts:36`

`details?: Record<string, unknown>` is entirely open. As adapters add diagnostic detail (connection strings, query params, auth internals), this becomes a latent secret leakage path. The security architecture requires secrets not to appear in error paths.

**Fix:** Document which keys are permitted in `details`. Consider a sanitization helper or type constraint for error construction.

### 4.8 MEDIUM — `StorageAdapter.database` is a public property bypassing tenant context

**File:** `adapters/interface.ts:71`

Any code holding a `StorageAdapter` can call `adapter.database.execute(...)` directly, bypassing `withTenantContext` and `runWithMigrationAuthority`. The security architecture requires "no tenant route can bypass `withTenantContext(...)`."

**Fix:** Remove or rename to `_rawDatabase` with a JSDoc warning. Recommend all access go through `adapter.withTenantContext(...)` or `adapter.runWithMigrationAuthority(...)`.

## 5. Recommended Fix Priority

### Before Milestone 3 (must fix)

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1 | `permissions` → `scopes` | Critical (code + security) | Rename in `ApiKeyAuthLookup`, update tests |
| 2 | `withTenantContext` orgId validation | Critical (security) | Add `assertOrbitId` guard |
| 3 | `withTenantContext` finally block | Critical (code) | Remove — transaction-local GUC auto-clears |
| 4 | `updatedAt` auto-update | Important (code) | Add `.$onUpdateFn(() => new Date())` |
| 5 | Remove `pgTable` re-export | Important (code) | Remove from helpers.ts |
| 6 | `relationName` disambiguation | Important (code) | Add to membership relations |
| 7 | Export `ID_PREFIXES` | Important (code) | Add to index.ts |
| 8 | Dead imports cleanup | Important (code) | Remove from tables.ts |

### Track for Later Milestones

| # | Finding | Target | Fix |
|---|---------|--------|-----|
| 9 | Branded `MigrationDatabase` type | Milestone 3 or 4 | New type, refactor `runWithMigrationAuthority` |
| 10 | RLS generation | Milestone 9 | Generator + tests |
| 11 | `StorageAdapter.database` visibility | Milestone 3 | Remove or restrict |
| 12 | `OrbitErrorShape.details` redaction | Milestone 5 (when API layer begins) | Type constraint or sanitizer |
| 13 | SQLite adapter | Before Milestone 5 | Implement adapter |
| 14 | Prefix uniqueness test | Milestone 3 | Add test |

### Minor (fix opportunistically)

| # | Finding | Fix |
|---|---------|-----|
| 15 | Lowercase ULID test | Add test case |
| 16 | ID uniqueness test | Add test case |

## 6. Review Gate Status

| Gate | Status |
|------|--------|
| `orbit-tenant-safety-review` | **This report serves as the review.** Findings documented above. FAIL — 2 critical security issues must be resolved. |
| `orbit-core-slice-review` | **This report serves as the review.** Plan alignment is strong. CONDITIONAL PASS — must fix the 8 items in section 5 "Before Milestone 3." |

Milestone 3 may begin after the 8 must-fix items are resolved and tests pass.
