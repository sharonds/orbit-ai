# Orbit AI — Meta Plan

*Date: March 28, 2026*
*Status: Active*
*This is the master plan. All specs reference this document.*

---

## Part 1: Where We Are — Current Orbit CRM Product

### 1.1 What We Built

Orbit CRM (`smb-sale-crm-app`) is a production multi-tenant SaaS CRM for SMBs, built over 70 PRs. It runs on Next.js 16 + Supabase + Vercel with 28 tables in the `crm_app` schema.

**Complete feature inventory:**

| Category | Features | Tables |
|----------|----------|--------|
| **Lead Management** | Full CRUD, kanban pipeline, lead scoring, hot leads, source tracking, assigned owner | `leads`, `pipeline_config` |
| **Communications** | Multi-channel logging (email, phone, SMS, WhatsApp), direction tracking, status | `communications` |
| **Quotes & Proposals** | Line items, discounts, PDF export, status workflow (draft→sent→accepted) | `quotes` |
| **Contracts** | Generation, e-signature, expiry tracking, public signing page | `contracts` |
| **Payments** | Stripe Express Connect, payment links, transaction tracking | `payments` |
| **Service Packages** | Product/service catalog with pricing | `service_packages` |
| **Follow-ups & Tasks** | Due date tasks, cron-driven reminders, morning brief | `follow_up_tasks` |
| **Email Sequences** | Multi-step automated sequences, enrollment, unsubscribe | `sequences`, `sequence_steps`, `sequence_enrollments`, `sequence_events` |
| **Tags** | Contact tagging, bulk operations | `tags`, `lead_tags` |
| **Booking & Scheduling** | Public booking pages, working hours, Google Calendar sync, reminders | `booking_pages`, `booking_slots`, `bookings`, `working_hours` |
| **CSV Import/Export** | 4-step wizard, field mapping, duplicate detection, rollback | `import_history` |
| **AI Assistant** | Chat with 22 tools, draft replies, marketing tools | `chat_sessions` |
| **Marketing Analytics** | Google Ads, Meta Ads, Search Console, campaigns, A/B experiments | `marketing_*` (6 tables) |
| **Multi-Tenant** | Organizations, org members, RLS via `get_my_org_id()` | `organizations`, `org_members` |
| **SaaS Platform** | Trial enforcement, Stripe Billing, super admin panel, onboarding | On `organizations` table |
| **Auth & Security** | Supabase Auth, RLS on all tables, audit logging, rate limiting | `profiles`, `audit_log` |
| **Settings** | App settings per org, pipeline config | `app_settings`, `pipeline_config` |
| **Push Notifications** | Web push via service worker | `push_subscriptions` |
| **Google Workspace** | Gmail scan (cron), Google Calendar, OAuth tokens | `google_tokens` |

### 1.2 Product Gaps (What's Missing for Orbit AI Extraction)

Based on competitive research against HubSpot Free, Pipedrive, Attio, Twenty, and CRM industry standards:

| Gap | Severity | Why It Matters | How Orbit AI Solves It |
|-----|----------|---------------|----------------------|
| **Companies as separate entity** | High | B2B CRM requires company→contact→deal relationships. Current `leads` table conflates contact and deal. | Core schema separates: `contacts`, `companies`, `deals` as independent entities with relationships |
| **Custom fields** | Critical | Every business needs different fields. Current schema is hardcoded (`event_date`, `event_location`). No runtime extensibility. | Schema engine: JSONB `custom_fields` + field definitions registry + `orbit schema add-field` |
| **Global search** | Medium | Can't search across contacts, deals, notes in one query. CRM is unusable during live calls without instant search. | Postgres `tsvector` full-text search across all entities. `orbit search <query>` in CLI. |
| **Webhooks outbound** | High | No way to trigger external systems on CRM events. Blocks Zapier/Make integration. Modern CRM table-stakes. | Standard Webhooks spec: HMAC signatures, retries, wildcard subscriptions, full payloads |
| **Won/Lost terminal states** | Medium | Pipeline stages are custom strings with no enforced terminal states. Can't calculate win rate reliably. | Pipeline stages have `is_won` and `is_lost` boolean flags. Win rate = won / (won + lost). |
| **"What do I do today" queue** | Medium | Morning brief exists as cron email, but no in-app daily task queue for reps. | `orbit tasks list --due today` + dashboard widget. Tasks surface overdue deals + follow-ups. |
| **API layer** | Critical | No REST API. All operations are Next.js server actions — not accessible from CLI, SDK, or external tools. | Hono REST API with OpenAPI spec. Framework-agnostic. |
| **CLI interface** | Critical | No terminal interface. Only web UI. Agents can't interact programmatically. | `@orbit-ai/cli` with 50+ commands, `--json` mode, `orbit context` briefing. |
| **MCP server** | Critical | Current AI tools (22) are built into the Next.js app. Not accessible as standalone MCP. | `@orbit-ai/mcp` with 23 core tools, stdio + HTTP transport, safety annotations. |
| **SDK** | Critical | No embeddable client library. Can't use Orbit in another app. | `@orbit-ai/sdk` — TypeScript client, type-safe, auto-pagination, works with any framework. |
| **Database portability** | High | Locked to one Supabase project (`zzmnmyxhkynbywnngess`). Can't self-host or use Neon. | Storage adapters: Supabase, Neon, SQLite in the initial supported release wave, with raw Postgres as a portability target immediately after. |

