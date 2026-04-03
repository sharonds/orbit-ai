# Core Wave 2 Slice E Review

## Update: 2026-04-02 Remediation Complete

This report is now superseded by the follow-up remediation pass completed on 2026-04-02.

Previously reported findings addressed:

1. Fixed: SQLite now preserves `idempotency_keys.responseBody = null` on the real adapter path.
2. Fixed: Postgres Slice E persistence coverage now uses the real Postgres repositories and the real `createCoreServices(adapter)` registry path.
3. Fixed: real SQLite/Postgres duplicate-key failures for Slice E unique indexes are normalized to typed Orbit `CONFLICT` errors.
4. Fixed: Slice E schema/zod coverage was added for the new tables and DTOs.
5. Fixed: `system.schemaMigrations` admin reads now sanitize `sqlStatements` and `rollbackStatements`.

Validation after remediation:

- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core test`

Result:

- Passed locally: 53 test files, 243 tests.

Fresh follow-up code review and security review were run on the completed patch set. No new blocking findings were identified in the remediation pass.

Date: 2026-04-02
Branch: `core-wave-2-slice-e`
Reviewer: Codex main + parallel code/security sub-agents
Plan re-read: [core-wave-2-slice-e-plan.md](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/docs/execution/core-wave-2-slice-e-plan.md)

## Executive Summary

Slice E is close, but it should not be accepted yet.

Two issues block acceptance:

1. SQLite corrupts nullable `idempotency_keys.response_body` from `null` to `{}` on round-trip.
2. The Postgres Slice E persistence proof does not exercise the real Slice E Postgres repositories, so the branch does not satisfy the plan's Postgres persistence requirement.

There is also one important follow-up correctness gap:

3. Real SQLite/Postgres duplicate-key failures for the new unique indexes are not translated into typed Orbit conflicts on the generic tenant repository path.

Security review note:

- Slice E expands `system.*` with more sensitive metadata, especially `system.schemaMigrations`. I am not marking admin authorization/RLS as a Slice E blocker because the plan explicitly leaves broader tenant hardening out of scope, but this should be decided before these surfaces are exposed through API/SDK/CLI/MCP.

## Blocking Findings

### F1. SQLite changes `idempotency_keys.responseBody: null` into `{}`

Severity: High

Why this matters:

- The Slice E plan requires stable persisted shapes for metadata entities.
- `responseBody: null` means "no cached response body"; `{}` means "empty JSON object". Those are not equivalent.

Evidence:

- [idempotency-keys/repository.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/entities/idempotency-keys/repository.ts#L83) serializes SQLite `response_body` with `toSqliteJson(record.responseBody)`.
- [sqlite/shared.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/repositories/sqlite/shared.ts#L237) defines `toSqliteJson(value)` as `JSON.stringify(value ?? {})`.
- Result: `null` is stored as `'{}'`, then [idempotency-keys/repository.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/entities/idempotency-keys/repository.ts#L119) reads that back as `{}`.

Required fix:

- Preserve `null` for nullable JSON fields on the SQLite path instead of routing them through `toSqliteJson(...)`.
- Add a regression test for `idempotency_keys.responseBody = null` on the real SQLite repository path.

### F2. The Postgres Slice E persistence proof does not test the real Postgres Slice E repositories

Severity: High

Why this matters:

- The Slice E plan requires SQLite and Postgres persistence proof coverage for the touched entity set.
- The current Postgres test proves registry wiring, not real Slice E Postgres persistence.

Evidence:

- [postgres-persistence.test.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/services/postgres-persistence.test.ts#L517) creates `createInMemoryCustomFieldDefinitionRepository()`, `createInMemoryAuditLogRepository()`, `createInMemorySchemaMigrationRepository()`, and `createInMemoryIdempotencyKeyRepository()`.
- [postgres-persistence.test.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/services/postgres-persistence.test.ts#L588) injects those in-memory repositories into `createCoreServices(...)`.
- That bypasses the real Postgres implementations in:
  - [custom-field-definitions/repository.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/entities/custom-field-definitions/repository.ts#L166)
  - [audit-logs/repository.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/entities/audit-logs/repository.ts#L222)
  - [schema-migrations/repository.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/entities/schema-migrations/repository.ts#L197)
  - [idempotency-keys/repository.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/entities/idempotency-keys/repository.ts#L150)

Required fix:

- Replace the in-memory overrides with a real Postgres proof for all four Slice E repositories, or split the test into:
  - a real Postgres persistence proof for the repositories that pg-mem can support, and
  - a clearly documented temporary blocker for any pg-mem limitation that still prevents full coverage.

## Additional Fix / Missing Coverage

### F3. Real adapter duplicate-key violations for new unique indexes are not normalized to typed Orbit conflicts

Severity: Medium

Why this matters:

- Slice E adds new uniqueness constraints for `custom_field_definitions` and `idempotency_keys`.
- The real SQLite/Postgres repository path inserts through the generic tenant repository helper without any duplicate-key translation.
- When real adapters hit those constraints, callers will receive raw database errors instead of consistent Orbit `CONFLICT` errors.

Evidence:

- New unique indexes:
  - [tables.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/schema/tables.ts#L489)
  - [tables.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/schema/tables.ts#L552)
- Generic SQLite insert path:
  - [sqlite/shared.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/repositories/sqlite/shared.ts#L107)
- Generic Postgres insert path:
  - [postgres/shared.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/repositories/postgres/shared.ts#L109)
- Neither path catches engine uniqueness failures and converts them into `createOrbitError({ code: 'CONFLICT', ... })`.

Required fix:

- Add constraint-aware error translation for the Slice E unique indexes, or add entity-specific guards on the real adapter path before insert.
- Add real-adapter tests for duplicate `custom_field_definitions` and duplicate `idempotency_keys`.

### F4. Slice E schema/zod tests were not expanded with Slice E assertions

Severity: Low

Why this matters:

- The branch added four tables, new relations, and new zod exports, but the dedicated schema tests still stop at older slices.

Evidence:

- [operational-schema.test.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/schema/operational-schema.test.ts#L40) only covers the older operational set and does not assert the Slice E tables/relations/indexes.
- [zod.test.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/schema/zod.test.ts#L5) still only exercises the older deal/stage cases.

Required fix:

- Add schema-level tests for Slice E table classification, foreign keys, and indexes.
- Add zod-level tests for Slice E record parsing, especially nullable JSON/date fields and sensitive-read DTO behavior.

## Security Follow-Up

These are not marked as Slice E blockers because the plan keeps broader hardening separate, but they need a product decision before transport surfaces are exposed:

- `system.schemaMigrations` currently returns raw `sqlStatements` and `rollbackStatements` unchanged via [schema-migrations/service.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/entities/schema-migrations/service.ts#L5) and is published directly from [services/index.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/services/index.ts#L921).
- `OrbitAuthContext` still carries tenant context, not an explicit admin capability model, in [adapters/interface.ts](/Users/sharonsciammas/orbit-ai/.worktrees/core-wave-2-slice-e/packages/core/src/adapters/interface.ts#L28).
- If `system.*` is intended to be admin-only at transport level, that gate is still a later milestone and should be documented as such.

## Validation Run

Executed locally:

- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core test`

Result:

- Passed locally: 53 test files, 237 tests.

## Review Outcome

Status: Changes requested before Slice E acceptance.
