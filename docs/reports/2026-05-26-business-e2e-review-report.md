# Business E2E Review Report

**Date:** 2026-05-26
**Database:** SQLite only
**Scope:** Lead Qualification and Stalled Pipeline business E2E slices

## Summary

Ran separate review passes for code quality, API/SDK parity, tenant safety,
business logic, security, and database behavior on the business E2E changes.
One review finding was fixed before final verification: public date coercion was
missing `contacts.lastContactedAt`, and the stalled-pipeline helper now paginates
deal activities and tasks when computing the expected answer.

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
  high-value no-task detection, active controls, and closed controls.
- Security review: no raw SQL, no new credentials, no live connector calls, no
  deployment paths, no new dependencies, and no bypass of the existing auth
  contract beyond trusted direct SDK usage in tests.
- Database review: SQLite remains the only required database, no schema or
  migration changes were introduced, and all scenario writes go through core
  services so tenant context and validation stay centralized.

## Issues Found And Fixed

- Fixed API/SDK date coercion coverage for `contacts.lastContactedAt`.
- Fixed Stalled Pipeline answer calculation to paginate activities and tasks for
  each scenario deal instead of relying on the first page.
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
  - Result: passed, 17 files, 49 tests.
- `pnpm -F @orbit-ai/e2e test`
  - Result: passed, 21 files, 25 tests passed, 3 skipped.
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
`pnpm -r build`, the targeted scenario tests passed.

## Remaining Gaps

- MCP read/search business assertion remains deferred.
- Raw REST API business assertion remains deferred.
- Account 360 scenario remains deferred.
- Broader security E2E files for scope boundaries, graph isolation, redaction,
  idempotency, payload limits, rate limits, and webhook SSRF remain deferred.
- Postgres/RLS proof remains deferred by design for this SQLite-only pass.

## Confidence

Confidence after review: **0.84**.

Confidence increased because the review passes found and fixed date-coercion and
pagination risks, and the business journeys now prove both positive behavior and
tenant exclusion. It is capped because MCP/raw REST coverage and the broader
security matrix are still planned follow-up work.

## Recommended Next Slice

Implement Account 360, then add one MCP assertion and one raw REST assertion
across the first three business scenarios before moving to any UI prototype.
