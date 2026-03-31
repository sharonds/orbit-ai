# Orbit AI — Product Requirements Document (PRD)

*Date: March 28, 2026*
*Status: Draft — Brainstorm Phase*
*Companion document: [orbit-ai-ard.md](./orbit-ai-ard.md) (Architecture Research Document)*

---

## 1. Vision

**One sentence**: Orbit AI is CRM infrastructure for AI agents and developers — the Resend of CRM.

**The problem**: Every business app eventually needs CRM functionality (contacts, deals, pipeline, payments). Today, developers either:
1. Build it from scratch (weeks of work, no migration safety, no agent support)
2. Integrate HubSpot/Salesforce ($$$, bloated, enterprise-first, not agent-native)
3. Use a no-code tool like Airtable (hits walls at scale, no real security)

**The solution**: `npm install @orbit-ai/core` (or `stripe projects add orbit/crm`) and get a type-safe, agent-manageable CRM schema with CLI, SDK, API, and MCP server — all in under 5 minutes.

**The thesis**: The market is shifting from developer-driven tools to agent-driven tools. The products that win the next cycle will be built for AI agents as first-class users (CLI, API, MCP, structured output). CRM is a massive category ($80B+) with no agent-native infrastructure product.

---

## 2. User Personas

### Persona 1: The Vibe Coder / Solo Entrepreneur (PRIMARY)
**Who**: Solo developer or solo entrepreneur building a SaaS (or running a small business) with Claude Code / Cursor / Bolt. Doesn't want to pay for HubSpot. Needs CRM features yesterday.
**Pain**: They need CRM in their app (leads, customers, pipeline) but building from scratch is fragile — no migration safety, no security, no agent interop. Paying $29+/seat/month for Attio or $45/mo for HubSpot Starter feels wrong for a solo operation.
**How they find Orbit AI**: **Their AI agent recommends it.** They're vibe coding, ask Claude/Cursor "I need a CRM," and the agent finds Orbit AI via MCP registry, `llms.txt`, or npm search. This is the primary discovery path — agent-mediated, not marketing-driven.
**What they do**: `orbit init --db supabase`, customize schema, build their UI on top (or use `create-orbit-app`).
**Revenue tier**: Free → Pro ($29/mo when they launch).
**Key insight**: The product must be good enough that AI agents recommend it unprompted. This means: excellent docs, `llms.txt`, AGENTS.MD, MCP server in the registry, clean npm package with good README.

### Persona 2: The SaaS Builder
**Who**: Technical founder or small team building a B2B SaaS that needs embedded CRM functionality.
**Pain**: Their customers need contact management, deal tracking, and pipeline views. Building this from scratch takes months. Embedding HubSpot is expensive and inflexible.
**How they find Orbit AI**: SDK documentation, GitHub stars, or Stripe Projects ecosystem.
**What they do**: `npm install @orbit-ai/sdk`, embed multi-tenant CRM in their product.
**Revenue tier**: Pro → Scale ($99-199/mo).

### Persona 3: The Agency Developer
**Who**: Developer at an agency building CRM-like apps for multiple SMB clients.
**Pain**: Each client wants a slightly different CRM. Rebuilding from scratch each time is wasteful.
**How they find Orbit AI**: GitHub, developer community, comparison with Twenty/Attio.
**What they do**: `orbit init` per client, customize schema per client's needs, deploy on client's infrastructure.
**Revenue tier**: Multiple Pro accounts (one per client) or Scale.

### Distribution Channel: AI Agents
AI agents (Claude Code, Cursor, Copilot) are not a user persona — they're a **distribution channel**. They discover Orbit AI via MCP server registry, `llms.txt`, and Stripe Projects catalog. They recommend and provision Orbit AI on behalf of human users. Revenue flows to the human's account. Agent-native design (CLI `--json` mode, MCP tools, AGENTS.MD) ensures agents can effectively use and recommend the product.

---

## 3. Core Features (MVP)

### 3.1 Schema Engine

The #1 differentiator. Agent-safe, type-safe CRM schema evolution.

**Must have (MVP)**:
- [ ] Base schema: contacts, companies, deals, pipeline_stages, activities, products, payments, notes
- [ ] Custom fields via JSONB + field definitions registry
- [ ] `orbit schema add-field <entity> <name> <type>` — adds custom field with validation
- [ ] `orbit schema add-entity <name>` — creates new table with RLS, types, API endpoints
- [ ] `orbit migrate --preview` — shows SQL diff without applying
- [ ] `orbit migrate --apply` — runs migration in transaction
- [ ] `orbit migrate --rollback` — reverses last migration
- [ ] Auto-generated TypeScript types from schema
- [ ] Auto-generated RLS policies (multi-tenant and single-tenant modes)
- [ ] Non-destructive default (agents cannot DROP without explicit flag)

