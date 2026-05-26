# Orbit AI Security E2E Matrix

**Date:** 2026-05-24
**Status:** Proposed expansion; Account 360 graph isolation and API scope smokes implemented

## Purpose

The current alpha E2E suite includes authentication, scoped access, structured
errors, and tenant isolation for contacts/deals. The business E2E milestone
should expand that into a security-focused matrix that proves realistic CRM
journeys cannot cross tenant, scope, credential, or transport boundaries.

## Matrix

| Control | Current coverage | Phase-one E2E target | Evidence artifact |
|---|---|---|---|
| API key required | SDK HTTP and API journeys authenticate with test key | Add missing/invalid/revoked/expired key cases against business journeys | `e2e/src/security/auth-boundary.test.ts` |
| Scope enforcement | Unit/API middleware coverage exists; API scope smoke proves `contacts:read` can read contacts but cannot create contacts, list deals, or create tasks | Add update/delete cases and broader notes/deals/tasks scopes | `e2e/src/security/scope-boundary.test.ts` |
| Tenant isolation | Journey 15 covers contacts and deals; Account 360 security smoke covers companies, contacts, deals, activities, notes, and tasks across SDK direct, SDK HTTP, raw API, and MCP | Add CLI graph isolation, tags/pipelines/stages/payments/contracts where implemented, schema metadata, and integration records | `e2e/src/security/tenant-graph-isolation.test.ts` |
| MCP tenant boundary | Journey 15 covers get/update/delete/search by beta ID for contacts/deals | Cover business tool flows and all registered MCP tools that can read/write tenant data | `e2e/src/security/mcp-boundary.test.ts` |
| Secret redaction | Integration config journeys verify status redaction | Assert no access tokens, refresh tokens, API keys, bearer tokens, or credential sentinels appear in CLI/MCP/API outputs | `e2e/src/security/redaction.test.ts` |
| Idempotency | API unit tests cover conflict behavior | Replay fake integration events and task creation requests; assert no duplicate activities/tasks/payments | `e2e/src/security/idempotency-business.test.ts` |
| Payload size | API middleware/unit coverage exists | Prove oversized import/activity/note payload fails with `PAYLOAD_TOO_LARGE` and does not partially write | `e2e/src/security/payload-limit.test.ts` |
| Rate limiting | API unit tests cover limit behavior | Add focused API-level e2e with low test limit; do not run in business journey hot path | `e2e/src/security/rate-limit.test.ts` |
| Webhook SSRF | Mentioned as local/direct protection | Prove webhook create/update rejects localhost, link-local, private IPs, and metadata endpoints | `e2e/src/security/webhook-ssrf.test.ts` |
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
  does not produce Lead Qualification scenario answers. Broader graph isolation
  remains in the dedicated security follow-up.
- Business journeys include cross-tenant trap records by default.
- At least one security E2E file verifies Account 360 graph tenant isolation
  beyond contacts/deals.
- Redaction assertions cover CLI, MCP, and API/SDK-visible outputs.
- Scope-boundary tests include a read-only/wrong-entity API key smoke.
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
deal, activity, note, or task IDs. CLI graph isolation, tags, pipelines/stages,
schema metadata, integration records, and restricted-role Postgres RLS remain
deferred.

## Scope Boundary Update

**2026-05-26 update:** `e2e/src/security/scope-boundary.test.ts` builds an
Acme stack with a `contacts:read` API key. The test verifies contact reads are
allowed while contact creation, deal listing, and task creation fail with
`AUTH_INSUFFICIENT_SCOPE`. Broader update/delete and multi-scope cases remain
deferred.
