# Orbit AI Core Persistence Bridge Plan

Date: 2026-03-31
Status: Executed locally; review pending acceptance
Package: `@orbit-ai/core`
Depends on:
- [core-wave-1-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-services-plan.md)
- [core-wave-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-review.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)

## Purpose

This slice replaces the Wave 1 in-memory proof path with adapter-backed persistence, starting with SQLite.

The service contracts are already accepted. The remaining goal is to prove that `createCoreServices(adapter)` can run against a real storage path without changing the Wave 1 service API.

## Scope

In scope:

- add a read-capable runtime database contract for repositories
- add a real SQLite runtime database wrapper
- initialize a SQLite Wave 1 schema for repository-backed execution
- back the Wave 1 repositories with SQLite storage
- switch `createCoreServices(adapter)` to prefer SQLite-backed repositories when the adapter is SQLite
- add persistence-bridge tests that prove records survive across service registries

Out of scope:

- Postgres-family adapter-backed repositories
- final scalable search implementation
- Wave 2 entities
- API, SDK, CLI, or MCP changes

## Delivery Order

1. Add the missing database read contract.
2. Add the SQLite runtime database and schema bootstrap.
3. Add SQLite-backed repositories for the Wave 1 entity set.
4. Switch `createCoreServices(adapter)` to use those repositories by default on SQLite.
5. Validate persistence, tenant safety, and admin/system separation against the real storage path.

## Validation Gates

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

Required review gates:

- code review
- tenant-safety review
- plan vs execution review

## Done Condition

The persistence bridge slice is complete when:

1. Wave 1 service calls persist across a fresh `createCoreServices(adapter)` call on SQLite.
2. Tenant-scoped reads still return `null` across org boundaries.
3. System/admin reads still work without becoming a bypass path into tenant CRUD.
4. The remaining gap to API/SDK execution is no longer “fake persistence,” but only unsupported adapters or later-wave scope.
