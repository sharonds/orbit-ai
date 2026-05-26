# Business E2E Account 360 Report

**Date:** 2026-05-26
**Database:** SQLite only
**Scope:** Third business E2E demo gate slice plus focused graph isolation smoke

## Summary

Implemented the Account 360 business scenario as a deterministic
`@orbit-ai/demo-seed` overlay and added the third business E2E journey. The
journey proves company graph traversal across contacts, open deals, activities,
notes, open tasks, SDK HTTP reads, raw API company fetch, MCP
`get_record`/`search_records`, SDK HTTP task creation, SDK direct persistence
verification, and Beta tenant exclusion.

Also added a focused security E2E that seeds the Account 360 graph in Beta and
proves Acme-bound SDK direct, SDK HTTP, raw API, and MCP surfaces cannot read
Beta company, contact, deal, activity, note, or task IDs.

No UI, Postgres, OrbStack, live Gmail/Calendar/Stripe, or deployment work was
added.

## Files Changed

- `packages/demo-seed/src/scenarios/account-360.ts`
- `packages/demo-seed/src/scenarios/account-360.test.ts`
- `packages/demo-seed/src/scenarios/index.ts`
- `e2e/src/business-journeys/03-account-360.test.ts`
- `e2e/src/security/tenant-graph-isolation.test.ts`
- `packages/demo-seed/README.md`
- `e2e/README.md`
- `docs/product/business-e2e-scenario-map.md`
- `docs/testing/security-e2e-matrix.md`
- `CHANGELOG.md`
- `.gitignore`
- `docs/reports/2026-05-26-business-e2e-account-360-report.md`

## Tests Run

- `pnpm -F @orbit-ai/demo-seed test -- src/scenarios/account-360.test.ts`
  - Initial result: failed on SQLite savepoint contention caused by parallel
    scenario answer reads.
  - Final result: passed, 1 test.
- `pnpm -F @orbit-ai/demo-seed typecheck`
  - Initial result: failed because `TaskRecord` is not exported from the core
    package barrel and because activity subjects are nullable.
  - Final result: passed.
- `pnpm -F @orbit-ai/demo-seed build`
  - Result: passed.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys/03-account-360.test.ts`
  - Result: passed, 1 test.
- `pnpm -F @orbit-ai/e2e typecheck`
  - Initial result: failed because public SDK `CreateTaskInput` does not expose
    `company_id`.
  - Final result: passed.
- `pnpm -F @orbit-ai/e2e test -- src/security/tenant-graph-isolation.test.ts`
  - Result: passed, 1 test.
- `pnpm -r build`
  - Result: passed.
- `pnpm -F @orbit-ai/demo-seed test`
  - Result: passed, 18 files, 50 tests.
- `pnpm -F @orbit-ai/e2e test`
  - Result: passed, 23 files, 27 tests passed, 3 skipped.
- `pnpm -F @orbit-ai/api test`
  - Result: passed, 14 files, 311 tests.
- `pnpm -F @orbit-ai/sdk test`
  - Result: passed, 13 files, 233 tests.
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

## Issues Found

- Account 360 expected-answer helpers must read SQLite sequentially. Parallel
  service reads can conflict on nested savepoints.
- `TaskRecord` is not exported from the `@orbit-ai/core` package barrel; the
  scenario uses an inferred public service return type instead of importing a
  private validator type.
- Activity `subject` is nullable at the type level, so semantic handles must
  provide a fallback label.
- SDK HTTP task creation supports `contact_id` and `deal_id` but not
  `company_id` in the public `CreateTaskInput` type. The E2E task write links to
  company through the deal/contact graph instead of faking unsupported coverage.

## Bugs Fixed During Implementation

- Account 360 helper uses sequential pagination for companies, contacts, deals,
  activities, notes, and tasks.
- Account 360 business journey includes real raw API and MCP assertions rather
  than leaving those surfaces deferred.
- Tenant graph isolation now covers activity, note, and task IDs in addition to
  companies, contacts, and deals.

## Remaining Gaps

- CLI graph isolation remains deferred.
- Tags, pipelines/stages, schema metadata, integration records, payments, and
  contracts are not included in the focused graph isolation smoke.
- MCP stdio wire behavior remains deferred; the E2E uses the existing in-process
  MCP transport harness.
- Renewal/Expansion, integration event simulation, and agent Q&A smoke scenarios
  remain deferred.
- Postgres/RLS proof remains deferred by design for this SQLite-only pass.
- No generated UI or Vercel/CopilotKit prototype was added in this pass.

## Confidence

Confidence after this slice: **0.88**.

Confidence increased because Account 360 proves multi-entity graph traversal,
adds real raw API/MCP business assertions, adds graph isolation coverage, and the
full package verification set passed. Confidence is still capped by deferred CLI
graph isolation, MCP stdio, broader security matrix controls, and Postgres/RLS
proof.

## Recommended Next Slice

Add Renewal/Expansion next, then add a compact raw API/MCP/CLI surface parity
smoke across all implemented business scenarios before building any UI prototype.
