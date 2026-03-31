# Orbit AI Product Brief

Date: 2026-03-31
Status: Draft
Primary inputs:
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md)
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md)
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [docs/specs](/Users/sharonsciammas/orbit-ai/docs/specs)

## 1. Product Summary

Orbit AI is CRM infrastructure for AI agents and developers.

It is not a CRM application with a built-in opinionated UI. The product is a programmable CRM foundation that developers and agents can install, provision, extend, and operate through code, the terminal, HTTP, and MCP.

The core promise is:

- give a project a production-grade CRM data model in minutes, not weeks
- make schema evolution safe enough for agent-assisted development
- keep the same CRM contract available through core services, REST API, SDK, CLI, and MCP
- remain portable across the initial adapter wave and preserve a path to broader Postgres portability

The strategic analogy remains: Resend for CRM, not another HubSpot clone.

## 2. Why This Product Exists

Every business application eventually needs some form of CRM behavior: contacts, companies, deals, notes, activities, products, payments, contracts, tagging, search, integrations, and event delivery.

Today the choices are poor for the target customer:

- build from scratch and absorb schema design, migrations, auth boundaries, and agent tooling yourself
- embed an incumbent CRM product and inherit seat pricing, product-first abstractions, and weak developer ergonomics
- use a generic database or no-code base and rebuild CRM domain behavior on top

Orbit AI exists to create the missing category: composable CRM infrastructure that is developer-native and agent-native from day one.

## 3. Target Customer

### Primary

Solo developers and solo entrepreneurs building with Claude Code, Cursor, Bolt, or similar agent-assisted workflows.

Why this customer matters:

- they feel the pain of building CRM capability from scratch immediately
- they are price-sensitive and resist seat-based CRM products
- they prefer tools that are easy to install, script, and embed
- they are likely to discover the product through their AI agent rather than traditional demand generation

### Secondary

Small SaaS teams embedding CRM primitives in their own products.

### Tertiary

Agency developers shipping custom CRM-like systems for multiple clients.

### Distribution Model

AI agents are a distribution channel, not just an interface.

Orbit AI must be good enough that an agent can:

- discover it from docs, package metadata, and MCP listings
- understand what it does from machine-readable docs
- install it or configure it with minimal human intervention
- use it safely through structured interfaces

## 4. Jobs To Be Done

Orbit AI should let a developer or agent say:

- "Give my app a CRM data model without building one from zero."
- "Let me manage contacts, companies, deals, activities, and pipeline with one shared contract."
- "Let my agent inspect and evolve the schema safely."
- "Expose CRM operations through API, SDK, CLI, and MCP without maintaining four different systems."
- "Keep my CRM portable across local development and the initial supported Postgres adapters."
- "Add custom fields and connectors without forking the platform."

## 5. Product Pillars

### 5.1 Schema Engine

This is the moat.

Orbit AI is not just a bundle of CRUD tables. It is a schema engine that combines:

- Drizzle-based schemas
- safe, previewable migrations
- rollback metadata
- tenant-aware RLS generation for Postgres-family adapters
- custom fields via JSONB plus field-definition registry
- generated type and machine-readable artifact updates

### 5.2 Agent-Native Interfaces

Every important action must be available through structured interfaces:

- CLI with `--json`
- REST API with typed envelopes, cursor pagination, and idempotency
- TypeScript SDK
- MCP server with tool descriptions and safety annotations

### 5.3 Headless Composability

Orbit AI owns CRM primitives, not the final application.

Developers retain control of:

- UI
- auth provider
- deployment topology
- higher-level business workflows

### 5.4 Portability

Orbit AI should not be locked to one managed Postgres vendor.

The supported adapter story is part of the product value:

- Supabase for mainstream developer adoption
- Neon for branching and hosted Postgres workflows
- SQLite for zero-config local development

Raw Postgres remains part of the long-term portability story and the core adapter contract, but the initial product support bar should follow the current rollout priorities in the planning docs.

### 5.5 Extension Without Forking

The platform must support:

- custom fields
- plugin-owned tables
- connector-owned state
- namespaced MCP and CLI extensions

without forcing users to fork core package code.

## 6. What Ships In v1

The v1 product plan includes both the self-hostable package release and a hosted offering path. The implementation-critical baseline is package-first and interface-complete, while hosted launch readiness depends on the still-open isolation and operating model decisions.

### 6.1 CRM Foundation

- tenant-scoped base entities with prefixed ULID identifiers
- shared error, envelope, pagination, filter, and search contracts
- core service layer for the first-party object model
- audit logging and idempotency support

### 6.2 Safe Schema Operations

- schema description and generated artifacts
- custom fields via JSONB plus registry
- add-field and add-entity workflows
- previewable, reversible migrations
- RLS generation for supported Postgres-family adapters

### 6.3 Interface Completeness

- `@orbit-ai/api` for HTTP access
- `@orbit-ai/sdk` in both HTTP mode and direct-core mode
- `@orbit-ai/cli` for setup, schema changes, CRUD, context, diagnostics, and MCP serving
- `@orbit-ai/mcp` with the 23 core tools

### 6.4 Initial Adapter Support

