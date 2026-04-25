# Plan C.5 — Schema-Engine Migration Implementation

> **Status:** EXECUTABLE FOLLOW-UP PLAN. Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. This follow-up plan replaces the prior non-executable placeholder.

**Goal:** Replace the alpha schema migration stubs with real preview, apply, rollback, custom-field update, and custom-field delete behavior while preserving Orbit's runtime-vs-migration authority boundary and tenant isolation contract.

**Scope:** One focused migration-engine PR covering `@orbit-ai/core`, API route behavior, SDK/DirectTransport parity, CLI confirmation semantics, adapter migration behavior, and E2E journeys that prove the destructive-operation gate is enforced outside the client.

**Branch:** Work continues on the current branch (`claude/recursing-almeida-e96c5d`). Do not create a new branch unless the coordinating agent explicitly asks for one.

**Required lenses:**
- **Orbit schema-change Type D:** migration/schema-engine behavior. Migration execution must use migration authority only, every applied migration must store rollback data, adapters need coverage, and destructive operations default to blocked.
- **Orbit tenant-safety:** runtime request paths must never use migration credentials, tenant-scoped reads/writes must assert trusted org context, and privileged migration execution must not be reachable through public runtime credentials.

**Related:**
- [Plan C plan doc](./2026-04-23-plan-c-e2e-journeys.md)
- [Plan C follow-ups](./2026-04-24-plan-c-followups.md)
- `docs/specs/01-core.md` — schema engine, adapter interface, migration authority, RLS
- `docs/security/security-architecture.md` — tenant isolation and Postgres role model
- `release-definition-v2.md §5` — alpha.1 launch gate
- CLAUDE.md "Key Architecture Rules" — agent-safe by default; ADD allowed, DROP/RENAME require destructive confirmation

---

## Cloud Execution Context

> This section is for cloud/remote agents executing this plan without access to the original review conversation.

| Item | Value |
|------|-------|
| **Repository** | `https://github.com/sharonds/orbit-ai` |
| **Branch** | Create from `main`: `git worktree add .worktrees/plan-c5-migration main -b feat/plan-c5-migration-engine` |
| **Node** | 22+ required |
| **Package manager** | pnpm 9.12.3 |
| **Baseline tests** | 1796 passing — run `pnpm -r test` to verify before starting |
| **Pre-execution** | `pnpm -r build && pnpm -r test && pnpm -r lint` must all pass first |
| **Post-execution** | `pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm --filter @orbit-ai/e2e test` — Journey 8 must certify real migration safety (not stub passthrough) |
| **Dependency** | Plan C (fix/plan-c-followups) must be merged first — Journey 8 is currently rewritten as stub passthrough and will be restored by this plan |
| **Authority contract** | Read `## Authority Contract` section in this plan before writing ANY migration code. All DDL must go through `runWithMigrationAuthority(...)`. Never bypass it. |

### Coding conventions (apply to every task)
- `catch (err)` — never bare `catch {}`; log before swallowing with `console.error(...)`
- Defensive cast: `err instanceof Error ? err.message : String(err)`
- Tests ship in the same commit as the feature
- `pnpm -r lint` must pass before each commit
- All schema tables must include `organization_id` + RLS policy (Postgres adapters)
- Zod v4: `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`
- Duck-type guards for ZodError: check `name === 'ZodError' && Array.isArray(issues)`

---

## Verified Validation Findings To Fix

| Finding | Required plan response |
|---|---|
| Prior file was a non-executable placeholder | This document is now executable and uses task checkboxes. |
| No authority-boundary design | Add a migration-authority contract and enforce it across core, API, SDK, CLI, and adapters. |
| `OrbitSchemaEngine` lacks migration authority dependency | Inject a migration runner/authority dependency into `OrbitSchemaEngine`; do not construct the engine with only `getCustomFieldDefinitionsRepository`. |
| Public route `POST /v1/schema/migrations/apply` exposes `schema:apply` without a clear boundary | Narrow route behavior, reject destructive operations by default, and route any privileged execution through authority checks. |
| Destructive confirmation is client-side only | Enforce `destructive=false` default and explicit destructive confirmation/token in core/server, not only CLI/SDK. |
| Rollback ledger is not actionable | Persist migration records with forward/reverse operations, checksum, adapter, orgId, appliedBy, status, and rollback preconditions. |
| SQLite migrate ignores configured `migrationDatabase` | Fix SQLite migration DB usage and add adapter regression tests. |
| Schema reads skip explicit org-context assertion | Require `listObjects`, `getObject`, and tenant-scoped schema metadata reads to assert org context. |
| Adapter coverage incomplete | Cover SQLite, Postgres-family, and Neon branch-before-migrate where configured. |
| Missing validation commands and acceptance criteria | Add explicit commands and release-gate criteria below. |

