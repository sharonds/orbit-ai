# Orbit AI Core Wave 2 Slice E Plan

Date: 2026-04-02
Status: Drafted for execution
Package: `@orbit-ai/core`
Depends on:
- [core-wave-2-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-services-plan.md)
- [core-wave-2-slice-d-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-d-review.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [database-hardening-checklist.md](/Users/sharonsciammas/orbit-ai/docs/security/database-hardening-checklist.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines the execution plan for Core Wave 2 Slice E in `@orbit-ai/core`.

Slice D completed the operational metadata and secret-safe delivery surfaces. Slice E closes the Wave 2 service registry by adding the remaining metadata entities and the final admin/system reads needed before the next hardening, audit, idempotency, and schema-engine milestones begin.

Current repo baseline:

- the Slice E object types exist only in [entities.ts](/Users/sharonsciammas/orbit-ai/packages/core/src/types/entities.ts)
- the schema, repositories, services, registry wiring, exports, and SQLite/Postgres bootstrap coverage for Slice E do not exist yet

## 2. Slice Objective

Deliver the final Wave 2 metadata surfaces while preserving the accepted Wave 1 and Wave 2 contracts:

1. the full Wave 2 registry is available from `createCoreServices(adapter)`
2. `system.customFieldDefinitions`, `system.auditLogs`, `system.schemaMigrations`, and `system.idempotencyKeys` exist with stable persisted shapes and coherent read contracts
3. admin/system metadata services remain explicit and read-only in this slice
4. no request-path service reaches migration authority, raw privileged adapter surfaces, or ad hoc schema execution behavior
5. SQLite and Postgres persistence paths both remain green for the touched entity set

Slice E is about registry completion, metadata persistence, and hardening prep. It is not the audit middleware milestone, not the idempotency middleware milestone, not the schema-engine execution milestone, and not the tenant-hardening follow-up.

## 3. In Scope

Admin/system read services:

- `system.customFieldDefinitions`
- `system.auditLogs`
- `system.schemaMigrations`
- `system.idempotencyKeys`

Supporting repository, schema, and service files under:

- `packages/core/src/entities/`
- `packages/core/src/repositories/`
- `packages/core/src/services/`
- `packages/core/src/schema/`
- `packages/core/src/adapters/`
- `packages/core/src/ids/`
- `packages/core/src/index.ts`

Expected file areas to change:

- new entity directories for:
  - `custom-field-definitions`
  - `audit-logs`
  - `schema-migrations`
  - `idempotency-keys`
- `packages/core/src/schema/tables.ts`
- `packages/core/src/schema/relations.ts`
- `packages/core/src/schema/zod.ts`
- `packages/core/src/repositories/tenant-scope.ts`
- `packages/core/src/adapters/sqlite/schema.ts`
- `packages/core/src/adapters/postgres/schema.ts`
- `packages/core/src/services/index.ts`
- `packages/core/src/services/index.test.ts`
- `packages/core/src/services/sqlite-persistence.test.ts`
- `packages/core/src/services/postgres-persistence.test.ts`
- `packages/core/src/index.ts`

Supporting tests under:

- `packages/core/src/entities/**/*.test.ts`
- `packages/core/src/services/**/*.test.ts`
- `packages/core/src/schema/**/*.test.ts`
- `packages/core/src/adapters/**/*.test.ts`

Documentation scope:

- [docs/KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- [docs/review/core-wave-2-slice-e-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-e-review.md)
- entity-local `AGENTS.MD` files for each new Slice E entity directory

## 4. Out Of Scope

- schema-engine mutation, apply, rollback, preview, or branch-before-migrate flows
- automatic audit-log writes on every mutation
- idempotency lock acquisition, replay, cache, or middleware behavior
- custom-field promotion DDL, promoted-column backfill, or runtime schema regeneration
- API, SDK, CLI, or MCP route/tool implementation
- the separate tenant-hardening follow-up for:
  - Postgres RLS DDL
  - org-leading tenant indexes
  - shared table-name allowlist assertions
- exposing new request-path services that widen the public registry beyond the accepted Wave 2 plan

These remain later milestones even though Slice E introduces persisted metadata they will consume.

## 5. Required Execution Principles

1. Do not rewrite accepted Wave 1, Slice A, Slice B, Slice C, or Slice D service contracts.
2. Keep Slice E metadata services under `system.*` and read-only in this slice.
3. Keep tenant-scoped repositories explicitly filtered by `organization_id`, even on Postgres-family adapters.
4. Preserve the frozen persisted field set from the canonical specs even if the public read DTO omits or redacts sensitive metadata fields.
5. Do not let request-path services invoke `runWithMigrationAuthority(...)`, `unsafeRawDatabase`, or any equivalent privileged adapter path.
6. If the canonical docs do not already freeze a safe admin DTO for `audit_logs` or `idempotency_keys`, default to omission or explicit redaction for sensitive payload fields rather than implicit pass-through.
7. Finish the Wave 2 registry and export surface without pulling audit middleware, idempotency middleware, or schema-engine workflows forward.

## 6. Service Surface To Deliver

### 6.1 Admin/System Read Service Pattern

Use the read-only `AdminEntityService<TRecord>` pattern for:

- `system.customFieldDefinitions`
- `system.auditLogs`
- `system.schemaMigrations`
- `system.idempotencyKeys`

Expected methods:

- `get`
- `list`

Do not expose tenant CRUD services named `customFieldDefinitions`, `auditLogs`, `schemaMigrations`, or `idempotencyKeys` from the public registry in this slice.

### 6.2 Sanitized Read Model Rule

`customFieldDefinitions` is metadata-only and may return its canonical persisted shape directly.

`auditLogs` and `idempotencyKeys` may carry sensitive snapshots or replay material. Slice E must either:

- document a stable safe-read DTO and return it consistently, or
- omit or redact sensitive fields until the canonical docs explicitly widen the contract

The default planning assumption is to avoid raw pass-through for:

- `auditLogs.before`
- `auditLogs.after`
- `idempotencyKeys.requestHash`
- `idempotencyKeys.responseBody`

unless the branch updates the canonical docs and security review accepts the chosen read contract.

### 6.3 Internal Write Helper Rule

If internal repositories or test fixtures need insert/update helpers below the public service boundary, keep them below `createCoreServices(...)` and do not treat them as accepted public mutation surfaces for Slice E.

## 7. Entity Delivery Contract

### 7.1 Custom Field Definitions

Goal:

- add read-safe schema metadata records for later custom-field and schema-engine work

Required behavior:

- `custom_field_definitions` uses the canonical persisted field set from [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- reads preserve:
  - `entityType`
  - `fieldName`
  - `fieldType`
  - `label`
  - `description`
  - `isRequired`
  - `isIndexed`
  - `isPromoted`
  - `promotedColumnName`
  - `defaultValue`
  - `options`
  - `validation`
  - timestamps
- `fieldType` is constrained to the existing `CustomFieldType` union
- `(organizationId, entityType, fieldName)` uniqueness is preserved
- the read service is exposed only as `system.customFieldDefinitions` in Slice E

Execution rule:

- do not add schema-apply behavior, promoted-column DDL, or unknown-custom-field write enforcement in this slice

Required tests:

- admin/system `get` and `list`
- tenant isolation
- uniqueness on `(organizationId, entityType, fieldName)`
- field-type validation and metadata JSON round-trip coverage
- SQLite/Postgres persistence proof coverage

### 7.2 Audit Logs

Goal:

- add read-safe persisted audit records without pulling automatic audit instrumentation forward

Required behavior:

- `audit_logs` uses the canonical persisted field set from [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- reads preserve stable identity and actor metadata:
  - `actorUserId`
  - `actorApiKeyId`
  - `entityType`
  - `entityId`
  - `action`
  - `requestId`
  - `metadata`
  - `occurredAt`
  - timestamps
- if `before` and `after` remain readable, the branch must document and test their sanitization behavior
- `actorUserId` and `actorApiKeyId`, when present, must resolve inside the same tenant as the audit row
- the read service is exposed only as `system.auditLogs` in Slice E

Execution rule:

- do not add automatic “write an audit row on every mutation” behavior in this slice

Required tests:

- admin/system `get` and `list`
- tenant isolation
- same-tenant actor relation checks
- `before` and `after` sanitization or omission tests if those fields remain in the read DTO
- SQLite/Postgres persistence proof coverage

### 7.3 Schema Migrations

Goal:

- add persisted schema-metadata visibility without exposing migration authority

Required behavior:

- `schema_migrations` uses the canonical persisted field set from [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- reads preserve:
  - `description`
  - `entityType`
  - `operationType`
  - `sqlStatements`
  - `rollbackStatements`
  - `appliedByUserId`
  - `approvedByUserId`
  - `appliedAt`
  - timestamps
- `appliedByUserId` and `approvedByUserId`, when present, must resolve inside the same tenant as the migration row
- the read service is exposed only as `system.schemaMigrations`

Execution rule:

- do not expose `apply`, `approve`, `rollback`, `preview`, or any schema-execution behavior from the public registry in this slice

Required tests:

- admin/system `get` and `list`
- tenant isolation
- JSON array persistence for SQL and rollback statements
- same-tenant actor relation checks
- SQLite/Postgres persistence proof coverage

### 7.4 Idempotency Keys

Goal:

- add persisted idempotency metadata visibility without pulling replay/locking behavior forward

Required behavior:

- `idempotency_keys` uses the canonical persisted field set from [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- `(organizationId, key, method, path)` uniqueness is preserved
- reads preserve stable lifecycle metadata:
  - `key`
  - `method`
  - `path`
  - `responseCode`
  - `lockedUntil`
  - `completedAt`
  - timestamps
- if `requestHash` or `responseBody` remain readable, the branch must document and test why that is safe
- the read service is exposed only as `system.idempotencyKeys`

Execution rule:

- do not add idempotency cache lookup, body-hash conflict detection, lock leasing, or replay behavior in this slice

Required tests:

- admin/system `get` and `list`
- tenant isolation
- uniqueness on `(organizationId, key, method, path)`
- `requestHash` and `responseBody` sanitization or omission tests if those fields remain in the read DTO
- SQLite/Postgres persistence proof coverage

### 7.5 Final Registry And Export Wiring

Goal:

- finish Wave 2 service-registry, bootstrap, and package-export completeness

Required behavior:

- `createCoreServices(adapter)` exposes the final Wave 2 system shape:
  - `organizations`
  - `organizationMemberships`
  - `apiKeys`
  - `customFieldDefinitions`
  - `webhookDeliveries`
  - `auditLogs`
  - `schemaMigrations`
  - `idempotencyKeys`
  - `entityTags`
- `CoreRepositoryOverrides` and lazy repository resolution cover the Slice E entities
- `packages/core/src/index.ts` exports the new Slice E repositories and services
- SQLite and Postgres schema bootstrap helpers advance to Slice E coverage

Execution rule:

- final registry completeness must not create a request-path bridge into migration authority or other privileged adapter surfaces

Required tests:

- service registry shape after Slice E wiring
- package export smoke coverage where appropriate
- SQLite/Postgres integrated persistence coverage for the final Wave 2 entity set
- negative assertions that `schema` remains the only registry entry associated with schema-engine behavior

## 8. Workstream Ownership

Use disjoint write scopes and keep `services/index.ts`, package exports, adapter schema files, and the final docs in the main thread.

### Workstream A. Metadata Schema Foundation

Owns:

- `customFieldDefinitions`
- `auditLogs`
- shared schema, relation, and validator additions needed only for those two entities

Responsibilities:

- table and relation definitions
- repository implementation
- admin/system service behavior for `customFieldDefinitions` and `auditLogs`
- entity-specific validation
- entity-specific tests

### Workstream B. Metadata System Surfaces

Owns:

- `schemaMigrations`
- `idempotencyKeys`
- read-contract sanitization behavior for sensitive metadata DTOs

Responsibilities:

- repository and admin/system service behavior
- uniqueness and actor-resolution rules
- entity-specific tests

### Workstream C. Integration, Proofs, And Docs

Owns:

- `packages/core/src/services/index.ts`
- `packages/core/src/index.ts`
- `packages/core/src/adapters/sqlite/schema.ts`
- `packages/core/src/adapters/postgres/schema.ts`
- integrated persistence tests
- KB and review artifact updates

Responsibilities:

- final registry wiring
- final bootstrap wiring
- SQLite/Postgres integrated proof coverage
- final validation and documentation

## 9. Sub-Agent Execution Plan

Execute Slice E with two implementation sub-agents plus the main thread:

1. Worker A owns Workstream A.
2. Worker B owns Workstream B.
3. The main thread owns Workstream C and all final integration.

Rules:

- do not let implementation workers edit `services/index.ts`, `packages/core/src/index.ts`, adapter schema files, or shared docs concurrently
- do not split one entity across multiple workers
- integrate one worker patch at a time, then rerun the affected tests before merging the next write scope
- after the integrated slice lands locally, run independent review sub-agents for:
  - code review
  - security review
- do not use the implementation workers as the final reviewing agents

Recommended sub-agent sequence:

1. Worker A implements `customFieldDefinitions` and `auditLogs` plus local tests.
2. Worker B implements `schemaMigrations` and `idempotencyKeys` plus local tests.
3. Main thread integrates registry, adapters, exports, and proofs.
4. Independent review agents rerun findings-first code review and tenant-safety review on the integrated branch.

## 10. Testing To Execute

### 10.1 Per-Entity Tests

`system.customFieldDefinitions`:

- `get` and `list`
- tenant isolation
- unique `(organizationId, entityType, fieldName)` coverage
- field-type validation

`system.auditLogs`:

- `get` and `list`
- tenant isolation
- same-tenant actor resolution
- sanitization or omission coverage for `before` and `after` if readable

`system.schemaMigrations`:

- `get` and `list`
- tenant isolation
- same-tenant actor resolution
- SQL statement and rollback statement persistence

`system.idempotencyKeys`:

- `get` and `list`
- tenant isolation
- unique `(organizationId, key, method, path)` coverage
- sanitization or omission coverage for `requestHash` and `responseBody` if readable

### 10.2 Cross-Cutting Tests

Wave 2 Slice E must add or expand tests for:

- final `system.*` registry shape after Slice E wiring
- package export wiring for the new entity modules
- SQLite-backed persistence path for the Slice E entities
- Postgres-backed persistence path for the Slice E entities
- admin/system read separation for all final Wave 2 metadata services
- no request-path bridge from Slice E services into migration authority
- stable bootstrap coverage through new `initializeSqliteWave2SliceESchema(...)` and `initializePostgresWave2SliceESchema(...)` helpers

### 10.3 Full Validation Gates

Before review and again after review fixes:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

## 11. Required Reviews

### 11.1 Code Review

Run a findings-first code review after the integrated slice lands.

Focus:

- contract drift against the accepted Wave 2 plan
- missing registry or export wiring
- wrong service-surface width
- missing sanitization decisions for audit or idempotency reads
- missing SQLite/Postgres proof coverage

### 11.2 Security Review

Run `orbit-tenant-safety-review` after the integrated slice lands.

Mandatory security review surfaces:

- tenant-scoped repositories for all four Slice E entities
- admin/system services for `customFieldDefinitions`, `auditLogs`, `schemaMigrations`, and `idempotencyKeys`
- any sanitization helpers for audit or idempotency DTOs
- final registry and export wiring
- adapter bootstrap additions for the Slice E tables

Threat-model focus:

- T1 cross-tenant read/write exposure
- T2 privileged credential or migration-authority misuse
- T3 secret leakage through read DTOs, logs, or replay metadata
- T6 unsafe schema-evolution exposure through the wrong service boundary

Security review questions the branch must answer:

1. Can `auditLogs` or `idempotencyKeys` leak secrets, hashes, or cached response bodies through admin/system reads?
2. Can any Slice E metadata row be read across tenant boundaries?
3. Can `schemaMigrations` reads or registry wiring reach migration authority or imply schema execution behavior?
4. Do actor/user/API-key references remain same-tenant where the persisted schema expects them?
5. Does the final registry still keep admin/system metadata separate from tenant CRUD services?

### 11.3 Plan Vs Execution Review

Run `orbit-core-slice-review` after implementation and after any review-driven fixes.

It must confirm:

- Slice E matches the accepted Wave 2 Slice E plan
- the final Wave 2 registry is complete
- no audit middleware was pulled forward
- no idempotency middleware or replay behavior was pulled forward
- no schema-engine execution or migration-authority behavior was pulled forward
- the tenant-hardening follow-up was not silently mixed into this branch

### 11.4 Schema Review

Run schema review if Slice E changes:

- accepted bootstrap SQL
- persisted metadata shapes
- the stable admin/system read DTOs for `auditLogs` or `idempotencyKeys`

The schema review should pay special attention to:

- `custom_fields_unique_idx`
- `idempotency_unique_idx`
- JSON and array field persistence for schema and metadata tables
- actor-reference constraints on audit and schema-migration rows

## 12. Documentation Updates Required

Slice E must update:

- [docs/KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- [docs/review/core-wave-2-slice-e-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-e-review.md)

Slice E should also add:

- `packages/core/src/entities/custom-field-definitions/AGENTS.MD`
- `packages/core/src/entities/audit-logs/AGENTS.MD`
- `packages/core/src/entities/schema-migrations/AGENTS.MD`
- `packages/core/src/entities/idempotency-keys/AGENTS.MD`

If the implementation freezes a concrete safe-read DTO for `auditLogs` or `idempotencyKeys` that is not already explicit in the canonical docs, update the relevant canonical documentation in the same branch rather than leaving the behavior implicit in tests only.

## 13. Commit Plan

Prefer small commits in this order:

1. schema, relations, tenant-scope, validators, repositories, services, and tests for `customFieldDefinitions` and `auditLogs`
2. schema, validators, repositories, services, and tests for `schemaMigrations` and `idempotencyKeys`
3. adapter bootstrap updates, final registry wiring, and package exports
4. integrated SQLite/Postgres proofs and registry-shape tests
5. review-driven fixes, entity `AGENTS.MD` files, KB updates, and the Slice E review artifact

## 14. Exit Criteria

Slice E is complete only when all of the following are true:

1. `system.customFieldDefinitions`, `system.auditLogs`, `system.schemaMigrations`, and `system.idempotencyKeys` exist with coherent read-only behavior intended by this plan.
2. The final Wave 2 `system` registry shape is available from `createCoreServices(adapter)`.
3. Slice E schema, relation, tenant-scope, adapter-bootstrap, and export wiring all exist for the touched entity set.
4. SQLite and Postgres persistence paths both pass for the final Wave 2 metadata surface.
5. No Slice E request-path code reaches migration authority or other privileged adapter surfaces.
6. The read-contract decision for any sensitive audit or idempotency fields is documented and covered by tests.
7. Code review passes.
8. Security review passes.
9. Plan-vs-execution review passes.
10. KB and review artifacts are updated.

## 15. Recommended Next Action

After accepting this plan:

1. create a fresh branch for Slice E from updated `main`, preferably `core-wave-2-slice-e`
2. execute Workstream A and Workstream B in parallel through sub-agents
3. integrate Workstream C in the main thread
4. run validation and the three review passes before opening the PR