- Supabase
- Neon
- SQLite for local development and application-enforced tenant-aware development workflows

Raw Postgres should remain compatible with the core design, but it should not be treated as a guaranteed initial-release support promise unless the PRD and implementation plan are updated to make it explicit.

### 6.5 Integration Foundation

- plugin architecture for integrations
- first-party connectors for Gmail, Google Calendar, and Stripe
- outbound webhooks
- internal eventing separation from outbound and inbound webhook flows

### 6.6 Hosted Offering Direction

The product strategy still includes a hosted tier, hosted MCP endpoint, and usage-based monetization. The canonical stance is:

- package v1 readiness is the hard launch bar
- hosted is part of the first release window
- hosted may launch as beta alongside package v1
- hosted GA depends on the isolation and operating model being resolved

### 6.7 Agent Discoverability

- AGENTS.MD coverage
- machine-readable schema artifacts
- high-quality README and docs
- `llms.txt` and MCP discoverability work

## 7. What Is Not v1

The following are intentionally outside the first release:

- a hosted CRM web application
- Orbit-owned end-user auth or session management
- general ERP, finance, or HR scope
- broad marketing automation
- a generic workflow platform
- Python SDK
- advanced InboxOps automation
- enterprise field-level encryption as a complete product feature
- broad connector marketplace beyond Gmail, Google Calendar, and Stripe
- hosted Stripe Projects integration as a launch dependency

## 8. Package-To-Value Map

| Package | Product Role | Customer Value |
|--------|--------------|----------------|
| `@orbit-ai/core` | source of truth for schema, types, migrations, services, adapters | safe CRM foundation and portability |
| `@orbit-ai/api` | universal HTTP interface | framework-agnostic integration and automation |
| `@orbit-ai/sdk` | embeddable TypeScript client | fastest path to application integration |
| `@orbit-ai/cli` | operational and agent control surface | fast setup, debugging, schema changes, scripted workflows |
| `@orbit-ai/mcp` | agent-native tool surface | direct use from Claude Code, Cursor, and similar tools |
| `@orbit-ai/integrations` | connector and plugin runtime | practical CRM interoperability without core forks |

## 9. Product Positioning

### Against Incumbent CRMs

Against HubSpot and Salesforce, Orbit AI wins on:

- infrastructure-first model
- self-hostability
- no seat-based pricing
- schema flexibility
- agent-native interfaces

### Against Modern CRMs

Against Attio and Twenty, Orbit AI wins on:

- embeddable primitives instead of end-user product software
- open architecture
- stronger schema-as-code posture
- MCP and CLI as first-class interfaces

### Against Open Mercato

Against Open Mercato, Orbit AI wins on:

- lighter runtime
- narrower and clearer product scope
- stronger focus on CRM primitives rather than a broad application framework
- more explicit agent-native contract design

## 10. Business Model

Orbit AI follows an open-source wedge with managed-service monetization.

### Free / Open

- full self-hostable packages
- local MCP
- CLI, API, SDK, and core platform primitives

### Paid / Managed

The planned monetization path is:

- hosted control plane and managed infrastructure
- hosted MCP endpoint
- usage-based billing
- operational support and SLA
- premium governance and enterprise controls later

Important constraint: hosted economics and isolation are not fully decided yet. Shared-DB versus dedicated-project isolation remains an open business and security decision, especially for Supabase-backed hosting.

## 11. Success Metrics

### North Star

Active projects with 100+ records.

This indicates a real system was built, not just tested.

### Activation Metrics

- `orbit init` success rate
- time to first contact or deal created
- time to first schema customization
- time to first successful SDK request
- time to first successful MCP tool call

### Retention and Depth Metrics

- schema modifications per active project
- repeated CLI usage per project
- repeated MCP tool usage per project
- integration setup rate
- webhook activation rate

### Business Metrics

- GitHub stars
- npm downloads
- active CLI users
- hosted customers
- monthly recurring revenue

## 12. Open Product Decisions

These decisions should be frozen before implementation is too far along:

1. Hosted isolation model
   Shared multi-tenant database with RLS, schema-per-tenant, or dedicated project per customer.

2. Supabase migration strategy
   Direct Drizzle ownership versus Supabase-compatible migration generation.

3. Realtime model
   Adapter-specific capability or unified abstraction.

4. Search strategy beyond MVP
   Postgres FTS only or optional Meilisearch/pgvector path.

5. Open-source wedge
   Which package or artifact is the best star-generating entry point independent of the paid product.

6. v1 hosted launch shape
   Whether hosted ships as beta or GA alongside the first public release.

## 13. Product Boundaries

Orbit AI should remain disciplined about what it is:

- CRM infrastructure
- agent-usable
- developer-first
- portable
- safe to extend

It should resist becoming:

- a full CRM application
- a generic workflow platform
- a communications platform
- a broad ERP framework

## 14. Recommended Next Product Documents

This brief should be followed by:

- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [database-hardening-checklist.md](/Users/sharonsciammas/orbit-ai/docs/security/database-hardening-checklist.md)

Together, these documents define what Orbit AI is, what ships first, and what must be true before implementation and release.
