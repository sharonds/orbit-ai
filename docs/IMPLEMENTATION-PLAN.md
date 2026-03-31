# Orbit AI Implementation Plan

Date: 2026-03-31
Status: Draft after spec review
Prerequisite: resolve the issues in [REVIEW-REPORT.md](/Users/sharonsciammas/orbit-ai/docs/REVIEW-REPORT.md)

## 1. Exit Criteria Before Coding

Implementation should not start until these are explicitly resolved in the specs:

1. Request-scoped tenant context is transaction-bound and safe on pooled Postgres connections.
2. Core/API service coverage is aligned, including the fate of system entities and `batch()`.
3. CLI command registry matches the declared command surface.
4. SDK return contract and idempotency behavior are fixed.
5. Plugin-owned schema extension model is defined in core.
6. `organizations` is removed from the literal `organization_id` invariant or documented as the sole exception.
7. MCP core-vs-extension tool model is fixed.
8. Integrations event architecture is split into internal events, outbound customer webhooks, and inbound provider sync paths.
9. API admin/system route model is typed and scoped concretely.
10. MCP tool definitions are expressed in TypeScript for all 23 tools.
11. Shared internal-vs-wire naming conventions are documented.
12. Connector persistence tables are fully specified.

## 2. Recommended Build Order

### Phase 0: Spec Corrections

Outputs:

- revised `01-core.md`
- revised `02-api.md`
- revised `03-sdk.md`
- revised `04-cli.md`
- revised `05-mcp.md`
- revised `06-integrations.md`

Goals:

- resolve the review report issues
- freeze shared contracts
- lock one canonical base entity list
- lock the MCP extensibility model
- lock the integration event architecture
- lock the internal-vs-wire serialization rule

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

Parallelize only after Phase 0 freezes the shared contracts.

## 4. Validation Gates

At the end of each phase:

1. run typecheck for all touched packages
2. regenerate artifacts and verify no drift
3. run adapter-specific integration tests where relevant
4. update AGENTS.MD and docs for any changed contract
5. confirm OpenAPI, SDK, CLI, and MCP still agree on the same wire format

## 5. Immediate Next Action

Next action: revise the six specs to close the issues in the review report, then freeze a “v1 implementation baseline” before writing any package code.