**Should have (v1.1)**:
- [ ] `orbit schema promote <entity>.<field>` — move JSONB field to real column
- [ ] Branch-before-migrate on Neon
- [ ] Migration impact preview (which queries/indexes affected)
- [ ] Schema versioning and named checkpoints

### 3.2 CLI (`orbit`)

The primary human interface and agent interface.

**Must have (MVP)**:
- [ ] `orbit init` — project setup (choose DB adapter, mode, schema)
- [ ] `orbit schema` — view and modify schema
- [ ] `orbit contacts` — CRUD operations
- [ ] `orbit deals` — CRUD + stage management
- [ ] `orbit pipeline` — view and configure pipeline stages
- [ ] `orbit migrate` — migration management
- [ ] `orbit seed` — generate sample data for development
- [ ] `--json` flag on every command (agent mode)
- [ ] `--dry-run` flag on mutations
- [ ] `orbit status` — health check (DB connection, schema version, entity counts)

**Should have (v1.1)**:
- [ ] `orbit tui` — full terminal dashboard (json-render + Ink)
- [ ] `orbit integrations add <name>` — add Resend, Stripe, etc.
- [ ] `orbit webhooks` — manage webhook endpoints
- [ ] `orbit analytics` — basic metrics (deals by stage, conversion rates)
- [ ] Natural language date parsing in filters
- [ ] Interactive mode with autocomplete

### 3.3 SDK (`@orbit-ai/sdk`)

The embeddable client for SaaS builders.

**Must have (MVP)**:
- [ ] `OrbitClient` — main client class, configurable (API key or direct DB URL)
- [ ] `crm.contacts` — full CRUD with filtering, sorting, pagination
- [ ] `crm.companies` — full CRUD with contact relationships
- [ ] `crm.deals` — CRUD + stage transitions + pipeline view
- [ ] `crm.activities` — log and query activities
- [ ] `crm.products` — product/service catalog
- [ ] `crm.payments` — payment tracking (matches base schema)
- [ ] `crm.schema` — programmatic schema operations
- [ ] Full TypeScript types (auto-generated, includes custom fields)
- [ ] Error handling with typed errors

**Should have (v1.1)**:
- [ ] `crm.contracts` — contract management
- [ ] `crm.automations` — define triggers and actions
- [ ] `crm.search` — full-text search across entities
- [ ] Realtime subscriptions (where adapter supports it)
- [ ] Batch operations
- [ ] Webhook client helpers

### 3.4 REST API (`@orbit-ai/api`)

The universal interface.

**Must have (MVP)**:
- [ ] Standard REST: `POST/GET/PATCH/DELETE /v1/{entity}/{id}`
- [ ] Filtering: `?filter[stage]=active&filter[source]=web`
- [ ] Sorting: `?sort=-created_at,name`
- [ ] Pagination: cursor-based (`?cursor=xxx&limit=50`)
- [ ] OpenAPI 3.1 spec (auto-generated)
- [ ] API key authentication
- [ ] Rate limiting (configurable per key)
- [ ] Error responses: consistent format with error codes
- [ ] Webhooks (`POST /v1/webhooks`)
- [ ] Schema management endpoints (`POST /v1/schema/fields`)
- [ ] Idempotency keys on all mutations

**Should have (v1.1)**:
- [ ] Bulk operations (`POST /v1/contacts/bulk`)
- [ ] OAuth 2.0 authentication

### 3.5 MCP Server (`@orbit-ai/mcp`)

The agent-native interface.

**Must have (MVP)**:
- [ ] 23 core MCP tools covering CRUD, schema, pipeline, activity, import/export, sequence, analytics, and team workflows
- [ ] stdio transport (for Claude Code, Cursor)
- [ ] HTTP transport (for remote/hosted MCP)
- [ ] API key authentication

**Should have (v1.1)**:
- [ ] `automations.create`, `automations.trigger`
- [ ] `search.query` (natural language)
- [ ] OAuth authentication

### 3.6 Authentication & Identity (Critical Gap — Needs Design)

Orbit AI is headless infrastructure. It does NOT own the auth layer. Developers bring their own auth provider.

