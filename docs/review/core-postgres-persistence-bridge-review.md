# Core Postgres Persistence Bridge Review

Date: 2026-04-01
Branch: `core-postgres-persistence-bridge`
Commit: `ba3dfb1` `feat(core): add postgres persistence bridge`

## Scope

This review covers the Postgres-family persistence bridge for `@orbit-ai/core`, including:

- Postgres runtime database wrapper and adapter
- Postgres-backed repository bridge for the Wave 1 entity set
- `createCoreServices(adapter)` selection behavior for `PostgresStorageAdapter`
- integrated proof harness for persistence reuse, tenant scoping, admin/system separation, and auth lookup DTO shape

## Validation Evidence

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

All four passed on `core-postgres-persistence-bridge`.

## Code Review

Findings:

- None.

Outcome: `PASS`

## Tenant Safety Review

Boundary touched:

- Tenant runtime
- Public interface
- Database/runtime authority boundary

Org context source:

- Tenant scope continues to derive from trusted `ctx.orgId`.
- `lookupApiKeyForAuth()` remains pre-tenant and returns only the minimal DTO shape.

Access mode safety:

- Runtime request paths use least-privilege adapter execution.
- Migration authority remains separated behind `runWithMigrationAuthority(...)`.
- `withTenantContext(...)` keeps tenant scope transaction-local.

Secret exposure check:

- API key read surfaces stay sanitized.
- The Postgres bridge exposes only the minimal auth lookup DTO.
- No new secret-bearing read surface was introduced by the bridge.

Findings:

- None.

Validation:

1. No caller-controlled org context: Pass
2. Runtime credentials only: Pass
3. Defense-in-depth on new tables: Pass
4. Secrets stay redacted across read surfaces: Pass

Outcome: `PASS`

## Plan Vs Execution

The bridge matches the execution plan:

- Slice A: generic Postgres runtime adapter and tenant context
- Slice B: Wave 1 Postgres repository bridge
- Slice C: integrated proof harness and adapter selection behavior

## Recommendation

The Postgres persistence bridge is ready as the new core baseline. The next step is the next core execution slice or the next package-level implementation plan, depending on product priority.
