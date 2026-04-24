# Orbit AI

> CRM infrastructure for AI agents and developers. Type-safe entities, a REST API,
> TypeScript SDK, CLI, MCP server, starter scaffolder, and integration connectors
> that you deploy alongside your own application.

**Status:** `0.1.0-alpha.0`. Orbit AI is public alpha software. The core CRUD
paths, SDK/API basics, CLI package, MCP package, integrations package, starter
scaffolder, and demo seed package exist, but several advanced routes and workflows
are intentionally incomplete. The packages are not yet published to npm; install
from source until the first public npm release lands.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/sharonds/orbit-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/sharonds/orbit-ai/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![MCP](https://img.shields.io/badge/MCP-server-111827)](packages/mcp)

## What is Orbit AI?

Orbit AI is an open-source CRM foundation for agent-native software. It gives your
application a consistent model for contacts, companies, deals, pipelines, tasks,
notes, products, payments, contracts, sequences, tags, imports, and webhooks.

It is **not** a hosted CRM product and it is **not** a UI. Orbit AI is a set of
packages you run in your own stack:

- Use the **REST API** when another service or language needs CRM access over HTTP.
- Use the **TypeScript SDK** when writing server-side TypeScript.
- Use the **MCP server** when Claude, Cursor, Copilot, or another MCP host needs
  agent tools for CRM records.
- Use the **CLI** for scripts, local workflows, and operational tasks.
- Use the **starter scaffolder** when you want a runnable Orbit-backed app shell.
- Use the **core package** directly in trusted server-side code when you want
  in-process access with no network boundary.

## Features

- **Type-safe CRM entities** - shared schemas, IDs, validation, pagination, and
  error contracts across all surfaces.
- **Multi-surface access** - REST API, SDK, CLI, MCP tools, and direct core
  transport all use the same entity model.
- **Multi-tenant foundations** - organization-scoped services, tenant guards, and
  Postgres Row Level Security policies for defense in depth.
- **Storage adapters** - SQLite for local development and tests; Postgres-family
  adapters for production deployments.
- **Authentication and scopes** - bearer API keys, per-organization context, and
  scoped access such as `contacts:read` or `*`.
- **Agent-ready MCP server** - 23 built-in tools, stdio and HTTP transports, and
  output redaction/truncation helpers.
- **Schema metadata and custom fields** - schema inspection and custom-field
  surfaces are present, while migration execution remains an alpha workstream.
- **Operational protections** - structured errors, request IDs, idempotency,
  rate limiting, payload limits, and explicit alpha limitations.
- **Integration connectors** - Gmail, Google Calendar, and Stripe connectors for
  common CRM-adjacent workflows.
- **Starter scaffolding** - `@orbit-ai/create-orbit-app` creates a starter backed
  by the demo seed.
- **Deterministic demo data** - multi-tenant seed data for examples, tests, and
  starter applications.

## How It Works

Orbit AI keeps the domain model in `@orbit-ai/core` and exposes it through several
thin surfaces:

```text
                         MCP hosts / agents
                              |
                              v
                       @orbit-ai/mcp
                              |
SDK clients ---> @orbit-ai/api <--- CLI scripts
     |                |
     |                v
     +--------> @orbit-ai/core <--- starter apps
                     |
          +----------+----------+
          |                     |
       SQLite              Postgres
   local dev/tests    production + RLS
```

The API and MCP HTTP transport authenticate every request with a bearer API key.
The SDK can either call the API over HTTP or use `DirectTransport` in trusted
server-side contexts. `DirectTransport` bypasses auth, rate limiting, and scope
enforcement, so it should only be used inside code you control.

## Choose a Surface

| Surface | Use when |
|---|---|
| [`@orbit-ai/mcp`](packages/mcp) | You are connecting an MCP host or coding agent to CRM tools |
| [`@orbit-ai/sdk`](packages/sdk) | You are writing trusted server-side TypeScript |
| [`@orbit-ai/api`](packages/api) | You need REST/JSON access from any language or service |
| [`@orbit-ai/cli`](packages/cli) | You are scripting from a terminal or operating a local deployment |
| [`@orbit-ai/create-orbit-app`](packages/create-orbit-app) | You want a starter project scaffolded quickly |
| [`@orbit-ai/core`](packages/core) | You need direct in-process services and adapters in code you control |

## Packages

| Package | Purpose |
|---|---|
| [`@orbit-ai/core`](packages/core) | Schema engine, entities, storage adapters, tenant context, migrations |
| [`@orbit-ai/api`](packages/api) | Hono REST API with auth, scopes, idempotency, rate limiting, sanitization |
| [`@orbit-ai/sdk`](packages/sdk) | TypeScript client with HTTP mode, DirectTransport, and auto-pagination |
| [`@orbit-ai/cli`](packages/cli) | Terminal interface for setup, CRUD commands, schema tooling, and JSON output |
| [`@orbit-ai/mcp`](packages/mcp) | Model Context Protocol server with stdio and HTTP transports |
| [`@orbit-ai/integrations`](packages/integrations) | Gmail, Google Calendar, and Stripe connectors |
| [`@orbit-ai/demo-seed`](packages/demo-seed) | Deterministic multi-tenant demo data |
| [`@orbit-ai/create-orbit-app`](packages/create-orbit-app) | Starter scaffolder for new Orbit-backed apps |

## Quick Start

Orbit AI is not yet on npm. Use the source checkout for now.

```bash
# 1. Clone
git clone https://github.com/sharonds/orbit-ai.git
cd orbit-ai

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm -r build

# 4. Run tests
pnpm -r test

# 5. Run the Node.js quickstart
cd examples/nodejs-quickstart
pnpm start
```

Requires **Node.js 22+** and **pnpm 9+**. The SQLite adapter uses `node:sqlite`,
which is only available in modern Node versions.

## Surface Quick Starts

### SDK over HTTP

Use this when you have a running Orbit API server:

```typescript
import { OrbitClient } from '@orbit-ai/sdk'

const client = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY!,
  baseUrl: process.env.ORBIT_API_BASE_URL!,
})

const contacts = await client.contacts.list({ limit: 25 })
console.log(contacts.data)
```

### SDK DirectTransport

Use this only inside trusted server-side code, tests, and local scripts:

```typescript
import { OrbitClient } from '@orbit-ai/sdk'
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  initializeAllSqliteSchemas,
} from '@orbit-ai/core'

const database = createSqliteOrbitDatabase()
await initializeAllSqliteSchemas(database)

const client = new OrbitClient({
  adapter: createSqliteStorageAdapter({ database }),
  context: { orgId: 'org_demo' },
})

await client.contacts.create({ name: 'Ada Lovelace' })
```

### API Server

Create a Hono app with `@orbit-ai/api` and serve it from your runtime of choice:

```typescript
import { createApi } from '@orbit-ai/api/node'
import {
  createCoreServices,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  initializeAllSqliteSchemas,
} from '@orbit-ai/core'

const database = createSqliteOrbitDatabase()
await initializeAllSqliteSchemas(database)

const adapter = createSqliteStorageAdapter({ database })
const services = createCoreServices(adapter)

export const app = createApi({
  adapter,
  services,
  version: '2026-04-01',
})
```

See [`packages/api`](packages/api) for a full adapter setup example.

### MCP Server

Start the MCP server programmatically with `@orbit-ai/mcp`:

```typescript
import { OrbitClient } from '@orbit-ai/sdk'
import { startMcpServer } from '@orbit-ai/mcp'

// Reuse the application adapter from your API or DirectTransport setup.
await startMcpServer({
  client: new OrbitClient({ adapter, context: { orgId: 'org_demo' } }),
  transport: 'stdio',
})
```

Use HTTP transport when your app needs a remote or multi-tenant MCP endpoint.
The `orbit mcp serve` CLI command is reserved but not wired in this alpha. See
[`packages/mcp`](packages/mcp) for transport setup and the full tool list.

## SDK Example

```typescript
import { OrbitClient } from '@orbit-ai/sdk'

const client = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY!,
  baseUrl: 'https://api.yourapp.com',
})

const contact = await client.contacts.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
})

await client.activities.create({
  contactId: contact.id,
  type: 'email',
  subject: 'Introduction',
  body: 'Sent intro email.',
})

for await (const item of client.contacts.pages({ limit: 100 }).autoPaginate()) {
  console.log(item.id, item.name)
}
```

## API Authentication

HTTP surfaces use standard bearer authentication plus an explicit API version:

```http
Authorization: Bearer <api-key>
Orbit-Version: 2026-04-01
```

API keys are organization-scoped. Keys can have `*` access or narrower scopes such
as `contacts:read`, `contacts:write`, or other entity-specific scopes.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.9, strict mode |
| Runtime | Node.js 22+ |
| Workspace | pnpm, Turborepo |
| API | Hono, Zod |
| SDK | TypeScript client, async pagination helpers |
| MCP | `@modelcontextprotocol/sdk`, stdio and HTTP transports |
| CLI | Commander, Ink, React |
| Starter | Clack prompts, execa |
| Database | SQLite via `node:sqlite`, Postgres via `pg` |
| Schema/data | Zod, Drizzle ORM, drizzle-zod, ULID |
| Integrations | Google APIs, Google Auth Library, Stripe |
| Testing | Vitest, `node:test`, launch-gate E2E tests |
| Release | Changesets, pinned GitHub Actions, npm provenance support |

## Project Structure

```text
orbit-ai/
|-- packages/
|   |-- core/              # Entity schemas, services, adapters, tenant guards
|   |-- api/               # REST server, middleware, routes, OpenAPI generation
|   |-- sdk/               # TypeScript SDK and transport layer
|   |-- cli/               # Command-line interface
|   |-- mcp/               # MCP server, tools, resources, transports
|   |-- integrations/      # Gmail, Google Calendar, Stripe connectors
|   |-- demo-seed/         # Deterministic demo data
|   `-- create-orbit-app/  # Starter scaffolder
|-- examples/
|   `-- nodejs-quickstart/
|-- e2e/                   # Cross-surface launch-gate journeys
|-- docs/
|   `-- security/          # Security architecture and hardening notes
|-- scripts/               # Release and package artifact verification
|-- AGENTS.MD              # Agent/developer operating guide
|-- llms.txt               # Compact machine-readable project index
|-- SECURITY.md            # Vulnerability reporting and security model
`-- CONTRIBUTING.md        # Contributor workflow and code style
```

## Agent & MCP Integration

Orbit AI is built for agent workflows:

- [`AGENTS.MD`](AGENTS.MD) gives coding agents the project model, auth contract,
  common workflows, error codes, and alpha limitations.
- [`llms.txt`](llms.txt) provides a compact machine-readable index.
- [`@orbit-ai/mcp`](packages/mcp) exposes 23 tools for contacts, companies, deals,
  pipelines, activities, tasks, notes, schema operations, imports, and more.
- The REST API and SDK use structured errors so agents can recover from validation,
  auth, rate-limit, and not-found failures predictably.

## Development

```bash
# Build all packages
pnpm -r build

# Typecheck
pnpm -r typecheck

# Lint
pnpm -r lint

# Test all packages
pnpm -r test

# Verify release workflow logic
pnpm test:release-workflow

# Run a release dry run
pnpm release:dry-run
```

## Security

See [`SECURITY.md`](SECURITY.md) for vulnerability reporting and
[`docs/security/`](docs/security) for security architecture and database hardening.

Important alpha notes:

- API keys are currently SHA-256 hashed before storage. HMAC-SHA256 with a
  server-side pepper is planned for v1.
- Idempotency and rate limiting stores are in-memory by default and are suitable
  for single-instance deployments only.
- SQLite has no database-level RLS. Do not use SQLite for multi-tenant production.
- `DirectTransport` is for trusted server-side code only because it bypasses HTTP
  auth, scope checks, and rate limiting.
- Batch mutation route types exist, but batch write implementation is not complete.

## Disclaimer

Orbit AI is alpha infrastructure software. You are responsible for deploying it
securely, managing API keys, configuring production databases, and validating that
the authorization model fits your application. Do not expose SQLite-backed
multi-tenant deployments to production traffic.

## Contributing

Issues and pull requests are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md)
before opening a PR.

High-level expectations:

- Use pnpm, not npm or yarn.
- Keep PRs focused on one concern.
- Add tests for non-trivial behavior changes.
- Run build, typecheck, lint, and tests before requesting review.
- Report security issues privately through GitHub Private Vulnerability Reporting.

## Sponsorship

If Orbit AI is useful in your work, you can support development through
[GitHub Sponsors](https://github.com/sponsors/sharonds). Sponsorship helps fund
maintenance, security hardening, docs, and release work.

## License

[MIT](LICENSE)

## Acknowledgments

Built with [TypeScript](https://www.typescriptlang.org), [Hono](https://hono.dev),
[Zod](https://zod.dev), [Drizzle ORM](https://orm.drizzle.team),
[Vitest](https://vitest.dev), [Turborepo](https://turbo.build/repo), and the
[Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk).
