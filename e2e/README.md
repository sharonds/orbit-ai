# @orbit-ai/e2e

End-to-end journey tests for Orbit AI. This package is the publish gate for `0.1.0-alpha.1`: all 16 journeys must pass before any package is released to npm. Tests exercise the full surface — SDK, API, CLI, MCP, and integrations — against a live SQLite adapter so no external services are required by default. A Postgres subset runs when `DATABASE_URL` is set.

## Journeys

| # | Journey | Surfaces covered |
|---|---------|-----------------|
| 1 | `orbit init` scaffolds config files | CLI |
| 2 | Configure adapter + working local context | CLI, SQLite direct |
| 3 | CRUD contacts | SDK HTTP, SDK direct, raw API, CLI, MCP |
| 4 | CRUD companies | SDK HTTP, SDK direct, raw API, CLI, MCP |
| 5 | CRUD deals | SDK HTTP, SDK direct, raw API, CLI, MCP |
| 6 | Move a deal between pipeline stages | SDK HTTP write + SDK direct read |
| 7 | Inspect schema + add a custom field safely | CLI (`schema list`, `fields create`) |
| 8 | Migration preview/apply destructive custom-field delete safety | API HTTP, SDK HTTP, SDK direct, CLI direct, MCP exclusion |
| 9 | SDK in HTTP mode (auth, pagination, typed errors) | SDK HTTP |
| 10 | SDK in direct-core mode (in-process, shared error semantics) | SDK direct |
| 11 | MCP server + core tool flows | MCP JSON-RPC in-process transport; all listed core tools invoked |
| 12 | Configure Gmail connector | CLI `integrations gmail configure/status` |
| 13 | Configure Google Calendar connector | CLI `integrations google-calendar configure/status` |
| 14 | Configure Stripe connector | CLI `integrations stripe configure/status` |
| 15 | Tenant isolation for contacts and deals | SDK HTTP, SDK direct, raw API, CLI API mode, MCP |
| 16 | Custom-field rename migration semantics | SDK direct |

## Running

```bash
# Build workspace packages first; the CLI journeys execute packages/cli/dist/index.js.
pnpm -r build

# Run all journeys (SQLite, no extra env vars needed)
pnpm -F @orbit-ai/e2e test

# Watch mode during development
pnpm -F @orbit-ai/e2e test:watch

# Type-check without emitting
pnpm -F @orbit-ai/e2e typecheck
```

Business journeys live under `e2e/src/business-journeys/` and currently run on
SQLite only:

```bash
# Build changed workspace packages first; e2e imports package dist output.
pnpm -F @orbit-ai/demo-seed build

# Run the first business/demo gate journey.
pnpm -F @orbit-ai/e2e test -- src/business-journeys/01-lead-qualification.test.ts

# Run the stalled pipeline business journey.
pnpm -F @orbit-ai/e2e test -- src/business-journeys/02-stalled-pipeline.test.ts

# Run the account 360 business journey.
pnpm -F @orbit-ai/e2e test -- src/business-journeys/03-account-360.test.ts

# Run the renewal/expansion business journey.
pnpm -F @orbit-ai/e2e test -- src/business-journeys/04-renewal-expansion.test.ts

# Run the CLI business-surface smoke.
pnpm -F @orbit-ai/e2e test -- src/business-journeys/05-cli-business-surface.test.ts

# Run the fake integration event simulation journey.
pnpm -F @orbit-ai/e2e test -- src/business-journeys/06-integration-event-simulation.test.ts

# Run the MCP agent Q&A smoke.
pnpm -F @orbit-ai/e2e test -- src/business-journeys/07-agent-qa-smoke.test.ts

# Run the focused tenant graph isolation security journey.
pnpm -F @orbit-ai/e2e test -- src/security/tenant-graph-isolation.test.ts

# Run focused business security smokes.
pnpm -F @orbit-ai/e2e test -- src/security/auth-boundary.test.ts src/security/scope-boundary.test.ts src/security/cli-graph-isolation.test.ts
pnpm -F @orbit-ai/e2e test -- src/security/redaction.test.ts src/security/payload-limit.test.ts src/security/rate-limit.test.ts src/security/webhook-ssrf.test.ts

# Run all business journeys currently implemented.
pnpm -F @orbit-ai/e2e test -- src/business-journeys
```

