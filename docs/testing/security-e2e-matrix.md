# Orbit AI Security E2E Matrix

**Date:** 2026-05-24
**Status:** SQLite security coverage expanded; MCP stdio wire and Postgres/RLS remain deferred

## Purpose

The current alpha E2E suite includes authentication, scoped access, structured
errors, and tenant isolation for contacts/deals. The business E2E milestone
should expand that into a security-focused matrix that proves realistic CRM
journeys cannot cross tenant, scope, credential, or transport boundaries.

## Matrix

| Control | Current coverage | Phase-one E2E target | Evidence artifact |
|---|---|---|---|
| API key required | SDK HTTP and API journeys authenticate with test key; missing/invalid key smoke now exists | Add revoked/expired key cases if the public admin API exposes deterministic setup | `e2e/src/security/auth-boundary.test.ts` |
| Scope enforcement | API scope smoke proves `contacts:read` can read contacts but cannot create/update/delete contacts, list deals, or create tasks | Add broader notes/deals/tasks multi-scope matrix later if needed | `e2e/src/security/scope-boundary.test.ts` |
| Tenant isolation | Journey 15 covers contacts and deals; Account 360 security smoke covers companies, contacts, deals, activities, notes, and tasks across SDK direct, SDK HTTP, raw API, MCP, and CLI API mode | Add tags/pipelines/stages/payments/contracts where a scenario requires them, schema metadata, and integration records | `e2e/src/security/tenant-graph-isolation.test.ts`, `e2e/src/security/cli-graph-isolation.test.ts` |
| MCP tenant boundary | Journey 15 covers get/update/delete/search by beta ID for contacts/deals; Business Journey 7 covers Lead Qualification MCP business search/create with a Beta trap | Cover all registered MCP tools that can read/write tenant data and HTTP MCP auth/scope behavior | `e2e/src/business-journeys/07-agent-qa-smoke.test.ts`, future `e2e/src/security/mcp-boundary.test.ts` |
| Secret redaction | Integration config journeys verify basic status redaction; focused smoke checks Gmail, Calendar, and Stripe credential sentinels across configure/status stdout and stderr | Add MCP/API redaction cases when connector read surfaces expose credential-adjacent records | `e2e/src/security/redaction.test.ts` |
| Idempotency | API unit tests cover conflict behavior; fake integration scenario proves Gmail, Calendar, and Stripe replay returns the same record without duplicate writes | Add HTTP idempotency-key task replay if needed | `packages/demo-seed/src/scenarios/integration-events.test.ts`, `e2e/src/business-journeys/06-integration-event-simulation.test.ts` |
| Payload size | API middleware/unit coverage exists; E2E rejects oversized note payload with `PAYLOAD_TOO_LARGE` | Add import/activity payload variants if those paths gain special parsing | `e2e/src/security/payload-limit.test.ts` |
| Rate limiting | API unit tests cover limit behavior; E2E exhausts the default per-key limiter and asserts `RATE_LIMITED` | A low-limit `createApi` test option is not currently exposed | `e2e/src/security/rate-limit.test.ts` |
| Webhook SSRF | API route rejects private targets | Prove webhook create rejects localhost, loopback, link-local metadata, private IPs, and IPv4-mapped loopback | `e2e/src/security/webhook-ssrf.test.ts` |
| SQLite tenant warning | Docs warn SQLite has no RLS | Business docs must not present SQLite as multi-tenant production-safe | Docs review checklist |
| Postgres RLS | Current e2e does not prove restricted-role RLS | Deferred unless a restricted-role Postgres harness exists | Follow-up plan |
| Migration safety | Journey 8 is stub passthrough only | Deferred to Plan C.5; do not claim destructive migration safety until real engine lands | Existing Plan C.5 |

## High-Risk Abuse Stories

### Cross-Tenant Record ID Guessing

An Acme-bound client receives or guesses a Beta record ID and tries to read,
update, delete, search, relate, tag, or export it.

**Required result:** every surface returns `RESOURCE_NOT_FOUND` or an equivalent
non-disclosing error, and the Beta record remains unchanged.

### Scope Downgrade Bypass

A key with `contacts:read` tries to mutate contacts, read deals, invoke MCP
write tools, or run business workflows that indirectly mutate tasks.

**Required result:** operations fail with `AUTH_INSUFFICIENT_SCOPE`; no partial
write occurs.

### Integration Credential Disclosure

