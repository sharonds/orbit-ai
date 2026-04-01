# Orbit AI Core Postgres Persistence Bridge Plan

Date: 2026-03-31
Status: Ready for execution planning
Package: `@orbit-ai/core`
Depends on:
- [core-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-persistence-bridge-plan.md)
- [core-persistence-bridge-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-persistence-bridge-review.md)
- [core-wave-1-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-services-plan.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)

## 1. Purpose

This slice extends the completed SQLite persistence bridge to the Postgres family.

The service layer and SQLite-backed repository path are already accepted. The remaining core persistence gap is:

- one real Postgres-family runtime database path
- one real Postgres-family storage adapter baseline
- Wave 1 repositories running through that adapter without changing the Wave 1 service API

This plan should close the “fake persistence is gone, but only on SQLite” gap before API execution begins.

## 2. Objective

Deliver one adapter-backed Postgres-family persistence path for the Wave 1 entity set while preserving the current core contracts:

1. `createCoreServices(adapter)` still exposes the same Wave 1 registry
2. tenant CRUD still derives tenant scope from `ctx.orgId`
3. runtime authority and migration authority stay separate
4. request-path auth lookup remains narrow and pre-tenant only
5. SQLite continues to pass unchanged

The first target should be a generic raw Postgres baseline. Supabase and Neon specifics should layer on top after the generic Postgres path is proven.

## 3. In Scope

- Postgres-family runtime database wrapper implementing:
  - `transaction()`
  - `execute()`
  - `query()`
- generic Postgres storage adapter baseline implementing:
  - runtime authority model
  - `withTenantContext(...)`
  - `lookupApiKeyForAuth(...)`
  - migration-authority boundary
- Postgres-backed repositories for the Wave 1 entity set:
  - `organizations`
  - `organization_memberships`
  - `api_keys`
  - `users`
  - `companies`
  - `contacts`
  - `pipelines`
  - `stages`
  - `deals`
- `createCoreServices(adapter)` selecting Postgres-backed repositories when the adapter is a real Postgres-family adapter
- persistence proof tests for:
  - fresh service registry reuse
  - tenant scoping
  - admin/system read separation
  - auth lookup DTO shape
  - transaction-bound tenant context

## 4. Out Of Scope

- Supabase-specific auth sync behavior beyond the adapter seam
- Neon branch lifecycle beyond adapter placeholders or explicit follow-up hooks
- Wave 2 entities
- search redesign
- schema engine mutation implementation
- API, SDK, CLI, or MCP work

## 5. Required Execution Principles

1. Raw Postgres comes first.
   - prove one generic Postgres-family path before adapter-specific deltas
2. Runtime authority must stay least-privilege.
   - no request-path use of elevated credentials
3. Tenant context must stay transaction-local.
   - `SET LOCAL` / `set_config(..., true)` semantics only
4. Repositories must still include explicit `organization_id = ctx.orgId` filters even when RLS exists.
5. `lookupApiKeyForAuth()` remains the only pre-tenant request lookup.
6. Do not redesign the service layer during this slice.
   - this is a persistence bridge, not a service-contract rewrite

## 6. Delivery Slices

### Slice A. Postgres Runtime Database And Adapter Baseline

Goal:

- establish the generic Postgres-family runtime path and authority boundary

Scope:

- `packages/core/src/adapters/postgres/database.ts`
- `packages/core/src/adapters/postgres/adapter.ts`
- supporting Postgres adapter tests

Required behavior:

- runtime transaction wrapper
- parameterized `execute()` and `query()`
- `withTenantContext()` using transaction-local tenant config
- `runWithMigrationAuthority()` separated from runtime path
- `lookupApiKeyForAuth()` returning the minimal auth DTO only
- pooled-connection proof for tenant context reuse safety

Exit criteria:

- the generic Postgres adapter compiles
- authority-model tests pass
- tenant-context tests prove transaction-local behavior under pooled connection reuse

### Slice B. Wave 1 Postgres Repository Bridge

Goal:

- back the accepted Wave 1 service surface with real Postgres-family repositories

Scope:

- repository implementations for:
  - `organizations`
  - `organization_memberships`
  - `api_keys`
  - `users`
  - `companies`
  - `contacts`
  - `pipelines`
  - `stages`
  - `deals`
- Postgres repository helper utilities as needed

Required behavior:

- all tenant tables use explicit org filters
- admin/system repositories stay bootstrap-scoped or explicitly system-scoped
- repository reads return data in the same record shapes as the current Wave 1 services
- cross-org negative tests prove repository-level null behavior even when RLS exists

Exit criteria:

- `createCoreServices(adapter)` can run against a real Postgres-family adapter
- the SQLite path still passes unchanged

