# @orbit-ai/e2e

End-to-end journey tests for Orbit AI. This package is the publish gate for `0.1.0-alpha.1`: all 14 journeys must pass before any package is released to npm. Tests exercise the full surface — SDK, API, CLI, MCP, and integrations — against a live SQLite adapter so no external services are required by default. A Postgres subset runs when `DATABASE_URL` is set.

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
| 8 | Preview + apply a reversible migration | CLI (`migrate --preview`, `migrate --apply`) |
| 9 | SDK in HTTP mode (auth, pagination, typed errors) | SDK HTTP |
| 10 | SDK in direct-core mode (in-process, shared error semantics) | SDK direct |
| 11 | MCP server + core tool flows | MCP JSON-RPC (search/create/update/delete) |
| 12 | Configure Gmail connector | CLI `integrations gmail configure/status` |
| 13 | Configure Google Calendar connector | CLI `integrations google-calendar configure/status` |
| 14 | Configure Stripe connector | CLI `integrations stripe configure/status` |

## Running

```bash
# Run all journeys (SQLite, no extra env vars needed)
pnpm -F @orbit-ai/e2e test

# Watch mode during development
pnpm -F @orbit-ai/e2e test:watch

# Type-check without emitting
pnpm -F @orbit-ai/e2e typecheck
```

## Environment

- **Node 22+** required (`node:sqlite` is used by the SQLite adapter)
- **`DATABASE_URL`** (optional) — set to a Postgres connection string to run the Postgres-backed subset of journeys
- No other external services are required
