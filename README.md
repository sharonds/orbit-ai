# Orbit AI

> **CRM infrastructure for AI agents and developers.** Packages, not a product.
> (Think: "Resend for CRM" — type-safe primitives, not a UI.)

**Status**: `0.1.0-alpha`. All eight public packages are implemented and tested. The first npm release is cut through the Changesets release workflow; before that release lands, install from source (see [Development](#development)).

## Packages

| Package | Status | Purpose |
|---|---|---|
| [`@orbit-ai/core`](packages/core) | ✅ alpha | Schema engine, entities, storage adapters (SQLite, Postgres, Supabase, Neon), tenant context, migrations |
| [`@orbit-ai/api`](packages/api) | ✅ alpha | Hono-based REST API with auth, scope enforcement, idempotency, rate limiting, sanitization |
| [`@orbit-ai/sdk`](packages/sdk) | ✅ alpha | TypeScript client with HTTP and direct-core transports, auto-pagination, type-safe resources |
| [`@orbit-ai/cli`](packages/cli) | ✅ alpha | Terminal interface — `orbit init`, CRUD commands, schema tooling, `--json` mode, direct and API mode |
| [`@orbit-ai/mcp`](packages/mcp) | ✅ alpha | Model Context Protocol server with 23 core tools, stdio and HTTP transports |
| [`@orbit-ai/integrations`](packages/integrations) | ✅ alpha | Gmail, Google Calendar, and Stripe connectors with OAuth lifecycle and webhook support |
| [`@orbit-ai/demo-seed`](packages/demo-seed) | ✅ alpha | Deterministic multi-tenant demo data for local testing and examples |
| [`@orbit-ai/create-orbit-app`](packages/create-orbit-app) | ✅ alpha | Starter scaffolder — `npx @orbit-ai/create-orbit-app@alpha my-app` |

## Quick look

```typescript
import { OrbitClient } from '@orbit-ai/sdk'

const client = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY!,
  baseUrl: 'https://api.orbit-ai.example.com',
})

// Happy path: list the first page of contacts
const page = await client.contacts.list({ limit: 10 })
console.log(page.data) // Contact[]

// Multi-page iteration
for await (const contact of client.contacts.pages({ limit: 50 }).autoPaginate()) {
  console.log(contact.id, contact.name)
}

// Create
const contact = await client.contacts.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
})
```

A runnable example lives at [`examples/nodejs-quickstart`](examples/nodejs-quickstart).

## Installation

```bash
pnpm add @orbit-ai/sdk
# or for the server-side packages:
pnpm add @orbit-ai/core @orbit-ai/api
```

> **Pre-publish note**: until the first `0.1.0-alpha` npm release is cut, clone this
> repo and run Orbit AI from source with `pnpm install && pnpm -r build`.

## Architecture

Orbit AI is a monorepo (pnpm + Turborepo) with eight public packages:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  @orbit-ai/api   │  │  @orbit-ai/sdk   │  │  @orbit-ai/cli   │
│  (REST server)   │  │  (client lib)    │  │  (terminal)      │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         └─────────────────────┼──────────────────────┘
                               │  depends on
                    ┌──────────▼──────────┐
                    │   @orbit-ai/core    │
                    │  (schema + adpts.)  │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                                         │
┌─────────▼──────────┐              ┌───────────────▼──────┐
│  @orbit-ai/mcp     │              │ @orbit-ai/integrations│
│  (MCP server,      │              │ (Gmail, Calendar,     │
│   23 tools)        │              │  Stripe)              │
└────────────────────┘              └──────────────────────┘
```

- **core** is the source of truth for schema, entities, storage adapters, tenant
  isolation, and migrations. It has no network or HTTP dependencies.
- **api** is a Hono-based REST server that wraps core with auth, scopes, idempotency,
  rate limiting, and sanitization. It exposes `/v1/*` routes.
- **sdk** is a TypeScript client that can talk to an api server over HTTP, or run
  in-process directly against a core adapter (DirectTransport) for tests and trusted
  server-side use.
- **cli** is a terminal interface built on Commander.js with interactive prompts,
  `--json` mode for scripting, and support for both API and direct modes.
- **mcp** is a Model Context Protocol server exposing 23 tools over stdio or HTTP.
- **integrations** provides Gmail, Google Calendar, and Stripe connectors with full
  OAuth lifecycle management and webhook support.
- **demo-seed** provides deterministic multi-tenant demo data for local testing and
  examples.
- **create-orbit-app** scaffolds a runnable starter backed by the demo seed.

## Development

```bash
# Install deps (pnpm required — never use npm or yarn in this repo)
pnpm install

# Build all packages
pnpm -r build

# Run all tests (vitest)
pnpm -r test

# Typecheck + lint
pnpm -r typecheck
pnpm -r lint

# Run the quickstart example
cd examples/nodejs-quickstart && pnpm start
```

Requires **Node.js 22+** (the SQLite adapter uses `node:sqlite`).

## Supported storage adapters

| Adapter | Status | Notes |
|---|---|---|
| SQLite (`node:sqlite`) | ✅ | Local dev + tests. Not for production tenant isolation. |
| Postgres (raw `pg`) | ✅ | Production target. RLS policies shipped. |
| Supabase | ✅ | Via the Postgres adapter + RLS. |
| Neon | ✅ | Via the Postgres adapter + branching. |

## Security

See [`SECURITY.md`](SECURITY.md) for vulnerability disclosure, and
[`docs/security/`](docs/security) for the threat model and database hardening
checklist.

**Quick notes for alpha users:**
- API keys are hashed with SHA-256 before storage. HMAC-SHA256 + server pepper is
  planned for v1 GA.
- Multi-tenant isolation is enforced in two layers: application-level `orgId` filtering
  in every repository + Postgres RLS policies for Postgres-family adapters. SQLite has
  no RLS — application-layer filtering only.
- Idempotency and rate limiting are **in-memory by default** — single-instance deployments
  only. For multi-instance, implement the `IdempotencyStore` interface and pass it via
  `CreateApiOptions`.
- The full list of known alpha gaps is documented in [`AGENTS.md`](AGENTS.md#known-alpha-limitations).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](LICENSE).

## What's next

- **npm publish** — `0.1.0-alpha.1` will be the first public npm release. Until then, install from source: `pnpm install && pnpm -r build`.
- **Hosted tier** — a managed Orbit AI API endpoint (beta) is planned alongside the npm release.
- **E2E test suite** — cross-surface journey tests and multi-tenant denial tests are in progress.
- **Documentation site** — a full docs site is planned post-publish.