**MVP approach — API key auth + BYOA (Bring Your Own Auth)**:
- **Service-to-service**: API keys (hashed, scoped to org). This is what the CLI, MCP, and SDK use.
- **User-level auth**: The SDK accepts `userId` and `orgId` as context parameters. It does NOT manage user sessions, login flows, or JWT verification. The developer's auth provider (Supabase Auth, Clerk, NextAuth, custom) handles that.
- **Supabase adapter**: Can optionally use Supabase Auth natively (RLS policies use `auth.uid()`). This is the tightest integration.
- **Other adapters**: Developer passes `userId`/`orgId` from their auth layer into the SDK client.

```typescript
// Developer's auth layer provides the context
const session = await clerk.getSession()
const crm = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY,
  context: { userId: session.userId, orgId: session.orgId }
})
```

**Should have (v1.1)**:
- [ ] Auth middleware for common providers (Clerk, Supabase Auth, NextAuth)
- [ ] JWT verification built into API server
- [ ] OAuth 2.0 for team-based access

### 3.7 Data Portability

- [ ] `orbit export --format json` — full CRM data export
- [ ] `orbit export --format csv` — per-entity CSV export
- [ ] `orbit import --from json` — restore from export
- [ ] `orbit import --from csv` — import from CSV (with field mapping)
- [ ] Self-hosted → hosted migration: `orbit migrate --to hosted`
- [ ] Hosted → self-hosted migration: `orbit export` + `orbit import` on new instance

### 3.8 Storage Adapters

**Must have (MVP)**:
- [ ] Supabase adapter (RLS, auth integration)
- [ ] Neon adapter (branching support)
- [ ] SQLite adapter (local dev, zero-config)

**Should have (v1.1)**:
- [ ] Raw Postgres adapter (any managed Postgres)
- [ ] Connection pooling (PgBouncer / Supabase pooler)

Release note: the initial supported release wave is Supabase, Neon, and SQLite. Raw Postgres remains an explicit portability target immediately after the first release wave, but it is not treated as the launch blocker.

### 3.7 Workflows & Automation (v1.1 — Inspired by Open Mercato)

Open Mercato's Workflow Engine is their only v1.0 module — they consider it core. We adopt the concept but make it agent-native.

**Should have (v1.1)**:
- [ ] `@orbit-ai/workflows` — state machine engine for entity lifecycles
- [ ] Deal lifecycle: lead → qualified → proposal → negotiation → won/lost (configurable stages)
- [ ] Contract approval: draft → review → approved → signed → expired
- [ ] Custom workflows: agent-definable via CLI/MCP (`orbit workflows create`)
- [ ] Transition guards: conditions that must be met before stage change
- [ ] Transition actions: side effects on stage change (send email, create task, webhook)
- [ ] `orbit.workflows.trigger` MCP tool for agents

### 3.8 InboxOps — Email-to-CRM Agent (v1.1 — Inspired by Open Mercato)

Open Mercato's InboxOps module is genuinely novel. We adapt it for our infrastructure model.

**Should have (v1.1)**:
- [ ] `@orbit-ai/inbox` — email forwarding → LLM extraction → proposal → approval
- [ ] Forward email to `inbox@your-project.orbit-ai.dev`
- [ ] LLM extracts: contact info, deal details, action items, sentiment
- [ ] Proposes structured CRM actions: create contact, update deal stage, log activity
- [ ] Human approves/rejects/edits proposals via CLI, MCP, or webhook
- [ ] `orbit.inbox.proposals` MCP tool for reviewing pending proposals

### 3.9 AGENTS.MD — LLM Discoverability (MVP — Inspired by Open Mercato)

**Must have (MVP)**:
- [ ] `AGENTS.MD` file per entity documenting: fields, relationships, API endpoints, example queries
- [ ] Machine-readable format optimized for LLM consumption
- [ ] Included in MCP `schema.describe` tool responses
- [ ] `llms.txt` at docs root for web crawler discoverability
- [ ] Skills/context files generated during `orbit init` for Claude Code / Cursor

---

## 4. Open-Source Wedge Strategy

Following the Resend playbook (React Email → commercial platform):

### The Free Open-Source Core

Everything in the monorepo is open source (MIT license):
- `@orbit-ai/core` — schema engine, entities, adapters
- `@orbit-ai/cli` — CLI tool
- `@orbit-ai/sdk` — TypeScript SDK
- `@orbit-ai/api` — Hono API server
- `@orbit-ai/mcp` — MCP server
- `@orbit-ai/react` — json-render CRM components
- `create-orbit-app` — project scaffolder