### 1.3 What We Keep (Proven Patterns to Extract)

These patterns from the current Orbit CRM are battle-tested and should be extracted into Orbit AI:

| Pattern | Where It Lives | How It Transfers |
|---------|---------------|-----------------|
| `get_my_org_id()` RLS function | Migration 025 | Core schema engine generates this for multi-tenant mode |
| `organization_id` on every tenant-scoped table | Migration 025 | Default for tenant data in multi-tenant mode; bootstrap/platform tables are excluded |
| `requireEditor()` / `requireAdmin()` guards | Server actions | SDK auth context: `OrbitClient({ context: { userId, orgId } })` |
| `logAudit()` on every mutation | Server actions | Built into core: every create/update/delete auto-logged |
| `checkRateLimit()` | Server actions | API middleware with Upstash Redis (hosted) or in-memory (self-hosted) |
| `escapeLike()` for search | Utils | Built into core query builder |
| Pipeline stages in DB | `pipeline_config` table | `pipelines` + `stages` tables with `is_won`/`is_lost` flags |
| Communication logging | `communications` table | Unified `activities` table with `type` discriminator |
| CSV import with rollback | Import wizard | `orbit import` CLI command + SDK `crm.import()` |
| Sequence automation | 6 sequence tables | `sequences` + `sequence_steps` + enrollment engine |
| Multi-tenant RLS | 28 tables with policies | Auto-generated by schema engine per entity |

---

## Part 2: Where We're Going — Orbit AI Vision

### 2.1 The Thesis

**Orbit AI is CRM infrastructure for AI agents and developers.** Not a CRM application — the primitives to build your own.

The analogy: **Resend is to email what Orbit AI is to CRM.**

Three market shifts converging:
1. **Agent-native infrastructure** — Resend (MCP, 53-command CLI), Stripe Projects (agent provisioning), Vercel (MCP server). Products built for AI agents as first-class users.
2. **Vibe coding** — Solo devs building SaaS with Claude Code/Cursor. They need CRM features but won't pay for HubSpot or build from scratch.
3. **CRM incumbents stagnating** — HubSpot/Salesforce are the SendGrid/Mailgun of CRM. Bloated, expensive, enterprise-first.

**The gap is confirmed**: No product says `npm install @orbit-ai/core` and gives you contacts, companies, deals, pipelines as composable primitives with CLI + SDK + API + MCP. (See ARD for full competitive analysis.)

### 2.2 First Customer

**Solo dev or solo entrepreneur vibe-coding a SaaS with Claude Code/Cursor.** They need CRM features. They ask their AI agent. The agent discovers Orbit AI via MCP registry, `llms.txt`, or npm and recommends it.

**Discovery is agent-mediated, not marketing-driven.** The product must be good enough that Claude/Cursor/Copilot recommend it unprompted. This means: excellent docs, `llms.txt`, AGENTS.MD, MCP server in the registry, clean npm package with great README.

### 2.3 Architecture