---

## Authority Contract

All implementers must preserve this contract:

1. **Runtime schema preview may inspect metadata only.** `preview`, `listObjects`, `getObject`, and custom-field metadata reads may run under runtime credentials, but only after `assertOrgContext(ctx)` for tenant-scoped data. Runtime preview may compute a plan from metadata and adapter introspection that is safe for the current org.
2. **Privileged operations require migration authority.** `apply`, `rollback`, custom-field promotion, physical column drop, physical column rename, table drop, index drop, type narrowing, and any adapter DDL must run only through `runWithMigrationAuthority(...)` or an equivalent adapter-provided migration authority. They must never run on public runtime credentials or request-serving database roles.
3. **Authority is injected.** `OrbitSchemaEngine` must receive a migration runner/authority dependency at construction time, alongside custom-field repositories. The engine must not discover or construct elevated credentials internally.
4. **Destructive defaults to false.** Every apply/delete/rename/drop path defaults to non-destructive. Destructive operations require server/core validation of an explicit destructive confirmation. CLI `--yes` or SDK booleans are inputs to that server/core check, not the enforcement boundary.
5. **Public routes are not an authority shortcut.** `POST /v1/schema/migrations/apply` may authenticate and authorize the caller, but actual execution must go through the injected migration authority. If the configured deployment does not expose migration authority to the API process, the route must return a structured error instead of falling back to runtime credentials.
6. **Tenant scope is explicit.** Migration records and metadata operations are keyed by trusted `ctx.orgId` where tenant-scoped. Callers never supply `orgId` in migration payloads for public surfaces.

Suggested core shape:

```typescript
export interface MigrationAuthority {
  preview?(ctx: OrbitContext, input: SchemaPreviewInput): Promise<SchemaMigrationPlan>
  runWithMigrationAuthority<T>(
    ctx: OrbitContext,
    operation: MigrationAuthorityOperation,
    fn: (runner: MigrationRunner) => Promise<T>,
  ): Promise<T>
  verifyDestructiveConfirmation?(
    ctx: OrbitContext,
    plan: SchemaMigrationPlan,
    confirmation: DestructiveConfirmation | undefined,
  ): Promise<void>
}

export interface OrbitSchemaEngineOptions {
  customFieldDefinitions: CustomFieldDefinitionsRepository
  migrationAuthority: MigrationAuthority
  migrationLedger: SchemaMigrationLedger
}
```

Exact names may differ to match local code, but the dependency direction must not.

---

## File Structure

Expected touch points. Adjust after reading current code, but keep the authority and tenant boundaries intact.

```
packages/core/src/schema-engine/
├── engine.ts                         # inject migration authority; preview/apply/rollback/update/delete implementations
├── migrations.ts                     # operation model, diff, destructive classifier
├── migration-ledger.ts               # persisted migration records and rollback preconditions
└── destructive-confirmation.ts       # core/server destructive confirmation checks

packages/core/src/adapters/
├── interface.ts                      # migration authority/runner contracts if not already present
├── sqlite/                           # honor configured migrationDatabase; SQLite DDL tests
├── postgres/                         # Postgres-family migration authority tests
└── neon/                             # branch-before-migrate coverage if Neon adapter is enabled

packages/api/src/routes/
└── schema*.ts                        # narrow POST /v1/schema/migrations/apply behavior and errors

packages/sdk/src/
├── transport/direct-transport.ts     # route preview/apply/rollback/update/delete through engine
└── resources/schema*.ts              # expose confirmation input without making it the enforcement boundary

packages/cli/src/commands/
├── migrate*.ts                       # preview/apply UX; --yes maps to confirmation input only
└── fields*.ts                        # update/delete custom-field wiring

e2e/src/journeys/
├── 08-migration-preview-apply.test.ts
└── 16-custom-field-rename.test.ts
```

---

## Task 1: Establish The Operation And Ledger Model

**Why:** Rollback and idempotency cannot be added later as comments. The engine needs a durable record of what it applied, how to reverse it, and which tenant/adapter it belongs to.