**Why MIT (not AGPL like Twenty)**:
- MIT maximizes adoption and embedding (AGPL scares SaaS builders)
- Revenue comes from hosting and managed services, not license enforcement
- Resend, Stripe, and Vercel all use permissive licenses for their OSS tools

### The GitHub Stars Strategy

Target: 10K stars in first 6 months. Tactics:
1. **Schema engine solves a real pain** — even non-CRM projects benefit from agent-safe Postgres migrations
2. **json-render CRM catalog** — visual, demo-able, shareable
3. **MCP server listed in official directory** — discovery by 97M+ monthly SDK downloads
4. **"Built with Orbit AI" examples** — showcase apps that demonstrate the vision
5. **Content marketing** — "Why we built a CRM for AI agents" (HN, Dev.to, X)
6. **Stripe Projects integration** — distribution to every vibe coder using Stripe

---

## 5. Pricing Model

### Revenue Architecture: Open-Core + Usage-Based

The table below is the current hosted pricing hypothesis, not a fully frozen commercial package. Package v1 readiness is the hard release bar. Hosted is part of the first release window, likely as beta, and hosted GA depends on resolving the final isolation and operating-model decisions.

| Tier | Price | Records | API Calls/mo | Features |
|------|-------|---------|-------------|----------|
| **Community** | Free forever | Unlimited (self-hosted) | Unlimited (self-hosted) | Full OSS: CLI, SDK, API, MCP, all entities |
| **Pro** | $29/mo | 25,000 | 100,000 | Managed hosting beta or GA depending on isolation readiness, hosted MCP endpoint, email support, webhooks |
| **Scale** | $99/mo | 250,000 | 1,000,000 | Priority support, automations, analytics, SSO |
| **Enterprise** | Custom | Unlimited | Unlimited | SLA, dedicated infra, on-prem, migration assistance |

**COGS note (needs validation)**: Hosted tier runs on Supabase or Neon. Supabase Pro = $25/mo per project. If each customer gets a dedicated Supabase project, COGS for Pro tier = ~$25, leaving $4 margin. This is unsustainable. **Decision needed**: shared database with RLS isolation (lower COGS, security risk) vs. dedicated projects (higher COGS, better isolation). See ARD §8 Q10.

**What's free**: Everything you need to build and self-host a CRM.
**What's paid**: Managed hosting, convenience features, scale, support.

**Overage pricing** (Pro/Scale):
- Extra records: $0.003/record/month (= $3 per 1,000 records)
- Extra API calls: $0.001/call (= $1 per 1,000 calls)

**Why this works**:
- Resend model proven: free SDK + paid sending
- Records + API calls scale naturally with business growth
- Self-hosted is truly free (not crippled) — builds trust
- Pro at $29/mo undercuts Attio (€29/user/mo) and is per-project, not per-seat

### MCP Pricing
- **Community**: MCP server runs locally (self-hosted)
- **Pro+**: Hosted MCP endpoint at `mcp.orbit-ai.dev/your-project` (remote, always-on, Claude/Cursor connect directly)

---

## 6. Competitive Positioning

### Positioning Statement

"Orbit AI is CRM infrastructure for AI agents and developers. Not another CRM app — the primitives to build your own."

### Positioning Matrix

```
                    Agent-Native
                         ↑
                         │
          Orbit AI ★     │     Attio
          (primitives)   │     (product)
                         │
  Developer ─────────────┼──────────── End-User
  Focused                │             Focused
                         │
          Twenty         │     HubSpot
          (OSS product)  │     Salesforce
                         │
                         ↓
                    Human-Native
```

### Key Differentiators

| vs | Orbit AI Advantage |
|----|--------------------|
| **HubSpot / Salesforce** | 100x cheaper. Self-hostable. Agent-native. No seat-based pricing. Schema flexibility. |
| **Twenty CRM** | Infrastructure, not product. Embeddable in other apps. Schema engine for agents. Stripe Projects distribution. |
| **Attio** | Open source. No per-seat pricing. Self-hostable. Schema-as-code (not UI-driven). |
| **Open Mercato** | See detailed comparison below (§6.1). Summary: They are a heavy framework (Docker+Redis+Meilisearch required); we are lightweight primitives (`npm install`). They have breadth (35 modules, ERP+Commerce); we have depth (schema engine, agent-safe migrations). They have no cloud offering; we have hosted + Stripe Projects. They have 4 generic MCP tools; we plan 20+ domain-specific. |
| **Airtable / NocoDB** | CRM-specific domain logic. RLS, multi-tenant, pipeline management. Not just a generic database. |
| **Building from scratch** | 10 weeks of work → 5 minutes. Safe migrations. Agent interop. Security built-in. |