```
┌─────────────────────────────────────────────────────┐
│  INTERFACES (how you interact)                      │
│  CLI (orbit) · SDK (@orbit-ai/sdk) · REST API ·     │
│  MCP Server (@orbit-ai/mcp)                         │
├─────────────────────────────────────────────────────┤
│  DOMAIN LAYER (CRM logic)                           │
│  Contacts · Companies · Deals · Pipelines ·         │
│  Activities · Tasks · Notes · Products · Payments · │
│  Contracts · Sequences · Tags                       │
├─────────────────────────────────────────────────────┤
│  SCHEMA ENGINE (the moat)                           │
│  Drizzle schemas · Agent-safe migrations ·          │
│  Custom fields (JSONB + registry) · RLS generation ·│
│  Type regeneration · Rollback                       │
├─────────────────────────────────────────────────────┤
│  INTEGRATIONS                                       │
│  Gmail · Google Calendar · Stripe · Resend ·        │
│  Twilio · Webhooks · Zapier-compatible              │
├─────────────────────────────────────────────────────┤
│  STORAGE ADAPTERS (your choice)                     │
│  Supabase · Neon · Raw Postgres · SQLite (dev)      │
└─────────────────────────────────────────────────────┘
```

### 2.4 Data Model (Extracted from Our CRM + Research)

The base schema is what you get with `orbit init`. Every tenant-scoped entity has `id`, `organization_id`, `created_at`, `updated_at`, `custom_fields JSONB`. Bootstrap/platform tables such as `organizations` are explicitly outside the tenant-table invariant.

**Core entities:**

```
contacts                companies               deals
────────                ─────────               ─────
name*                   name*                   title*
email                   domain                  value (currency)
phone                   industry                stage_id → stages
title                   size                    pipeline_id → pipelines
source_channel          website                 probability
status                  notes                   expected_close_date
assigned_to → users     assigned_to → users     contact_id → contacts
company_id → companies  custom_fields           company_id → companies
lead_score              created_at              assigned_to → users
is_hot                  updated_at              won_at / lost_at / lost_reason
tags[]                                          custom_fields
notes
custom_fields

pipelines               stages                  activities
─────────               ──────                  ──────────
name*                   name*                   type* (call|email|meeting|
is_default              pipeline_id → pipelines   note|task|sms|custom)
                        order                   subject
                        probability             body
                        color                   direction (in|out|internal)
                        is_won                  contact_id → contacts
                        is_lost                 deal_id → deals
                                                company_id → companies
                                                duration_minutes
                                                outcome
                                                occurred_at
                                                logged_by → users

tasks                   notes                   products
─────                   ─────                   ────────
title*                  content*                name*
description             contact_id → contacts   price (currency)
due_date                deal_id → deals         currency
priority (low|med|high) company_id → companies  description
is_completed            created_by → users      is_active
contact_id → contacts                           sort_order
deal_id → deals
assigned_to → users

payments                contracts               tags
────────                ─────────               ────
amount*                 title*                  name*
currency                content                 color
status                  status (draft|sent|     entity_type
method                    signed|expired)
deal_id → deals         signed_at
contact_id → contacts   expires_at
external_id             deal_id → deals
                        contact_id → contacts

entity_tags             users
───────────             ─────
tag_id → tags           id (ULID, prefixed user_)
entity_type             email*
entity_id               name
                        role (admin|editor|viewer)
                        avatar_url
                        is_active

sequences               sequence_steps          field_definitions
─────────               ──────────────          ─────────────────
name*                   sequence_id → sequences entity (contacts|deals|...)
description             step_order              field_name
trigger_event           action_type (email|     field_type (text|number|
status (active|paused)    wait|task)              date|select|...)
                        delay_minutes           validation (JSON Schema)
                        template_subject        required
                        template_body           default_value
                                                options[] (for select)

webhooks                import_history          users (from auth)
────────                ──────────────          ─────
url*                    entity_type             id (from auth provider)
events[] (contact.*,    file_name               email
  deal.*, etc.)         total_rows              name
secret (HMAC key)       created / updated /     role
is_active                 skipped / failed      avatar_url
last_triggered_at       status
                        rollback_data
```

**Entity relationships:**
```
companies ──< contacts ──< deals
                │              │
                ├──< activities ├──< activities
                ├──< tasks      ├──< tasks
                ├──< notes      ├──< notes
                ├──< payments   ├──< payments
                └──< contracts  └──< contracts
```

