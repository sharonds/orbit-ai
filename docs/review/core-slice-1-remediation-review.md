# Core Slice 1 Remediation Review

Date: 2026-03-31
Branch: `core-slice-1-remediation`
Scope:
- `packages/core/src/`
- [core-slice-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-1-remediation-plan.md)

## 1. Review Summary

The slice-1 remediation patch set resolves the must-fix findings from [core-slice-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-slice-1-review.md) that were blocking Milestone 3 and slice 2.

Resolved in this branch:

- `ApiKeyAuthLookup.permissions` renamed to `scopes`
- `withTenantContext(...)` now validates `orgId` with `assertOrbitId(...)`
- redundant tenant-context cleanup removed
- `updatedAt` now has automatic update behavior
- `pgTable` is no longer re-exported from schema helpers
- `organizationMemberships -> users` relations are disambiguated
- `ID_PREFIXES` is exported from the core package root
- ID uniqueness and lowercase-ULID rejection tests are present

## 2. Validation Evidence

Passed:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

Test totals at review time:

- 8 test files passed
- 24 tests passed

## 3. Code Review Outcome

Outcome: `PASS`

Findings:

- none

Notes:

- the branch fixes the slice-1 contract and safety defects without pulling in slice-2 repository or service work
- the auth naming, export surface, relation, and timestamp helper changes are narrow and consistent with the core spec

## 4. Tenant-Safety Review Outcome

Boundary touched:

- Tenant Runtime
- Database

Org context source:

- `organization_id` still comes from trusted runtime context
- `withTenantContext(...)` now rejects malformed `orgId` values before entering the transaction

Access mode safety:

- API mode remains safe on the current contract because auth lookup and tenant context now use aligned `scopes` and validated `orgId`
- direct mode remains safe on the current contract because the trusted `context.orgId` path is validated before tenant context is established

Secret exposure check:

- no new secret-bearing reads were introduced
- the remediation branch does not widen DTOs, envelopes, or serializer surfaces

Validation:

1. **No caller-controlled org context**: Pass — `withTenantContext(...)` validates `context.orgId` before opening a transaction
2. **Runtime credentials only**: Pass — no runtime path was changed to use elevated or migration credentials
3. **Defense-in-depth on new tables**: N/A — this remediation branch does not add tenant tables
4. **Secrets stay redacted across read surfaces**: Pass — no new read surface was added and the auth DTO remains minimal

Outcome: `PASS`

## 5. Core Slice Review Outcome

Validation:

1. **Slice scope is respected**: Pass — the branch only addresses slice-1 remediation items
2. **Workstream ownership stayed clean**: Pass — auth, tenant-context, schema helper, relation, export, and ID-test changes stayed within the planned remediation file sets
3. **Required build/test evidence exists**: Pass — build, typecheck, tests, and diff hygiene all passed
4. **Shared contracts still match the core spec**: Pass — `scopes`, `ID_PREFIXES`, helper exports, and tenant-context behavior are aligned with the reconciled core spec
5. **Required specialized reviews ran where needed**: Pass — this document records both the tenant-safety and integrated slice outcomes
6. **Postgres-family proof exists when required**: Pass — the existing slice-1 proof test remains green after the tenant-context change

Outcome: `READY FOR NEXT MILESTONE`

## 6. Remaining Follow-Ups

Tracked but not blocking slice 2:

- branded `MigrationDatabase` type
- restricted raw database access on `StorageAdapter`
- stronger transaction-boundary proof on a real adapter-backed connection path
- prefix invariant test
- SQLite adapter before Wave 1 services
- RLS generation in Milestone 9
