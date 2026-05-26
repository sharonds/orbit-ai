# Business E2E MCP Agent Q&A Report

**Date:** 2026-05-26
**Branch:** `codex/business-e2e-mcp-coverage`
**Database:** SQLite only

## Summary

Implemented the first MCP-first business Q&A smoke using the deterministic Lead
Qualification scenario. The journey proves that an agent-style MCP flow can
discover qualified leads, ground the answer in activity records, create a
follow-up task, and avoid cross-tenant Beta records without adding UI,
deployment, live integrations, Postgres, or OrbStack.

## Files Changed

- `e2e/src/business-journeys/07-agent-qa-smoke.test.ts`
- `e2e/README.md`
- `packages/mcp/README.md`
- `docs/product/business-e2e-scenario-map.md`
- `docs/testing/security-e2e-matrix.md`
- `docs/reports/2026-05-26-business-e2e-mcp-agent-qa-report.md`

## Tests Run

- `pnpm -r build` on updated `main` after PR #94 merge: passed.
- `pnpm -F @orbit-ai/e2e test` on updated `main` after build: passed, 33 files,
  38 tests passed, 3 skipped.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys/07-agent-qa-smoke.test.ts`:
  passed, 1 file, 1 test.
- `pnpm -F @orbit-ai/e2e test -- src/business-journeys`: passed, 7 files,
  7 tests.
- `pnpm -F @orbit-ai/e2e typecheck`: passed.
- `pnpm -F @orbit-ai/mcp typecheck`: passed.
- `pnpm -F @orbit-ai/e2e test`: passed, 34 files, 39 tests passed, 3 skipped.

## Issues Found

- The first broad MCP contact search used `status=lead` and `limit=100`, which
  paged through base demo leads before scenario leads. The test now searches on
  the business predicate `status=lead` plus `is_hot=true`.
- MCP search ordering is not stable for same-timestamp scenario rows. The test
  now sorts reconstructed answer IDs by the deterministic expected-answer order.
- MCP direct payloads can expose public snake_case fields while some helper
  paths can use SDK/direct casing. The test reads both shapes for the fields it
  asserts.

## Bugs Fixed During Implementation

No product code changes were required. The fixes were limited to the new E2E
journey assertions.

## Coverage Added

- MCP `search_records` derives the Lead Qualification answer.
- MCP `list_activities` proves hot email-qualified leads have email activity.
- MCP `create_record` creates a follow-up task.
- SDK direct verifies the MCP-created task persisted.
- Beta tenant Lead Qualification trap records are excluded from Acme MCP
  results.

## Review Results

- Code review: passed. The change is isolated to one E2E journey and docs; no
  product runtime code, serializers, or shared helpers changed.
- Security review: passed. The MCP handle is created with Acme trusted context,
  the test seeds a Beta trap, and Acme MCP search results are asserted not to
  include Beta records. No secrets, API keys, or connector credentials are
  introduced.
- Tenant-safety review: passed. The new journey does not accept
  `organization_id` from tool arguments; org context comes from the MCP server
  setup via `spawnMcp({ organizationId: stack.acmeOrgId })`.
- Database review: passed. No schema, migration, repository, adapter, or raw SQL
  changes were made. SQLite remains the only database required for this slice.
- Business logic review: passed. The MCP-derived qualified lead answer is
  compared to `answerLeadQualificationQuestion()` and excludes the cold lead,
  missing-company data is preserved, email activity grounding is checked, and
  follow-up task persistence is verified.

## Remaining Gaps

- No natural-language planner or generated UI is tested.
- MCP stdio process startup remains deferred because the CLI `orbit mcp serve`
  command is still reserved but not wired.
- HTTP MCP auth/scope behavior is not covered in this slice.
- Postgres/RLS proof remains outside this SQLite-only pass.

## Confidence Level

High for the MCP direct business smoke added in this slice. Medium for broader
agent-facing behavior until HTTP MCP auth/scope, stdio startup, and UI/agent
orchestration are covered.

## Recommended Next Slice

Add focused MCP boundary coverage for HTTP MCP auth/scope behavior if the
current HTTP transport can be exercised cleanly. If not, wire the smallest
stdio/CLI startup smoke first so MCP hosts can launch Orbit through the intended
operator path.