### 2.5 Technology Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| **Language** | TypeScript (strict) | Dominant in vibe coding ecosystem. AI generates TS well. Same language for all packages. |
| **ORM** | Drizzle | 7KB, agent-friendly (plain TS functions), programmatic migration API (`drizzle-kit/api`), 33K stars, 4.9M weekly downloads. Beats MikroORM (150KB, decorator-heavy) and Prisma (custom DSL). |
| **API framework** | Hono | 14KB, runs everywhere (Node, Bun, Edge, Workers), native OpenAPI generation via Zod, framework-agnostic. |
| **CLI framework** | Commander.js + Ink | Commander for parsing, Ink for rich terminal output. |
| **MCP** | `@modelcontextprotocol/sdk` | Official Anthropic SDK. stdio + HTTP transport. |
| **Monorepo** | Turborepo + pnpm | Parallel builds, remote caching, Vercel-native. |
| **Validation** | Zod | Schema-first, pairs with Drizzle (`createSelectSchema`), Hono, and TypeScript. |
| **IDs** | Type-prefixed ULIDs | `contact_01HX...`, `deal_01HX...` — sortable, type-identifiable at a glance. Stripe pattern. |
| **Pagination** | Cursor-based | Never offset. `limit` + `cursor` → `next_cursor`. Proven across HubSpot, Attio, Pipedrive, Stripe. |
| **Versioning** | Date-based headers | `Orbit-Version: 2026-04-01`. Stripe pattern. 24-month deprecation window. |
| **License** | MIT | Maximum adoption. SaaS builders won't embed AGPL. Revenue from hosting, not license enforcement. |

### 2.6 Interface Design Summary

**23 core MCP tools** (universal + semantic pattern from Attio research):

| Tier | Tools | Count |
|------|-------|-------|
| Core record ops | `search_records`, `get_record`, `create_record`, `update_record`, `delete_record`, `relate_records`, `list_related_records`, `bulk_operation` | 8 |
| Pipeline intelligence | `get_pipelines`, `move_deal_stage`, `get_pipeline_stats` | 3 |
| Activity logging | `log_activity`, `list_activities` | 2 |
| Schema management | `get_schema`, `create_custom_field`, `update_custom_field` | 3 |
| Import/export | `import_records`, `export_records` | 2 |
| Sequences | `enroll_in_sequence`, `unenroll_from_sequence` | 2 |
| Analytics | `run_report`, `get_dashboard_summary` | 2 |
| Team | `assign_record` | 1 |
| **Total** | | **23 core tools** |

Every tool has: `readOnlyHint`, `destructiveHint`, `idempotentHint` safety annotations. Error responses include `hint` + `recovery` fields for agent self-correction.

Integrations may add namespaced extension tools in a composite runtime, but the core MCP package remains fixed at 23 tools.

**CLI** mirrors MCP with noun-verb structure:
```
orbit contacts list/get/create/update/delete/search/import/export
orbit companies list/get/create/update/delete/search
orbit deals list/get/create/update/delete/move/pipeline/stats
orbit log call/email/meeting/note
orbit tasks list/get/create/done
orbit schema list/describe
orbit fields create/update/delete
orbit report pipeline/activities/conversion
orbit dashboard
orbit context <contact-id|email>    # pre-flight briefing
orbit init / orbit status / orbit migrate / orbit seed / orbit doctor
```

Every command supports `--format=table|json|csv` and `--json` shorthand.

**REST API** pattern:
```
POST           /v1/bootstrap/organizations
GET            /v1/bootstrap/current_org
GET/POST       /v1/{entity}                   # tenant-scoped public entities only
GET/PATCH/DEL  /v1/{entity}/{id}
POST           /v1/search
POST           /v1/{entity}/batch
GET            /v1/{entity}/{id}/timeline
GET            /v1/{entity}/{id}/{relationship}
GET            /v1/objects                    # schema introspection
POST           /v1/schema/fields              # custom field management
GET            /v1/admin/{entity}             # platform and admin-only entities
```

Response envelope: `{ data, meta: { request_id, cursor, has_more }, links: { self, next } }`

**SDK**:
```typescript
const crm = new OrbitClient({ apiKey: process.env.ORBIT_API_KEY })
await crm.contacts.create({ name: 'Jane', email: 'jane@acme.com' })
await crm.deals.move(dealId, { stage: 'negotiation' })
await crm.schema.addField('contacts', { name: 'wedding_date', type: 'date' })
for await (const contact of crm.contacts.list().autoPaginate()) { ... }
```

### 2.7 Competitive Positioning