### 6.1 Orbit AI vs Open Mercato — Detailed Differentiation

Open Mercato (~1,100 stars, 5 months old, founded by Piotr Karwatka of Vue Storefront/Alokai fame) is the closest architectural competitor. Here's what they built, what we learn from them, and why we're fundamentally different.

#### What Open Mercato Built (and What's Impressive)

- **35 modules** in 5 months: CRM, ERP, Commerce, Workflow Engine, Customer Portal, Checkout, Shipping, InboxOps
- **Workflow Engine v1.0** — state machines for document/process lifecycles (their most mature module)
- **InboxOps** — email → LLM extracts structured data → proposes CRM action → human approves (genuinely novel)
- **Field-level encryption** per tenant (AES-GCM, per-tenant DEKs from Vault/KMS)
- **AGENTS.MD per module** — machine-readable docs that help LLMs navigate and extend the codebase
- **OCP overlay architecture** — your app is a thin layer on `@open-mercato/core`; `npm update` for core upgrades, `--eject` for full ownership
- Tech: MikroORM (Unit of Work + Identity Map) + Awilix (per-request DI) + Next.js + Meilisearch + Redis + pgvector

#### Why We're Fundamentally Different

| Dimension | Open Mercato | Orbit AI |
|-----------|-------------|----------|
| **Mental model** | Framework (clone, extend, deploy) | Infrastructure (install, use, compose) |
| **Analogy** | Ruby on Rails | Stripe SDK |
| **Onboarding** | Clone repo → Docker Compose → configure | `npm install @orbit-ai/sdk` or `orbit init` |
| **Infrastructure required** | Docker + Node 24 + Postgres + Redis + Meilisearch | Just Postgres (Supabase or Neon) |
| **Runtime size** | MikroORM ~150-300KB + Redis client + Meilisearch client | Drizzle ~7.4KB |
| **Edge/serverless** | No (Docker required) | Yes (Drizzle + Hono run everywhere) |
| **Schema modification** | Code changes → redeploy | CLI/SDK/MCP command → auto-migration |
| **Agent-safe migrations** | Not a focus | Core moat (non-destructive default, branch-before-migrate, rollback) |
| **MCP depth** | 4 generic tools (discover, find, call, whoami) | 20+ domain-specific tools (contacts.create, deals.move, schema.addField, etc.) |
| **Cloud offering** | None (self-hosted only) | Hosted path at orbit-ai.dev in the first release window; GA depends on isolation readiness. Stripe Projects is strategic distribution, not a ship blocker. |
| **SaaS billing layer** | None | Hosted tier has Stripe Billing for Orbit AI's own subscriptions. SDK does NOT include billing primitives — developers bring their own (Stripe, Lemon Squeezy, etc.) |
| **Scope** | CRM + ERP + Commerce + HR + Resource Planning | CRM infrastructure only (focused depth) |
| **Target user** | Enterprise dev teams building internal systems | Vibe coders, SaaS builders, AI agents |
| **Stability** | v0.1.0 on 30/35 modules, 230 open issues, RBAC bugs | Focused on fewer features, each production-ready |

#### What We Adopt From Them

1. **AGENTS.MD pattern** → Ship machine-readable docs per entity for LLM discoverability
2. **InboxOps concept** → `@orbit-ai/inbox` package: email → LLM → proposal → approval
3. **Workflow Engine** → `@orbit-ai/workflows`: state machines for deal lifecycle, approvals, nurturing
4. **Standard Webhooks spec** → Production-proven webhook format with HMAC signatures
5. **Audit with undo** → Before/after JSON diffs + `orbit activity undo <id>`
6. **Field-level encryption** → Enterprise tier, per-org DEKs via KMS

#### Where We Deliberately Diverge

1. **No ERP/Commerce/HR** — CRM only. Their breadth is their moat; our depth is ours.
2. **No Docker requirement** — We run on any Postgres. `npm install` is the whole setup.
3. **No DI container** — Awilix is elegant but framework-heavy. Our SDK handles multi-tenancy at the client level.
4. **No MikroORM** — Drizzle is 40x lighter, has programmatic migration APIs for agents, and runs on Edge.
5. **No self-hosted-only** — We plan a hosted offering in the first release window. Package v1 is the hard launch bar; hosted beta may ship alongside it, and hosted GA depends on the isolation model being resolved.
6. **Agent-first, not framework-first** — Every feature is CLI/MCP-accessible. UI is optional. Open Mercato is UI-first with MCP bolted on.