A user configures Gmail/Calendar/Stripe credentials and then calls status,
export, MCP tools, dashboard summaries, logs, or error paths.

**Required result:** raw secrets never appear in structured responses or text
tool output.

### Replay / Duplicate Event

The same fake Gmail, Calendar, or Stripe event is delivered more than once.

**Required result:** the same idempotency key or event ID cannot create duplicate
activities, meetings, payments, or tasks.

### Generated UI Data Leak

A future demo UI asks an agent for business summaries while the server holds
multiple tenants.

**Required result:** generated UI payloads contain only current-tenant records,
and every clickable/actionable record ID belongs to the current tenant.

## Phase-One Security Acceptance Criteria

- Business Journey 1 runs with Acme and Beta seeded and asserts the Beta tenant
  does not produce Lead Qualification scenario answers. Dedicated security files
  cover the broader Account 360 graph.
- Business journeys include cross-tenant trap records by default.
- At least one security E2E file verifies Account 360 graph tenant isolation
  beyond contacts/deals.
- Redaction assertions cover CLI connector configure/status outputs.
- Scope-boundary tests include read-only, wrong-entity, create, update, and delete API-key smokes.
- Deferred controls are explicitly listed in docs and not described as complete.

## First-Slice Finding

SDK HTTP task creation currently rejects ISO `due_date` strings because the API
deserializes snake_case keys but does not coerce date strings to `Date` before
core validation. The first business journey avoids due dates for the task write
and records date coercion as a follow-up. This is a correctness and API
ergonomics issue, not a proven tenant boundary issue.

**2026-05-25 update:** API and SDK direct deserializers now coerce known public
date/time input fields before core validation. Business Journey 2 verifies SDK
HTTP task creation with ISO `due_date` and SDK direct read-back.

## Account 360 Graph Isolation Update

**2026-05-26 update:** `e2e/src/security/tenant-graph-isolation.test.ts`
creates the Account 360 scenario in Beta and verifies Acme-bound SDK direct, SDK
HTTP, raw API, and MCP `get_record` calls cannot read Beta company, contact,
deal, activity, note, or task IDs. `e2e/src/security/cli-graph-isolation.test.ts`
adds CLI API-mode coverage for those same graph IDs. Tags, pipelines/stages,
schema metadata, integration records, and restricted-role Postgres RLS remain
deferred.

## Scope Boundary Update

**2026-05-26 update:** `e2e/src/security/scope-boundary.test.ts` builds an
Acme stack with a `contacts:read` API key. The test verifies contact reads are
allowed while contact creation, contact update, contact delete, deal listing,
and task creation fail with `AUTH_INSUFFICIENT_SCOPE`. Broader multi-scope cases
remain deferred.

## Coverage Closure Update

**2026-05-26 update:** The SQLite coverage closure added:

- `e2e/src/security/auth-boundary.test.ts` for missing/invalid API keys.
- `e2e/src/security/cli-graph-isolation.test.ts` for Acme CLI API-mode denial of
  Beta Account 360 graph IDs.
- `e2e/src/security/redaction.test.ts` for Gmail, Google Calendar, and Stripe
  credential sentinel redaction in CLI configure/status stdout and stderr.
- `e2e/src/security/payload-limit.test.ts` for `PAYLOAD_TOO_LARGE`.
- `e2e/src/security/rate-limit.test.ts` for default per-key `RATE_LIMITED`.
- `e2e/src/security/webhook-ssrf.test.ts` for private, loopback, link-local
  metadata, and IPv4-mapped loopback webhook destinations.
- `e2e/src/business-journeys/06-integration-event-simulation.test.ts` for fake
  provider event idempotency.

MCP stdio wire coverage remains deferred because `packages/mcp/package.json` has
no `bin` entry and `packages/cli/src/commands/mcp.ts` still throws
`DEPENDENCY_NOT_AVAILABLE` for `orbit mcp serve`. Restricted-role Postgres/RLS
proof remains outside this SQLite-only gate.

## MCP Agent Q&A Update

**2026-05-26 update:** `e2e/src/business-journeys/07-agent-qa-smoke.test.ts`
uses the Lead Qualification scenario to prove an MCP-first business path:
Acme-scoped MCP `search_records` derives the qualified lead answer,
`list_activities` grounds the hot email leads, `create_record` persists a
follow-up task, and a Beta tenant trap is excluded from Acme MCP results. This
does not cover MCP stdio process startup, natural-language planning, or HTTP MCP
auth/scope behavior.