```
                    Agent-Native
                         |
          Orbit AI *     |
          (primitives,   |     Attio (product, MCP)
           CLI/SDK/MCP)  |
                         |
  Lightweight -----------+------------ Heavy Framework
  (npm install,          |             (Docker, clone,
   embed in YOUR stack)  |              live inside)
                         |
          Twenty         |     Open Mercato
          (OSS product)  |     (framework, ERP+CRM)
                         |
                         |     HubSpot / Salesforce
                         |
                    Human-Native
```

**Key differentiators:**
- vs HubSpot/Salesforce: 100x cheaper, self-hostable, agent-native, no seat pricing
- vs Twenty (43K stars): Infrastructure, not product. Embeddable. Schema engine for agents.
- vs Attio ($52M): Open source. No per-seat pricing. Schema-as-code.
- vs Open Mercato (1.1K stars): Lightweight primitives vs heavy framework. No Docker/Redis/Meilisearch required. Agent-safe migrations. Hosted option.

### 2.8 What We Learn From Competitors

| From | Pattern | How We Apply It |
|------|---------|----------------|
| **Resend** | Open-source wedge (React Email), CLI + MCP, `llms.txt`, 5-min onboarding | Ship schema engine as standalone value. `llms.txt` + AGENTS.MD from day one. |
| **Stripe** | Prefixed IDs, idempotency keys, date-based versioning, `expand` param, error format | All adopted in API design. See §2.5. |
| **Stripe Projects** | `stripe projects add orbit/crm` — one-command provisioning | Distribution channel. Apply when ready. CRM is missing from their catalog. |
| **Attio** | Universal MCP tools (18 tools for 70+ operations), object/attribute model | 23 universal tools with `object_type` parameter. Safety annotations. |
| **Open Mercato** | AGENTS.MD per module, InboxOps (email→LLM→approval), Workflow Engine, Standard Webhooks, field encryption, OCP overlay | AGENTS.MD adopted for MVP. InboxOps and Workflows for v1.1. Standard Webhooks for webhook system. |
| **Twenty** | Schema-as-API (metadata endpoint), dual API (REST + GraphQL), human-readable slugs | `GET /v1/objects` for schema introspection. Named slugs everywhere (never hash keys). |
| **HubSpot (anti-patterns)** | Confusing associations, webhook payloads without data, 10K search limit, multi-version API | Full payloads in webhooks. No search result caps. Single versioning scheme. Clean relationships. |
| **Pipedrive (anti-patterns)** | 40-char hash keys for custom fields | Human-readable slugs always. |
| **json-render** | UI as runtime output, flat JSON spec, multi-platform rendering | Optional TUI via Ink. React component library for web. Not a dependency — core works without it. |
| **crm-cli.sh** | Local-first CRM with built-in MCP, `crm context` briefing command | `orbit context <email>` adopted. CLI + MCP share service layer. |

### 2.9 Pricing Model

This is the current hosted pricing hypothesis. Package v1 readiness is the hard release bar. Hosted is part of the first release window, likely as beta, and hosted GA depends on the final isolation and operating-model decisions.

| Tier | Price | Records | API Calls/mo | Includes |
|------|-------|---------|-------------|----------|
| **Community (self-hosted)** | Free forever | Unlimited | Unlimited | Full OSS: CLI, SDK, API, MCP, all entities. You run your own infra — no hosted services. |
| **Pro** | $29/mo | 25,000 | 100,000 | Managed hosting beta or GA depending on isolation readiness, hosted MCP endpoint, webhooks, email support |
| **Scale** | $99/mo | 250,000 | 1,000,000 | Priority support, automations, analytics, SSO |
| **Enterprise** | Custom | Unlimited | Unlimited | SLA, dedicated infra, field-level encryption |

---

## Part 3: Build Plan — The 6 Specs

Each spec is a self-contained implementation document. A developer (or agent) with no prior context can follow it to build the package.

### Spec 1: `@orbit-ai/core`
**The foundation. Everything depends on this.**