---

## 7. Go-to-Market

**Build approach**: Sub-agents and multi-parallel AI-assisted development. Timeline is flexible — quality over speed.

### GTM Phase 1: Build in Public (Month 1-4, aligns with Build Phases 0-3)
- GitHub repo public from day one (build in public, not stealth launch)
- Weekly dev updates on X / Dev.to (progress, decisions, architecture)
- AGENTS.MD and `llms.txt` published early (AI discoverability before launch)
- Discord community seeded with early feedback from vibe coder networks
- Target: 200-500 stars, 20 CLI installs, feedback from 10 real developers

### GTM Phase 2: Open Source Launch (Month 4-5, aligns with Build Phase 4)
- Documentation site (Mintlify or Fumadocs)
- MCP server listed in official directory
- Hacker News post: "We built CRM infrastructure for AI agents" (but NOT the only channel — also Dev.to, X, Reddit r/nextjs, r/selfhosted, relevant Discord servers)
- `create-orbit-app` with working example
- Target: 1K-2K stars, 100 CLI installs, 5 "Built with Orbit AI" projects

### GTM Phase 3: Hosted Beta / Launch Window (Month 5-7, aligns with Build Phase 5)
- orbit-ai.dev — managed hosting
- Usage-based billing via Stripe
- Stripe Projects provider application (research requirements first)
- Hosted MCP endpoint for remote agent connections
- Hosted GA depends on the final data-isolation decision and operational readiness
- Target: 2K-5K stars, 30-50 paying customers, $1.5K-3K MRR

### GTM Phase 4: Ecosystem Expansion (Month 8-14, aligns with Build Phase 6+)
- Workflows + InboxOps features (differentiation from Phase 6)
- Integration guides (Resend, Stripe, Clerk, etc.)
- `@orbit-ai/react` component library
- More storage adapters (Neon branching improvements, PlanetScale, Turso)
- Enterprise prep: field-level encryption, SSO, audit logs
- **Python SDK deferred** — significant investment, requires real demand signal first
- Target: 5K+ stars, 100+ paying customers, $5K+ MRR

---

## 8. Success Metrics

### Product Metrics (6 months post-launch)

**Note**: Targets assume 1-2 person team, no VC funding, unknown founder. Adjusted for realism based on comparable launches (Open Mercato: 1.1K stars in 5 months with a known founder).

| Metric | Target | How Measured |
|--------|--------|-------------|
| GitHub stars | 2,000-5,000 | GitHub API |
| npm weekly downloads (`@orbit-ai/*`) | 1,000 | npm stats |
| Active CLI users (monthly) | 200 | Telemetry (opt-in) |
| `@orbit-ai/mcp` npm downloads | 500 | npm stats |
| Hosted tier customers | 30-50 | Stripe dashboard |
| Monthly revenue | $1.5K-3K | Stripe (30-50 customers × $29-99 avg) |

### North Star Metric
**Active projects with 100+ records** — this means someone built a real thing with Orbit AI, not just tried the demo.

### Leading Indicators
- `orbit init` runs per week
- Schema modifications per project (custom fields added = deep adoption)
- MCP tool calls per week (agents are using it)
- CLI commands per user per week (sticky usage)

---

## 9. Technical Requirements

### Performance
- API latency: p50 < 50ms, p99 < 200ms
- CLI startup: < 300ms
- Migration preview: < 2s for any schema size
- Schema type regeneration: < 5s

### Security
- API keys: hashed with bcrypt, scoped to org
- RLS: auto-generated, tested on every migration
- Rate limiting: sliding window, configurable per key
- Audit log: every mutation, immutable, queryable
- No SQL injection: parameterized queries only (Drizzle)
- Input validation: Zod on every endpoint

### Reliability
- Hosted API: 99.9% uptime SLA (Scale+)
- Migrations: transaction-wrapped, auto-rollback on failure
- Data: daily backups on hosted tier
- Webhooks: at-least-once delivery with retry

### Developer Experience
- Time to first CRM operation: < 5 minutes
- Zero-config local development (SQLite adapter)
- Hot reload for schema changes in dev mode
- Comprehensive error messages (not just "something went wrong")
- `orbit doctor` command for debugging setup issues

