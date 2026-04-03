# Core Tenant Hardening — Plan vs Execution Review

Date: 2026-04-03
Branch: core-tenant-hardening (worktree)
Base: a12f4e4 (main after Wave 2 Slice E merge)

## Scope Confirmation

This branch contains tenant hardening only:
- [x] Postgres-family RLS DDL generation (Slice A+B)
- [x] Postgres bootstrap integration for RLS (Slice C)
- [x] Org-leading index audit and DDL (Slice D)
- [x] Proof harness and adapter proofs (Slice E)

Not pulled forward:
- [ ] API route implementation
- [ ] SDK transport or direct-mode implementation
- [ ] CLI or MCP transport work
- [ ] Schema-engine mutation execution
- [ ] Audit middleware or idempotency replay middleware

## Intentional Spec Deviations

1. **Shared allowlist source of truth** (Slice A): `rls.ts` imports `IMPLEMENTED_TENANT_TABLES` from `tenant-scope.ts` instead of defining a module-local `TENANT_TABLES` const as shown in the frozen spec (01-core.md §9). Rationale: single source of truth per Execution Principle 6.

2. **Idempotent policy creation** (Slice B): Added `DROP POLICY IF EXISTS` before each `CREATE POLICY`. The frozen spec uses bare `CREATE POLICY` which would throw on re-bootstrap. This is a spec gap fix, not a deviation from intent.

3. **Bootstrap applies RLS by default** (Slice C/E): The final bootstrap path runs in a transaction, creates schema `orbit`, pins `search_path` to `orbit, pg_temp`, applies table DDL, baseline org-leading indexes, and RLS. The only test-only exception is `includeRls: false` in `pg-mem` persistence proofs because `pg-mem` does not implement RLS DDL.

## Org-Leading Index Coverage

The branch applies baseline org-leading indexes for tenant-filtered tables by default during Postgres bootstrap. This is enough to support the RLS/tenant-filter path and the existing org-scoped repository access model.

This review does not claim query-pattern-specific composite index hardening. Any future `(organization_id, <column>)` tuning should be treated as a separate performance pass, not as part of this tenant-hardening baseline.

### Intentional Exceptions
None for the baseline tenant-filter/RLS coverage. The remaining `pg-mem` exception is test-only and is controlled with `includeRls: false`.

## SQLite Impact

SQLite remains unchanged. Postgres-specific bootstrap now carries the new schema/search-path/RLS behavior, while SQLite continues to enforce tenant isolation through application-level org filters in repositories.

## Real Postgres Proof

The branch now includes an opt-in live Postgres proof at `packages/core/src/adapters/postgres/live-bootstrap.test.ts`.

- It is intentionally gated by `ORBIT_TEST_POSTGRES_URL` and `ORBIT_TEST_POSTGRES_ALLOW_SCHEMA_RESET=1`
- It drops and recreates schema `orbit`, so it is only safe against a dedicated test database
- It verifies the real engine applies the schema, indexes, policies, and search-path behavior that `pg-mem` cannot fully execute

## Security Review Answers

1. Does every implemented tenant table now receive Postgres-family RLS coverage? **Yes** — 27/27 tables are covered by `generatePostgresRlsSql()`, and bootstrap applies that RLS by default.
2. Can any request-path runtime code bypass tenant isolation? **No** — runtime paths use least-privilege credentials; RLS + app-layer filters remain in place.
3. Does the shared allowlist make missing tenant-table registration a test failure? **Yes** — drift detection test fails if a table is added to `IMPLEMENTED_TENANT_TABLES` but not covered by RLS.
4. Did any bootstrap or adapter change widen migration authority into runtime paths? **No** — the bootstrap path is still migration-authority-only, and the pg-mem test exception is test-only.
5. Are the new indexes justified by actual tenant-scoped access patterns? **Yes** — they provide baseline org-leading coverage for tenant filters and RLS. This branch does not claim separate query-pattern-specific composite index tuning.
