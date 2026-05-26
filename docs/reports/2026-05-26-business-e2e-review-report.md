# Business E2E Review Report

**Date:** 2026-05-26
**Database:** SQLite only
**Scope:** Lead Qualification, Stalled Pipeline, Account 360, and Renewal/Expansion business E2E slices

## Summary

Ran separate review passes for code quality, API/SDK parity, tenant safety,
business logic, security, and database behavior on the business E2E changes.
Review findings fixed before final verification include public date coercion for
`contacts.lastContactedAt`, stalled-pipeline activity/task pagination, Account
360 sequential SQLite reads, and narrowing SDK HTTP task creation to supported
public fields. The Renewal/Expansion round added contract/payment-backed
business logic, CLI API-mode smoke, and scoped API-key support in the E2E
harness.

## Review Passes

- Code review: scenario helpers use deterministic fixed time inputs, semantic
  handles, stable scenario markers, and package-level tests before E2E journeys.
- API/SDK parity review: public date-field coercion is mirrored between
  `@orbit-ai/api` serialization and SDK direct transport serialization, with
  regression tests in both packages.
- Tenant safety review: business journeys build both Acme and Beta tenants where
  practical, assert Beta answers are empty, and verify Beta cannot fetch Acme
  records by ID.
- Business logic review: Lead Qualification includes hot leads, missing-company
  detection, and cold controls; Stalled Pipeline includes stale open deals,
  high-value no-task detection, active controls, and closed controls; Account
  360 includes company graph traversal across contacts, deals, activities,
  notes, tasks, and closed/completed controls; Renewal/Expansion includes signed
  contract, paid historical deal, recent positive activity, open expansion deal,
  and dormant negative controls.
- Security review: no raw SQL, no new credentials, no live connector calls, no
  deployment paths, no new dependencies, and no bypass of the existing auth
  contract beyond trusted direct SDK usage in tests. The focused graph isolation
  E2E verifies Beta Account 360 IDs are not readable through Acme-bound SDK
  direct, SDK HTTP, raw API, or MCP. The scope-boundary E2E verifies a
  `contacts:read` API key cannot write contacts, list deals, or create tasks.
- Database review: SQLite remains the only required database, no schema or
  migration changes were introduced, and all scenario writes go through core
  services so tenant context and validation stay centralized. Scenario answer
  helpers paginate and avoid parallel SQLite reads where savepoint contention can
  occur.

## Issues Found And Fixed

- Fixed API/SDK date coercion coverage for `contacts.lastContactedAt`.
- Fixed Stalled Pipeline answer calculation to paginate activities and tasks for
  each scenario deal instead of relying on the first page.
- Fixed Account 360 answer calculation to read SQLite-backed services
  sequentially and to avoid private core task validator imports.
- Adjusted Account 360 SDK HTTP task creation to use supported public task
  fields rather than unsupported `company_id`.
- Added scoped API-key support to the E2E stack builder so security E2E can
  test `AUTH_INSUFFICIENT_SCOPE` behavior.
- Confirmed E2E package imports require rebuilt workspace package output before
  journey tests can see source changes.

## Final Verification

- `pnpm -r build`
  - Result: passed.
- `pnpm -F @orbit-ai/api test`
  - Result: passed, 14 files, 311 tests.
- `pnpm -F @orbit-ai/sdk test`
  - Result: passed, 13 files, 233 tests.
- `pnpm -F @orbit-ai/demo-seed test`
  - Result: passed, 19 files, 51 tests.
- `pnpm -F @orbit-ai/e2e test`
  - Result: passed, 26 files, 30 tests passed, 3 skipped.
- `pnpm -F @orbit-ai/api typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/sdk typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/demo-seed typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/e2e typecheck`
  - Result: passed.
- `git diff --check`
  - Result: passed.

Targeted demo-seed and E2E scenario tests initially failed in the fresh worktree
before build because package entrypoints in `dist` were absent. After
`pnpm -r build`, the targeted scenario tests passed. The Account 360 slice also
  initially found SQLite savepoint contention from parallel helper reads and a
  typed public SDK task-field mismatch; both were fixed before final
  verification. The Renewal/Expansion round added scoped-key harness support and
  verified the full test set after adding CLI and scope-boundary smoke.

## Remaining Gaps

- CLI graph isolation remains deferred.
- MCP stdio wire behavior remains deferred.
- Broader security E2E files for scope boundaries, graph isolation, redaction,
  idempotency, payload limits, rate limits, and webhook SSRF remain deferred.
- Postgres/RLS proof remains deferred by design for this SQLite-only pass.

## Confidence

Confidence after review: **0.90**.

Confidence increased because the review passes found and fixed date-coercion,
pagination, SQLite concurrency, and public SDK type-boundary risks. The business
journeys now include raw REST and MCP business reads, and the security smoke
covers Account 360 graph tenant isolation. It is capped because CLI graph
isolation, MCP stdio, broader security matrix controls, and Postgres/RLS proof
are still planned follow-up work.

## Recommended Next Slice

Implement Renewal/Expansion next, then add compact CLI business-surface smoke
and broader auth/scope/redaction security files before moving to any UI
prototype.
