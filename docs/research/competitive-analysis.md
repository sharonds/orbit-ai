# Competitive Analysis — Orbit AI

*Last updated: March 28, 2026*
*Status: Research complete — informs positioning and build decisions*

---

## Summary

The "CRM infrastructure for AI agents" category does not exist yet. Every existing product either builds a full CRM application (Twenty, Attio, HubSpot) or provides generic infrastructure (Supabase, NocoDB) without CRM domain logic. The closest architectural competitor is Open Mercato — a framework, not infrastructure. This analysis documents the competitive landscape, key learnings, and the basis for our strategic positioning.

---

## 1. Open Mercato — Deep Dive

**The closest architectural competitor.**

| Dimension | Detail |
|-----------|--------|
| GitHub stars | ~1,100 (5 months old, March 2026) |
| License | MIT |
| Version | v0.4.9 |
| Founders | Piotr Karwatka (Vue Storefront → Y Combinator → Alokai $40M Series A) and Tomasz Karwatka (Callstack, React Native core contributor) |
| Architecture | Framework (clone → extend → deploy), not infrastructure (install → use) |

### Tech Stack

- **ORM**: MikroORM (Unit of Work + Identity Map, ~150-300KB runtime)
- **DI**: Awilix (per-request scoped containers, injects tenant/user/org context)
- **Frontend**: Next.js App Router
- **Search**: Meilisearch (fulltext + vector hybrid)
- **Cache**: Redis
- **Vector DB**: pgvector via ChromaDB
- **Infrastructure**: Docker Compose + Node 24 + Postgres + Redis + Meilisearch (required stack)

### Module Inventory (35 modules)

**Infrastructure (12)**: Auth & accounts, directory (tenants/orgs), custom entities & fields, config, query indexes, audit logs, attachments with OCR, API keys, feature toggles, shared dictionaries, table perspectives, admin dashboards.

**Business Domain (8)**: CRM (people, companies, deals, activities), product catalog, sales management (quoting, ordering, fulfillment), business rules engine, Workflow Engine v1.0, currencies, employees, resource planning.

**Communication (10)**: Messages, notifications, webhooks (Standard Webhooks-compliant), integrations, data sync, events, scheduler, progress tracking, search, entity translations.

**AI (2)**: AI Assistant (MCP server with 4 tools), InboxOps (email → LLM → structured proposal → human approval).

**Commerce (3)**: Payment gateways, checkout (pay links, templates), Stripe integration, shipping carriers.

### MCP Integration Assessment

4 MCP tools only:

| Tool | Description |
|------|-------------|
| `discover_schema` | Searches entity schemas via Meilisearch (fulltext + vector) |
| `find_api` | Finds API endpoints via natural language |
| `call_api` | Executes any API call with tenant context |
| `context_whoami` | Returns auth context |

**What's missing**: No workflow triggers, no analytics queries, no bulk operations, no schema modification tools, no streaming/events, no domain-specific tools. Generic "discover and call" pattern, not purpose-built CRM agent tools.

### What They Do Exceptionally Well

1. **OCP overlay architecture** — `npx create-mercato-app` scaffolds your app as a thin overlay on `@open-mercato/core`. Core upgrades via `npm update`. Module eject (`--eject`) for full ownership.
2. **Workflow Engine v1.0** — State machines for document/process lifecycles. Their most mature module. v1.0 while everything else is v0.1.0.
3. **InboxOps** — Email forwarding → LLM extracts structured data → proposes action (create deal, update order) → human approves. Genuinely novel agentic AI pattern.
4. **Field-level encryption** — AES-GCM, per-tenant DEKs from Vault/KMS, ORM lifecycle hooks. Enterprise-grade.
5. **AGENTS.MD per module** — Machine-readable docs for every module. LLM-optimized format. Helps agents navigate and extend the codebase without hallucinating APIs.
6. **Standard Webhooks spec** — Production-proven webhook format with HMAC signatures and idempotency. Not invented here.
7. **Architecture discipline** — 35 modules in 5 months from experienced founders.

### What They Do Poorly (Our Opportunities)