---

## 10. What We're NOT Building (Anti-Requirements)

1. **Not a CRM application** — no pre-built web dashboard, no hosted CRM UI, no `orbit ui serve`. We ship primitives + an optional React component library. Developers build their own UI (or use `create-orbit-app` as a starter template).
2. **Not a marketing platform** — no email campaigns, landing pages, or ad management.
3. **Not an ERP** — no inventory, manufacturing, HR, or accounting (unlike Open Mercato).
4. **Not a data enrichment tool** — no Clay-like data scraping or enrichment.
5. **Not a no-code platform** — developers and agents are the users, not business analysts.
6. **Not enterprise-first** — no SCIM provisioning, complex approval chains, or custom deployment topologies at launch.
7. **Not a communication platform** — does not send emails, SMS, or notifications. InboxOps (v1.1) receives and processes email but does not send. For sending, integrate Resend/Twilio via `orbit integrations add`.
8. **Not a reporting/BI platform** — basic pipeline metrics only. No custom report builder, no BI dashboards. For advanced analytics, export data to your own tools.
9. **Not a desktop or mobile app** — CLI is the primary interface. No Electron app, no mobile app. Web UI is built by the developer, not shipped by us.
10. **Not a general workflow platform** — `@orbit-ai/workflows` (v1.1) is CRM lifecycle only (deal stages, contract approval). Not a Zapier/Make/n8n replacement.

---

## 11. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| "CRM is too broad" — scope creep | High | High | Rigid MVP scope. Schema engine + 8 core entities. Community requests inform v1.1+. |
| Open Mercato captures market | Low-Medium | High | Different quadrant: heavy framework (Docker+Redis+Meilisearch) vs lightweight primitives (`npm install`). They target enterprise dev teams; we target vibe coders + agents. If they launch cloud, our moat is schema engine depth + Stripe Projects. Monitor their Official Modules CLI and corporate deployments. |
| Agents break production data | Medium | High | Non-destructive default. Branch-before-migrate. Human gates for prod. |
| No one wants CRM primitives | Low | Critical | Validate with vibe coder community before v1. Pivot to "managed Twenty" if needed. |
| Revenue model doesn't work | Medium | Medium | Self-hosted core ensures adoption. Revenue optimization is a post-traction problem. |
| Drizzle ORM limitations | Low | Medium | Raw SQL escape hatch. Drizzle is mature (1M+ weekly downloads). |
| MCP standard evolves | Medium | Low | MCP SDK abstracts protocol details. Upgrading transport is straightforward. |

---

## 12. Relationship to Current Orbit CRM

The current Orbit CRM (this repo: `smb-sale-crm-app`) is a **full-stack Next.js CRM application** built for SMBs. It includes:
- 28 tables in `crm_app` schema on Supabase
- Multi-tenant architecture with RLS
- AI assistant with 22 tools
- Booking, sequences, CSV import, contracts, marketing analytics
- Stripe Billing + Stripe Express Connect

**Orbit AI is a different project.** However, the current Orbit CRM provides:

1. **Domain expertise** — We've built a production CRM. We know the entities, relationships, edge cases, and security patterns.
2. **Proven architecture** — The `get_my_org_id()` RLS pattern, audit logging, rate limiting, `requireEditor()` guard pattern — all battle-tested.
3. **Reference implementation** — The current app could become the "Next.js CRM template" built with Orbit AI SDK (example in `examples/nextjs-crm/`).
4. **Migration path** — Current Orbit CRM users could migrate from bespoke schema to Orbit AI managed schema.

**Decision**: New repo (`orbit-ai`), new npm org (`@orbit-ai/*`), new domain (`orbit-ai.dev`). Current Orbit CRM remains as-is — a standalone product and a showcase of what can be built with CRM infrastructure.

---

## 13. Decision Log