## Environment

- **Node 22+** required (`node:sqlite` is used by the SQLite adapter)
- **`DATABASE_URL`** (optional) — set to a safe local Postgres connection string to run the Postgres-backed subset of journeys. The Postgres gate is valid only with runtime adapter proof and a passing CI Postgres matrix.
- No other external services are required

## Honest Coverage Notes

- Journeys 3–5 include read-after-update assertions for CRUD parity.
- Journey 8 verifies destructive custom-field delete preview/apply behavior, non-rollbackable apply output, and MCP exclusion. Postgres coverage runs in the CI subset when `DATABASE_URL` is set.
- Journey 16 verifies rollbackable custom-field rename migration semantics.
- Journey 11 does not cover MCP stdio wire behavior.
- Journey 15 covers contacts and deals only; focused security files cover the
  Account 360 graph across additional entities. Restricted-role Postgres RLS
  proof is deferred.
- DirectTransport custom-field delete is covered by Journey 8; lower-level Plan C.5 tests cover additional destructive field update/delete paths.
- Connector journeys persist and redact Gmail, Google Calendar, and Stripe credentials only; they do not prove live provider dispatch.
- Business Journey 1 proves the deterministic Lead Qualification scenario
  through SDK direct answers, SDK HTTP contact reads, SDK HTTP task creation,
  SDK direct task verification, and a Beta tenant exclusion check.
- API and SDK direct deserializers coerce known public date/time input fields
  before core validation. Business Journey 2 verifies SDK HTTP task creation
  with an ISO `due_date` and SDK direct read-back.
- Business Journey 2 proves the deterministic Stalled Pipeline scenario through
  SDK direct answers, SDK HTTP deal reads, SDK HTTP deal movement, SDK HTTP task
  creation with ISO `due_date`, SDK direct verification, and a Beta tenant
  exclusion check.
- Business Journey 3 proves the deterministic Account 360 scenario through SDK
  direct graph answers, SDK HTTP graph reads, raw API company fetch, MCP
  `get_record`/`search_records`, SDK HTTP task creation, SDK direct
  verification, and Beta tenant exclusion.
- `e2e/src/security/tenant-graph-isolation.test.ts` expands tenant isolation
  beyond contacts/deals for the Account 360 graph across SDK direct, SDK HTTP,
  raw API, and MCP. `e2e/src/security/cli-graph-isolation.test.ts` covers CLI
  API-mode graph reads. Restricted-role Postgres RLS remains a separate
  follow-up.
- Business Journey 4 proves the deterministic Renewal/Expansion scenario through
  SDK direct answers, SDK HTTP reads, raw API deal fetch, MCP read/search, SDK
  HTTP task creation, SDK direct verification, and Beta tenant exclusion.
- Business Journey 5 proves representative business records are fetchable
  through CLI API mode without rebuilding the full CRUD matrix.
- Business Journey 6 proves deterministic fake Gmail, Google Calendar, and
  Stripe event application and idempotent replay using SQLite only. It does not
  call live providers.
- Business Journey 7 proves a first MCP agent-style Q&A path over Lead
  Qualification using `search_records`, `list_activities`, and `create_record`.
  It verifies the MCP-derived answer against the deterministic expected answer,
  persists a follow-up task, and excludes Beta tenant records. It does not prove
  natural-language planning or MCP stdio wire startup.
- `e2e/src/security/scope-boundary.test.ts` proves a `contacts:read` key can
  read contacts but cannot create, update, or delete contacts, list deals, or
  create tasks.
- `e2e/src/security/auth-boundary.test.ts` proves missing and invalid API keys
  fail with `AUTH_INVALID_API_KEY`.
- `e2e/src/security/cli-graph-isolation.test.ts` proves Acme CLI API mode cannot
  fetch Beta Account 360 company, contact, deal, activity, note, or task IDs.
- `e2e/src/security/redaction.test.ts` proves connector credential sentinels do
  not leak in CLI configure/status stdout or stderr.
- `e2e/src/security/payload-limit.test.ts`, `rate-limit.test.ts`, and
  `webhook-ssrf.test.ts` cover oversized body rejection, default per-key rate
  limiting, and webhook private-address rejection.
- npm Trusted Publishing, Dependabot, and `pnpm audit` gating remain deferred per Plan B follow-ups.