### Slice C. Proof Harness And Adapter Selection Hardening

Goal:

- prove that Postgres persistence is real, tenant-safe, and structurally aligned with the existing Wave 1 registry

Scope:

- Postgres persistence proof tests
- adapter-selection tests for `createCoreServices(adapter)`
- plan-vs-execution review artifact

Required behavior:

- records survive across fresh service registries
- tenant reads return `null` across org boundaries
- system/admin services remain structurally separate
- the auth lookup DTO is still minimal and pre-tenant
- CRUD, admin, search, and contact-context paths remain unable to cross into migration authority

Exit criteria:

- the persistence gap is no longer “SQLite only”
- the remaining adapter work is Supabase/Neon specialization, not missing generic Postgres persistence

## 7. Workstream Ownership

Use disjoint write scopes.

### Workstream A. Postgres Adapter Layer

Owns:

- `packages/core/src/adapters/postgres/database.ts`
- `packages/core/src/adapters/postgres/adapter.ts`
- Postgres adapter tests

Responsibilities:

- implement runtime database contract
- keep runtime vs migration authority separate
- keep auth lookup narrow

### Workstream B. Postgres Repository Layer

Owns:

- Postgres repository helpers
- Postgres repository implementations for the Wave 1 entity set

Responsibilities:

- preserve current record shapes
- preserve explicit org filtering
- preserve admin/system separation

### Workstream C. Integration Proof And Registry Selection

Owns:

- `packages/core/src/services/index.ts`
- Postgres persistence tests
- bridge review artifact updates

Responsibilities:

- route real Postgres-family adapters to real Postgres repositories
- prove fresh-registry persistence and tenant safety
- verify SQLite remains green

## 8. Required Skills And Reviews

Mandatory review gates for this slice:

- `orbit-tenant-safety-review`
  - on any repository or adapter change affecting tenant scoping
- `orbit-core-slice-review`
  - after the integrated Postgres bridge lands
- `orbit-schema-change`
  - only if this slice unexpectedly changes core schema or bootstrap SQL

## 9. Validation Gates

### 9.1 Build And Suite Gates

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

### 9.2 Adapter Authority Gates

- runtime code paths do not require elevated credentials
- `runWithMigrationAuthority()` is not used by CRUD/admin/search/context services
- request-path core entry points cannot reach migration authority indirectly through adapter helpers
- migration-only primitives stay unreachable from:
  - CRUD services
  - admin/system read services
  - search
  - contact context
  - SDK direct mode
  - MCP request paths
- `lookupApiKeyForAuth()` returns only:
  - `id`
  - `organizationId`
  - `scopes`
  - `revokedAt`
  - `expiresAt`

### 9.3 Tenant Context Gates

- `withTenantContext()` is transaction-bound
- tenant context does not leak across calls
- tenant context proof includes pooled connection reuse
- repositories still include explicit org filters

### 9.4 Repository Behavior Gates

- the Wave 1 entity services behave the same on Postgres as on SQLite for:
  - CRUD
  - list
  - search
  - contact/company relationship checks
  - deal/stage/pipeline consistency
- repository-level cross-org negative tests pass even when Postgres RLS is enabled

### 9.5 Auth Lookup Gates

- `lookupApiKeyForAuth()` remains the only pre-tenant request lookup
- runtime roles may call the auth lookup primitive without gaining raw `api_keys` row access
- tests prove the lookup result does not expose non-auth or secret-bearing fields

### 9.6 Regression Gates

- SQLite persistence proof still passes
- Wave 1 registry shape does not change

## 10. Threat Focus

This slice primarily addresses:

- T1 cross-tenant leakage through repository or tenant-context mistakes
- T2 privileged credential misuse through request-path adapter design

The highest-risk area is the Postgres-family request path:

- tenant context must be transaction-local
- auth lookup must stay narrow
- runtime and migration authority must stay separate

## 11. Done Condition

This slice is complete when:

1. one generic Postgres-family adapter-backed Wave 1 persistence path exists
2. `createCoreServices(adapter)` uses it without changing the Wave 1 service API
3. tenant CRUD remains explicitly org-scoped
4. admin/system reads remain separate
5. the minimal auth lookup boundary remains intact
6. pooled Postgres tenant-context tests prove no cross-request leakage
7. SQLite still passes unchanged
8. the remaining adapter gap is specialization for Supabase/Neon, not missing generic Postgres persistence

## 12. Immediate Next Actions

1. Accept this Postgres persistence bridge plan.
2. Create branch `core-postgres-persistence-bridge`.
3. Execute Slice A first:
   - Postgres runtime database wrapper
   - generic Postgres adapter baseline
4. Run tenant-safety review before starting repository integration.
5. Continue through Slices B and C in order.