**Files:**
- Modify/create under `packages/core/src/schema-engine/`
- Modify adapter schema/migrations for the ledger table
- Update `docs/specs/01-core.md` only if the public contract changes; otherwise keep this PR implementation-focused

- [ ] Define a closed `SchemaOperation` union. Include at least custom-field add, update, delete, rename, promote, add column, drop column, rename column, add index, drop index, and raw adapter migration references if needed.
- [ ] Every operation must include `destructive: boolean`, `entityType` or object/table target, and enough payload to generate a reverse operation before apply.
- [ ] Define persisted `schema_migration_records` or equivalent with these required fields:
  - `id`
  - `orgId` for tenant-scoped migrations, nullable only for explicitly bootstrap/global migrations
  - `adapter`
  - `checksum`
  - `forwardOperations`
  - `reverseOperations`
  - `destructive`
  - `appliedBy`
  - `status` (`pending`, `applied`, `rolled_back`, `failed`)
  - `startedAt`, `appliedAt`, `rolledBackAt`, `failedAt`
  - `errorCode` / `errorMessage` for failed attempts without leaking secrets
- [ ] Compute the checksum from canonicalized forward operations plus adapter and org scope. Reusing an idempotency key with different operations must fail with a structured conflict.
- [ ] Define rollback preconditions:
  - record status is `applied`
  - `reverseOperations` exist and match the stored checksum
  - same adapter family and trusted `ctx.orgId`
  - no newer applied migration for the same org/object depends on this record, unless the rollback explicitly targets a full reverse chain
  - caller has migration authority

**Safety gate:** Ledger reads for tenant-scoped migrations must filter by trusted `ctx.orgId`; no caller-supplied org ID.

---

## Task 2: Inject Migration Authority Into `OrbitSchemaEngine`

**Why:** Today the schema engine can be constructed around repository access only. That makes it too easy for DDL to run from a runtime path.

**Files:**
- Modify: `packages/core/src/schema-engine/engine.ts`
- Modify: engine construction sites in API, SDK DirectTransport, tests, and harnesses
- Modify: adapter interface files if authority types need to move there

- [ ] Replace any engine constructor shape that only accepts `getCustomFieldDefinitionsRepository` or equivalent with explicit dependencies: custom-field repository, migration authority/runner, and migration ledger.
- [ ] Update tests and direct transports to pass a test migration authority. The test authority must make elevated execution visible, not silently no-op.
- [ ] Ensure `apply`, `rollback`, `updateField` for destructive changes, `deleteField`, and promotion paths cannot execute without a configured migration authority. Missing authority should produce a structured internal/configuration error, not a runtime fallback.
- [ ] Keep runtime metadata reads on runtime credentials, but add `assertOrgContext(ctx)` to each tenant-scoped read path.

**Safety gate:** Add a unit test that fails if `apply` is called without migration authority and succeeds only when execution happens inside the authority callback.

---

## Task 3: Implement Preview And Destructive Classification

**Why:** `preview()` must stop returning coverage-theater empty operations and must classify destructive work before any apply path runs.

**Files:**
- Modify/create: `packages/core/src/schema-engine/migrations.ts`
- Modify: `packages/core/src/schema-engine/engine.ts`
- Add tests under `packages/core/src/schema-engine/`

- [ ] Decide and document the preview source of truth in code comments/tests:
  - custom-field metadata for tenant-scoped custom fields
  - adapter introspection/migration state for physical DDL
  - migration ledger for previously applied operations
- [ ] Implement `preview(ctx, input)` so it asserts org context for tenant-scoped plans and returns a typed operation list, `destructive`, `checksum`, and human-readable summary.
- [ ] Classify as destructive at minimum: delete/drop, rename without safe alias/backfill, type narrowing, removing default that can make existing writes fail, and promotion paths that can lose custom-field data.
- [ ] Classify as non-destructive at minimum: add nullable custom field, add nullable column, add index, widen compatible type where adapter guarantees no data loss.
- [ ] Add tests proving at least:
  - add custom field returns one non-destructive operation
  - delete custom field with existing data returns a destructive operation
  - rename custom field returns destructive unless implemented as a reversible metadata alias/backfill sequence

**Safety gate:** Preview may inspect tenant metadata under runtime credentials, but must never execute DDL.

---

## Task 4: Enforce Destructive Confirmation In Core And Server

**Why:** Client-side confirmation is advisory. Safety must hold for API, SDK HTTP, SDK direct, CLI, and MCP callers.

