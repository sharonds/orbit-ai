# Orbit AI Core Tenant Hardening Plan

Date: 2026-04-03
Status: Ready for execution (post-review revision)
Last reviewed: 2026-04-03 — consolidated review (spec/scope, codebase verification, tenant safety)
Package: `@orbit-ai/core`
Depends on:
- [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
- [core-wave-2-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-services-plan.md)
- [core-wave-2-slice-e-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-slice-e-plan.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [database-hardening-checklist.md](/Users/sharonsciammas/orbit-ai/docs/security/database-hardening-checklist.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines the dedicated tenant-hardening follow-up for `@orbit-ai/core`.

Core Wave 2 is now merged. The remaining security carry-forwards were intentionally not mixed into the service-surface slices:

- Postgres RLS DDL generation and bootstrap application
- broader org-leading index hardening for tenant tables
- shared table-name allowlist assertions so tenant-table registration, schema bootstrap, and RLS generation cannot silently drift

This follow-up exists to close those database-boundary gaps before Postgres-family production posture is treated as complete.

## 2. Objective

Deliver the missing tenant-isolation hardening without changing accepted core service contracts:

1. every implemented Postgres-family tenant table receives generated RLS DDL
2. tenant table registration is driven by one auditable allowlist contract
3. tenant tables that need org-leading lookup support receive explicit index coverage or an intentional documented exception
4. runtime repositories continue to include explicit `organization_id` filters even with RLS enabled
5. request-path services still cannot reach migration authority or bypass-RLS credentials

This follow-up is about database hardening and proof coverage. It is not the API milestone, not the SDK milestone, and not the audit/idempotency middleware milestone.

## 3. In Scope

Primary hardening targets:

- Postgres-family RLS SQL generation for all implemented tenant tables
- Postgres bootstrap/schema helpers applying the generated RLS statements
- shared tenant-table allowlist assertions across:
  - repository tenant-scope registration
  - Postgres RLS generation
  - bootstrap/schema coverage
- org-leading index audit and follow-up DDL for implemented tenant tables where missing or weak
- proof harness and regression tests for the above

Expected file areas to change:

- `packages/core/src/repositories/tenant-scope.ts`
- `packages/core/src/schema-engine/`
- `packages/core/src/adapters/postgres/schema.ts`
- `packages/core/src/adapters/postgres/schema.test.ts`
- `packages/core/src/adapters/postgres/adapter.test.ts`
- `packages/core/src/adapters/postgres/tenant-context.test.ts`
- `packages/core/src/services/postgres-persistence.test.ts`
- supporting schema or repository tests under `packages/core/src/**`
- docs and review artifacts under `docs/`

Documentation scope:

- [docs/KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- a new review artifact for this follow-up under `docs/review/`

## 4. Out Of Scope

- API route implementation
- SDK transport or direct-mode implementation
- CLI or MCP transport work
- Supabase- or Neon-specific adapter specialization beyond the generic Postgres-family hardening seam
- schema-engine mutation execution, apply, rollback, or preview UX
- audit middleware, idempotency replay middleware, or webhook runtime changes
- connector-specific tenant tables

Those can build on this hardening work, but they are not part of this branch.

## 5. Required Execution Principles

1. Do not widen the public service registry.
2. Do not remove explicit repository tenant filters after RLS lands.
3. Treat RLS as defense in depth, not as a replacement for app-layer tenant enforcement.
4. Keep runtime authority and migration authority separate.
5. Keep SQLite behavior unchanged except where tests or shared assertions must acknowledge that SQLite is application-enforced only.
6. Prefer one shared source of truth for tenant-table names rather than duplicated local lists.
7. If an org-leading index is intentionally not added, document the reason in the plan-vs-execution review artifact rather than leaving silent drift.

## 6. Delivery Slices

### Slice A. Tenant Table Inventory And Allowlist Contract

Goal:

- establish one auditable tenant-table inventory that other hardening layers consume

Scope:

- `packages/core/src/repositories/tenant-scope.ts`
- new shared allowlist helper(s) if needed
- assertion tests comparing the implemented tenant-table set against the hardening consumers

Required behavior:

- one canonical list exists for implemented tenant tables
- bootstrap tables remain explicitly separate
- tests fail if RLS generation, bootstrap coverage, or schema helpers drift from the tenant-table inventory
- the allowlist remains readable enough for future plugin/connector table extension work

Intentional spec deviation:

- The frozen spec (01-core.md) shows a module-local `TENANT_TABLES` const inside `rls.ts`. This plan instead imports `IMPLEMENTED_TENANT_TABLES` from `tenant-scope.ts` to maintain a single source of truth (Execution Principle 6). The review artifact must document this deviation per Execution Principle 7.

Exit criteria:

- shared table-name allowlist assertions exist
- tenant-table drift becomes a test failure instead of a review-time discovery

### Slice B. Postgres RLS DDL Generation

Goal:

- generate the missing Postgres-family row-level security SQL from the shared tenant-table inventory

Scope:

- `packages/core/src/schema-engine/rls.ts` or equivalent shared RLS helper
- RLS statement tests

Required behavior:

- generates `current_org_id()` helper SQL (using `CREATE OR REPLACE FUNCTION`)
- generates per-table `enable row level security`
- generates `select`, `insert`, `update`, and `delete` policies for every implemented tenant table
- **policy creation must be idempotent**: emit `DROP POLICY IF EXISTS` before each `CREATE POLICY` — Postgres has no `CREATE POLICY IF NOT EXISTS`, so bare `CREATE POLICY` will throw `ERROR: policy already exists` on re-bootstrap (spec gap in 01-core.md, intentionally fixed here)
- uses transaction-local `app.current_org_id`
- does not generate policies for bootstrap tables

Exit criteria:

- the generated RLS SQL matches the contract frozen in [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md), with the documented idempotency fix above
- tests prove all implemented tenant tables receive policy coverage
- a test proves re-running RLS generation does not throw duplicate policy errors

### Slice C. Postgres Bootstrap Integration

Goal:

- apply the generated RLS SQL through the Postgres bootstrap/schema path so the runtime baseline actually provisions the policies

Scope:

- `packages/core/src/adapters/postgres/schema.ts`
- Postgres schema bootstrap tests

Required behavior:

- Postgres Wave 2 bootstrap includes the RLS helper and policy statements
- bootstrap remains idempotent (RLS re-application must not throw — see Slice B idempotency requirement)
- **`initializePostgresXxxSchema` functions that apply RLS DDL must only be called from `runWithMigrationAuthority()` paths** — `ALTER TABLE ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` are DDL that require migration-level credentials, not runtime credentials
- normal runtime code still does not require elevated credentials
- schema bootstrap tests assert that tenant tables receive both table DDL and RLS DDL

Exit criteria:

- the Postgres schema bootstrap no longer stops at table/index creation
- RLS coverage is part of the tested bootstrap contract

### Slice D. Org-Leading Index Audit And DDL

Goal:

- harden tenant-table query support where the current indexes are weak for org-scoped lookup patterns

Scope:

- Postgres and SQLite schema helpers where index additions are accepted
- targeted schema tests
- review artifact notes for any intentional exceptions

Required behavior:

- audit every implemented tenant table for whether its current index set is org-leading, org-sufficient, or intentionally exempt
- add indexes where the branch can justify a clear tenant-scoped lookup or isolation benefit
- avoid speculative index sprawl; tie each added index to an actual repository or service access pattern
- keep uniqueness indexes unchanged unless the hardening case is explicit

Exit criteria:

- the branch contains either:
  - concrete org-leading index additions, or
  - an explicit accepted exception list with rationale

### Slice E. Proof Harness, Review, And Docs

Goal:

- prove the hardening is real and document the remaining non-goals

Scope:

- persistence and adapter proof tests
- KB updates
- follow-up review artifact

Required behavior:

- tests cover allowlist drift, RLS generation, bootstrap integration, and tenant-safety invariants
- **adapter and tenant-context proof tests** must be re-run and, where needed, extended to confirm:
  - RLS changes do not break the authority boundary
  - transaction-bound tenant context still uses transaction-local settings
  - no request-path reachability into migration authority
  - files: `adapter.test.ts`, `tenant-context.test.ts`, `postgres-persistence.test.ts`
- review confirms the branch did not silently pull API or schema-engine execution work forward
- docs reflect that tenant hardening is now planned and then executed

Exit criteria:

- integrated review and security review pass with no unresolved tenant-isolation findings for this scope
- all existing adapter/tenant-context proofs still pass after bootstrap and RLS changes

## 7. Workstream Ownership

Use disjoint write scopes.

### Workstream A. Tenant Inventory And RLS Generator

Owns:

- `packages/core/src/repositories/tenant-scope.ts`
- `packages/core/src/schema-engine/rls.ts`
- related unit tests

Responsibilities:

- canonical tenant-table inventory
- generated RLS SQL
- allowlist drift assertions

### Workstream B. Postgres Bootstrap And Adapter Proofs

Owns:

- `packages/core/src/adapters/postgres/schema.ts`
- `packages/core/src/adapters/postgres/schema.test.ts`
- `packages/core/src/adapters/postgres/adapter.test.ts`
- `packages/core/src/adapters/postgres/tenant-context.test.ts`

Responsibilities:

- bootstrap integration of generated RLS SQL
- Postgres proof coverage
- transaction-local tenant-context safety remains intact

### Workstream C. Index Audit, Integrated Proofs, And Docs

Owns:

- integrated persistence tests
- index additions and related schema assertions
- KB and review artifact updates

Responsibilities:

- org-leading index audit and targeted DDL
- integrated validation
- final documentation and plan-vs-execution confirmation

## 8. Execution Model

### 8.1 Parallel Mode (Preferred — When Sub-Agents Are Available)

Execute with two implementation sub-agents plus the main thread:

1. Worker A owns Workstream A (Slice A + Slice B).
2. Worker B owns Workstream B (Slice C).
3. The main thread owns Workstream C (Slice D + Slice E) and final integration.

Rules:

- do not let implementation workers edit the same schema or adapter file concurrently
- do not split one hardening primitive across multiple workers
- integrate one worker patch at a time, rerun the affected tests, then merge the next write scope
- after the integrated branch is green, run fresh independent review sub-agents for:
  - code review
  - security review
- final review agents must not be the same agents used for implementation

Recommended sequence with integration checkpoints:

1. Worker A implements the shared allowlist contract and RLS generator (Slices A + B).
2. **Checkpoint 1**: Integrate Worker A output. Run `pnpm --filter @orbit-ai/core test`. Run `orbit-tenant-safety-review` (required mid-sequence gate — see §9).
3. Worker B integrates Postgres bootstrap usage and adapter/schema tests (Slice C).
4. **Checkpoint 2**: Integrate Worker B output. Run `pnpm --filter @orbit-ai/core test`.
5. Main thread performs the org-leading index audit, adapter/tenant-context proofs, and docs (Slices D + E).
6. **Checkpoint 3**: Run full validation gates (§10.5). Run `orbit-tenant-safety-review` (final gate).
7. Independent review sub-agents rerun findings-first code review and tenant-safety/security review on the integrated diff.

### 8.2 Sequential Mode (Fallback — Single-Agent Execution)

When sub-agents are not available, execute slices A through E sequentially in one thread. The same integration checkpoints apply:

- After Slice B completion: run tests + `orbit-tenant-safety-review`
- After Slice C completion: run tests
- After Slice E completion: run full validation gates + final reviews

Task annotations:

| Task | Workstream | Slice |
|------|-----------|-------|
| Tenant-table allowlist | A | A |
| RLS generator + idempotency | A | B |
| Postgres bootstrap integration | B | C |
| Org-leading index audit | C | D |
| Adapter/tenant-context proofs | C | E |
| KB + review artifact | C | E |

## 9. Required Skills And Reviews

Mandatory review gates for this follow-up:

- `orbit-tenant-safety-review`
  - **required after Slice B** (mid-sequence gate — see §8 Checkpoint 1) **and again after final integration** (§8 Checkpoint 3)
  - focus on RLS, tenant-context safety, and cross-tenant deny behavior
  - the mid-sequence gate catches RLS generation issues before they propagate into bootstrap integration
- `orbit-core-slice-review`
  - required after the integrated branch lands locally
  - confirm the branch only contains the intended tenant-hardening scope
- `orbit-schema-change`
  - required because this follow-up changes bootstrap SQL and generated schema-policy behavior

If those repo-local skills are unavailable in the execution environment, use equivalent explicit review passes with separate sub-agents and preserve the same review questions and gates.

## 10. Testing To Execute

### 10.1 Allowlist And Drift Tests

- canonical tenant-table list excludes bootstrap tables
- RLS generator and tenant-scope inventory stay in lockstep
- bootstrap/schema helpers do not silently omit a tenant table
- newly added tenant tables fail tests until registered in the shared allowlist

### 10.2 RLS Generation Tests

- `current_org_id()` helper SQL is emitted
- every implemented tenant table gets:
  - `enable row level security`
  - `select` policy
  - `insert` policy
  - `update` policy
  - `delete` policy
- bootstrap tables do not receive tenant RLS policies

### 10.3 Bootstrap And Adapter Tests

- Postgres bootstrap emits both table/index DDL and RLS DDL
- bootstrap remains idempotent
- transaction-bound tenant context still uses transaction-local settings
- runtime adapter tests still prove no request-path reachability into migration authority
- **if `schema.test.ts` is replaced**, the new file must explicitly supersede the Wave 1 statement-count assertion with an updated count that reflects both Wave 1 and hardening DDL — do not silently drop coverage

### 10.4 Index Audit Tests

- added org-leading indexes are asserted explicitly in schema tests
- exception cases are documented and covered by review notes rather than left implicit
- repository access patterns used to justify new indexes are cited in the review artifact

### 10.5 Integrated Validation Gates

Before review and again after review fixes:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core test -- src/adapters/sqlite` (Execution Principle 5 — confirm SQLite is unchanged)
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

## 11. Review Focus

### 11.1 Core Review

Run a findings-first code review after the integrated branch lands.

Focus:

- shared tenant-table inventory drift
- incorrect or partial RLS generation
- bootstrap integration mistakes
- indexes added without a defensible repository access pattern
- accidental service-surface or authority-model drift

### 11.2 Security Review

Run `orbit-tenant-safety-review` and an explicit security review after the integrated branch lands.

Mandatory security review surfaces:

- generated RLS SQL
- Postgres bootstrap integration
- tenant-table inventory and allowlist assertions
- adapter authority boundaries
- cross-tenant negative proof coverage

Threat-model focus:

- T1 cross-tenant read/write exposure
- T2 privileged credential misuse or bypass-RLS runtime design
- T6 unsafe schema/policy exposure through the wrong authority boundary

Security review questions the branch must answer:

1. Does every implemented tenant table now receive Postgres-family RLS coverage?
2. Can any request-path runtime code still bypass tenant isolation through missing tenant context or policy drift?
3. Does the shared allowlist make missing tenant-table registration a test failure?
4. Did any bootstrap or adapter change accidentally widen migration authority into runtime paths?
5. Are the new indexes justified by actual tenant-scoped access patterns rather than speculative tuning?

### 11.3 Plan Vs Execution Review

Run `orbit-core-slice-review` after implementation and after any review-driven fixes.

It must confirm:

- the branch contains tenant hardening only
- Wave 2 service-surface work was not reopened
- API, SDK, CLI, and MCP work were not pulled forward
- schema-engine execution behavior was not pulled forward beyond shared RLS SQL generation
- SQLite remains clearly documented as application-enforced only

## 12. Done Condition

This follow-up is complete when:

1. implemented Postgres-family tenant tables have generated RLS SQL coverage
2. Postgres bootstrap applies that RLS SQL as part of the tested baseline
3. a shared tenant-table allowlist assertion prevents drift across hardening layers
4. org-leading tenant index gaps are either fixed or explicitly documented as accepted exceptions
5. runtime repositories still include explicit org filters
6. adapter authority boundaries remain intact
7. the full core test, typecheck, build, and diff checks pass
8. core review and security review report no unresolved blocking findings for this scope

## 13. Immediate Next Actions

1. Accept this tenant-hardening plan.
2. Create branch `core-tenant-hardening`.
3. Execute Slice A first:
   - canonical tenant-table allowlist
   - RLS generator
4. Execute Slice B (RLS DDL generation with idempotency).
5. **Checkpoint 1**: Run tests + `orbit-tenant-safety-review` before integrating bootstrap changes.
6. Execute Slice C (Postgres bootstrap integration).
7. **Checkpoint 2**: Run tests.
8. Execute Slices D + E (index audit, proofs, docs).
9. **Checkpoint 3**: Run full validation gates + final reviews.

## 14. Review Findings Log

### 2026-04-03 — Consolidated Pre-Execution Review

Three independent review passes (spec/scope, codebase verification, tenant safety). All codebase references verified correct. Schema change classified as additive with migration review.

#### Findings Addressed In This Revision

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| H1 | HIGH | `CREATE POLICY` not idempotent in Postgres | Slice B now requires `DROP POLICY IF EXISTS` before each `CREATE POLICY` |
| H2 | HIGH | Missing adapter/tenant-context proof tests | Slice E now explicitly requires re-running and extending these tests |
| H3 | HIGH | Sub-agent workstream model abandoned in task list | §8 now has parallel and sequential modes with task-to-workstream mapping |
| M1 | MEDIUM | `orbit-tenant-safety-review` required twice, plan ran once | §8 + §9 now have explicit mid-sequence gate after Slice B |
| M2 | MEDIUM | Bootstrap authority not documented | Slice C now requires `initializePostgresXxxSchema` only from `runWithMigrationAuthority()` |
| M3 | MEDIUM | Spec deviation (shared allowlist) not documented | Slice A now has explicit deviation note per Execution Principle 7 |
| M4 | MEDIUM | schema.test.ts replacement risks dropping coverage | §10.3 now requires explicit supersession of Wave 1 assertions |

#### Low-Severity Findings Acknowledged

| ID | Finding | Disposition |
|----|---------|-------------|
| L1 | No test verifies repositories retain explicit org filters | Existing repository tests from prior waves cover this — no new test needed |
| L2 | No SQLite verification step | Added `pnpm test -- src/adapters/sqlite` to §10.5 validation gates |
| L3 | No cross-tenant deny integration test at Postgres level | Deferred — unit tests verify SQL generation; runtime deny proof requires live Postgres |
| L4 | `extractTenantTableNames` regex won't match schema-qualified names | No immediate risk — current DDL uses unqualified names |
| L5 | `rls.ts` public export path marked optional | To be decided during Slice A — either explicit re-export from `engine.ts` or internal-only |
| L6 | `schema_migrations` under RLS requires migration authority for reads | Bootstrap/status reads already use migration authority path — note in review artifact |