Scope:
- Drizzle schema definitions for all 20+ entities (extracted from our 28 Supabase tables, refactored into clean entity model)
- Storage adapter interface (Supabase, Neon, SQLite in the initial supported release wave; raw Postgres as a portability target immediately after)
- Schema engine: custom field definitions, `addField`, `addEntity`, `promote`
- Migration engine: generate, preview, apply, rollback, non-destructive default
- RLS auto-generation (`get_my_org_id()` pattern for multi-tenant, `auth.uid()` for single-tenant)
- TypeScript type regeneration from schema
- Entity operations: type-safe CRUD for all entities
- Audit logging: every mutation auto-logged with before/after
- Validation: Zod schemas generated from Drizzle (`createSelectSchema`, `createInsertSchema`)
- ID generation: type-prefixed ULIDs (`contact_`, `deal_`, etc.)
- AGENTS.MD for every entity

Additional scope from review:
- **Shared types module** (`@orbit-ai/core/types`): error codes enum, response envelope type, pagination types (`Cursor`, `PaginatedResult`), entity ID types. Must exist before Phase 2 branches so CLI, MCP, and API don't diverge.
- **Users/team table**: `users` table managed by core. On Supabase adapter, synced from `auth.users` → `profiles`. On raw Postgres/SQLite, managed directly via `orbit users create`. Spec must define `IUserResolver` interface per adapter.
- **Tags join table**: `entity_tags (tag_id, entity_type, entity_id)` — polymorphic join table. Tags are global (not per-entity-type).
- **SQLite migration limitations**: Document that field type changes and column drops require table recreation (handled by Drizzle, but with data movement). `orbit doctor` should warn about this in SQLite mode.
- **Multi-tenancy in non-Supabase mode**: `organization_id` columns present in all tenant-scoped adapters. RLS enforcement is Supabase/Postgres only. On SQLite, multi-tenancy enforced at application level (WHERE clause in queries), not database level. Document this clearly.
- **`getContactContext()` query**: Core function that returns full dossier: contact record + company + last 10 activities + open tasks + open deals + tags + last contact date. Used by CLI `orbit context` and composable by MCP agents.

Dependencies: Drizzle ORM, Zod, ulid
Depends on: Nothing (foundation)
Blocks: All other packages

### Spec 2: `@orbit-ai/api`
**The universal HTTP interface.**

Scope:
- Hono REST API server with OpenAPI 3.1 auto-generation
- All entity endpoints: CRUD + search + batch + timeline + relationships
- Authentication: API key (hashed, scoped to org) + OAuth 2.0 (v1.1)
- Rate limiting: configurable per key, sliding window, `X-RateLimit-*` headers
- Webhook system: Standard Webhooks spec, HMAC signatures, retries, full payloads, wildcard subscriptions
- Response envelope: `{ data, meta, links }` consistent format
- Error format: `{ code, message, field, doc_url, request_id }`
- Pagination: cursor-based everywhere
- `?include=` parameter for relationship expansion
- `Orbit-Version` date-based versioning
- Idempotency keys on all mutations
- Schema introspection: `GET /v1/objects`, `GET /v1/objects/{type}`
- Custom field management: `POST /v1/objects/{type}/fields`
- Deployable as: standalone Node server, Vercel Function, Cloudflare Worker, embedded in any app

Dependencies: Hono, Zod, `@orbit-ai/core`
Depends on: Spec 1 (core)

### Spec 3: `@orbit-ai/sdk`
**The embeddable TypeScript client.**

Scope:
- `OrbitClient` — main client class, configurable (API key OR direct DB URL)
- Resource classes: `contacts`, `companies`, `deals`, `activities`, `tasks`, `notes`, `products`, `payments`, `contracts`, `sequences`, `pipelines`, `schema`, `webhooks`
- Each resource: `create()`, `get()`, `update()`, `delete()`, `list()`, `search()`
- Auto-pagination: `list().autoPaginate()` returns async iterator
- Type-safe: types auto-generated from core schema, includes custom fields
- Error handling: typed errors with `code`, `message`, `recovery`
- Idempotency: auto-generated keys on all writes
- Retries: auto-retry on 429/503 with exponential backoff
- Auth context: `{ userId, orgId }` for user-level operations
- Schema operations: `crm.schema.addField()`, `crm.schema.addEntity()`
- Pipeline operations: `crm.deals.move()`, `crm.pipelines.stats()`
- Import/export: `crm.contacts.import(csvData)`, `crm.contacts.export()`
- Event emitter: `crm.on('contact.created', handler)` for local hooks

Dependencies: `@orbit-ai/core` (for direct DB mode), fetch (for API mode)
Depends on: Spec 1 (core), optionally Spec 2 (API)

### Spec 4: `@orbit-ai/cli`
**The terminal interface for humans and agents.**