**Files:**
- Modify/create: `packages/core/src/schema-engine/destructive-confirmation.ts`
- Modify: `packages/core/src/schema-engine/engine.ts`
- Modify: API schema route files
- Modify: SDK/CLI request shapes only as needed

- [ ] Make `apply(ctx, input)` recompute or load the plan, inspect `plan.destructive`, and reject by default.
- [ ] Require explicit destructive confirmation when `plan.destructive === true`. Accept either a structured confirmation token or a core-validated `{ destructive: true, checksum }` style input. The exact UX can vary, but the core check must bind confirmation to the plan checksum.
- [ ] Reject stale confirmation when operations/checksum changed between preview and apply.
- [ ] Require the same confirmation check for `deleteField`, destructive `updateField`, physical drop/rename, and rollback if rollback itself is destructive for the active adapter.
- [ ] Preserve CLI `--yes`, but map it to the server/core confirmation input. Do not let CLI be the only enforcement layer.
- [ ] Add API and DirectTransport tests showing destructive apply is rejected without confirmation and accepted only with valid confirmation plus migration authority.

**Safety gate:** Default behavior for all public surfaces is `destructive=false`. No destructive operation may run because a client omitted a flag.

---

## Task 5: Narrow `POST /v1/schema/migrations/apply`

**Why:** The public tenant route currently exposes `schema:apply` without a clear authority boundary.

**Files:**
- Modify: API schema migration route implementation
- Modify: API route tests/OpenAPI if present
- Modify: SDK HTTP resource tests if route contract changes

- [ ] Classify the route as tenant-scoped public runtime entrypoint. Auth resolves `ctx.orgId`; request body must not provide org scope.
- [ ] Validate payload against the new apply input schema. Unknown operation payloads fail closed.
- [ ] Reject destructive operations by default before reaching adapter execution.
- [ ] Route privileged execution through injected migration authority. If the API process is not configured with migration authority, return a structured error such as `MIGRATION_AUTHORITY_UNAVAILABLE` or existing equivalent.
- [ ] Do not let the route use service-role, migration-role, or RLS-bypassing credentials directly. The only elevated path is the authority callback.
- [ ] Add tests for:
  - missing org context returns auth/context error
  - destructive apply without confirmation returns validation/safety error
  - configured no-authority API returns authority-unavailable error
  - successful apply records `appliedBy` from authenticated context

**Safety gate:** A public API key with `schema:apply` scope is not itself migration authority. It authorizes the request; the injected authority controls execution.

---

## Task 6: Implement Apply, Rollback, Update Field, Delete Field

**Why:** DirectTransport routes already expect these behaviors, but the engine is missing real semantics.

**Files:**
- Modify: `packages/core/src/schema-engine/engine.ts`
- Modify: custom-field repository/service files if needed
- Modify: `packages/sdk/src/transport/direct-transport.ts`
- Modify: CLI fields/migrate commands

- [ ] Implement `apply(ctx, input)`:
  - assert org context
  - build or load preview plan
  - enforce destructive confirmation
  - execute forward operations inside migration authority
  - persist ledger status transitions
  - return applied operation IDs and migration record ID
- [ ] Implement `rollback(ctx, migrationId, input)`:
  - assert org context
  - load ledger record by trusted org
  - check rollback preconditions
  - execute reverse operations inside migration authority
  - mark record `rolled_back`
- [ ] Implement `updateField(ctx, entity, fieldName, patch)`:
  - metadata-only safe changes may run as tenant-scoped runtime writes if no DDL is needed
  - rename/type-change/default changes that are destructive or physical must route through preview/apply authority flow
  - old and new names must be checked for conflicts within the same org/entity
- [ ] Implement `deleteField(ctx, entity, fieldName, input)`:
  - always destructive when data may exist
  - default reject without destructive confirmation
  - after confirmed apply, metadata and stored custom-field values must agree
- [ ] Update DirectTransport to stop returning 501 for PATCH/DELETE custom-field routes.
- [ ] Update CLI `orbit migrate` and `orbit fields update/delete` to pass confirmation inputs while preserving `--json` envelope behavior.

**Safety gate:** Any tenant-scoped custom-field write must use trusted `ctx.orgId`; no payload-provided organization ID.

---

## Task 7: Fix SQLite `migrationDatabase` Handling

**Why:** SQLite migrate currently ignores the configured migration database, so tests can pass against the wrong file and production/dev setups can drift.

**Files:**
- Modify: SQLite adapter migration code
- Add/modify: SQLite adapter tests

