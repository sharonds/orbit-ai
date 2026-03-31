# Core Slice 2 Review

Date: 2026-03-31
Branch: `core-slice-2-execution`
Scope:
- `packages/core/src/schema/`
- `packages/core/src/query/`
- `packages/core/src/repositories/`
- `packages/core/package.json`

## 1. Review Summary

Core slice 2 was executed as planned.

Implemented in this branch:

- first operational tenant tables:
  - `companies`
  - `contacts`
  - `pipelines`
  - `stages`
  - `deals`
- relation graph for the same operational slice
- generated Zod schemas for all currently implemented tables
- cursor helpers
- list-query normalization helpers
- tenant-scope and base repository planning primitives
- validation tests proving deterministic tenant filtering for Postgres-family and SQLite paths

The slice stays within scope. It does not add services, audit writes, idempotency logic, schema-engine mutation behavior, or any API/SDK/CLI/MCP implementation.

## 2. Validation Evidence

Passed:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

Test totals at review time:

- 13 test files passed
- 40 tests passed

## 3. Code Review Outcome

Outcome: `PASS`

Findings:

- none

Notes:

- the operational table definitions match the reconciled slice-2 plan and the core spec
- the new query and repository modules are pure primitives, which is the correct boundary for this slice
- `schema/zod.ts` is no longer a placeholder and the added invariants are limited to the implemented tables

## 4. Tenant-Safety Review Outcome

Boundary touched:

- Tenant Runtime
- Database

Org context source:

- repository primitives derive tenant filters only from trusted `context.orgId`
- bootstrap-table behavior is explicit and separate from tenant-table behavior

Access mode safety:

- Postgres-family path remains safe because tenant tables still require explicit repository-level organization filters and the plan metadata keeps `requiresPostgresTenantContext` explicit
- SQLite path remains safe for this slice because repository plans still require app-level tenant filtering even without RLS

Secret exposure check:

- no secret-bearing tables or serializer surfaces were added in this slice
- the new repository and query helpers are planning primitives only and do not expose new DTOs or raw database rows

Validation:

1. **No caller-controlled org context**: Pass — repository scope is built only from trusted runtime context
2. **Runtime credentials only**: Pass — no elevated or migration authority path was introduced
3. **Defense-in-depth on new tables**: Pass — new tenant tables are organization-scoped and the repository layer explicitly plans tenant filters
4. **Secrets stay redacted across read surfaces**: Pass — no new secret-bearing read surface was added

Outcome: `PASS`

## 5. Core Slice Review Outcome

Validation:

1. **Slice scope is respected**: Pass — the branch contains only the schema bridge, validation layer, query primitives, and repository foundations defined in the slice-2 plan
2. **Workstream ownership stayed clean**: Pass — schema, validation, query, and repository changes stayed within the slice-2 ownership areas
3. **Required build/test evidence exists**: Pass — build, typecheck, tests, and diff hygiene all passed
4. **Shared contracts still match the core spec**: Pass — table names, tenant columns, Zod generation, pagination helpers, and repository scope metadata align with the reconciled core contract
5. **Required specialized reviews ran where needed**: Pass — this review records the integrated code and tenant-safety outcomes
6. **Postgres-family proof exists when required**: Pass — the slice-1 proof remains green and the new repository metadata preserves the Postgres tenant-context requirement

Outcome: `READY FOR NEXT MILESTONE`

## 6. Remaining Follow-Ups

Tracked but not blocking slice 2 acceptance:

- service-layer implementation for Wave 1 entities
