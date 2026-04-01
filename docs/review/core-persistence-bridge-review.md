# Core Persistence Bridge Review

Date: 2026-03-31
Branch: `core-wave-1-services`
Scope:
- [core-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-persistence-bridge-plan.md)
- SQLite-backed Wave 1 repositories in `@orbit-ai/core`

## Outcome

The SQLite persistence bridge is implemented locally and validated.

Validation passed:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

## Code Review

No critical or high defects were found in the bridge patch.

What is now true:

- `OrbitDatabase` and `StorageAdapter` have a real read path via `query()`
- SQLite has a concrete runtime database wrapper and Wave 1 schema bootstrap
- `createCoreServices(adapter)` prefers adapter-backed repositories when the adapter is a real `SqliteStorageAdapter`
- records persist across fresh service registries on SQLite

## Security Review

No critical or high tenant-safety findings were found.

What passed:

- tenant CRUD still derives scope from `ctx.orgId`
- SQLite repositories enforce org filters at the repository boundary
- admin/system reads stay separate from tenant CRUD services
- the persistence bridge does not introduce migration-authority use into request-path services

## Plan vs Execution Review

No critical or high plan drift was found.

Remaining medium gaps:

1. The persistence bridge is implemented for SQLite only. Postgres-family adapter-backed repositories are still pending.
2. Search remains intentionally bounded and in-memory after repository reads. That is acceptable for the bridge slice, but it is not the final search architecture.

## Recommendation

Accept the SQLite persistence bridge as complete.

The next core decision should be one of:

1. add the Postgres-family repository bridge next, then start API work
2. or explicitly treat SQLite as the first supported persistence path and plan Postgres-family bridge as the next core follow-up before API leaves prototype depth