| # | Decision | Chosen | Alternatives Considered | Reasoning |
|---|----------|--------|------------------------|-----------|
| D-01 | Schema definition | Drizzle ORM | Prisma, raw SQL, custom DSL | TypeScript-native schemas. Agents write TS fluently. SQL-like queries. Migration generation. See ARD §5.1. |
| D-02 | API framework | Hono | Next.js API routes, Express, Fastify | Framework-agnostic. OpenAPI native. Runs everywhere (Node, Bun, Edge). 14KB. See ARD §5.2. |
| D-03 | Custom fields | JSONB + registry | Column-per-field, EAV, MongoDB | Flexible without DDL cost. Promotable to real columns. See ARD §5.3. |
| D-04 | License | MIT | AGPL, Apache 2.0, BSL | Maximum adoption. SaaS builders won't embed AGPL. Revenue from hosting, not license. |
| D-05 | Multi-tenancy | Default on, optional off | Single-tenant only, always multi-tenant | Most use cases embed CRM in multi-tenant SaaS. Solo devs can opt out. |
| D-06 | Pricing model | Open-core + usage-based | Per-seat, flat rate, transaction % | Proven (Resend, Supabase). Records + API calls scale with business. No seat tax. |
| D-07 | TUI framework | json-render + Ink | Blessed, Terminal.css, none | json-render = same spec renders web + terminal. Ink = React for terminal. |
| D-08 | Naming | Orbit AI (decided) | Various | Open source. Name confirmed. Separate brand from current "Orbit CRM" SaaS app. |
| D-09 | Database adapters | Supabase + Neon + SQLite (initial supported release), raw Postgres immediately after | Postgres-only, MongoDB, PlanetScale | Supabase = most popular with vibe coders. Neon = best for branching. SQLite = zero-config dev. Raw Postgres remains part of the portability story but is not the first release blocker. |
| D-10 | MCP transport | stdio + HTTP | stdio only, SSE, WebSocket | stdio for local agents. HTTP for hosted. Matches Resend's MCP pattern. |

---

## Appendix A: Research Sources

### Products Analyzed
- **Resend**: 150K+ devs, $21M raised, 53-command CLI, native MCP, React Email (12K stars), $20/mo Pro
- **Stripe Projects**: Launched March 26, 2026, 10 providers, agent-native provisioning, Shared Payment Tokens
- **json-render**: Vercel Labs, 27 packages, flat JSON spec, multi-platform rendering, shadcn catalog
- **Twenty CRM**: 43K stars, $5.5M raised, GraphQL + REST, metadata-driven custom objects, AGPL license
- **Attio**: $52M Series B, 5K paying customers, official MCP server, €29-119/user/month
- **Open Mercato**: ~1.1K stars, 5 months old, 35 modules (CRM+ERP+Commerce), MIT, v0.4.9. Founders: Piotr Karwatka (Vue Storefront→YC→$40M), Tomasz Karwatka (Callstack). MikroORM + Awilix DI + Meilisearch + Redis + pgvector. MCP (4 tools), InboxOps, Workflow Engine v1.0, field-level encryption. Self-hosted only. Key learnings adopted: AGENTS.MD, InboxOps, Workflows, Standard Webhooks, audit undo.
- **Clay**: $185+/mo, no free tier, data enrichment, 150+ providers, "Claygent" AI agent
- **NocoDB**: 62K stars, Airtable alternative on SQL, auto-generated REST APIs
- **Unified.to**: Unified CRM API across 47+ providers, MCP support

### Market Data
- CRM market: $80B+ globally (Salesforce alone: $34B revenue)
- MCP ecosystem: 5,800+ servers, 97M+ monthly SDK downloads (March 2026)
- Vibe coding adoption: Bolt, Lovable, v0 collectively serving millions of developers
- "Headless CRM" emerging as a named category (Ibbaka Research, 2026)
- IDC: nearly half of new CRM investment going to data architecture and AI infrastructure vs licenses

### Key Insights
- **Karpathy's wall**: "Building a modern app is like assembling IKEA furniture" — services, docs, API keys, configurations
- **Paul Graham on Resend**: "The Stripe for Email" — same market, radically better DX
- **Agent-safe migrations**: Unsolved problem. No tool offers non-destructive default + branch-before-migrate + auto-RLS generation
- **CRM missing from Stripe Projects**: 10 providers, zero CRM. Distribution channel open.
- **85% of SaaS leaders have adopted usage-based or hybrid pricing** (industry trend, 2026)

### Pricing Benchmarks
| Product | Model | Free Tier | Entry Paid |
|---------|-------|-----------|------------|
| Resend | emails/mo | 3K/mo | $20/mo (50K) |
| Supabase | platform + usage | 500MB DB | $25/mo/project |
| Neon | compute + storage | 100 CU-hr | $5/mo min |
| Twenty | open-source + cloud | Self-host free | ~$9/user/mo |
| Attio | per-seat | 3 seats | €29/user/mo |
| **Orbit AI** | **records + API calls** | **Self-host free** | **$29/mo** |
