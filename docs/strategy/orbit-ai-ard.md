# Orbit AI — Architecture Research Document (ARD)

*Date: March 28, 2026*
*Status: Draft — Brainstorm Phase*

---

## 1. Executive Summary

Orbit AI is **CRM infrastructure for AI agents and developers** — not a CRM application. It provides the schema, API, CLI, SDK, and MCP server that let agents and developers build, manage, and extend their own CRM from the terminal.

The analogy: **Resend is to email what Orbit AI is to CRM.** Resend didn't build a better email client — they built email infrastructure that developers and agents control programmatically. Orbit AI does the same for customer relationship management.

The product is a response to three converging market shifts:
1. **Developer infrastructure going agent-native** (Resend MCP, Stripe Projects, Vercel MCP)
2. **Vibe coding becoming mainstream** (Karpathy's MenuGen, 150K+ devs on Resend, Bolt/Lovable/v0)
3. **CRM incumbents stagnating** (HubSpot/Salesforce = the SendGrid/Mailgun of CRM)

---

## 2. Market Research & Competitive Landscape

### 2.1 The Resend Precedent

Resend (founded 2022) proved the playbook:
- **Open-source wedge first**: React Email (12K+ GitHub stars) before the commercial product
- **API-first, CLI-first**: 53-command CLI with JSON output mode for agents, MCP server shipped natively
- **Superior DX over legacy**: "5 minutes to first email" vs SendGrid's multi-step verification
- **Small team, massive leverage**: 6 people serving 150K+ developers, $21M raised
- **Paul Graham: "The Stripe for Email"**

Key business metrics:
- Free tier: 3,000 emails/month (generous enough to build real things)
- Pro: $20/month for 50K emails
- 150K+ developers on platform
- React Email: community + trust before revenue

### 2.2 Stripe Projects — The Distribution Channel

Stripe Projects (launched March 26, 2026) lets agents provision entire application stacks from CLI:
```bash
stripe projects add vercel/project      # hosting
stripe projects add neon/database       # Postgres
stripe projects add clerk/auth          # authentication
stripe projects add posthog/analytics   # analytics
```

**CRM is missing from this ecosystem.** Current providers: Vercel, Neon, Supabase, Clerk, PostHog, Railway, PlanetScale, Turso, Chroma, Runloop. No CRM.

Key architectural insight from Stripe Projects:
- Resources live in YOUR accounts (not Stripe-managed)
- Credentials auto-written to `.env`
- Non-interactive flags (`--json`, `--no-interactive`) designed for agent consumption
- **Shared Payment Tokens** — agents can upgrade plans through constrained, revocable tokens (co-developed with OpenAI as part of Agentic Commerce Protocol)

**Opportunity**: `stripe projects add orbit/crm` provisions a Postgres schema, API key, webhook endpoint — one command.

### 2.3 json-render — UI as Runtime Output

Vercel Labs' json-render (27 packages) is a generative UI framework:
- Agent generates JSON spec → framework renders it as UI
- Same spec renders to: React, Terminal (Ink), React Native, PDF, Video, 3D
- Flat JSON format optimized for LLM generation
- Type-safe via Zod schemas
- Streaming support for progressive rendering
- Pre-built shadcn catalog (36 components)

**For Orbit AI**: An agent asks "show me my pipeline" → json-render produces a Kanban board in the terminal. Or in a browser. Or in a mobile app. The CRM component catalog (Pipeline, Contact Card, Deal Timeline, Activity Feed, Dashboard) becomes a json-render registry.

### 2.4 Competitive Landscape

| Product | Stars | Funding | Model | Gap vs Orbit AI |
|---------|-------|---------|-------|-----------------|
| **Twenty CRM** | 43K | $5.5M | Open-source Salesforce alternative | Product, not infrastructure. You use it, not build on it. |
| **Attio** | — | $52M | Modern CRM with API + MCP | Closed-source, €29-119/seat. Product, not primitive. |
| **Open Mercato** | 1.1K | — | CRM/ERP framework, Next.js + MCP | Closest architecturally. Heavy framework (Docker+Redis+Meilisearch), not lightweight primitives. See §2.7. |
| **Clay** | — | Large | Data enrichment platform | $185+/mo, no free tier. Upstream of CRM, not CRM itself. |
| **NocoDB** | 62K | — | Open-source Airtable | Generic database UI. No CRM domain logic. |
| **Unified.to** | — | — | Unified CRM API layer | Wraps existing CRMs. Middleware, not a primitive. |
| **HubSpot** | — | Public | Enterprise CRM | MCP server shipped June 2025. Bloated, expensive, stagnant DX. |
| **Salesforce** | — | Public | Enterprise CRM | Agentforce 3.0 bolted on. Decades of tech debt. |

**Key finding: The "Resend of CRM" category doesn't exist yet.** Nobody says `npm install @orbit-ai/core` and gets contacts, deals, pipelines as composable primitives.

### 2.5 The Karpathy Pain Point

Andrej Karpathy documented the vibe coding wall in his MenuGen blog post:

> "Vibe coding menugen was exhilarating and fun... but a bit of a painful slog as a deployed, real app. Building a modern app is like assembling IKEA furniture. There are all these services, docs, API keys, configurations..."

The pain is: **agents can write code but can't navigate dashboards, create accounts, or configure services.** Stripe Projects solves provisioning. Orbit AI solves the CRM-specific domain layer that every business app eventually needs.

### 2.6 Agent-Native Design Patterns (from Research)

Products designed for AI agent consumption share these patterns:
- **Structured JSON output** on all CLI commands (not just human-readable)
- **Idempotency keys** on mutating operations
- **MCP server** as a first-class interface
- **Schema introspection** endpoints
- **Dry-run / preview modes** for destructive operations
- **Non-interactive flags** (`--json`, `--auto-confirm`)

Products with native MCP servers (as of March 2026): Supabase, Vercel, Stripe, Resend, Neon, Cloudflare, Upstash, Sentry, Linear, Attio, HubSpot, Salesforce. **5,800+ MCP servers exist, 97M+ monthly SDK downloads.**

### 2.7 Open Mercato — Deep Competitive Analysis

Open Mercato is the **closest architectural competitor** and deserves a deep section. Founded by Piotr Karwatka (built Vue Storefront → Y Combinator → Alokai $40M Series A) and Tomasz Karwatka (Callstack, core React Native contributor). Experienced founders, not amateurs.

**What it is**: Open-source, self-hosted CRM/ERP/Commerce application framework. ~1,100 GitHub stars, 5 months old, MIT license, v0.4.9 (March 2026). Tagline: "Start with 80% done."

#### Tech Stack

| Layer | Their Choice | Our Choice | Analysis |
|-------|-------------|------------|----------|
| Frontend | Next.js App Router | N/A (headless) | Same base |
| ORM | MikroORM (Unit of Work, Identity Map) | Drizzle (SQL-first, 7KB) | MikroORM = enterprise OOP patterns, 150-300KB. Drizzle = lightweight, agent-friendly. See §5.1. |
| DI | Awilix (per-request scoped containers) | None needed | Awilix injects tenant context per request. Elegant but framework-heavy. Our SDK handles this at the client level. |
| Database | PostgreSQL + pgvector | PostgreSQL (Supabase/Neon) | Same base. They add Meilisearch + ChromaDB. |
| Search | Meilisearch (fulltext + vector hybrid) | Postgres tsvector (MVP) | Their search is more sophisticated but adds infrastructure dependency. |
| Validation | Zod | Zod | Same. |
| Caching | Redis | None (MVP) | Redis adds ops overhead. We start without it. |
| Monitoring | New Relic | Vercel Observability | Their monitoring requires self-hosted setup. |
| Package manager | Yarn 4 | pnpm | Both valid. pnpm is more common in Turborepo monorepos. |

**Why they chose MikroORM over Prisma/Drizzle**: Unit of Work pattern batches writes into single transactions automatically. Per-module entity discovery (`@Entity()` decorators auto-discovered per module path). However: 150-300KB runtime, requires Node.js (no Edge/serverless), decorator-heavy API that agents find harder to generate than Drizzle's plain TS functions.

**Why they chose Awilix**: Per-request DI containers inject `currentTenant`, `currentUser`, `currentOrg` as services automatically. Modules can override core services via `di.ts` without forking. This is elegant but adds framework complexity — our SDK handles multi-tenancy at the client level without DI overhead.

#### Module Inventory (35 active modules)

**Infrastructure** (12 modules): Auth & accounts, directory (tenants/orgs), custom entities & fields, config, query indexes, audit logs, attachments (with OCR), API keys, feature toggles, shared dictionaries, table perspectives, admin dashboards.

**Business Domain** (8 modules): CRM (people, companies, deals, activities), product catalog, sales management (quoting, ordering, fulfillment), business rules engine, workflow engine (v1.0!), currencies, employees, resource planning.

**Communication** (10 modules): Messages, notifications, webhooks (Standard Webhooks-compliant), integrations, data sync, events, scheduler, progress tracking, search, entity translations.

**AI** (2 modules): AI Assistant (MCP server with 4 tools), InboxOps (email → LLM → structured proposal → human approval).

**Commerce** (3 modules): Payment gateways, checkout (pay links, templates), Stripe integration, shipping carriers.

#### Their MCP Integration (Assessment: Moderate Depth)

4 MCP tools only:
- `discover_schema` — searches entity schemas via Meilisearch hybrid (fulltext + vector)
- `find_api` — finds API endpoints via natural language
- `call_api` — executes any API call with tenant context
- `context_whoami` — returns auth context

**Notably missing**: No workflow triggers, no analytics queries, no bulk operations, no streaming/events, no schema modification tools. Compare to our planned 20+ domain-specific MCP tools.

**AGENTS.MD concept** (worth adopting): Every module ships a machine-readable `AGENTS.MD` documenting entities, APIs, and business rules in LLM-optimized format. Feeds the MCP discovery tools. Also helps Claude Code/Cursor generate compliant code without hallucinating APIs.

#### What They Do Exceptionally Well

1. **Architecture discipline** — OCP overlay system (extend without forking core), per-request Awilix DI, Unit of Work via MikroORM. Production-grade patterns.
2. **35 modules in 5 months** — Impressive surface area. Workflow Engine at v1.0.0 while everything else is v0.1.0.
3. **InboxOps** — Forward email → LLM extracts structured data → proposes action (create deal, update order) → human approves. Practical agentic AI.
4. **Field-level encryption per tenant** — AES-GCM, per-tenant DEKs from Vault/KMS, ORM lifecycle hooks. Enterprise-grade.
5. **OCP overlay architecture** — `npx create-mercato-app` scaffolds your app as a thin overlay on `@open-mercato/core`. Core updates via `npm update` without merge conflicts. Module eject (`--eject`) for full ownership.

#### What They Do Poorly (Our Opportunities)

1. **No cloud/SaaS offering** — Must self-host Docker + Node 24 + Postgres + Redis + Meilisearch. High bar for SMBs and vibe coders.
2. **No SaaS billing layer** — Has Stripe for collecting payments FROM customers, but no subscription/trial/plan enforcement for building SaaS ON TOP of it.
3. **v0.1.0 on 30/35 modules** — Nothing production-ready. 230 open issues. RBAC bugs: admins can't create messages (#1042), org scope ignored for non-admin (#1112).
4. **Custom fields limited** — Date/datetime fields still a feature request (#1087). For a CRM, this is a gap.
5. **MCP is shallow** — 4 generic tools vs our planned 20+ domain-specific. Can query and call APIs but can't orchestrate business processes.
6. **Demo is largely locked** — Superadmin disabled, credentials hidden. Bad evaluation experience.
7. **Docs are thin** — Navigation shells without content. Architecture deep-dives not yet written.
8. **Heavy runtime** — MikroORM (~150-300KB) + Redis + Meilisearch + Docker Compose. Not portable to Edge/serverless.
9. **Community tiny** — 1,100 stars, ~12 contributors. Not enough for a framework ecosystem.

#### The Fundamental Strategic Difference

**Open Mercato = Framework** (Ruby on Rails model — clone, extend, live inside it)
**Orbit AI = Infrastructure** (Stripe SDK model — composable primitives, use in YOUR stack)

They say: "Here's 80% of an ERP. Build the last 20%."
We say: "Here are CRM primitives. Compose them however you want."

They target: Developer teams building internal tools / custom ERP systems.
We target: Vibe coders, SaaS builders, AI agents — anyone who needs CRM in 5 minutes.

### 2.8 Lessons From Open Mercato (What We Should Adopt)

| Pattern | What They Did | How We Adapt It |
|---------|-------------|-----------------|
| **AGENTS.MD per module** | Machine-readable docs for every module — entities, APIs, business rules in LLM-optimized format | Ship `AGENTS.MD` for each entity/feature. Helps Claude Code / Cursor generate correct SDK usage. Include in `@orbit-ai/mcp` for tool discovery. |
| **InboxOps (email → CRM agent)** | Email forwarding → LLM extracts structured data → proposes action → human approves | Add as `@orbit-ai/inbox` package (v1.1). We already have Gmail scan infra in current Orbit CRM. Pattern: email → extract → propose → approve. |
| **Workflow / State Machine Engine** | State machines for document/process lifecycles. v1.0.0 — their most mature module. | Add `@orbit-ai/workflows` package (v1.1). State machine for: deal lifecycle, contract approval, lead nurturing, custom flows. Agent can define transitions via CLI/MCP. |
| **OCP Overlay Architecture** | `@open-mercato/core` as npm package. Apps are thin overlays. `npm update` for core updates. Module eject for full ownership. | Our SDK architecture naturally achieves this. `@orbit-ai/core` is a package you install, not a repo you fork. Schema customization via SDK/CLI, not by editing source. |
| **Field-level Encryption** | Per-tenant DEKs, AES-GCM in ORM lifecycle hooks, deterministic hashing for lookups | Add to Enterprise tier (v2). Use Drizzle middleware hooks for encrypt/decrypt. Per-org encryption keys stored in KMS. |
| **Audit with Undo Scaffolding** | Command pattern — every mutation logged with before/after, undo capability | Enhance our planned audit logging to include before/after JSON diffs. Enable `orbit activity undo <id>` in CLI. Expose via MCP as `activity.undo`. |
| **Standard Webhooks** | Uses standardwebhooks.com spec for webhook delivery (signatures, retries, event types) | Adopt Standard Webhooks spec from day one. Production-proven format. Includes HMAC signatures and idempotency. |

### 2.9 Drizzle vs MikroORM — Why Drizzle Wins for Our Use Case

| Dimension | MikroORM (their choice) | Drizzle (our choice) |
|-----------|------------------------|---------------------|
| **Bundle size** | ~150-300KB | **7.4KB** |
| **Agent schema generation** | Moderate (decorators, metadata classes) | **Excellent** (plain TS functions, SQL-like) |
| **Programmatic migration API** | Limited (CLI-based) | **Exported APIs** (`drizzle-kit/api` — `generateDrizzleJson`, `generateMigration`) |
| **Edge/serverless** | v7 added support (still heavyweight) | **Native** (Workers, Edge, Deno, Bun) |
| **Type inference** | Strong via `defineEntity()` | **Best-in-class** (zero codegen, inferred from schema) |
| **npm downloads** | 1.1M/week | **4.9M/week** (4.5x more) |
| **GitHub stars** | 8.8K | **33.4K** (3.8x more) |
| **Zod integration** | None built-in | **Built-in** (`createSelectSchema`, `createInsertSchema`) |
| **SQL transparency** | Abstracted (Unit of Work) | **Explicit** (SQL-like query syntax) |
| **Multi-tenancy** | Via Awilix DI injection | **Via RLS + org scoping** (simpler, proven) |

**Bottom line**: MikroORM is the right choice for Open Mercato's use case (enterprise framework with complex domain models). Drizzle is the right choice for ours (lightweight, agent-friendly, portable infrastructure primitives).

---

## 3. Product Architecture

### 3.1 Core Thesis

The product is NOT a CRM application. It is **CRM infrastructure** organized into four layers:

```
┌─────────────────────────────────────────────┐
│  INTERFACES (how you interact)              │
│  CLI · SDK · REST API · MCP Server          │
├─────────────────────────────────────────────┤
│  DOMAIN LAYER (CRM logic)                   │
│  Contacts · Companies · Deals · Pipelines   │
│  Products · Payments · Contracts · Channels │
│  Activities · Automations · Sequences       │
├─────────────────────────────────────────────┤
│  SCHEMA ENGINE (the moat)                   │
│  Type-safe migrations · Agent-safe DDL      │
│  RLS generation · Custom fields · Rollback  │
├─────────────────────────────────────────────┤
│  STORAGE ADAPTERS (your choice)             │
│  Supabase · Neon · Raw Postgres · SQLite    │
└─────────────────────────────────────────────┘
```

### 3.2 Interface Layer

Four parallel interfaces, all first-class:

#### CLI (`orbit`)
```bash
# Provisioning
orbit init --db supabase               # or --db neon, --db local
orbit init --from stripe-projects      # auto-detect Stripe Projects context

# Schema management
orbit schema                           # show current schema
orbit schema add-field contacts company_size int
orbit schema add-entity invoices       # generates table + RLS + types + API
orbit migrate --preview                # dry-run, show SQL
orbit migrate --apply                  # run migration
orbit migrate --rollback               # undo last migration

# Data operations
orbit contacts create --name "Acme Corp" --email "ceo@acme.com"
orbit deals list --stage negotiation --sort value
orbit pipeline view                    # renders TUI via json-render + Ink

# Agent mode
orbit --json contacts list             # structured output for agents
orbit --json schema describe           # full schema introspection
```

**Design principles** (learned from Resend CLI):
- Every command has `--json` output mode
- Idempotency keys on all mutations
- Interactive mode for humans, structured mode for agents
- Natural language date parsing ("last week", "next Monday")
- Dual auth: API key or OAuth

#### SDK (`@orbit-ai/sdk`)
```typescript
import { OrbitClient } from '@orbit-ai/sdk'

const crm = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY,
  // OR connect directly to your database:
  database: process.env.DATABASE_URL,
})

// Type-safe CRUD
const lead = await crm.contacts.create({
  name: 'Jane Doe',
  email: 'jane@acme.com',
  customFields: { company_size: 50 }
})

// Pipeline operations
await crm.deals.move(dealId, { stage: 'negotiation' })

// Schema operations (the magic)
await crm.schema.addField('contacts', {
  name: 'wedding_date',
  type: 'date',
  nullable: true
})
// ^ This generates migration, updates RLS, regenerates types
```

#### REST API
```
POST   /v1/contacts
GET    /v1/contacts/:id
PATCH  /v1/contacts/:id
DELETE /v1/contacts/:id
GET    /v1/contacts?filter[stage]=active&sort=-created_at

POST   /v1/deals
GET    /v1/pipeline?period=week
POST   /v1/schema/fields    { entity: "contacts", name: "company_size", type: "int" }
POST   /v1/schema/migrate   { preview: true }

# Webhooks
POST   /v1/webhooks         { url: "...", events: ["contact.created", "deal.moved"] }
```

#### MCP Server (`@orbit-ai/mcp`)
Exposes all operations as MCP tools:
- `orbit.contacts.create` / `list` / `get` / `update` / `delete`
- `orbit.deals.create` / `move` / `list`
- `orbit.pipeline.view` / `configure`
- `orbit.schema.describe` / `addField` / `addEntity` / `migrate`
- `orbit.activity.log` / `list`
- `orbit.automations.create` / `list` / `trigger`
- `orbit.analytics.summary` / `funnel`

**Transport modes** (like Resend's MCP): stdio (local) + HTTP (remote, with bearer auth)

### 3.3 Schema Engine — The Moat

This is what differentiates Orbit AI from "just another CRM." The schema engine allows **safe, agent-driven schema evolution**.

#### Base Schema (what you get out of the box)

```
contacts          companies         deals
─────────         ─────────         ─────────
id                id                id
name              name              title
email             domain            value
phone             industry          stage
source            size              probability
status            website           expected_close
company_id ──────→                  contact_id ──────→ contacts
tags              tags              company_id ──────→ companies
custom_fields     custom_fields     custom_fields
created_at        created_at        created_at

products          payments          contracts
─────────         ─────────         ─────────
id                id                id
name              amount            title
price             currency          content
currency          status            status
description       method            signed_at
active            deal_id ────────→ deal_id ──────→ deals
                  contact_id ─────→ contact_id ──→ contacts

activities        channels          automations
─────────         ─────────         ─────────
id                id                id
type              type (email,      name
subject           phone, sms,       trigger
body              whatsapp, etc.)   conditions
contact_id ─────→ config            actions
deal_id ────────→ connected_at      active
logged_at         status            last_run
```

Plus: `pipeline_stages`, `tags`, `sequences`, `sequence_steps`, `notes`, `files`

#### Agent-Safe Migration System

The core innovation. When an agent (or developer) modifies the schema:

```bash
orbit schema add-field contacts wedding_date date --nullable
```

The engine:
1. **Validates** — checks field name, type compatibility, no conflicts
2. **Generates migration SQL** — `ALTER TABLE contacts ADD COLUMN wedding_date DATE;`
3. **Updates RLS policies** — ensures new field is covered by existing row-level security
4. **Regenerates TypeScript types** — `Contact` type now includes `wedding_date?: Date`
5. **Updates API schema** — REST + MCP + SDK all expose the new field
6. **Previews** — shows diff before applying (dry-run by default for agents)
7. **Applies** — runs migration in transaction
8. **Records** — logs the migration for rollback capability

**Safety guardrails for agents:**
- **Non-destructive by default**: Agents can ADD columns/tables but cannot DROP or rename without explicit `--destructive` flag
- **Branch-before-migrate**: If using Neon, auto-creates a database branch, runs migration there, validates, then merges
- **Type checking**: Prevents incompatible type changes (e.g., string → int on populated column)
- **RLS auto-generation**: Every new table gets multi-tenant RLS automatically
- **Rollback**: Every migration has a reverse migration generated and stored
- **Approval gate**: In production mode, migrations require human confirmation

**This is unsolved in the market.** No existing tool offers agent-safe CRM schema evolution with automatic RLS, type generation, and rollback.

### 3.4 Storage Adapters

The schema engine abstracts over multiple Postgres providers:

| Adapter | Best For | Special Features |
|---------|---------|-----------------|
| **Supabase** | Full-stack (auth + storage + realtime) | Built-in auth, RLS native, realtime subscriptions, edge functions |
| **Neon** | Schema-heavy workflows | Branch-before-migrate, serverless scale-to-zero, copy-on-write |
| **Raw Postgres** | Self-hosted / existing infra | Maximum control, any managed Postgres |
| **SQLite** | Local dev / prototyping | Zero-config, instant startup, file-based |

```bash
orbit init --db supabase --project-ref zzmnmyxhkynbywnngess
orbit init --db neon --connection-string $NEON_URL
orbit init --db local                    # SQLite for dev
orbit init --db postgres --url $PG_URL   # any Postgres
```

### 3.5 UI Rendering Layer (Optional — Not the Product)

**Important**: UI is NOT the product. Orbit AI is headless infrastructure. UI is an optional convenience layer — like how Stripe has a Dashboard but the product is the API. Resend does NOT ship an email client. We do NOT ship a CRM application.

The UI layer exists in two forms:

#### Terminal UI (CLI output, not a dashboard)
```bash
orbit pipeline view          # pretty-prints pipeline as table/columns
orbit contacts list          # formatted table output
orbit status                 # health check with metrics summary
```

This is **CLI output formatting**, not a standalone TUI application. Uses Ink for rich terminal rendering when available. Falls back to plain text. json-render integration is a **Phase 3 nice-to-have** — the core product (CLI + SDK + API + MCP) ships and works without it.

**json-render risk note**: json-render is a Vercel Labs experimental project. Core Orbit AI must be fully functional without json-render. If json-render matures, we adopt it for richer CLI output and a component catalog. If it doesn't, plain Ink rendering suffices.

#### React Component Library (optional, for developers building UIs)
`@orbit-ai/react` provides composable components for developers who want to build their own CRM UI:
```tsx
import { PipelineBoard, ContactCard, DealTimeline } from '@orbit-ai/react'

// These are building blocks, not an app
// Developers compose them into their own UI
```

**What we do NOT ship**: No `orbit ui serve` (that would make us an app). No pre-built web dashboard. No hosted CRM interface. If developers want a full CRM UI, they build it with our SDK + React components — or use `create-orbit-app` which scaffolds a starter Next.js app (like `create-next-app` scaffolds a starter, not a product).

---

## 4. Technology Stack Decisions

### 4.1 Core Runtime

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Language** | TypeScript (strict) | Dominant in vibe coding ecosystem. Same language for SDK, CLI, API, and web UI. AI generates TS well. |
| **Runtime** | Node.js 22+ | Universal. Runs CLI, API server, and SDK. Bun as optional runtime. |
| **Package manager** | pnpm | Monorepo-friendly. Industry standard for multi-package repos. |
| **Monorepo tool** | Turborepo | Parallel builds, remote caching, Vercel-native. |

### 4.2 Database Layer

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **Primary database** | PostgreSQL | Industry standard. Supabase, Neon, and raw Postgres all speak it. RLS is native. JSON columns for custom fields. |
| **Schema definition** | Drizzle ORM | TypeScript-native schemas. Agent-friendly (agents write TS, not DSL). SQL-like query syntax. Built-in migration generation. Best positioned for agent-driven schema evolution. |
| **Migration engine** | Custom on Drizzle Kit | `drizzle-kit generate` for SQL diffs + custom safety layer (non-destructive-only mode, preview, rollback). |
| **Why not Prisma** | Prisma uses a custom DSL (`.prisma` files), not TypeScript. Agents must learn an extra language. Drizzle schemas are pure TS — agents already know it. |
| **Why not raw SQL** | Raw SQL migrations (current Orbit CRM pattern) work but lack type safety, auto-generation, and introspection that agents need. |

### 4.3 API Layer

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **API framework** | Hono | Ultra-lightweight, runs everywhere (Node, Bun, Cloudflare Workers, Vercel). OpenAPI spec generation built-in. Type-safe routes via Zod. |
| **Why not Next.js API routes** | Next.js is a frontend framework. The API should be framework-agnostic — deployable as standalone server, Vercel function, or embedded in any app. |
| **Why not Express** | Hono is lighter, faster, has native OpenAPI, and runs on edge. Express is legacy. |
| **API spec** | OpenAPI 3.1 (auto-generated from Hono + Zod) | Enables auto-generated SDKs, docs, and MCP tool definitions. |
| **Auth** | API keys (simple) + OAuth 2.0 (advanced) | API keys for quick start (like Resend). OAuth for team/org scenarios. |

### 4.4 CLI

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **CLI framework** | Commander.js + Ink | Commander for command parsing. Ink for rich terminal UI (React-based, json-render compatible). |
| **Output modes** | Human (pretty) + JSON (agent) | Every command supports `--json` flag. Follows Resend CLI pattern. |
| **Distribution** | npm (`npx @orbit-ai/cli`) + standalone binary | npm for JS ecosystem. Standalone via `pkg` or `bun build --compile` for non-JS users. |

### 4.5 MCP Server

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| **MCP implementation** | `@modelcontextprotocol/sdk` | Official Anthropic SDK. Standard compliance. |
| **Transport** | stdio + HTTP | stdio for local agents (Claude Code, Cursor). HTTP for remote/hosted. |
| **Tool generation** | Auto-generated from OpenAPI spec | Single source of truth: Hono routes → OpenAPI → MCP tools → SDK types. |

### 4.6 Monorepo Structure

```
orbit-ai/
├── packages/
│   ├── core/                  # Domain logic, schema engine, migration engine
│   │   ├── src/
│   │   │   ├── schema/        # Base schema definitions (Drizzle)
│   │   │   ├── engine/        # Migration engine, safety checks
│   │   │   ├── entities/      # Contact, Deal, Company, etc. logic
│   │   │   ├── adapters/      # Supabase, Neon, Postgres, SQLite
│   │   │   └── security/      # RLS generation, auth, permissions
│   │   └── package.json       # @orbit-ai/core
│   │
│   ├── api/                   # Hono REST API server
│   │   ├── src/
│   │   │   ├── routes/        # /v1/contacts, /v1/deals, etc.
│   │   │   ├── middleware/    # Auth, rate limiting, logging
│   │   │   └── openapi/      # Auto-generated spec
│   │   └── package.json       # @orbit-ai/api
│   │
│   ├── sdk/                   # TypeScript SDK
│   │   ├── src/
│   │   │   ├── client.ts      # OrbitClient
│   │   │   ├── resources/     # contacts, deals, pipeline, schema
│   │   │   └── types/         # Auto-generated from core schema
│   │   └── package.json       # @orbit-ai/sdk
│   │
│   ├── cli/                   # CLI tool
│   │   ├── src/
│   │   │   ├── commands/      # init, schema, contacts, deals, migrate, tui
│   │   │   ├── tui/           # Ink components for terminal UI
│   │   │   └── output/        # Human + JSON formatters
│   │   └── package.json       # @orbit-ai/cli (bin: orbit)
│   │
│   ├── mcp/                   # MCP server
│   │   ├── src/
│   │   │   ├── tools/         # Auto-generated from OpenAPI
│   │   │   ├── server.ts      # stdio + HTTP transport
│   │   │   └── auth.ts        # API key + OAuth
│   │   └── package.json       # @orbit-ai/mcp
│   │
│   ├── react/                 # React component library (json-render catalog)
│   │   ├── src/
│   │   │   ├── components/    # Pipeline, ContactCard, DealTimeline, etc.
│   │   │   ├── catalog.ts     # json-render component catalog
│   │   │   └── registry.ts    # json-render React registry
│   │   └── package.json       # @orbit-ai/react
│   │
│   └── create-orbit/          # Project scaffolder
│       ├── src/
│       │   └── index.ts       # npx create-orbit-app
│       └── package.json       # create-orbit-app
│
├── apps/
│   ├── docs/                  # Documentation site (Mintlify or Fumadocs)
│   ├── web/                   # Marketing site + hosted dashboard (optional)
│   └── playground/            # Interactive schema explorer
│
├── examples/
│   ├── nextjs-crm/            # Full CRM built with Orbit AI + Next.js
│   ├── agent-workflow/        # Claude Code managing a CRM via MCP
│   └── stripe-integration/    # CRM + Stripe Billing + Payments
│
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 5. Key Architectural Decisions

### 5.1 Drizzle Over Prisma for Schema-as-Code

**Decision**: Use Drizzle ORM as the schema definition layer.

**Reasoning**:
- Drizzle schemas are pure TypeScript — agents write TS fluently, no custom DSL to learn
- `drizzle-kit generate` creates SQL migration files from schema diffs
- SQL-like query syntax means less abstraction between intent and execution
- Better type inference for complex queries
- Lighter runtime (~7KB vs Prisma's ~2MB engine)
- Drizzle runs everywhere (Node, Bun, Cloudflare Workers, Vercel Edge)

**Trade-off**: Prisma has a larger ecosystem (Prisma Studio, Prisma Pulse, Prisma Accelerate). Drizzle is newer but growing fast and better aligned with agent-driven workflows.

### 5.2 Hono Over Next.js API Routes

**Decision**: Use Hono as the API framework, independent of any frontend framework.

**Reasoning**:
- The API MUST be framework-agnostic — developers using Remix, SvelteKit, Nuxt, or bare Node should be able to use Orbit AI
- Hono generates OpenAPI specs natively — this feeds SDK generation, MCP tool generation, and documentation
- Hono runs on any runtime: Node, Bun, Deno, Cloudflare Workers, Vercel Functions, AWS Lambda
- 14KB total size. Zero overhead.
- Built-in Zod validation, CORS, auth middleware

**Trade-off**: Less ecosystem than Express. But Hono is the clear successor and already used by Cloudflare, Vercel, and many modern tools.

### 5.3 Custom Fields via JSONB + Schema Registry

**Decision**: Custom fields stored in a `custom_fields JSONB` column, with a schema registry tracking field definitions.

**Reasoning**:
- Adding a Postgres column for every custom field is expensive (DDL locks, migration for each field)
- JSONB gives unlimited flexibility with JSON Schema validation
- The schema registry tracks: field name, type, required, default, validation rules
- Indexed via GIN indexes on JSONB for query performance
- Agent-driven: agent defines a custom field → schema registry updates → validation enforced → types regenerated

**Architecture**:
```
field_definitions table:
  entity (contacts, deals, etc.)
  field_name
  field_type (text, number, date, boolean, select, multi_select)
  validation (JSON Schema)
  required
  default_value

contacts table:
  ... standard columns ...
  custom_fields JSONB  ← validated against field_definitions
```

For high-frequency or indexed custom fields, the agent CAN choose to "promote" a JSONB field to a real column via `orbit schema promote contacts.wedding_date`. This triggers a real migration — bridging flexibility with performance.

### 5.4 Multi-Tenant by Default, Single-Tenant Optional

**Decision**: Schema supports both modes.

```bash
orbit init --mode multi-tenant   # organization_id on every table, RLS scoped
orbit init --mode single-tenant  # no org scoping, simpler RLS
```

Multi-tenant is default (CRM infrastructure is most useful when embeddable in SaaS products). Single-tenant for solo developers or agencies.

### 5.5 Security Model

Learned from building Orbit CRM (current app):

| Layer | Implementation |
|-------|---------------|
| **Row-Level Security** | Auto-generated per entity. Multi-tenant uses `get_my_org_id()` pattern (proven in production). Single-tenant uses `auth.uid()`. |
| **API auth** | API keys (hashed, scoped to org) + OAuth 2.0 (for team scenarios) |
| **Rate limiting** | Built-in per-key rate limiting (configurable). Uses sliding window counter. |
| **Audit logging** | Every mutation logged: who, what, when, before/after values. |
| **Input validation** | Zod schemas on every endpoint. `escapeLike()` for all text search. SQL injection impossible via Drizzle parameterized queries. |
| **Migration safety** | Non-destructive default. Branch-before-migrate on Neon. Transaction-wrapped. Rollback available. |

---

## 6. Integration Architecture

### 6.1 Stripe Projects Integration

```bash
stripe projects add orbit/crm
# → Creates Orbit AI account
# → Provisions Postgres schema (via selected db provider)
# → Generates API key
# → Writes ORBIT_API_KEY, ORBIT_DATABASE_URL to .env
# → Generates agent skills file for Claude Code / Cursor
```

### 6.2 Webhook System

```
orbit webhooks create \
  --url https://example.com/hooks \
  --events contact.created,deal.moved,payment.received
```

Events:
- `contact.created`, `contact.updated`, `contact.deleted`
- `deal.created`, `deal.moved`, `deal.won`, `deal.lost`
- `payment.received`, `payment.failed`
- `contract.signed`, `contract.expired`
- `schema.migrated`, `schema.field_added`

### 6.3 Built-in Integrations (via CLI/MCP)

```bash
orbit integrations add resend       # email sending
orbit integrations add stripe       # payments
orbit integrations add google       # Gmail + Calendar
orbit integrations add twilio       # SMS + calls
orbit integrations add slack        # notifications
```

Each integration:
- Installs required packages
- Adds config to `.orbit/integrations.json`
- Exposes new MCP tools (e.g., `orbit.email.send` after adding Resend)
- Generates webhook handlers

---

## 7. Build Sequence

**Build approach**: Sub-agents and multi-parallel execution (AI-assisted development). Timeline is flexible — focus on quality and completeness over speed.

**Dependency graph**:
```
Phase 0 (Foundation) ──→ Phase 1 (Schema Engine) ──→ Phase 2 (Interfaces)
                                                          │
                                                     ┌────┴────┐
                                                     ▼         ▼
                                              Phase 3       Phase 4
                                              (CLI polish)  (Docs + Launch)
                                                     │         │
                                                     └────┬────┘
                                                          ▼
                                                     Phase 5 (Hosted)
                                                          │
                                                          ▼
                                                     Phase 6 (Advanced)
```

### Phase 0: Foundation (Weeks 1-3)
- Monorepo setup (Turborepo + pnpm)
- `@orbit-ai/core`: Base Drizzle schema (contacts, companies, deals, activities, pipeline_stages)
- Storage adapters: Supabase + SQLite (Neon deferred to Phase 2)
- Basic CRUD operations on all entities
- AGENTS.MD for each entity (LLM discoverability — low cost, high value)

### Phase 1: Schema Engine (Weeks 4-6)
- Custom field definitions + JSONB validation
- `orbit schema add-field` / `add-entity`
- Migration generation + preview + apply + rollback
- RLS auto-generation (multi-tenant mode using `get_my_org_id()` pattern from current Orbit CRM)
- TypeScript type regeneration from schema
- `orbit migrate --to multi-tenant` upgrade path (single→multi migration)
- **Blocker for Phase 2**: Schema engine must stabilize before interfaces can auto-generate types

### Phase 2: Interfaces (Weeks 7-11)
- `@orbit-ai/api`: Hono REST API with OpenAPI spec
- `@orbit-ai/sdk`: TypeScript SDK generated from OpenAPI
- `@orbit-ai/cli`: Commander CLI with core commands (`init`, `schema`, `contacts`, `deals`, `migrate`, `status`)
- `@orbit-ai/mcp`: MCP server (stdio transport)
- Neon adapter (with branch-before-migrate)
- Auth strategy: API keys (MVP), bring-your-own-auth via adapter (Supabase Auth, Clerk, etc.)
- **Buffer week** (Week 11): Integration testing, edge cases, DX polish

### Phase 3: CLI Polish + Examples (Weeks 12-13)
- Rich CLI output via Ink (pretty tables, colored diffs)
- `--json` flag on every command (agent mode)
- `create-orbit-app` scaffolder
- Example apps: Next.js CRM, agent workflow
- `orbit doctor` command

### Phase 4: Open Source Launch (Weeks 14-16)
- Documentation site (Mintlify or Fumadocs)
- `llms.txt` for AI discoverability
- GitHub repo, README, contributing guide, AGENTS.MD
- MCP server listed in official directory
- **Buffer week** (Week 16): Fix launch-blocking issues from early feedback
- Target: 500-1K stars, 50 CLI installs (realistic for unknown founder)

### Phase 5: Hosted + Monetization (Weeks 17-22)
- Managed hosting architecture (see §8 Open Question: hosted tier isolation)
- Usage metering (records + API calls)
- Stripe Billing integration
- Rate limiting via Upstash Redis (not in-memory — must work on serverless)
- HTTP transport for MCP server (remote/hosted)
- Stripe Projects provider application (research requirements first — see §8 Q7)
- Target: 20-50 paying customers

### Phase 6: Advanced Features — Lessons from Open Mercato (Weeks 23-30)
- `@orbit-ai/workflows`: State machine engine for deal lifecycle, contract approval, lead nurturing (inspired by Open Mercato's Workflow Engine v1.0)
- `@orbit-ai/inbox`: Email → LLM → structured proposal → human approval pipeline (inspired by Open Mercato's InboxOps)
- Standard Webhooks spec adoption (signatures, retries, idempotency)
- Audit log enhancement: before/after JSON diffs + `orbit activity undo <id>`
- `orbit schema promote` (JSONB field → real column)
- `@orbit-ai/react`: Optional React component library (PipelineBoard, ContactCard, etc.)
- Enterprise prep: field-level encryption per tenant (AES-GCM, per-org DEKs)

---

## 8. Open Questions

### Technical

1. **Drizzle vs raw SQL for advanced migrations**: Drizzle Kit handles 90% of cases, but complex migrations (data backfills, conditional logic) may need raw SQL escape hatch. **Decision needed**: allow `orbit migrate --raw <file.sql>` for escape hatch?

2. **Drizzle + Supabase migration conflict**: Supabase has its own migration runner (`supabase migration up`). Drizzle Kit generates its own files. Running both creates conflicts. **Decision needed**: Does the Supabase adapter bypass Supabase migrations entirely (connect via `DATABASE_URL` directly)? Or do we generate Supabase-compatible migration files?

3. **Realtime subscriptions**: Supabase has native realtime. Neon doesn't. **Decision needed**: Adapter-specific feature (Supabase users get realtime, others don't) or abstraction layer?

4. **File storage**: CRM needs attachments. **Options**: Vercel Blob (Vercel-native), Supabase Storage (Supabase-native), S3-compatible (universal). Likely adapter-specific.

5. **Search strategy**: Postgres `tsvector` for MVP. Open Mercato uses Meilisearch (adds infra dependency). **Decision needed**: Stay with Postgres FTS or offer optional Meilisearch/pgvector for hosted tier?

6. **Auth/identity model**: Biggest architectural gap. SaaS builders (Persona 2) will ask "how does auth work?" first. **Options**: (a) Bring-your-own-auth (SDK accepts any JWT/session), (b) Supabase Auth native for Supabase adapter, Clerk for others, (c) Built-in API key auth only (no user-level auth). **Likely answer**: API keys for service-to-service (MVP). User-level auth delegated to the developer's auth provider. SDK accepts `userId` + `orgId` as context, doesn't manage auth itself.

7. **Rate limiting without Redis**: Can't do in-memory on serverless. **Decision**: Use Upstash Redis for hosted tier. Self-hosted users bring their own Redis or accept in-memory (single-instance only). Phase 5 concern, not MVP.

### Strategic

8. **Stripe Projects provider requirements**: Treated as a build step but requirements unknown. **Action needed**: Research the application process, partnership terms, and timeline before Phase 5. If blocked, fall back to npm + MCP directory as primary distribution.

9. **Open-source wedge — what's the "React Email" equivalent?** The thing that gets stars independently of the commercial offering. **Candidates**: (a) Schema engine as standalone migration tool, (b) AGENTS.MD generator for any project, (c) `@orbit-ai/react` CRM component library, (d) MCP CRM server that wraps any Postgres. **Decision needed before launch.**

10. **Hosted tier data isolation**: Each customer in their own Supabase/Neon project (expensive, secure)? Or shared database with schema-per-tenant or RLS isolation (cheaper, riskier)? **Decision needed**: This determines COGS, margin, and security posture.

11. **Open Mercato competitive response**: They may launch a cloud offering. Monitor their Official Modules CLI (v0.4.9) and "first corporate deployments." Our moat: agent-safe schema engine + lightweight primitives + Stripe Projects. Their MCP (4 tools) may expand — comparison dated March 2026.

12. **First customer (decided)**: Solo dev or solo entrepreneur vibe-coding a SaaS with Claude Code/Cursor, who needs CRM features without paying for HubSpot. The discovery path: they're building, ask their AI agent for a CRM solution, and the agent recommends Orbit AI (via MCP registry, `llms.txt`, or npm search). This is organic, agent-mediated discovery — not traditional marketing. **The product must be good enough that Claude/Cursor/Copilot recommend it unprompted.**

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CRM is too broad for a single schema | Medium | High | Start narrow (contacts, deals, pipeline). Extensibility via custom fields + add-entity. |
| Drizzle ORM immaturity | Low | Medium | Drizzle is mature enough (1M+ weekly downloads). Escape hatch to raw SQL available. |
| Open Mercato captures the market first | Low-Medium | High | Different quadrant (heavy framework vs lightweight primitives). They need Docker+Redis+Meilisearch; we need `npm install`. They target enterprise dev teams; we target vibe coders + agents. If they launch cloud offering, our moat is schema engine depth + Stripe Projects. |
| Agents break production schemas | Medium | High | Non-destructive default. Branch-before-migrate. Human approval gate for production. |
| json-render is too immature for TUI | Medium | Low | Terminal UI is optional. CLI + SDK + API + MCP are the core value. TUI is a nice-to-have. |
| Pricing model doesn't work | Medium | Medium | Iterate. Start with generous free tier. Learn from usage patterns. |

---

## 10. References

- Resend: 150K+ devs, $21M raised, 53-command CLI, native MCP server, React Email (12K stars)
- Stripe Projects: launched March 26, 2026, 10 providers, `stripe projects add` CLI, Shared Payment Tokens
- json-render: Vercel Labs, 27 packages, flat JSON spec, multi-platform rendering
- Twenty CRM: 43K stars, $5.5M raised, GraphQL + REST, metadata-driven custom objects
- Attio: $52M Series B, 5K paying customers, official MCP server at mcp.attio.com
- Open Mercato: ~1.1K stars, 5 months old, 35 modules, MIT license, v0.4.9. Founded by Piotr Karwatka (Vue Storefront/Alokai, YC, $40M Series A). MikroORM + Awilix DI + Next.js + Meilisearch + Redis. Built-in MCP (4 tools), InboxOps (email→LLM→approval), Workflow Engine v1.0, field-level encryption. Heavy framework approach (Docker required). No cloud/SaaS offering. 230 open issues. RBAC bugs in progress.
- Karpathy MenuGen: "Building a modern app is like assembling IKEA furniture"
- MCP Ecosystem: 5,800+ servers, 97M+ monthly SDK downloads (March 2026)
- Ibbaka Research: "Agent strategies in CRM and the emergence of headless CRM" (2026)