- [ ] Read the SQLite adapter configuration and identify every path that opens a DB for migrations.
- [ ] Ensure migration execution uses the configured `migrationDatabase` when provided, and uses the runtime database only when that is explicitly the configured migration target. Specifically, wrap ALL migration-applying calls in `runWithMigrationAuthority((db) => ...)` — the `migrationDatabase` value must be passed as the DB argument. Direct calls to `initializeAllSqliteSchemas(this.unsafeRawDatabase)` that bypass the migration authority are the exact defect being fixed; remove them.
- [ ] Add a regression test with separate runtime and migration DB files. The test must fail if migrations are applied to the runtime DB when `migrationDatabase` points elsewhere.
- [ ] Add a test proving ledger records are written/read from the intended migration store or documented canonical store.
- [ ] Verify cleanup removes both DB files in tests.

**Safety gate:** SQLite remains unsuitable for multi-tenant production because it lacks RLS, but its migration target must still honor configuration.

---

## Task 8: Add Adapter Coverage

**Why:** Migration semantics differ across adapters; the plan is not complete with SQLite-only proof.

**Files:**
- Modify/add adapter tests under `packages/core/src/adapters/**`
- Modify E2E adapter matrix if needed

- [ ] SQLite coverage:
  - additive custom-field migration
  - destructive custom-field delete blocked by default
  - confirmed destructive delete
  - rollback from ledger
  - configured `migrationDatabase`
- [ ] Postgres-family coverage:
  - migration execution happens inside migration authority
  - tenant-scoped metadata reads/writes use trusted org context
  - no runtime connection executes DDL
  - RLS/current-org context remains transaction-bound for runtime reads
- [ ] Neon coverage if the Neon adapter is enabled in this repo:
  - branch-before-migrate runs before privileged migration execution
  - failed migration does not promote/attach the branch
  - ledger records the adapter/branch identity needed for rollback or audit
- [ ] If Neon is not enabled or cannot run in CI, add a skipped/conditional test with a TODO linked to the adapter setup, and still unit-test the branch-before-migrate orchestration boundary with a fake authority.

**Safety gate:** Do not claim Postgres-family support from a SQLite-only test path.

---

## Task 9: Add Explicit Org-Context Assertions To Schema Reads

**Why:** `listObjects`, `getObject`, and schema metadata reads currently rely on lower layers for tenant filtering. This is a defense-in-depth gap.

**Files:**
- Modify: `packages/core/src/schema-engine/engine.ts`
- Modify: repository tests if helper behavior changes

- [ ] Add `assertOrgContext(ctx)` to `listObjects` and `getObject` when returning tenant-scoped schema/object metadata.
- [ ] Audit all schema metadata reads used by preview, field list, field get, update, delete, and promotion. Add explicit org assertions anywhere tenant-scoped data is read.
- [ ] Confirm bootstrap/global schema reads, if any, are named separately and do not accidentally enter tenant context.
- [ ] Add tests for missing org context on `listObjects`, `getObject`, and at least one custom-field metadata read.

**Safety gate:** Public, SDK direct, and MCP schema reads must get org scope from trusted context, never request input.

---

## Task 10: Rewrite Journey 8 And Add Rename Journey

**Why:** E2E coverage must prove real behavior instead of stub passthrough.

**Files:**
- Modify: `e2e/src/journeys/08-migration-preview-apply.test.ts`
- Create: `e2e/src/journeys/16-custom-field-rename.test.ts`
- Modify E2E README/listing if journey inventory is documented

- [ ] Rewrite Journey 8 to:
  - create a custom field
  - populate data for that field
  - request deletion/drop through migration preview
  - assert preview reports `destructive: true`
  - assert apply without confirmation fails
  - assert apply with valid confirmation succeeds
  - assert the field metadata and values are gone or migrated according to the operation contract
- [ ] Add Journey 16 for custom-field rename:
  - create a field
  - populate data
  - preview rename
  - apply with required confirmation if classified destructive
  - assert reads use the new name
  - assert old name is unreachable or available only via a documented alias window
- [ ] Run both journeys under SQLite and every enabled Postgres-family adapter path.

**Safety gate:** The journey must fail if destructive behavior is enforced only in CLI code and bypassable through SDK direct/API.

---

## Task 11: Update Documentation And Release Gates

**Why:** The migration engine was previously documented as a known limitation. Once this lands, docs and launch gates must describe the real contract and remaining alpha limits.

