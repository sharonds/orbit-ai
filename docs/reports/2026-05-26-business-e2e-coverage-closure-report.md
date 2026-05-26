# Business E2E Coverage Closure Report

**Date:** 2026-05-26
**Database:** SQLite only by default
**Scope:** Integration event simulation plus expanded security coverage

## Summary

Implemented the first coverage-closure pass for the business E2E demo gate. The
new slice adds deterministic fake Gmail, Google Calendar, and Stripe event
simulation, proves idempotent replay, expands CLI/auth/scope security coverage,
and adds focused redaction, payload-limit, rate-limit, and webhook SSRF smokes.

MCP stdio wire coverage remains deferred because the repository currently has no
stable executable stdio entrypoint: `packages/mcp/package.json` has no `bin`
entry, and `packages/cli/src/commands/mcp.ts` still throws
`DEPENDENCY_NOT_AVAILABLE` for `orbit mcp serve`.

## Files Changed

- `.gitignore`
- `CHANGELOG.md`
- `docs/product/business-e2e-scenario-map.md`
- `docs/reports/2026-05-26-business-e2e-coverage-closure-report.md`
- `docs/reports/2026-05-26-business-e2e-review-report.md`
- `docs/testing/security-e2e-matrix.md`
- `e2e/README.md`
- `e2e/src/business-journeys/06-integration-event-simulation.test.ts`
- `e2e/src/harness/build-stack.ts`
- `e2e/src/security/auth-boundary.test.ts`
- `e2e/src/security/cli-graph-isolation.test.ts`
- `e2e/src/security/helpers.ts`
- `e2e/src/security/payload-limit.test.ts`
- `e2e/src/security/rate-limit.test.ts`
- `e2e/src/security/redaction.test.ts`
- `e2e/src/security/scope-boundary.test.ts`
- `e2e/src/security/webhook-ssrf.test.ts`
- `packages/demo-seed/README.md`
- `packages/demo-seed/src/scenarios/index.ts`
- `packages/demo-seed/src/scenarios/integration-events.test.ts`
- `packages/demo-seed/src/scenarios/integration-events.ts`

## Tests Run

- `pnpm -F @orbit-ai/e2e typecheck` — passed after adding shared security helpers.
- `pnpm -F @orbit-ai/demo-seed test -- src/scenarios/integration-events.test.ts` — first run failed as expected before implementation because `integration-events.js` did not exist; passed after implementation.
- `pnpm -F @orbit-ai/demo-seed typecheck` — passed.
- `pnpm -F @orbit-ai/demo-seed build` — passed before running the new E2E journey.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys/06-integration-event-simulation.test.ts` — passed, 1 test.
- `pnpm -F @orbit-ai/e2e test -- src/security/cli-graph-isolation.test.ts` — passed, 1 test.
- `pnpm -F @orbit-ai/e2e test -- src/security/auth-boundary.test.ts src/security/scope-boundary.test.ts` — passed, 2 tests.
- `pnpm -F @orbit-ai/e2e test -- src/security/redaction.test.ts` — passed, 1 test.
- `pnpm -F @orbit-ai/e2e test -- src/security/payload-limit.test.ts src/security/rate-limit.test.ts` — passed, 2 tests.
- `pnpm -F @orbit-ai/e2e test -- src/security/webhook-ssrf.test.ts` — passed, 1 test.
- `pnpm -r build` — passed.
- `pnpm -F @orbit-ai/demo-seed test` — passed, 20 files, 52 tests.
- `pnpm -F @orbit-ai/e2e test` — passed, 33 files, 37 tests passed, 3 skipped.
- `pnpm -F @orbit-ai/api test` — passed, 14 files, 311 tests.
- `pnpm -F @orbit-ai/sdk test` — passed, 13 files, 233 tests.
- `pnpm -F @orbit-ai/demo-seed typecheck` — passed.
- `pnpm -F @orbit-ai/e2e typecheck` — passed.
- `pnpm -F @orbit-ai/api typecheck` — passed.
- `pnpm -F @orbit-ai/sdk typecheck` — passed.
- `git diff --check` — passed.

## Issues Found

- Activities do not have a first-class `externalId`, so fake Gmail and Calendar
  idempotency stores the provider event ID in `customFields.providerExternalId`
  and paginates activities to detect replay.
- `createApi` does not expose a low test rate-limit option. The E2E rate-limit
  smoke exhausts the real default per-key budget instead.
- The SQLite E2E harness reused one static API key ID, which could collide with
  rate-limit buckets across files. The harness now generates a unique API key ID
  per stack.
- MCP stdio wire coverage is not currently runnable through a stable CLI/bin
  entrypoint.

## Bugs Fixed During Implementation

- Fixed SQLite E2E harness API key IDs to be unique per stack so rate-limit
  buckets are isolated across E2E files.
- Adjusted webhook SSRF E2E expectations to the current route contract:
  `VALIDATION_FAILED` with HTTP 400.

## Remaining Gaps

- MCP stdio wire smoke remains deferred until `orbit mcp serve` or an equivalent
  package binary is implemented.
- Restricted-role Postgres/RLS proof remains deferred and is not part of this
  SQLite-only gate.
- Revoked/expired API-key E2E cases remain deferred until the harness can create
  those states without raw SQL or unsupported setup.
- Broader multi-scope matrices can be added later if product scope contracts
  require them.

## Confidence

Confidence after this slice: **0.93**.

The main confidence gain is that business utility and security controls now have
deterministic SQLite evidence beyond CRUD: provider-event replay, CLI graph
isolation, auth/scope boundaries, credential redaction, payload/rate limits, and
webhook SSRF.

## Recommended Next Slice

Implement a real MCP stdio executable path if MCP host integration needs to be
certified before the UI/agent prototype. Otherwise, proceed to the prototype on
top of the deterministic scenarios and keep Postgres/RLS as a separate
production-hardening gate.
