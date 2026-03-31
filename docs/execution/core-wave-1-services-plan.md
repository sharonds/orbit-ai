# Orbit AI Core Wave 1 Services Plan

Date: 2026-03-31
Status: Ready for execution planning
Package: `@orbit-ai/core`
Depends on:
- [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
- [core-slice-2-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-2-plan.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines the first service-layer execution wave for `@orbit-ai/core`.

Wave 1 begins after the slice-2 schema, validation, query, repository, and adapter foundations are accepted. Its job is to prove the service pattern on the minimum critical domain and admin surface before the rest of core is implemented.

## 2. Wave Objective

Deliver the first operational service layer for:

1. tenant-scoped CRUD on the core CRM graph
2. bootstrap/admin read separation for system entities
3. search and contact-context primitives good enough to unblock API and SDK planning

Wave 1 must prove service composition, repository use, and admin-versus-tenant boundaries without pulling in the rest of the entity catalog.

## 3. In Scope

Tenant-scoped services:

- `users`
- `api_keys`
- `companies`
- `contacts`
- `pipelines`
- `stages`
- `deals`

Cross-cutting services:

- `search`
- `contactContext`

System/admin services:

- `system.organizations`
- `system.organizationMemberships`
- `system.apiKeys`

Service-layer support files:

- `packages/core/src/services/entity-service.ts`
- `packages/core/src/services/search-service.ts`
- `packages/core/src/services/contact-context.ts`
- `packages/core/src/services/index.ts`
- supporting repository modules under `packages/core/src/entities/` or `packages/core/src/repositories/` as needed

## 4. Out Of Scope

- Wave 2 entities:
  - `activities`
  - `tasks`
  - `notes`
  - `products`
  - `payments`
  - `contracts`
  - `sequences`
  - `sequence_steps`
  - `sequence_enrollments`
  - `sequence_events`
  - `tags`
  - `entity_tags`
  - `webhooks`
  - `imports`
- schema-engine mutation logic
- RLS generation work
- full audit and idempotency hardening milestone
- API route implementation
- SDK transport implementation
- CLI command implementation
- MCP tool implementation

## 5. Service Surface To Deliver

### 5.1 Tenant-Scoped Entity Services

These services should follow the shared `EntityService<TCreate, TUpdate, TRecord>` contract:

- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`

Wave 1 should implement this pattern for:

- `users`
- `api_keys`
- `companies`
- `contacts`
- `pipelines`
- `stages`
- `deals`

### 5.2 Admin/System Services

These services should follow the shared `AdminEntityService<TRecord>` contract:

- `list`
- `get`

Wave 1 should implement this pattern for:

- `system.organizations`
- `system.organizationMemberships`
- `system.apiKeys`

### 5.3 Cross-Cutting Services

Wave 1 should also provide:

- `search`
  - enough to query across the Wave 1 entity set using the slice-2 query primitives
- `contactContext`
  - enough to return the documented shape for a contact using the currently implemented entity graph

## 6. Execution Principles

1. Service code must build on the slice-2 repository and query primitives instead of bypassing them.
2. Tenant-scoped services must never accept caller-controlled `organization_id`.
3. Admin/system services must stay structurally separate from tenant CRUD services.
4. Relationship invariants belong in service logic, not in transport layers.
5. Search and contact context should be “good enough to unblock downstream planning,” not prematurely optimized.

## 7. Recommended Delivery Slices

Wave 1 should execute in three slices, not one broad patch.

### Slice A. Service Contracts And Tenant CRUD Skeleton

Goal:

- establish the service scaffolding and prove CRUD on the first tenant entities

Scope:

- `entity-service.ts`
- shared service helpers
- `companies`
- `contacts`

Why first:

- proves tenant CRUD with the simplest customer-facing graph
- establishes the service/repository split without stage/pipeline movement complexity

Exit criteria:

- companies and contacts support `create/get/update/delete/list/search`
- relationship rules for `contact.companyId` are enforced
- tenant-safety review passes on the service pattern

### Slice B. Pipeline And Deal Graph

Goal:

- prove the relationship-heavy CRM workflow logic

Scope:

- `pipelines`
- `stages`
- `deals`

Why second:

- this is where the most important service invariants live:
  - stage ordering
  - stage pipeline ownership
  - deal stage/pipeline consistency
  - deal contact/company relationships

Exit criteria:

- pipelines, stages, and deals support intended CRUD/list/search behavior
- deal movement invariants are implemented and tested
- cross-entity relationship tests pass

### Slice C. Users, API Keys, Search, Contact Context, And System Read Services

Goal:

- complete the minimum operational and admin surface for downstream packages

Scope:

- `users`
- `api_keys`
- `search`
- `contactContext`
- `system.organizations`
- `system.organizationMemberships`
- `system.apiKeys`
- `services/index.ts`

Why last:

- finishes the registry shape used by API and SDK planning
- keeps bootstrap/admin logic separate until tenant service patterns are stable

Exit criteria:

- admin/system reads are isolated from generic tenant CRUD services
- search covers the Wave 1 entity set coherently
- contact context returns the documented high-level shape from currently implemented entities
- `createCoreServices(adapter)` exposes the Wave 1 registry shape

## 8. Workstream Ownership

Use disjoint write scopes per slice.

### Workstream A. Service Contracts And Shared Helpers

Owns:

- `packages/core/src/services/entity-service.ts`
- shared service helper modules
- export wiring for new services

Responsibilities:

- define shared service interfaces from the core spec
- add shared mutation/read helper functions used by multiple Wave 1 services

### Workstream B. Tenant Entity Services

Owns:

- entity-specific repositories and services for:
  - `companies`
  - `contacts`
  - `pipelines`
  - `stages`
  - `deals`
  - `users`
  - `api_keys`

Responsibilities:

- implement CRUD/list/search behavior
- enforce tenant filters and relationship invariants
- keep repository and service boundaries explicit

### Workstream C. Cross-Cutting Search And Contact Context

Owns:

- `packages/core/src/services/search-service.ts`
- `packages/core/src/services/contact-context.ts`

Responsibilities:

- implement the shared search surface for the Wave 1 entities
- implement the documented contact-context result shape using currently implemented entities

### Workstream D. System/Admin Read Services And Registry

Owns:

- `packages/core/src/services/index.ts`
- admin/system service files

Responsibilities:

- expose `system.organizations`
- expose `system.organizationMemberships`
- expose `system.apiKeys`
- keep bootstrap/admin reads out of generic tenant CRUD code

## 9. Required Skills

These skills are mandatory during Wave 1:

- `orbit-tenant-safety-review`
  - required for every tenant-scoped service slice
  - required for admin/system separation review
- `orbit-core-slice-review`
  - required after each integrated Wave 1 slice
- `orbit-schema-change`
  - only if a Wave 1 implementation unexpectedly needs schema changes

Wave 1 should not depend on building new skills first.

## 10. Validation Gates

Wave 1 is not complete until all of these pass.

### 10.1 Build And Suite Gates

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

### 10.2 Service Contract Gates

- all Wave 1 tenant services implement the shared `EntityService` contract
- all Wave 1 admin/system services implement the shared `AdminEntityService` contract
- `createCoreServices(adapter)` exposes the intended Wave 1 registry keys

### 10.3 Domain Behavior Gates

- CRUD tests exist for each tenant-scoped Wave 1 entity
- list and search tests exist for each tenant-scoped Wave 1 entity
- contact/company/deal relationship tests pass
- pipeline/stage/deal movement invariants pass
- admin/system separation tests pass

### 10.4 Search And Context Gates

- search returns paginated results using slice-2 query primitives
- contact context returns:
  - contact
  - company
  - open deals
  - open tasks if available from implemented scope, otherwise an explicit empty list
  - recent activities if available from implemented scope, otherwise an explicit empty list
  - tags if available from implemented scope, otherwise an explicit empty list
  - derived `lastContactDate`

### 10.5 Tenant-Safety Gates

- tenant-scoped services always derive tenant scope from `ctx.orgId`
- admin/system services do not become a bypass path into tenant CRUD
- no service path uses migration authority
- SQLite path still relies on explicit repository-level org filters

## 11. Threat Focus

Wave 1 primarily addresses:

- T1 cross-tenant leakage through service or repository misuse
- T2 authority misuse through admin/system mixing

The highest-risk area in this wave is not raw storage anymore; it is service-layer scoping and relationship enforcement.

## 12. Done Condition

Wave 1 is complete when all of the following are true:

1. the seven tenant-scoped Wave 1 services exist and pass CRUD/list/search tests where intended
2. the three admin/system read services exist and stay structurally separate
3. `search` and `contactContext` are implemented at the documented planning depth
4. tenant-safety review reports no unresolved findings
5. core-slice review reports the integrated wave is ready for the next milestone
6. API and SDK planning can consume the Wave 1 service registry without requiring core contract changes

## 13. Immediate Next Actions

1. Accept this Wave 1 services plan.
2. Create branch `core-wave-1-services`.
3. Execute Slice A first:
   - service contracts
   - companies
   - contacts
4. Run tenant-safety review and core-slice review on Slice A before starting Slice B.
5. Continue through Slices B and C in order.
