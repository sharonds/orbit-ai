# Business E2E Lead Qualification Report

**Date:** 2026-05-25
**Database:** SQLite only
**Scope:** First business E2E demo gate slice

**Superseded status note:** This is a point-in-time slice report. Later slices
completed Stalled Pipeline, Account 360, Renewal/Expansion, fake integration
event simulation, and the SQLite security coverage closure. MCP stdio wire and
Postgres/RLS remain deferred.

## Summary

Implemented the Lead Qualification business scenario as a deterministic
`@orbit-ai/demo-seed` overlay and added the first business E2E journey. The
journey proves a realistic CRM question across seeded business data, SDK direct
answer verification, SDK HTTP contact reads, SDK HTTP task creation, SDK direct
task persistence verification, and Beta tenant exclusion.

No UI, Postgres, OrbStack, live Gmail/Calendar/Stripe, or deployment work was
added.

## Files Changed

- `packages/demo-seed/src/scenarios/types.ts`
- `packages/demo-seed/src/scenarios/index.ts`
- `packages/demo-seed/src/scenarios/lead-qualification.ts`
- `packages/demo-seed/src/scenarios/lead-qualification.test.ts`
- `packages/demo-seed/src/index.ts`
- `e2e/src/business-journeys/01-lead-qualification.test.ts`
- `packages/demo-seed/README.md`
- `e2e/README.md`
- `docs/product/business-e2e-scenario-map.md`
- `docs/testing/security-e2e-matrix.md`
- `.gitignore`
- `docs/reports/2026-05-25-business-e2e-lead-qualification-report.md`

## Tests Run

- `pnpm install --frozen-lockfile`
  - Result: passed; restored missing workspace dependencies from the lockfile.
- `pnpm -F @orbit-ai/demo-seed test -- src/scenarios/lead-qualification.test.ts`
  - Initial result: failed as expected before implementation because
    `lead-qualification.js` did not exist.
  - Final result: passed, 1 test.
- `pnpm -F @orbit-ai/demo-seed build`
  - Result: passed; required so `@orbit-ai/e2e` can import the new package export
    from `packages/demo-seed/dist`.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys/01-lead-qualification.test.ts`
  - Initial result: failed as expected before build because the new scenario
    export was not present in `dist`.
  - Intermediate result: failed on SDK HTTP task creation with ISO `due_date`.
  - Final result: passed, 1 test.
- `pnpm -F @orbit-ai/demo-seed typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/e2e typecheck`
  - Initial result: failed when run in parallel with `pnpm -F @orbit-ai/demo-seed
    build` because `dist` was temporarily absent during rebuild.
  - Final result after build completed: passed.
- `pnpm -F @orbit-ai/demo-seed test`
  - Result: passed, 16 files, 48 tests.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys`
  - Result: passed, 1 file, 1 test.
- `pnpm -F @orbit-ai/e2e test`
  - Result: passed, 20 files, 24 tests passed, 3 skipped.

## Issues Found

- `@orbit-ai/e2e` consumes built package output for `@orbit-ai/demo-seed`.
  Source-only changes are not visible to E2E until `pnpm -F @orbit-ai/demo-seed
  build` runs.
- SDK HTTP task creation rejects ISO `due_date` strings because the API
  deserializes key names but does not coerce date strings before core Zod
  validation. The journey creates a task without `due_date` and records date
  coercion as follow-up work.
- Parallel core reads against the same SQLite adapter can hit savepoint conflicts
  in tests. The package test performs verification reads sequentially.
- Core paginated results use `nextCursor`, while SDK/API wire envelopes use
  `meta.next_cursor`. Scenario helpers must use the core shape.

## Bugs Fixed During Implementation

- The scenario answer helper now paginates through all lead contacts instead of
  relying on the first 100 records from the base Acme seed.
- Scenario answer ordering is now stable by explicit business priority email
  order rather than timestamp/ULID insertion order.
- Company `size` is seeded as a number to match the core schema.

## Remaining Gaps

- Current status: later slices added Stalled Pipeline, Account 360,
  Renewal/Expansion, fake integration event simulation, raw API/MCP business
  reads where supported, and focused SQLite security E2E files for auth/scope,
  graph isolation, redaction, idempotency, payload limits, rate limits, and
  webhook SSRF.
- MCP stdio wire behavior remains deferred.
- Postgres/RLS proof remains deferred.
- No generated UI or Vercel/CopilotKit prototype was added in this pass.

## Confidence

Confidence after this slice: **0.78**.

The first business scenario is deterministic and covered by focused package and
E2E tests on SQLite. At the time, confidence was not higher because MCP/raw API
business coverage, broader security matrix tests, and HTTP date coercion were
still open. Later slices closed HTTP date coercion, added raw API/MCP business
reads where supported, and completed the focused SQLite security matrix.

## Recommended Next Slice

Current recommendation: decide whether MCP stdio wire coverage should be
implemented before shaping the agent/UI prototype against the stable scenario
helpers.
