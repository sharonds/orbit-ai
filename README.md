# Orbit AI

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![npm](https://img.shields.io/badge/npm-%40orbit--ai-red)](https://www.npmjs.com/org/orbit-ai)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange)](./docs/strategy/orbit-ai-prd.md)

**CRM infrastructure for AI agents and developers.**

Not a CRM application — the primitives to build your own.

---

## What Is Orbit AI

Orbit AI is what Resend is to email: infrastructure. Resend did not build a better email client — they built email primitives that developers and agents control programmatically. Orbit AI does the same for customer relationship management.

The problem every business application eventually faces: you need contacts, deals, pipeline management, and payment tracking. Your options today are:

1. Build it from scratch — weeks of work, no migration safety, no agent support
2. Integrate HubSpot or Salesforce — expensive, bloated, enterprise-first, not designed for programmatic use
3. Use a no-code tool like Airtable — breaks at scale, no real security model

Orbit AI is option 4: `npm install @orbit-ai/sdk` and get a type-safe, agent-manageable CRM schema with CLI, REST API, SDK, and MCP server in under 5 minutes.

---

## Interfaces

Orbit AI exposes four parallel interfaces. Every operation is available through all four.

### CLI

```bash
# Initialize a new CRM project
orbit init --db supabase

# Schema management
orbit schema
orbit schema add-field contacts company_size int
orbit schema add-entity invoices
orbit migrate --preview
orbit migrate --apply

# Data operations
orbit contacts create --name "Acme Corp" --email "ceo@acme.com"
orbit deals list --stage negotiation --sort value
orbit pipeline view

# Agent mode — every command outputs structured JSON
orbit --json contacts list
orbit --json schema describe
orbit --json migrate --preview
```

### SDK

```typescript
import { OrbitClient } from '@orbit-ai/sdk'

const crm = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY,
  // or connect directly to your database:
  // database: process.env.DATABASE_URL,
})

// Create a contact
const contact = await crm.contacts.create({
  name: 'Jane Doe',
  email: 'jane@acme.com',
  customFields: { company_size: 50 }
})

// Move a deal through the pipeline
await crm.deals.move(dealId, { stage: 'negotiation' })

// Extend the schema from code
await crm.schema.addField('contacts', {
  name: 'preferred_contact_method',
  type: 'text',
  nullable: true
})
// Generates migration SQL, updates RLS policies, regenerates TypeScript types

// Multi-tenant: pass context from your auth provider
const session = await clerk.getSession()
const tenantCrm = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY,
  context: { userId: session.userId, orgId: session.orgId }
})
```

### REST API

```
POST   /v1/contacts
GET    /v1/contacts/:id
PATCH  /v1/contacts/:id
DELETE /v1/contacts/:id

GET    /v1/contacts?filter[stage]=active&sort=-created_at&cursor=xxx&limit=50
GET    /v1/pipeline?period=week

POST   /v1/deals
PATCH  /v1/deals/:id/stage

POST   /v1/schema/fields       { entity: "contacts", name: "company_size", type: "int" }
POST   /v1/schema/migrate      { preview: true }
POST   /v1/schema/migrate      { apply: true }

POST   /v1/webhooks            { url: "...", events: ["contact.created", "deal.moved"] }
```

All responses follow a consistent format. OpenAPI 3.1 spec is auto-generated from the schema.

### MCP Server

```
# Configure in your agent (Claude Code, Cursor, etc.)
{
  "mcpServers": {
    "orbit": {
      "command": "npx",
      "args": ["-y", "@orbit-ai/mcp"],
      "env": { "ORBIT_API_KEY": "sk_..." }
    }
  }
}
```

Available MCP tools:

```
orbit.contacts.create / list / get / update / delete
orbit.companies.create / list / get / update / delete
orbit.deals.create / move / list / get / update / delete
orbit.pipeline.view / configure
orbit.activities.log / list
orbit.schema.describe / addField / addEntity / migrate
orbit.analytics.summary / funnel
```

---

## Why Orbit AI

### Agent-Safe Schema Evolution

This is the core differentiator. When an agent modifies your CRM schema:

```bash
orbit schema add-field contacts wedding_date date --nullable
```

The engine validates the change, generates migration SQL, updates RLS policies, regenerates TypeScript types, updates REST and MCP endpoints, and previews the diff before applying — all in a single command. Agents cannot `DROP` or rename columns without an explicit `--destructive` flag. On Neon, branch-before-migrate is automatic.

No other CRM tool gives agents safe, programmatic schema evolution with rollback.

### Lightweight Primitives, Not a Heavy Framework

Orbit AI uses Drizzle ORM (7.4KB) and Hono (14KB). The stack runs on Node, Bun, Deno, Edge Workers, and serverless functions. No Docker required. No Redis required. No Meilisearch required.

Compare to Open Mercato (the closest architectural competitor): Docker + Node 24 + Postgres + Redis + Meilisearch is required infrastructure just to start. Orbit AI requires only Postgres — which Supabase and Neon provide in one click.

### Truly Open Source

MIT license. Not AGPL like Twenty CRM. You can embed Orbit AI in a commercial SaaS product without licensing concerns. The entire core (schema engine, CLI, SDK, API, MCP server) is open source and self-hostable.

### Built for the Agent Era

Every command has `--json` output. Every operation is idempotent. Every mutation accepts a `--dry-run` flag. `AGENTS.MD` files per entity tell Claude Code, Cursor, and other agents exactly what schema they're working with, what fields exist, and what operations are available — without the agent needing to hallucinate.

The hosted MCP endpoint (`mcp.orbit-ai.dev/your-project`) lets remote agents connect to your CRM without running a local process.

---

## Base Schema

Out of the box, every Orbit AI project includes:

```
contacts        companies       deals
pipelines       products        payments
contracts       activities      channels
sequences       tags            notes
```

Every entity supports custom fields via JSONB (promotable to real columns), multi-tenant scoping, and auto-generated RLS policies.

---

## Storage Adapters

| Adapter | Status | Notes |
|---------|--------|-------|
| Supabase | MVP | RLS + auth integration, most popular with vibe coders |
| Neon | MVP | Branch-before-migrate support |
| SQLite | MVP | Zero-config local development |
| Raw Postgres | v1.1 | Any managed Postgres provider |

---

## Pricing

| Tier | Price | What You Get |
|------|-------|-------------|
| Community | Free forever | Full open-source stack, unlimited records, self-hosted |
| Pro | $29/month | Managed hosting, hosted MCP endpoint, 25K records, 100K API calls |
| Scale | $99/month | Automations, analytics, 250K records, 1M API calls |
| Enterprise | Custom | Dedicated infra, SLA, on-prem, migration assistance |

No per-seat pricing. One project, one price.

---

## Roadmap

### Phase 0 — Foundation (current)
- Monorepo setup, `@orbit-ai/core` package skeleton
- Drizzle schema definitions for all 12 base entities
- SQLite adapter for local development

### Phase 1 — Schema Engine
- `orbit schema` CLI commands
- Agent-safe migration pipeline (generate → preview → apply → rollback)
- Auto-generated TypeScript types
- Auto-generated RLS policies

### Phase 2 — Data Layer
- Supabase and Neon adapters
- Full CRUD via SDK (`@orbit-ai/sdk`)
- REST API via Hono (`@orbit-ai/api`)
- OpenAPI 3.1 spec generation

### Phase 3 — MCP Server
- `@orbit-ai/mcp` package
- 20+ domain-specific tools
- stdio transport for local agents
- HTTP transport for remote agents

### Phase 4 — CLI + DX
- Full `orbit` CLI (contacts, deals, pipeline, migrate, seed, status)
- `create-orbit-app` scaffolder
- `AGENTS.MD` generation per entity
- `orbit doctor` for debugging setup

### Phase 5 — Hosted Platform
- `orbit-ai.dev` managed hosting
- Usage-based billing via Stripe
- Hosted MCP endpoint
- Stripe Projects provider integration

### Phase 6 — Ecosystem
- `@orbit-ai/workflows` — state machine engine for deal/contract lifecycle
- `@orbit-ai/inbox` — email → LLM → structured CRM proposal → approval
- `@orbit-ai/react` — json-render CRM component catalog
- Field-level encryption (Enterprise)

---

## Repository Structure

```
orbit-ai/
├── packages/
│   ├── core/          # Schema engine, entities, adapters (@orbit-ai/core)
│   ├── sdk/           # TypeScript SDK (@orbit-ai/sdk)
│   ├── api/           # Hono REST API server (@orbit-ai/api)
│   ├── mcp/           # MCP server (@orbit-ai/mcp)
│   └── cli/           # CLI tool (orbit)
├── apps/
│   └── docs/          # Documentation site
├── examples/
│   ├── nextjs-crm/    # Next.js app built with Orbit AI SDK
│   └── agent-workflow/ # Agent-driven CRM automation example
├── docs/
│   ├── strategy/      # ARD and PRD
│   └── research/      # Competitive analysis
└── AGENTS.MD          # Machine-readable project description for LLMs
```

---

## Documentation

- [Product Requirements Document](./docs/strategy/orbit-ai-prd.md) — vision, features, pricing, GTM
- [Architecture Research Document](./docs/strategy/orbit-ai-ard.md) — technical decisions, competitive analysis, schema design
- [Competitive Analysis](./docs/research/competitive-analysis.md) — Open Mercato, Twenty, Attio, Resend, Stripe Projects

---

## Contributing

This project is pre-alpha. The repository is private while the foundation is being built. Contribution guidelines will be published when the project reaches public alpha.

---

## License

MIT — see [LICENSE](./LICENSE).
