# Business E2E Renewal/Expansion Report

**Date:** 2026-05-26
**Database:** SQLite only
**Scope:** Fourth business E2E demo gate slice plus CLI and scope-boundary smoke

## Summary

Implemented the Renewal/Expansion business scenario as a deterministic
`@orbit-ai/demo-seed` overlay and added the fourth business E2E journey. The
journey proves a signed expiring contract, paid historical deal, recent positive
activity, open expansion deal, dormant negative-control customer, SDK HTTP
reads/writes, raw API deal fetch, MCP `get_record`/`search_records`, SDK direct
persistence verification, and Beta tenant exclusion.

Also added a read-only CLI API-mode business-surface smoke and a focused API
scope-boundary security test for a `contacts:read` key.

No UI, Postgres, OrbStack, live Gmail/Calendar/Stripe, or deployment work was
added.

## Files Changed

- `packages/demo-seed/src/scenarios/renewal-expansion.ts`
- `packages/demo-seed/src/scenarios/renewal-expansion.test.ts`
- `packages/demo-seed/src/scenarios/index.ts`
- `e2e/src/business-journeys/04-renewal-expansion.test.ts`
- `e2e/src/business-journeys/05-cli-business-surface.test.ts`
- `e2e/src/security/scope-boundary.test.ts`
- `e2e/src/harness/build-stack.ts`
- `packages/demo-seed/README.md`
- `e2e/README.md`
- `docs/product/business-e2e-scenario-map.md`
- `docs/testing/security-e2e-matrix.md`
- `CHANGELOG.md`
- `.gitignore`
- `docs/reports/2026-05-26-business-e2e-renewal-expansion-report.md`

## Tests Run

- `pnpm -F @orbit-ai/demo-seed test -- src/scenarios/renewal-expansion.test.ts`
  - Result: passed, 1 test.
- `pnpm -F @orbit-ai/demo-seed typecheck`
  - Result: passed.
- `pnpm -r build`
  - Result: passed.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys/04-renewal-expansion.test.ts`
  - Result: passed, 1 test.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys/05-cli-business-surface.test.ts`
  - Result: passed, 1 test.
- `pnpm -F @orbit-ai/e2e test -- src/security/scope-boundary.test.ts src/harness/build-stack.test.ts`
  - Result: passed, 2 files, 2 tests passed, 3 skipped.
- `pnpm -F @orbit-ai/e2e typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/demo-seed test`
  - Result: passed, 19 files, 51 tests.
- `pnpm -F @orbit-ai/e2e test`
  - Result: passed, 26 files, 30 tests passed, 3 skipped.
- `pnpm -F @orbit-ai/api test`
  - Result: passed, 14 files, 311 tests.
- `pnpm -F @orbit-ai/sdk test`
  - Result: passed, 13 files, 233 tests.
- `pnpm -F @orbit-ai/api typecheck`
  - Result: passed.
- `pnpm -F @orbit-ai/sdk typecheck`
  - Result: passed.

## Issues Found

- The current E2E harness only supported all-scope API keys. A narrowly scoped
  `rawApiScopes` option was added so scope-boundary E2E can exercise API auth
  without introducing a second harness.
- Contracts and payments are supported by core services, so Renewal/Expansion
  uses deterministic local records rather than documenting those as unsupported.

## Bugs Fixed During Implementation

- Added `rawApiScopes` to the E2E stack builder for SQLite and Postgres harness
  paths.
- Added deterministic Renewal/Expansion expected-answer pagination over
  companies, deals, activities, contracts, and payments.

## Remaining Gaps

- CLI graph isolation remains deferred.
- Scope-boundary update/delete and broader entity-scope cases remain deferred.
- Redaction, idempotency, payload-limit, rate-limit, and webhook SSRF security
  files remain deferred.
- Integration event simulation remains deferred.
- MCP stdio wire behavior remains deferred; E2E uses the existing in-process
  MCP transport harness.
- Postgres/RLS proof remains deferred by design for this SQLite-only pass.
- No generated UI or Vercel/CopilotKit prototype was added in this pass.

## Confidence

Confidence after this slice: **0.90**.

Confidence increased because Renewal/Expansion covers contract/payment-backed
business logic, CLI API-mode smoke, API scope-boundary smoke, and the full
verification set passed. Confidence is capped by deferred full security matrix,
CLI graph isolation, integration-event simulation, MCP stdio, and Postgres/RLS
proof.

## Recommended Next Slice

Add integration event simulation with fake Gmail/Calendar/Stripe payloads and
idempotent replay checks, then start shaping the agent/UI prototype against the
stable scenario helpers.
