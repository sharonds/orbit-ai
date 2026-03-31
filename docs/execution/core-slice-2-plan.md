# Orbit AI Core Slice 2 Plan

Date: 2026-03-31
Status: Executed locally and ready for review acceptance
Package: `@orbit-ai/core`
Depends on:
- [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
- [core-slice-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-1-remediation-plan.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines the second executable core slice after the completed bootstrap and authority-boundary work in slice 1.

Slice 2 is intentionally narrow. Its job is to land the minimum remaining schema and repository foundation needed before broad entity services begin.

Execution precondition:

- the must-fix items from [core-slice-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-slice-1-review.md) are resolved through [core-slice-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-1-remediation-plan.md)

## 2. Slice Objective

Complete the minimum bridge between slice 1 and service work:

1. add the first operational tenant tables needed to prove repository behavior
2. implement generated Zod validation for the implemented tables
3. add cursor and list-query primitives
4. add base repository primitives with deterministic tenant filtering

This slice should stop before service breadth, audit writing, idempotency handling, or schema-engine mutation work.

## 3. In Scope

- first operational domain tables:
  - `companies`
  - `contacts`
  - `pipelines`
  - `stages`
  - `deals`
- `packages/core/src/schema/zod.ts`
- query and cursor helpers
- base repository primitives
- deterministic tenant filtering rules for Postgres-family and SQLite paths
- tests that prove repository-level tenant behavior is stable before service work starts

## 4. Out Of Scope

- entity service implementations
- admin/system services beyond what already exists
- audit write behavior
- idempotency behavior
- schema-engine apply, rollback, or promotion logic
- webhook, import, or integration entities
- API, SDK, CLI, or MCP implementation work

## 5. Deliverables

Slice 2 should produce these concrete outputs:

- `packages/core/src/schema/tables.ts`
  - adds `companies`, `contacts`, `pipelines`, `stages`, `deals`
- `packages/core/src/schema/relations.ts`
  - adds relations for the same first operational graph
- `packages/core/src/schema/zod.ts`
  - replaces the placeholder export with generated select, insert, and update schemas for implemented tables
- `packages/core/src/query/cursor.ts`
  - cursor encode, decode, and validation helpers
- `packages/core/src/query/list-query.ts`
  - normalized limit, sort, filter, and cursor parsing helpers
- `packages/core/src/repositories/base-repository.ts`
  - tenant-safe base list and record lookup primitives
- `packages/core/src/repositories/tenant-scope.ts`
  - shared tenant filter helpers and bootstrap-table exceptions
- tests for:
  - Zod generation and custom validation extensions
  - cursor stability and invalid-cursor rejection
  - deterministic sort normalization
  - tenant-safe repository predicates
  - SQLite application-level tenant filtering expectations

If file names need to shift slightly during implementation, keep the module boundaries the same and update exports in one pass.

## 6. Why This Slice Exists

Slice 1 proved:

- package shape
- shared IDs and types
- bootstrap schema
- runtime-vs-migration authority boundary
- Postgres-family tenant context

It did not yet prove:

- the first operational tenant table graph
- generated validation for implemented tables
- reusable cursor and list-query behavior
- repository primitives that always inject tenant scope

Those are the minimum dependencies for safe service implementation in the next slice.

## 7. Workstream Ownership

Use disjoint write scopes so the slice can execute safely with sub-agents.

### Workstream A. Operational Schema Bridge

Owns:

- `packages/core/src/schema/tables.ts`
- `packages/core/src/schema/relations.ts`
- schema tests that cover only the five new operational tables

Responsibilities:

- add `companies`, `contacts`, `pipelines`, `stages`, and `deals`
- keep `organization_id` on every tenant-scoped table
- preserve prefixed-ULID text IDs
- encode the minimum relation graph needed for repository proofs:
  - contacts to companies
  - deals to companies
  - deals to contacts
  - deals to pipelines
  - deals to stages
  - stages to pipelines

Constraints:

- do not add service-layer code
- do not add nonessential entities in the same patch
- if a table requires a secret-bearing field, stop and split it into a later slice

### Workstream B. Validation Layer

Owns:

- `packages/core/src/schema/zod.ts`
- validation-focused tests under `packages/core/src/schema/`

Responsibilities:

- replace the milestone-3 placeholder export
- generate select, insert, and update schemas with `drizzle-zod`
- add the documented runtime extensions that are already required by the spec for implemented tables
- keep validation limited to tables that actually exist after Workstream A lands

Constraints:

- do not invent service-specific DTO shapes
- do not widen into schema-engine mutation behavior

### Workstream C. Query And Cursor Primitives

Owns:

- `packages/core/src/query/cursor.ts`
- `packages/core/src/query/list-query.ts`
- tests under `packages/core/src/query/`

Responsibilities:

- implement cursor encode and decode helpers
- normalize default limits and enforce upper bounds
- normalize sort rules so pagination is deterministic
- validate and normalize list and search query inputs for repository consumption

Constraints:

- keep external transport mapping out of this slice
- reuse existing shared types rather than introducing competing query shapes

### Workstream D. Repository Primitives And Tenant Scope

Owns:

- `packages/core/src/repositories/base-repository.ts`
- `packages/core/src/repositories/tenant-scope.ts`
- repository tests under `packages/core/src/repositories/`
- any export wiring in `packages/core/src/index.ts` needed for the new modules

Responsibilities:

- implement reusable tenant-scope helpers
- distinguish bootstrap-table behavior from tenant-table behavior
- make repository list and get behavior deterministic on tenant filters and sort order
- define the minimum repository contract the later entity services will build on
- prove SQLite still applies explicit tenant filters at the repository layer

Constraints:

- do not implement entity-specific CRUD repositories yet
- do not bypass tenant filters because Postgres-family RLS will exist later

## 8. Coordination Rules

1. Workstream A lands first because Workstreams B and D depend on the new tables.
2. Workstream C can start in parallel with A.
3. Workstream B starts after A is merged or rebased locally.
4. Workstream D starts after A and C are stable.
5. Integrated slice review happens only after all four workstreams are merged.

## 9. Required Skills

These skills are mandatory for slice 2:

- `orbit-schema-change`
  - required for Workstream A and any `schema/zod.ts` change that depends on new tables
- `orbit-tenant-safety-review`
  - required for Workstream D and for any schema change that introduces or changes tenant-scoped table behavior
- `orbit-core-slice-review`
  - required after the integrated slice is complete and before service work begins

Do not add more skills to the critical path for this slice.

## 10. Validation Gates

Slice 2 is not done until all of these pass.

### 10.1 Unit And Build Gates

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

### 10.2 Schema And Validation Gates

- table tests prove all five operational tables compile with the expected tenant columns and indexes
- relation tests prove the minimum contact, company, deal, pipeline, and stage graph
- generated Zod schemas exist for every implemented table in this slice
- validation extensions cover the documented invariants that apply to implemented tables, especially:
  - valid Orbit IDs
  - stage won/lost mutual exclusion
  - basic deal-stage consistency rules, if modeled in this slice

### 10.3 Query And Pagination Gates

- cursor encode and decode round-trip tests pass
- invalid cursor inputs are rejected cleanly
- default sort normalization is deterministic
- tie-break behavior is documented and tested
- list-query normalization does not allow unbounded or unstable repository calls

### 10.4 Tenant-Safety Gates

- repository primitives always require tenant scope for tenant tables
- bootstrap-table exceptions are explicit and tested
- SQLite tests prove application-level tenant filtering remains mandatory
- no repository helper assumes privileged database authority

## 11. Threat Focus

Slice 2 primarily addresses:

- T1 cross-tenant leakage through repository or predicate mistakes
- T3 secret exposure risk from premature broad schema expansion

The slice should reduce risk by proving the repository layer before service code starts.

## 12. Done Condition

Slice 2 is complete when all of the following are true:

1. the five operational tables and their minimum relations are in place
2. `schema/zod.ts` is no longer a placeholder
3. cursor and list-query helpers are reusable and tested
4. repository primitives prove deterministic tenant filtering
5. `orbit-schema-change` review reports no unresolved findings
6. `orbit-tenant-safety-review` reports no unresolved findings
7. `orbit-core-slice-review` reports that the integrated diff matches this plan and the core spec

## 13. Immediate Next Actions

1. Accept this slice-2 plan.
2. Create branch `core-slice-2-execution`.
3. Assign Workstreams A-D with the file ownership listed above.
4. Land Workstream A first.
5. Stop after the integrated slice-2 review before starting entity services.