**Files:**
- Modify: `release-definition-v2.md`
- Modify: package READMEs if migration commands or confirmation inputs changed
- Modify: `llms.txt` if machine-readable surface inventory includes migration behavior
- Add memory entry if this repo still uses `.claude/projects/.../memory/` for durable design decisions

- [ ] Remove or rewrite the known limitation that says schema migration engine is stubbed.
- [ ] Document the authority boundary: preview is runtime-safe; apply/rollback/promote/drop/rename require migration authority.
- [ ] Document destructive confirmation semantics for API/SDK/CLI/MCP where exposed.
- [ ] Record a concise design memory with:
  - migration authority dependency shape
  - diff source of truth
  - destructive classification rules
  - rollback ledger fields and preconditions
  - adapter coverage expectations

**Safety gate:** Do not remove the limitation until Journey 8 and adapter tests prove real destructive-gate behavior.

---

## Validation Commands

Run the narrow commands while implementing each task, then run the full gate before marking the plan complete.

```bash
pnpm -F @orbit-ai/core test -- schema-engine
pnpm -F @orbit-ai/core test -- adapters
pnpm -F @orbit-ai/api test -- schema
pnpm -F @orbit-ai/sdk test -- direct-transport
pnpm -F @orbit-ai/cli test -- migrate fields
pnpm -F @orbit-ai/e2e test src/journeys/08-migration-preview-apply.test.ts
pnpm -F @orbit-ai/e2e test src/journeys/16-custom-field-rename.test.ts
ORBIT_E2E_ADAPTER=postgres pnpm -F @orbit-ai/e2e test src/journeys/08-migration-preview-apply.test.ts src/journeys/16-custom-field-rename.test.ts
pnpm -r test
```

If the repo uses a separate Neon test gate, run the configured Neon command and record it in the PR. If Neon credentials are unavailable locally, run the fake-authority orchestration test and mark the live Neon test as CI-only.

---

## Acceptance Criteria

Plan C.5 is complete only when all of these are true:

1. `OrbitSchemaEngine.preview()` returns real operations for additive custom-field changes and destructive custom-field deletion/rename scenarios.
2. `OrbitSchemaEngine.apply()` refuses destructive operations by default in core, API, SDK HTTP, SDK DirectTransport, CLI, and MCP/direct callers where applicable.
3. Privileged migration execution happens only through injected migration authority or adapter equivalent; no public runtime credential path executes DDL.
4. `OrbitSchemaEngine` is constructed with explicit migration authority and ledger dependencies.
5. `POST /v1/schema/migrations/apply` validates authority availability, rejects destructive operations by default, and records `appliedBy` from authenticated context.
6. Destructive confirmation is bound to the preview checksum or equivalent plan identity and is enforced server/core-side.
7. Rollback uses persisted records containing forward/reverse operations, checksum, adapter, orgId, appliedBy, and status, and refuses rollback when preconditions fail.
8. SQLite migrations honor configured `migrationDatabase`, with regression tests proving separate runtime/migration DB behavior.
9. `listObjects`, `getObject`, and tenant-scoped schema metadata reads assert org context explicitly.
10. Adapter coverage includes SQLite and Postgres-family paths; Neon branch-before-migrate is tested when applicable or explicitly documented as CI-only/conditional.
11. Journey 8 no longer certifies stub behavior; it proves destructive preview/apply safety. Journey 16 proves custom-field rename semantics.
12. `release-definition-v2.md` no longer claims the migration engine is stubbed unless a narrower alpha limitation remains true and is explicitly documented.

---

## Out Of Scope

- Cross-database data migration, such as SQLite to Postgres.
- Per-tenant physical table layouts. Custom-field metadata remains tenant-scoped; shared base tables remain shared.
- Hosted control-plane workflows beyond the authority checks needed to prevent public runtime credential escalation.
- A general-purpose migration DSL for third-party plugins. This plan covers Orbit core schema/custom-field migration semantics.

---

## Residual Risks To Call Out In The PR

- SQLite cannot provide database-enforced tenant isolation. Tests should prove correct behavior, but docs must continue to warn against multi-tenant production SQLite.
- Some destructive operations may be adapter-specific. If an operation cannot be made reversible on an adapter, preview/apply must reject it or record it as non-rollbackable and require a stronger confirmation.
- Neon live branch-before-migrate coverage may depend on CI credentials. If unavailable locally, keep fake-authority tests and document the live gate.
