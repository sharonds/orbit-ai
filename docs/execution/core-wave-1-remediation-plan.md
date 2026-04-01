# Orbit AI Core Wave 1 Remediation Plan

Date: 2026-04-01
Status: Executed and validated locally
Package: `@orbit-ai/core`
Depends on:
- [core-wave-1-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-services-plan.md)
- [core-wave-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-review.md)
- [core-wave-1-full-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-full-review.md)
- [core-postgres-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-postgres-persistence-bridge-plan.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document converts the validated consolidated Wave 1 review findings into an execution plan.

Wave 1 service-surface work is no longer the active acceptance baseline. Before the Postgres-family persistence bridge or API work continues, `@orbit-ai/core` must close the secret-exposure, repository-scope, SQLite-boundary, and correctness gaps identified after the Wave 1 and SQLite bridge milestones.

## 2. Outcome Required

The remediation is complete only when all of the following are true:

1. API key secrets no longer cross normal read surfaces.
2. API key rotation is explicit and cannot happen through generic update flows.
3. `organization_memberships` has one consistent classification across:
   - scope registry
   - repositories
   - service registry
   - execution docs
4. SQLite tenant repositories do not bypass the tenant boundary on create/read/update/delete paths.
5. SQLite tenant update paths are atomic and do not perform read-modify-write across separate transactions.
6. API key management no longer looks equivalent to ordinary tenant CRUD without an explicit admin/system boundary.
7. non-SQLite adapters no longer silently degrade to in-memory storage.
8. Wave 1 search and contact-context behavior are safe and correct enough to support downstream planning.
9. the KB and execution docs clearly show remediation as the current gate before the Postgres-family bridge resumes.

## 3. Scope

In scope:

- `packages/core/src/entities/api-keys/*`
- `packages/core/src/entities/organization-memberships/*`
- `packages/core/src/repositories/tenant-scope.ts`
- `packages/core/src/repositories/sqlite/shared.ts`
- `packages/core/src/adapters/sqlite/adapter.ts`
- `packages/core/src/services/search-service.ts`
- `packages/core/src/services/contact-context.ts`
- `packages/core/src/services/index.ts`
- `packages/core/src/services/service-helpers.ts`
- `packages/core/src/entities/deals/service.ts`
- `packages/core/src/query/cursor.ts`
- Wave 1 service tests and new regression tests
- KB and Wave 1 execution docs needed to reflect the new gate

Out of scope:

- Postgres-family repository implementation itself
- API package implementation
- SDK package implementation
- Wave 2 entities
- full scalable search redesign beyond what is needed to remove the current correctness bug

## 4. Fix Strategy

Execute this remediation in three phases.

### Phase A. Security And Boundary Blockers

These are mandatory before any new persistence-bridge work.

1. Secret-safe API key model
   - introduce a sanitized API key read shape that omits `keyHash`
   - keep `keyHash` server-internal and repository-internal only
   - return sanitized shapes from:
     - tenant-facing reads
     - system/admin reads
     - search or any indirect read surface if added later
   - preserve the narrow auth lookup DTO separately

2. Remove generic API key mutation of secret fields
   - remove `keyHash` and `keyPrefix` from generic update inputs
   - if rotation remains needed in core, add a dedicated admin-only rotation method later
   - do not mix rotation into generic CRUD update

3. Resolve `organization_memberships` classification
   - choose one classification and apply it everywhere
   - recommended decision for Wave 1 and the bridge: keep `organization_memberships` tenant-scoped because it stores tenant data and has `organization_id`
   - fix the SQLite repository and service path so reads remain org-scoped even if the surface stays under `services.system.organizationMemberships`
   - remove the bootstrap-style implementation split, not the tenant classification

4. Close SQLite tenant create-path bypass
   - change tenant repository create paths so they execute through `withTenantContext(ctx, ...)`
   - make tenant repository create operations assert `record.organizationId === ctx.orgId`
   - update repository contracts as needed so tenant create has trusted context available

5. Repair SQLite tenant update atomicity
   - remove read-then-write update flow across separate operations
   - perform tenant-scoped read + merge + write in one `withTenantContext(...)` path
   - add regression tests for concurrent-safe semantics and cross-org update failure behavior

6. Resolve API key service boundary
   - generic API key management must not look like the same trust level as contact or company CRUD
   - recommended decision for Wave 1 remediation: move API key mutation flows under the `system` namespace or make the current surface explicitly admin-only in the core contract
   - do not leave the final result ambiguous for API and SDK planning

7. Remove silent non-SQLite in-memory fallback
   - `createCoreServices(adapter)` must not quietly use in-memory repositories for adapters that are not implemented
   - unsupported persistence adapters should throw a typed Orbit error or require explicit test-only overrides

### Phase B. Service Correctness Hardening

These should land in the same remediation branch before the next milestone starts.

1. Sanitize search result payloads
   - `SearchResultRecord.record` must become a safe summary shape, not the raw underlying entity record
   - remove secret-bearing and internal-only fields from search results
   - do not expose `externalAuthId`, `keyHash`, or similar internal attributes

2. Fix search pagination contract
   - remove the per-entity hard cap bug that breaks global cursor semantics
   - either:
     - redesign Wave 1 search pagination so it is explicitly first-page only and non-cursorable for now, or
     - implement a deterministic merged pagination path
   - the preferred fix is deterministic merged pagination with regression tests

3. Fix contact-context email lookup
   - use direct equality semantics for email lookup
   - do not depend on fuzzy search and then select the first exact match from an arbitrary result set

4. Tighten deal update graph logic
   - updating only `pipelineId` must not leave a stale `stageId`
   - generic update should not revalidate unchanged foreign keys unless that relationship is part of the change
   - define the intended rule explicitly:
     - either clear `stageId` when `pipelineId` changes alone
     - or reject the change unless a compatible `stageId` is also provided
   - apply the same rule consistently in tests

5. Use typed cursor errors
   - invalid cursor inputs should not throw generic `Error`
   - cursor decode failures must return an `OrbitError`-compatible shape or a typed core error wrapper

6. Split filtered and unfiltered SQLite select helpers
   - remove the optional predicate shape that makes unfiltered reads easy to introduce by accident
   - require explicit helper choice for tenant-scoped versus bootstrap/system reads

7. Harden SQLite JSON parsing
   - `fromSqliteJson(...)` must not throw uncaught parse errors on corrupted persisted values
   - return the typed fallback on parse failure and add regression coverage

### Phase C. Acceptance, Docs, And KB Alignment

1. Record the remediation review outcome in a dedicated review artifact.
2. Update the Wave 1 and bridge execution docs so the order is clear:
   - Wave 1 remediation first
   - Postgres-family persistence bridge second
3. Update the KB:
   - current focus
   - immediate next actions
   - canonical docs
   - decision log
4. Re-run the required review gates and local validation.

## 5. Architectural Decisions In This Plan

### 5.1 API Keys

Decision:

- `keyHash` is never part of the normal record returned by core services.

Reason:

- hashed secrets are still secrets for Orbit's threat model because they can leak implementation detail, support offline analysis, and collapse the redaction contract across API, CLI, and MCP later.

Enablement:

- unblocks safe API/SDK/CLI/MCP design on top of the same core service shapes.

Constraint:

- repository internals and auth lookup may still use `keyHash`, but only in server-internal paths.

### 5.2 Organization Memberships

Decision:

- for Wave 1 and the immediate persistence bridge, `organization_memberships` remains tenant-scoped data, even if it is still exposed under the `system` namespace.

Reason:

- the table carries `organization_id` and is defined as tenant-scoped in the core schema model
- reclassifying it as bootstrap would create drift between schema, repository scope helpers, and future Postgres RLS work
- the actual defect is the current bootstrap-style SQLite implementation, not the tenant classification itself

Enablement:

- keeps the current schema and tenant-isolation model coherent while preserving the current higher-level service namespace.

Constraint:

- if the service namespace changes later, that is a separate API design decision and must not silently alter tenant classification.

### 5.3 Unsupported Adapter Behavior

Decision:

- unsupported adapters must fail loudly rather than silently degrade to in-memory repositories.

Reason:

- silent fallback makes validation evidence meaningless and can hide data-loss behavior.

### 5.4 API Key Surface

Decision:

- Wave 1 remediation must make API key mutation flows structurally distinct from ordinary tenant CRUD.

Reason:

- core does not own full authorization policy, so the service surface itself must avoid implying that API key mutation is equivalent to contact/company mutation.
- downstream API and SDK planning need one stable contract for key-management placement.

Preferred direction:

- keep sanitized read access where needed, but place create/update/delete semantics under `system` or another explicitly admin-scoped surface.

## 6. Delivery Slices

### Slice 1. Security Model And Registry Correction

Goal:

- close the secret-exposure and classification defects at the service-contract layer

Scope:

- API key validators, service, repository output types
- service registry shape
- membership classification and org-scoped access updates in repo scope helpers, repositories, service wiring, and related docs
- SQLite tenant update atomicity
- API key service boundary decision

Exit criteria:

- no service read path returns `keyHash`
- generic API key update no longer mutates `keyHash` or `keyPrefix`
- `organization_memberships` classification is consistent across code and docs
- `organization_memberships` reads stay org-scoped on SQLite and no longer use bootstrap-style list/get behavior
- tenant update paths no longer use separate read/write operations across different tenant contexts
- API key management surface is explicitly admin/system-scoped or equivalently constrained in the contract
- unsupported non-SQLite adapters fail explicitly

### Slice 2. SQLite Tenant Boundary Repair

Goal:

- repair the tenant repository path so SQLite-backed Wave 1 behavior matches the intended tenant model

Scope:

- SQLite adapter tenant-context behavior
- tenant repository create contract
- tenant repository helper updates
- SQLite helper split between filtered and unfiltered selects
- JSON parsing hardening in SQLite repository helpers
- regression tests for create/read/update/delete on tenant-scoped tables

Exit criteria:

- tenant create paths require trusted context
- create/read/update/delete repository tests prove org-bound behavior on SQLite
- cross-tenant update/delete regression tests exist
- filtered versus unfiltered SQLite repository helpers are explicit
- corrupted JSON values fail closed to typed fallback behavior
- no Wave 1 tenant repository mutates data outside the context-owned org

### Slice 3. Search, Contact Context, Deal Logic, And Error Hardening

Goal:

- remove the remaining correctness issues before the next milestone

Scope:

- `search-service.ts`
- `contact-context.ts`
- `deals/service.ts`
- `service-helpers.ts`
- `query/cursor.ts`
- related tests

Exit criteria:

- search result records are sanitized
- search pagination behavior is deterministic and tested
- `object_type` is not a free-text search field unless explicitly justified and tested
- contact email lookup uses equality semantics
- deal graph update invariants are explicit and tested
- unchanged deleted foreign keys do not break unrelated deal updates
- invalid cursors return typed errors

## 7. Workstream Ownership

Use disjoint write scopes.

### Workstream A. Secret-Safe Entity Contracts

Owns:

- `packages/core/src/entities/api-keys/*`
- `packages/core/src/services/index.ts`
- service-shape and registry tests

### Workstream B. Tenant Repository Boundary Repair

Owns:

- `packages/core/src/repositories/sqlite/shared.ts`
- `packages/core/src/adapters/sqlite/adapter.ts`
- tenant repository implementations affected by signature changes

### Workstream C. Search And Service Correctness

Owns:

- `packages/core/src/services/search-service.ts`
- `packages/core/src/services/contact-context.ts`
- `packages/core/src/entities/deals/service.ts`
- `packages/core/src/query/cursor.ts`
- their regression tests

### Workstream D. Docs And Acceptance

Owns:

- remediation review artifact
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- any execution docs that need ordering/status updates

## 8. Required Skills And Reviews

Mandatory review gates for this remediation:

- `orbit-tenant-safety-review`
  - required after Slice 1 and Slice 2
- `orbit-core-slice-review`
  - required after the integrated remediation branch is complete
- `orbit-schema-change`
  - required if repository contract or table classification changes alter schema-facing contracts or core entity shapes

There is no dedicated KB-specific skill in the repo today. KB validation for this remediation should be done by:

- one cross-doc consistency pass against execution docs
- one local diff review confirming the KB reflects the active gate and next action order correctly

## 9. Validation Gates

### 9.1 Build And Suite Gates

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

### 9.2 Security Gates

These must pass:

1. No caller-controlled org context.
2. Runtime credentials only.
3. Defense-in-depth on tenant-scoped tables.
4. Secrets stay redacted across read surfaces.

### 9.3 Wave 1 Regression Gates

Required new regression coverage:

- API key reads never expose `keyHash`
- generic API key update cannot mutate `keyHash` or `keyPrefix`
- API key management surface matches the chosen admin/system contract
- membership classification tests match the chosen scope model
- tenant repository create requires trusted org context
- tenant repository update runs atomically inside one tenant-context path
- SQLite tenant CRUD rejects cross-org access on the Wave 1 entity set
- SQLite tenant CRUD rejects cross-org update and delete paths explicitly
- tenant and bootstrap/system SQLite helpers are exercised through separate call sites
- search result payloads omit internal-only fields
- search cursor behavior matches the documented semantics
- `object_type` search behavior matches the documented semantics
- contact-context exact email lookup returns the right contact and does not rely on fuzzy search
- deal update edge cases:
  - pipeline-only change
  - unchanged deleted relation
  - incompatible stage/pipeline change
- invalid cursor errors are typed
- corrupted SQLite JSON falls back safely
- unsupported non-SQLite adapter registry creation fails loudly

## 10. Deferred Follow-Ups From The Full Review

These were validated but do not need to land in the immediate remediation branch:

- replace raw SQLite schema bootstrap strings with Drizzle-driven schema artifacts before or during the Postgres-family persistence bridge
- document the SQLite authority-model limitation before release
- add a runtime allowlist for dynamic table names before plugin-driven table registration exists

## 11. Blocking Rule

Do not begin execution of [core-postgres-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-postgres-persistence-bridge-plan.md) until this remediation is accepted.

The Postgres-family bridge should build on a corrected Wave 1 service and repository baseline, not on top of known secret, scope, or atomicity defects.

## 12. Immediate Next Actions

1. Accept this remediation plan.
2. Update the KB and execution docs so this remediation is the active gate.
3. Execute Slice 1 first.
4. Run `orbit-tenant-safety-review` after Slice 1 before proceeding to Slice 2.
5. Run the integrated validation suite and `orbit-core-slice-review` after Slice 3.