1. **No cloud/SaaS offering** — Must self-host Docker + Node 24 + Postgres + Redis + Meilisearch. High bar for vibe coders.
2. **No SaaS billing layer** — Has Stripe for collecting customer payments, but no subscription/trial/plan enforcement for building SaaS on top.
3. **v0.1.0 on 30/35 modules** — 230 open issues. RBAC bugs: admins cannot create messages (#1042), org scope ignored for non-admin (#1112). Not production-ready.
4. **Custom date/datetime fields** — Still a feature request (#1087) for a CRM. Fundamental gap.
5. **MCP is shallow** — 4 generic tools vs our planned 20+ domain-specific. Cannot orchestrate business processes.
6. **Demo is locked** — Superadmin disabled, credentials hidden. Poor evaluation experience.
7. **Docs are thin** — Navigation shells without content. Architecture deep-dives not written.
8. **Heavy runtime** — Cannot run on Edge/serverless. Docker required.
9. **Small community** — ~1,100 stars, ~12 contributors. Not enough for a framework ecosystem.

### Fundamental Strategic Difference

| Dimension | Open Mercato | Orbit AI |
|-----------|-------------|----------|
| Mental model | Framework (clone, extend, deploy) | Infrastructure (install, use, compose) |
| Analogy | Ruby on Rails | Stripe SDK |
| Onboarding | Clone repo → Docker Compose → configure | `npm install @orbit-ai/sdk` or `orbit init` |
| Infrastructure required | Docker + Node 24 + Postgres + Redis + Meilisearch | Just Postgres (Supabase or Neon) |
| Runtime size | MikroORM ~150-300KB + Redis client + Meilisearch client | Drizzle ~7.4KB |
| Edge/serverless | No (Docker required) | Yes (Drizzle + Hono run everywhere) |
| Schema modification | Code changes → redeploy | CLI/SDK/MCP command → auto-migration |
| Agent-safe migrations | Not a focus | Core moat (non-destructive default, branch-before-migrate, rollback) |
| MCP depth | 4 generic tools | 20+ domain-specific tools planned |
| Cloud offering | None (self-hosted only) | Hosted tier at orbit-ai.dev + Stripe Projects |
| Scope | CRM + ERP + Commerce + HR + Resource Planning | CRM infrastructure only (focused depth) |
| Target user | Enterprise dev teams building internal systems | Vibe coders, SaaS builders, AI agents |
| Stability | v0.1.0 on 30/35 modules, 230 open issues | Fewer features, each production-ready |

### Patterns Worth Adopting From Open Mercato

| Pattern | Adaptation |
|---------|-----------|
| AGENTS.MD per module | Ship `AGENTS.MD` per entity. Include in `@orbit-ai/mcp` for tool discovery. Generate during `orbit init` for Claude Code / Cursor. |
| InboxOps | `@orbit-ai/inbox` package (v1.1): email → LLM extract → propose → approve. We already have Gmail scan infrastructure. |
| Workflow Engine | `@orbit-ai/workflows` (v1.1): state machines for deal lifecycle, contract approval, custom flows. Agent-definable via CLI/MCP. |
| Standard Webhooks spec | Adopt from day one. HMAC signatures, idempotency, retry semantics. |
| Audit with undo | Before/after JSON diffs. `orbit activity undo <id>`. `activity.undo` MCP tool. |
| Field-level encryption | Enterprise tier (v2). Drizzle middleware hooks for encrypt/decrypt. Per-org keys via KMS. |

---

## 2. Twenty CRM

**The open-source Salesforce alternative.**

| Dimension | Detail |
|-----------|--------|
| GitHub stars | ~43,000 |
| Funding | $5.5M |
| License | AGPL-3.0 |
| Architecture | Full-stack CRM application (not infrastructure) |
| API | GraphQL + REST |
| Custom objects | Metadata-driven (UI-based configuration) |

**Position vs Orbit AI**: Twenty is a product you use. Orbit AI is infrastructure you build on. Twenty's AGPL license scares SaaS builders who want to embed CRM in their own products — they cannot do so without open-sourcing their entire application. Orbit AI is MIT. Twenty targets end-users running a CRM; Orbit AI targets developers and agents building systems that include CRM functionality.

**What we learn from them**: 43K stars validates massive demand for a developer-friendly CRM story. Their metadata-driven custom objects approach (UI-based) is the wrong direction for agents — we use schema-as-code via Drizzle instead.

---

## 3. Attio

**The modern, agent-native commercial CRM.**

| Dimension | Detail |
|-----------|--------|
| Funding | $52M Series B |
| Customers | ~5,000 paying |
| MCP server | Hosted at `mcp.attio.com` (official) |
| Pricing | €29-119 per user per month |
| Architecture | Closed-source SaaS product |

**Position vs Orbit AI**: Attio is per-seat, closed-source, and a product (not primitives). They have excellent MCP support — they understand the agent market. But €29/user/month does not work for solo devs or for embedding in another SaaS. Their MCP server requires an Attio account and exposes Attio's own data model, not a customizable schema.

**What we learn from them**: Attio proves the market will pay for agent-native CRM features. Their hosted MCP endpoint (`mcp.attio.com`) validates our plan for `mcp.orbit-ai.dev`.

---

## 4. Resend — The Playbook

**The primary strategic precedent.**

| Dimension | Detail |
|-----------|--------|
| Developers on platform | 150,000+ |
| Funding | $21M |
| CLI commands | 53 (with `--json` mode) |
| MCP | Native MCP server |
| React Email | 12,000+ GitHub stars (open-source wedge) |
| Free tier | 3,000 emails/month |
| Pro tier | $20/month (50,000 emails) |
| Team size | ~6 people at time of scale |
| Paul Graham quote | "The Stripe for Email" |

**The playbook Orbit AI follows**:
1. Build the open-source wedge first (React Email = `@orbit-ai/core` + `create-orbit-app`)
2. Ship a best-in-class developer experience before monetizing
3. CLI with `--json` output mode for agent consumption
4. MCP server as first-class interface
5. Free tier generous enough to build real things
6. Paid tier priced per-unit (emails/month = records/month), not per-seat

**Key insight**: Resend did not build a better email client — they built email infrastructure. The same move applies to CRM.

---

## 5. Stripe Projects

**The distribution channel.**

Launched March 26, 2026. Lets agents provision entire application stacks from CLI:

```bash
stripe projects add vercel/project
stripe projects add neon/database
stripe projects add clerk/auth
stripe projects add posthog/analytics
```

Current providers (10): Vercel, Neon, Supabase, Clerk, PostHog, Railway, PlanetScale, Turso, Chroma, Runloop.

**CRM is not on this list.** This is the distribution opportunity: `stripe projects add orbit/crm`.

Key architectural details:
- Resources live in the developer's accounts (not Stripe-managed)
- Credentials auto-written to `.env`
- Non-interactive flags (`--json`, `--no-interactive`) designed for agent consumption
- **Shared Payment Tokens** — agents upgrade plans via constrained, revocable tokens (co-developed with OpenAI as part of Agentic Commerce Protocol)

**Implication**: Orbit AI needs to apply to become a Stripe Projects provider. The integration model: `orbit init --from stripe-projects` auto-detects the Stripe Projects context and configures the DB adapter.

---

## 6. json-render (Vercel Labs)

**The TUI and UI rendering approach.**

| Dimension | Detail |
|-----------|--------|
| Packages | 27 |
| Pattern | Agent generates JSON spec → framework renders to any target |
| Targets | React, Terminal (Ink), React Native, PDF, Video, 3D |
| Format | Flat JSON optimized for LLM generation |
| Type safety | Zod schemas |
| Catalog | 36 pre-built shadcn components |

**For Orbit AI**: `orbit pipeline view` renders a Kanban board in the terminal via json-render + Ink. The same JSON spec renders in the browser. The CRM component catalog (Pipeline, Contact Card, Deal Timeline, Activity Feed, Dashboard) becomes a json-render registry — the `@orbit-ai/react` package.

---

## 7. Drizzle vs MikroORM — ORM Decision

This decision underpins the entire technical architecture.

| Dimension | MikroORM | Drizzle |
|-----------|----------|---------|
| Bundle size | ~150-300KB | **7.4KB** (40x smaller) |
| GitHub stars | 8,800 | **33,400** (3.8x more) |
| npm downloads/week | 1.1M | **4.9M** (4.5x more) |
| Agent schema generation | Moderate (decorators, metadata classes) | **Excellent** (plain TypeScript functions, SQL-like syntax) |
| Programmatic migration API | Limited (CLI-based only) | **Exported APIs** (`drizzle-kit/api` — `generateDrizzleJson`, `generateMigration`) — critical for schema engine |
| Edge/serverless | v7 added partial support | **Native** (Workers, Edge, Deno, Bun) |
| Type inference | Strong via `defineEntity()` | **Best-in-class** (zero codegen, inferred from schema definition) |
| Zod integration | None built-in | **Built-in** (`createSelectSchema`, `createInsertSchema`) |
| SQL transparency | Abstracted (Unit of Work) | **Explicit** (SQL-like query syntax) |
| Multi-tenancy | Via Awilix DI injection | **Via RLS + org scoping** (simpler, proven) |
| Node.js only | Yes (v6 and earlier) | No |

**Decision: Drizzle wins for our use case.**

MikroORM is correct for Open Mercato (enterprise framework, complex domain models, Unit of Work pattern for transactional batch writes). Drizzle is correct for Orbit AI (lightweight, agent-friendly, portable, programmatic migration generation for the schema engine).

The programmatic migration API (`drizzle-kit/api`) is the critical differentiator — it allows the schema engine to generate and apply migrations via SDK/MCP/CLI without requiring a separate CLI invocation. Agents can call `generateMigration()` programmatically, inspect the SQL, and apply or reject it.

---

## 8. Other Competitors

### Clay

- Pricing: $185+/month, no free tier
- Category: Data enrichment platform (150+ providers, "Claygent" AI agent)
- Position: Upstream of CRM — enriches data before it enters a CRM, not a CRM itself
- Relationship: Potential integration target (`orbit integrations add clay`)

### NocoDB

- GitHub stars: ~62,000
- Category: Open-source Airtable alternative on SQL, auto-generated REST APIs
- Position: Generic database UI without CRM domain logic (no pipeline, deal stages, lead scoring, activity tracking)
- Relationship: Validates demand for open-source database tooling, but wrong abstraction level

### Unified.to

- Category: Unified CRM API layer across 47+ providers
- Position: Middleware that wraps HubSpot, Salesforce, Pipedrive — not a CRM primitive
- Relationship: Orbit AI and Unified.to could coexist (Unified.to as a sync adapter for existing CRM data into Orbit AI)

### HubSpot

- Revenue: Public company
- MCP: Shipped June 2025
- Position: The SendGrid/Mailgun of CRM — bloated, enterprise-first, stagnant DX, expensive
- What we learn: They shipped MCP, validating agent-native is a real requirement. Their DX failures are our opportunity.

### Salesforce

- Revenue: $34B annually
- MCP: Agentforce 3.0 (bolted on to decades of tech debt)
- Position: Irrelevant to vibe coders and SaaS builders. Mentioned for completeness.

---

## 9. Pricing Benchmarks

| Product | Model | Free Tier | Entry Paid | Notes |
|---------|-------|-----------|------------|-------|
| Resend | emails/month | 3,000/mo | $20/mo (50K emails) | Per-unit, not per-seat |
| Supabase | platform + usage | 500MB DB | $25/mo/project | Per-project |
| Neon | compute + storage | 100 CU-hr | $5/mo minimum | Usage-based |
| Twenty CRM | open-source + cloud | Self-host free | ~$9/user/mo | Per-seat |
| Attio | per-seat SaaS | 3 seats free | €29/user/mo | Per-seat |
| HubSpot Starter | per-seat SaaS | Free (limited) | $45/mo (2 users) | Per-seat |
| Open Mercato | self-hosted only | Free (self-host) | None | No cloud tier |
| Clay | enrichment credits | None | $185/mo | No free tier |
| **Orbit AI** | **records + API calls** | **Self-host free** | **$29/mo** | **Per-project, not per-seat** |

**Why per-project pricing wins**:
- Resend and Supabase proved it: usage scales with business growth
- No "seat tax" — a solo developer building for 1,000 customers pays the same as a 5-person team
- $29/mo dramatically undercuts Attio (€29/user = $32/user, so a 3-person team pays ~$96/mo vs our $29)
- Aligns incentives: we grow revenue when customers grow their CRM usage

---

## 10. Market Context

- **CRM market size**: $80B+ globally (Salesforce alone: $34B annual revenue)
- **MCP ecosystem**: 5,800+ servers, 97M+ monthly SDK downloads (March 2026)
- **Vibe coding adoption**: Bolt, Lovable, v0 collectively serving millions of developers
- **"Headless CRM"** emerging as a named category (Ibbaka Research, 2026)
- **IDC**: Nearly half of new CRM investment going to data architecture and AI infrastructure vs licenses
- **CRM missing from Stripe Projects**: 10 providers, zero CRM — distribution channel open

### The Karpathy Signal

Andrej Karpathy documented the vibe coding wall in his MenuGen blog post:

> "Vibe coding menugen was exhilarating and fun... but a bit of a painful slog as a deployed, real app. Building a modern app is like assembling IKEA furniture. There are all these services, docs, API keys, configurations..."

Stripe Projects solves provisioning. Orbit AI solves the CRM-specific domain layer that every business app eventually needs.

### Key Finding

**The "Resend of CRM" category does not exist yet.** No product today lets you `npm install @orbit-ai/core` and get contacts, deals, pipelines as composable, agent-manageable primitives. Every existing product is either a full application (Twenty, Attio, HubSpot) or generic infrastructure without CRM domain logic (NocoDB, Supabase). The gap is real and validated by the market data above.