Scope:
- Commander.js command structure: `orbit <noun> <verb> [options]`
- All entity commands: contacts, companies, deals, tasks, notes, sequences
- Activity logging: `orbit log call|email|meeting|note`
- Pipeline: `orbit deals pipeline`, `orbit deals move`, `orbit deals stats`
- Schema management: `orbit schema list|describe`, `orbit fields create|update|delete`
- Migration: `orbit migrate --preview|--apply|--rollback`
- Setup: `orbit init --db supabase|neon|local`, `orbit seed`, `orbit doctor`, `orbit status`
- Context briefing: `orbit context <contact-id|email>` — full dossier in one call
- Reports: `orbit report pipeline|activities|conversion`, `orbit dashboard`
- Import/export: `orbit contacts import <file.csv>`, `orbit contacts export`
- Search: `orbit search <query>` — cross-entity full-text search
- Output: `--format=table|json|csv|tsv`, `--json` shorthand, `--quiet`, `--no-color`
- Agent mode: `--json` on every command, structured error output, idempotency keys
- Interactive mode: autocomplete, fuzzy search, confirmation prompts
- MCP server start: `orbit mcp serve`
- Rich terminal output via Ink (tables, colors, pipeline visualization)
- Distribution: `npx @orbit-ai/cli` + standalone binary via `bun build --compile`

Dependencies: Commander.js, Ink, `@orbit-ai/core`
Depends on: Spec 1 (core)

### Spec 5: `@orbit-ai/mcp`
**The agent-native interface.**

Scope:
- 23 core MCP tools organized in 8 tiers (see §2.6), plus optional namespaced integration extensions in composite runtimes
- Safety annotations on every tool: `readOnlyHint`, `destructiveHint`, `idempotentHint`
- Error responses with `hint` + `recovery` fields for agent self-correction
- Schema discovery: `get_schema` returns all entities and their fields at runtime
- Transport: stdio (Claude Code, Cursor) + HTTP (hosted, remote agents)
- Auth: API key via environment variable or tool parameter
- Tool descriptions optimized for LLM tool selection (when to use, when NOT to use, prerequisites)
- MCP Resources: `team_members` (not a tool — reference data)
- Universal tools use `object_type` parameter (Attio pattern) — one `create_record` for all entity types
- Semantic workflow tools for multi-step operations: `move_deal_stage`, `log_activity`
- Truncation of long text fields with `truncated: true` flag
- ID resolution: responses include both ID and human-readable name
- Registration: `claude mcp add orbit -- npx @orbit-ai/mcp` or `orbit mcp serve`
- Publishable to MCP server registry (modelcontextprotocol/servers)
- AGENTS.MD integration: tool descriptions reference entity documentation

Dependencies: `@modelcontextprotocol/sdk`, `@orbit-ai/core`
Depends on: Spec 1 (core)

### Spec 6: `@orbit-ai/integrations`
**Connectors to external services.**

Scope:
- Integration architecture: each connector is a plugin that registers with core
- `orbit integrations add <name>` — installs packages, configures, exposes new CLI/MCP tools
- Configuration: `.orbit/integrations.json` per project

Essential connectors (MVP):
- **Gmail**: Two-way email sync, automatic activity logging, OAuth 2.0 (extracted from current Orbit CRM gmail-scan)
- **Google Calendar**: Meeting sync, booking page integration (extracted from current Orbit CRM)
- **Stripe**: Payment links, transaction tracking, Express Connect (extracted from current Orbit CRM)

Note: Webhooks outbound are part of Spec 2 (API), not this package. This package consumes the webhook delivery system to register integration-specific event handlers.

Should-have connectors (v1.1):
- **Resend**: Email sending from CRM (`orbit.email.send` MCP tool)
- **Twilio**: SMS/WhatsApp (extracted from current Orbit CRM)
- **Slack**: Notifications on CRM events
- **Zapier/Make**: Webhook-based compatibility (inbound triggers + outbound actions)

Each connector exposes:
- New MCP tools (e.g., `email.send`, `calendar.create_event`)
- New CLI commands (e.g., `orbit email send`, `orbit calendar view`)
- Webhook handlers for inbound events
- Configuration schema (what env vars / API keys are needed)

Dependencies: Per-connector (googleapis, stripe, resend, etc.)
Depends on: Spec 1 (core), Spec 2 (API for webhook delivery)

