# Orbit AI Implementation Plan

Date: 2026-03-31
Status: Draft after top-level docs reconciliation
Prerequisite: complete the remaining implementation-facing contract pushdown from [docs-validation-report.md](/Users/sharonsciammas/orbit-ai/docs/review/docs-validation-report.md)

## 1. Exit Criteria Before Coding

The original spec-review blockers are now closed in the package specs. Broad implementation should start only after the remaining implementation-facing clarifications are pushed into the build docs:

1. Core and API specs define runtime role versus migration role expectations.
2. Request paths explicitly prohibit elevated credentials such as Supabase `service_role`.
3. API and MCP specs define redacted read contracts for secret-bearing objects.
4. SDK and CLI specs agree on how `--json` output obtains envelope metadata.
5. Top-level docs remain aligned on hosted stance, adapter rollout, and `v1` scope while implementation begins.

## 2. Recommended Build Order

### Phase 0: Contract Pushdown

Outputs:

- revised `01-core.md`
- revised `02-api.md`
- revised `03-sdk.md`
- revised `04-cli.md`
- revised `05-mcp.md`
- revised `06-integrations.md`
- validation note closing the remaining contract gaps

Goals:

- push security authority rules into implementation-facing specs
- push secret-redaction rules into API and MCP contracts
- lock the CLI/SDK JSON contract
- confirm the reconciled top-level docs remain the canonical product baseline

### Phase 1: Core Foundations

Package: `@orbit-ai/core`

Deliverables:

- ID utilities and parsers
- shared error/envelope/pagination/search types
- bootstrap org model, user, membership, and API key schema
- tenant-aware adapter interface
- migration bootstrap
- explicit internal page type to wire envelope mapper
- per-request tenant-context transaction pattern

Exit criteria:

- a clean migration can create the bootstrap schema without self-referential org hacks
- request-scoped tenant context is safe on Postgres pools and SQLite
- internal pagination and wire envelopes have one documented translation path

### Phase 2: Core Domain Schema and Services

Package: `@orbit-ai/core`

Deliverables:

- entity tables and relations
- CRUD services for contacts, companies, deals, activities, tasks, notes, products, payments, contracts, sequences, stages, pipelines, tags, webhooks, imports, and users
- explicit decision and service layer for system/admin entities
- batch service support if batch remains generic
- audit logging
- contact context
- search service

Exit criteria:

- all CRUD services run against at least one Postgres adapter and SQLite
- cursor pagination is stable across entities

### Phase 3: Schema Engine and RLS

Package: `@orbit-ai/core`

Deliverables:

- custom field registry
- `addField`, `addEntity`, `promoteField`
- reversible migration records
- Postgres RLS generation
- plugin schema extension hooks
- plugin-owned table registration and tenant policy metadata

Exit criteria:

- custom field creation and promotion are previewable and reversible
- plugin tables can register tenant policy metadata

### Phase 4: API Server

Package: `@orbit-ai/api`

Deliverables:

- auth middleware
- request ID, versioning, idempotency, rate limiting
- public and admin route layers
- typed global search route
- object introspection and schema routes
- webhook registration and delivery worker
- OpenAPI generation

Exit criteria:

- OpenAPI matches the real route behavior
- every supported entity has list/get/create/update/delete semantics where intended
- read-only system entities enforce read-only semantics
- admin-only entities enforce stronger scope checks in code, not prose

### Phase 5: SDK

Package: `@orbit-ai/sdk`

Deliverables:

- transport abstraction
- HTTP transport
- direct transport
- resource classes
- retry and idempotency behavior
- cross-entity search client
- explicit record-vs-envelope public contract
- direct-mode operation map for all supported non-CRUD routes

Exit criteria:

- API mode and direct mode produce the same public results
- auto-pagination works uniformly

### Phase 6: CLI

Package: `@orbit-ai/cli`

Deliverables:

- full command registry
- formatters
- interactive prompts
- `orbit init`
- `orbit context`
- reports and dashboard
- `orbit mcp serve`

Exit criteria:

- every declared command exists
- `--json` mode is stable and machine-safe across commands
- direct mode and hosted mode are both configurable from `orbit init`

### Phase 7: MCP

Package: `@orbit-ai/mcp`

Deliverables:

- 23 tool definitions in code
- tool execution runtime
- stdio transport
- HTTP transport
- MCP resources
- explicit policy for whether integrations may extend the core 23-tool set

Exit criteria:

- tool registry matches the spec exactly
- errors include actionable recovery guidance

### Phase 8: Integrations

Package: `@orbit-ai/integrations`

Deliverables:

- plugin loader
- Gmail connector
- Google Calendar connector
- Stripe connector
- connector CLI and MCP registration
- connector persistence tables
- inbound provider webhook and polling runners
- internal event subscriptions

Exit criteria:

- connectors can install without modifying core package code
- connector state is tenant-scoped and migration-safe
- connector flows do not reuse the customer outbound webhook worker as an internal event bus

## 3. Parallelization Strategy

Use sub-agents by workstream rather than by package count.

Recommended workstreams:

1. Core schema and migration engine
2. API and SDK contract implementation
3. CLI and MCP interface implementation
4. Integrations and plugin extension model
5. Cross-cutting eventing and serialization rules

Parallelize only after Phase 0 closes the remaining implementation-facing contract gaps.

## 4. Validation Gates

At the end of each phase:

1. run typecheck for all touched packages
2. regenerate artifacts and verify no drift
3. run adapter-specific integration tests where relevant
4. update AGENTS.MD and docs for any changed contract
5. confirm OpenAPI, SDK, CLI, and MCP still agree on the same wire format

## 5. Immediate Next Action

Next action: close the remaining Phase 0 contract-pushdown items in the implementation-facing specs, then freeze a “v1 implementation baseline” before broad package work begins.
