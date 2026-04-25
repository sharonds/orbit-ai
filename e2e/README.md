# @orbit-ai/e2e

End-to-end journey tests for Orbit AI. This package is the publish gate for `0.1.0-alpha.1`: all 15 journeys must pass before any package is released to npm. Tests exercise the full surface — SDK, API, CLI, MCP, and integrations — against a live SQLite adapter so no external services are required by default. A Postgres subset runs when `DATABASE_URL` is set.

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
| 8 | Migration preview/apply alpha stub passthrough; not a migration-safety gate | CLI (`migrate --preview`, `migrate --apply`) |
| 9 | SDK in HTTP mode (auth, pagination, typed errors) | SDK HTTP |
| 10 | SDK in direct-core mode (in-process, shared error semantics) | SDK direct |
| 11 | MCP server + core tool flows | MCP JSON-RPC in-process transport; all listed core tools invoked |
| 12 | Configure Gmail connector | CLI `integrations gmail configure/status` |
| 13 | Configure Google Calendar connector | CLI `integrations google-calendar configure/status` |
| 14 | Configure Stripe connector | CLI `integrations stripe configure/status` |
| 15 | Tenant isolation for contacts and deals | SDK HTTP, SDK direct, raw API, CLI API mode, MCP |

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

## Environment

- **Node 22+** required (`node:sqlite` is used by the SQLite adapter)
- **`DATABASE_URL`** (optional) — set to a safe local Postgres connection string to run the Postgres-backed subset of journeys. The Postgres gate is valid only with runtime adapter proof and a passing CI Postgres matrix.
- No other external services are required

## Honest Coverage Notes

- Journeys 3–5 include read-after-update assertions for CRUD parity.
- Journey 8 only verifies current alpha stub passthrough behavior. Real migration safety is deferred to Plan C.5.
- Journey 11 does not cover MCP stdio wire behavior.
- Journey 15 covers contacts and deals only. Broader entity isolation and restricted-role Postgres RLS proof are deferred.
- DirectTransport custom-field `PATCH`/`DELETE` remains deferred until Plan C.5 implements `engine.updateField` and `engine.deleteField`.
- Connector journeys persist and redact Gmail, Google Calendar, and Stripe credentials only; they do not prove live provider dispatch.
- npm Trusted Publishing, Dependabot, and `pnpm audit` gating remain deferred per Plan B follow-ups.