---

## Part 4: Build Sequence

```
                    @orbit-ai/core (Spec 1)
                    ┌──────────────────┐
                    │ Schema + Engine  │
                    │ Entities + CRUD  │
                    │ Adapters + RLS   │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        @orbit-ai/cli  @orbit-ai/mcp  @orbit-ai/api
        (Spec 4)       (Spec 5)       (Spec 2)
              │              │              │
              └──────┬───────┘              │
                     │                      │
              @orbit-ai/sdk
              (Spec 3 — direct: core | remote: API over HTTP)
                     │
              @orbit-ai/integrations
              (Spec 6 — plugs into core + api)
```

**Phase 1**: Core (Spec 1) — the foundation everything depends on
**Phase 2**: CLI + MCP + API in parallel (Specs 4, 5, 2) — all three wrap core operations
**Phase 3**: SDK (Spec 3) — wraps API or connects directly to DB via core
**Phase 4**: Integrations (Spec 6) — plugs into core + API for webhooks
**Phase 5**: Documentation, `llms.txt`, AGENTS.MD, MCP registry listing
**Phase 6**: Hosted beta + billing, with hosted GA gated by the isolation decision

---

## Part 5: Success Criteria

### Launch Readiness Checklist

- [ ] `orbit init --db local` works in < 30 seconds
- [ ] `orbit contacts create` + `orbit contacts list` + `orbit contacts get` work
- [ ] `orbit deals create` + `orbit deals move` + `orbit deals pipeline` work
- [ ] `orbit schema add-field contacts wedding_date date` adds field and regenerates types
- [ ] `orbit migrate --preview` shows SQL diff without applying
- [ ] `orbit context <email>` returns full contact dossier
- [ ] MCP server: `claude mcp add orbit -- npx @orbit-ai/mcp` registers and works
- [ ] MCP: `create_record`, `search_records`, `move_deal_stage`, `log_activity` all work
- [ ] SDK: `OrbitClient` connects via API key or direct DB
- [ ] API: OpenAPI spec auto-generated and serves at `/docs`
- [ ] Gmail integration syncs emails to activity log
- [ ] Webhooks fire on contact/deal CRUD events
- [ ] CSV import works via CLI and SDK
- [ ] `llms.txt` published at docs root
- [ ] AGENTS.MD exists for every entity
- [ ] README has working code examples for all 4 interfaces
- [ ] MIT LICENSE
- [ ] npm packages published under `@orbit-ai/*`

### 6-Month Targets (Realistic)

| Metric | Target |
|--------|--------|
| GitHub stars | 2,000-5,000 |
| npm weekly downloads | 1,000 |
| Active CLI users | 200 |
| MCP server downloads | 500 |
| Hosted tier customers | 30-50 |
| Monthly revenue | $1.5K-3K |

### North Star Metric
**Active projects with 100+ records** — someone built a real thing, not just a demo.

---

## Appendix: Research Sources

See these documents for full research details:
- `docs/strategy/orbit-ai-ard.md` — Architecture Research Document (competitive analysis, tech decisions, Open Mercato deep dive)
- `docs/strategy/orbit-ai-prd.md` — Product Requirements Document (features, pricing, GTM, risks)
- `docs/research/competitive-analysis.md` — Competitive landscape analysis

Key research conducted:
- Resend: 150K devs, $21M raised, CLI + MCP, React Email (12K stars), "Stripe for Email"
- Stripe Projects: launched March 26, 2026, 10 providers, no CRM, agent provisioning
- Open Mercato: 1.1K stars, 35 modules, MikroORM + Awilix, MCP (4 tools), InboxOps, Workflow Engine v1.0
- Twenty CRM: 43K stars, GraphQL + REST, metadata API, AGPL
- Attio: $52M, MCP server, universal tool pattern, object/attribute model
- json-render: Vercel Labs, 27 packages, multi-platform UI rendering
- HubSpot/Pipedrive/Salesforce API design patterns analyzed
- CRM MCP servers analyzed: HubSpot, Salesforce, Attio (18 tools), Pipedrive (100+), Twenty (23), crm-cli.sh
- Drizzle vs MikroORM: Drizzle wins (7KB vs 150KB, 33K vs 8.8K stars, agent-friendly)
- Pricing benchmarks: Resend, Supabase, Neon, Twenty, Attio, Clay
