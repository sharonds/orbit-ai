# Business E2E Stalled Pipeline Report

**Date:** 2026-05-25
**Database:** SQLite only
**Scope:** Second business E2E demo gate slice

## Summary

Implemented the Stalled Pipeline business scenario as a deterministic
`@orbit-ai/demo-seed` overlay and added the second business E2E journey. The
journey proves stuck-deal detection, high-value proposal next-task logic, SDK
HTTP deal reads, SDK HTTP deal movement, SDK HTTP task creation with ISO
`due_date`, SDK direct persistence verification, and Beta tenant exclusion.

The pass also fixed the public date-input coercion issue discovered during the
Lead Qualification slice. API and SDK direct deserializers now coerce known
date/time input fields before core validation.

No UI, Postgres, OrbStack, live Gmail/Calendar/Stripe, or deployment work was
added.

## Files Changed

- `packages/api/src/serialization.ts`
- `packages/api/src/__tests__/serialization.test.ts`
- `packages/sdk/src/transport/serialization.ts`
- `packages/sdk/src/__tests__/serialization.test.ts`
- `packages/demo-seed/src/scenarios/stalled-pipeline.ts`
- `packages/demo-seed/src/scenarios/stalled-pipeline.test.ts`
- `packages/demo-seed/src/scenarios/index.ts`
- `e2e/src/business-journeys/02-stalled-pipeline.test.ts`
- `packages/demo-seed/README.md`
- `e2e/README.md`
- `docs/product/business-e2e-scenario-map.md`
- `docs/testing/security-e2e-matrix.md`
- `CHANGELOG.md`
- `.gitignore`

## Tests Run

- `pnpm -F @orbit-ai/api test -- src/__tests__/serialization.test.ts`
  - Initial result: failed as expected because `due_date` and `occurred_at`
    remained strings.
  - Final result: passed, 24 tests.
- `pnpm -F @orbit-ai/sdk test -- src/__tests__/serialization.test.ts`
  - Initial result: failed as expected because direct transport deserialization
    matched the old string behavior.
  - Final result: passed, 17 tests.
- `pnpm -F @orbit-ai/demo-seed test -- src/scenarios/stalled-pipeline.test.ts`
  - Initial result: failed as expected before implementation because
    `stalled-pipeline.js` did not exist.
  - Final result: passed, 1 test.
- `pnpm -F @orbit-ai/demo-seed build`
  - Result: passed.
- `pnpm -F @orbit-ai/api build`
  - Result: passed.
- `pnpm -F @orbit-ai/sdk build`
  - Result: passed.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys/02-stalled-pipeline.test.ts`
  - Initial result: failed before rebuilding API/SDK dist because E2E consumed
    stale built package output.
  - Final result: passed, 1 test.
- `pnpm -F @orbit-ai/api typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/sdk typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/demo-seed typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys`
  - Result: passed, 2 files, 2 tests.
- `pnpm -F @orbit-ai/e2e typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/api test`
  - Result: passed, 14 files, 311 tests.
- `pnpm -F @orbit-ai/sdk test`
  - Result: passed, 13 files, 233 tests.
- `pnpm -F @orbit-ai/demo-seed test`
  - Result: passed, 17 files, 49 tests.
- `pnpm -F @orbit-ai/e2e test`
  - Result: passed, 21 files, 25 tests passed, 3 skipped.

## Issues Found

- E2E tests consume built workspace package output for `@orbit-ai/api`,
  `@orbit-ai/sdk`, and `@orbit-ai/demo-seed`; source changes must be built
  before E2E can verify them.
- Date-input coercion must stay mirrored between API serialization and SDK
  direct serialization to preserve HTTP/direct parity.
- Stalled-deal answers should be driven by explicit scenario markers and record
  handles, not broad seeded CRM data.

## Bugs Fixed During Implementation

- Public date/time input strings are now converted to `Date` for known core date
  fields before validation.
- The Stalled Pipeline answer helper paginates all deals and filters by the
  scenario marker so closed controls and page boundaries do not distort answers.

## Remaining Gaps

- MCP business assertion is deferred.
- Raw API business assertion is deferred.
- Account 360 scenario is deferred.
- Dedicated security E2E files for broader graph isolation, scope boundaries,
  redaction, idempotency, payload limits, rate limits, and webhook SSRF remain
  deferred.
- Postgres/RLS proof remains deferred.
- No generated UI or Vercel/CopilotKit prototype was added in this pass.

## Confidence

Confidence after this slice: **0.82**.

The second business workflow is deterministic and covered by focused package and
E2E tests on SQLite, and the previously discovered date coercion issue is fixed
with parity tests. Confidence is capped because MCP/raw API business coverage,
Account 360, and the broader security matrix are still open.

## Recommended Next Slice

Implement Account 360 next. That should verify traversal across company,
contacts, deals, notes, activities, tasks, and tags before building a UI or
agent chat prototype.
