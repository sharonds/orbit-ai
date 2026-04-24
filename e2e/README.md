# @orbit-ai/e2e

End-to-end journey tests for Orbit AI. This package is the publish gate for `0.1.0-alpha.1`: all 14 journeys must pass before any package is released to npm. Tests exercise the full surface — SDK, API, CLI, MCP, and integrations — against a live SQLite adapter so no external services are required by default. A Postgres subset runs when `DATABASE_URL` is set.

## Journeys

| # | Journey | Spec ref |
|---|---------|----------|
| 1 | Contact CRUD via SDK | v2 §1 |
| 2 | Company CRUD via SDK | v2 §2 |
| 3 | Deal lifecycle (open → won) | v2 §3 |
| 4 | Pipeline stage ordering | v2 §4 |
| 5 | Activity log and retrieval | v2 §5 |
| 6 | Tag attach / detach / filter | v2 §6 |
| 7 | Note create and list | v2 §7 |
| 8 | Sequence enroll and step | v2 §8 |
| 9 | Payment record and lookup | v2 §9 |
| 10 | Contract create and sign | v2 §10 |
| 11 | Channel create and list | v2 §11 |
| 12 | Product catalog CRUD | v2 §12 |
| 13 | Demo-seed idempotent load | v2 §13 |
| 14 | Multi-tenant isolation (org_id boundary) | v2 §14 |

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
