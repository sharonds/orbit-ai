# Orbit AI

> **CRM infrastructure for AI agents and developers.** Packages, not a product.
> (Think: "Resend for CRM" — type-safe primitives, not a UI.)

**Status**: pre-alpha. First npm release (`0.1.0-alpha`) targets `@orbit-ai/core`,
`@orbit-ai/api`, and `@orbit-ai/sdk`. CLI, MCP server, and integrations (Gmail,
Google Calendar, Stripe) are next.

## What's in this repo today

| Package | Status | Purpose |
|---|---|---|
| [`@orbit-ai/core`](packages/core) | ✅ alpha | Schema engine, entities, storage adapters (SQLite, Postgres, Supabase, Neon), tenant context, migrations |
| [`@orbit-ai/api`](packages/api) | ✅ alpha | Hono-based REST API with auth, scope enforcement, idempotency, rate limiting, sanitization |
| [`@orbit-ai/sdk`](packages/sdk) | ✅ alpha | TypeScript client with HTTP and direct-core transports, auto-pagination, type-safe resources |

## What's coming next (not in this release)

- `@orbit-ai/cli` — `orbit init`, CRUD commands, `--json` mode, schema tooling
- `@orbit-ai/integrations` — Gmail, Google Calendar, Stripe connectors
- `@orbit-ai/mcp` — Model Context Protocol server with 23 core tools
- A reference web app built on the SDK

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

## Installation (when published)

```bash
pnpm add @orbit-ai/sdk
# or for the server-side packages:
pnpm add @orbit-ai/core @orbit-ai/api
```

> **Note**: the packages have not yet been published to npm. Until the `0.1.0-alpha`
> release, the only way to try Orbit AI is to clone this repo and run it from source
> with `pnpm install && pnpm -r build`.

## Architecture

Orbit AI is a monorepo (pnpm + Turborepo) with three layered packages:

```
┌─────────────────┐   ┌─────────────────┐
│  @orbit-ai/api  │   │  @orbit-ai/sdk  │
│   (REST server) │   │ (client lib)    │
└────────┬────────┘   └────────┬────────┘
         │                     │
         │   depends on        │
         └──────────┬──────────┘
                    │
           ┌────────▼─────────┐
           │  @orbit-ai/core  │
           │  (schema + adp.) │
           └──────────────────┘
```

- **core** is the source of truth for schema, entities, storage adapters, tenant
  isolation, and migrations. It has no network or HTTP dependencies.
- **api** is a Hono-based REST server that wraps core with auth, scopes, idempotency,
  rate limiting, and sanitization. It exposes `/v1/*` routes.
- **sdk** is a TypeScript client that can talk to an api server over HTTP, or run
  in-process directly against a core adapter (DirectTransport) for tests and trusted
  server-side use.

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
- The full list of known alpha gaps lives in
  [`docs/review/2026-04-08-post-stack-audit.md`](docs/review/2026-04-08-post-stack-audit.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](LICENSE).

## Key planning docs

- [`docs/META-PLAN.md`](docs/META-PLAN.md) — master plan
- [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — execution baseline
- [`docs/product/release-definition-v1.md`](docs/product/release-definition-v1.md) — what v1 GA requires
- [`docs/specs/01-core.md`](docs/specs/01-core.md) through [`06-integrations.md`](docs/specs/06-integrations.md) — per-component specs
- [`docs/review/2026-04-08-post-stack-audit.md`](docs/review/2026-04-08-post-stack-audit.md) — post-stack audit (alpha readiness)
