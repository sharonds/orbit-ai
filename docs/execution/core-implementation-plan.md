# Orbit AI Core Implementation Plan

Date: 2026-03-31
Status: Execution-ready baseline
Package: `@orbit-ai/core`
Depends on:
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [orbit-skills-plan.md](/Users/sharonsciammas/orbit-ai/docs/skills/orbit-skills-plan.md)

## 1. Purpose

This document defines how to execute `@orbit-ai/core` from zero to a package baseline that can safely unblock API, SDK, CLI, MCP, and integrations.

It is intentionally narrower than the core spec. The spec defines what must exist. This plan defines:

- what to build first
- what can be deferred inside core
- what validation must pass before the next slice begins
- where tenant-safety and schema-safety review must happen

## 2. Core Mission

`@orbit-ai/core` must deliver five things before other packages can move safely:

1. shared types and ID system
2. canonical schema and relations
3. tenant-safe adapters and runtime authority boundaries
4. CRUD/admin/search/context service layer
5. schema engine and RLS generation

If any of those are weak, downstream packages will either drift or encode security bugs.

## 3. Execution Principles

1. Build the tenant boundary before building breadth.
2. Build shared types before package-specific transport contracts.
3. Build bootstrap/admin separation early so it does not get retrofitted later.
4. Add schema-engine mutation capability only after the authority model is working.
5. Use the planned skills selectively during core work:
   - `orbit-tenant-safety-review`
   - `orbit-schema-change`
   - `orbit-core-slice-review`

## 4. Non-Goals For Initial Core Execution

Do not expand scope during the first core pass to include:

- API route implementation
- SDK transport implementation
- CLI formatting or command work
- MCP tool implementation
- connector extraction

Core should expose the correct primitives for those packages, not pull their work in.

## 5. Milestone Map

### Milestone 0. Workspace And Skeleton

Goal:

- create the package structure and build/test skeleton without locking in behavior prematurely

Deliverables:

- `packages/core/package.json`
- `tsconfig.json`
- `vitest.config.ts`
- root `src/index.ts`
- folder skeleton from the spec

Exit criteria:

- `pnpm --filter @orbit-ai/core build` runs
- empty or placeholder exports resolve cleanly
- no downstream package assumptions are encoded yet

### Milestone 1. IDs And Shared Types

Goal:

- establish the canonical type layer every other package will import

Deliverables:

- `ids/prefixes.ts`
- `ids/generate-id.ts`
- `ids/parse-id.ts`
- `types/errors.ts`
- `types/pagination.ts`
- `types/api.ts`
- `types/entities.ts`
- envelope mapper helpers

Must-have validations:

- prefixed ULID generation and parsing tests
- wrong-prefix rejection tests
- internal page metadata to wire metadata mapping tests

Threat-model focus:

- prevent cross-package drift before interfaces begin

Exit criteria:

- core exports the shared type surface defined in the spec
- API/SDK/CLI/MCP can later import these types unchanged

### Milestone 2. Schema Helpers, Tables, And Relations

Goal:

- define the canonical Postgres schema and table classification model

Deliverables:

- `schema/helpers.ts`
- `schema/tables.ts`
- `schema/relations.ts`
- table classification note for bootstrap vs tenant-scoped tables

Execution notes:

- implement bootstrap table(s) first:
  - `organizations`
- then auth/bootstrap-adjacent tenant tables:
  - `users`
  - `organization_memberships`
  - `api_keys`
- then first-wave operational tables:
  - `audit_logs`
  - `idempotency_keys`
  - `schema_migrations`
- then the rest of the domain entities

Required review:

- run `orbit-schema-change` equivalent review for schema grouping and table classification
- run `orbit-tenant-safety-review` equivalent on any milestone-2 change that introduces or changes tenant-scoped tables

Must-have validations:

- table-definition tests or snapshot validation for all expected columns
- `organization_id` present on every tenant table and absent on `organizations`
- secret-bearing columns present only where expected
- tenant table classification and tenant-boundary assumptions reviewed before Milestone 2 is accepted

Threat-model focus:

- T1 cross-tenant leakage
- T3 secret-bearing object storage

Exit criteria:

- all first-party tables from the core spec are defined
- bootstrap vs tenant-scoped classification is explicit and correct

### Milestone 3. Validation Layer And Basic Repository Primitives

Goal:

- establish input validation and common repository behavior before service breadth

Deliverables:

- `schema/zod.ts`
- shared filter/sort/list query helpers
- cursor helpers
- base repository patterns for tenant filtering and list pagination

Required review:

- run `orbit-tenant-safety-review` equivalent before Milestone 3 is considered stable

Must-have validations:

- generated Zod schemas compile and cover the expected tables
- custom validation rules for the documented invariants exist
- cursor encode/decode and stable sort tests pass
- repository primitives prove deterministic tenant filtering before entity services begin

Threat-model focus:

- T1 through deterministic tenant filtering

Exit criteria:

- repository primitives are ready for entity implementation
- validation rules exist for the highest-risk invariants

### Milestone 4. Adapter Interface And Tenant Context

Goal:

- make the runtime-vs-migration authority model executable

Deliverables:

- `adapters/interface.ts`
- Postgres-family tenant context helper
- adapter capability contracts
- auth lookup contract

First implementation targets:

- SQLite adapter
- one Postgres-family adapter baseline

Recommendation:

- implement SQLite and raw Postgres-style adapter contracts first
- layer Supabase- and Neon-specific behavior after the generic Postgres path is proven

Required review:

- run `orbit-tenant-safety-review` equivalent before this milestone is considered stable

Must-have validations:

- `withTenantContext()` transaction-bound tests
- runtime authority vs migration authority contract tests
- `lookupApiKeyForAuth()` contract tests
- SQLite tenant-filter expectation tests

Threat-model focus:

- T1 cross-tenant leakage
- T2 privileged credential misuse

Exit criteria:

- adapter contract matches the spec exactly on authority boundaries
- no request-path primitive requires elevated credentials

### Milestone 5. Core Services Wave 1

Goal:

- prove the service layer pattern on the minimum critical surface before implementing every entity

Wave 1 entities:

- `users`
- `api_keys`
- `companies`
- `contacts`
- `pipelines`
- `stages`
- `deals`

Plus:

- `search`
- `contactContext`
- `system.organizations`
- `system.organizationMemberships`
- `system.apiKeys`

Why this wave first:

- it exercises bootstrap/admin separation
- it proves tenant-scoped CRUD
- it proves the core CRM relationship graph
- it unblocks most of the later surfaces

Must-have validations:

- CRUD tests for each wave-1 entity
- admin/system separation tests
- contact/company/deal relationship tests
- pipeline/stage/deal movement invariants

Threat-model focus:

- T1 cross-tenant leakage
- T2 authority misuse through admin/system mixing

Exit criteria:

- wave-1 services support list/get/create/update/delete where intended
- search and contact context are good enough to unblock API and SDK planning

### Milestone 6. Core Services Wave 2

Goal:

- complete the rest of the first-party entity and admin service surface

Wave 2 entities:

- `activities`
- `tasks`
- `notes`
- `products`
- `payments`
- `contracts`
- `sequences`
- `sequence_steps`
- `sequence_enrollments`
- `sequence_events`
- `tags`
- `entity_tags`
- `webhooks`
- `webhook_deliveries`
- `imports`
- `custom_field_definitions`
- `audit_logs`
- `schema_migrations`
- `idempotency_keys`

Must-have validations:

- CRUD or read-only semantics tests per entity
- secret-bearing object storage and sanitization-prep tests
- audit and idempotency persistence behavior tests

Threat-model focus:

- T3 secret leakage preparation
- T5 webhook/event persistence correctness

Exit criteria:

- all required first-party and admin services exist
- behavior is coherent enough to support the API generic registration model

### Milestone 7. Audit, Idempotency, And Contact Context Hardening

Goal:

- harden the cross-cutting services before schema-engine work begins

Deliverables:

- `services/audit-service.ts`
- idempotency storage behavior
- finalized `contact-context.ts`

Must-have validations:

- audit rows written on mutation
- audit actor and request attribution tests
- idempotency uniqueness and replay-path tests
- contact context dossier shape tests against the documented result shape

Threat-model focus:

- T3 secret leakage into logs or snapshots

Exit criteria:

- audit and idempotency behavior are reliable enough for API middleware consumption
- contact context shape is stable enough for CLI and MCP consumers

### Milestone 8. Schema Engine And Custom Fields

Goal:

- implement safe schema evolution only after the static model and service layer are working

Deliverables:

- `schema-engine/engine.ts`
- `preview.ts`
- `add-field.ts`
- `add-entity.ts`
- `promote-field.ts`
- custom field registry logic
- reversible migration records

Required review:

- run `orbit-schema-change` equivalent review on any engine behavior that changes persisted structure

Must-have validations:

- metadata-only add-field path tests
- reversible migration record tests
- promoted field merge/read behavior tests
- destructive-operation blocking tests

Threat-model focus:

- T6 unsafe schema evolution

Exit criteria:

- `addField`, `addEntity`, `promoteField`, preview, apply, and rollback semantics match the spec baseline

### Milestone 9. RLS Generation And Plugin Extensions

Goal:

- finish the Postgres-family security model and extension registration model

Deliverables:

- `schema-engine/rls.ts`
- plugin schema registry
- plugin tenant table registration path

Must-have validations:

- generated RLS SQL covers every tenant table
- `organizations` excluded from tenant-policy generation
- plugin-owned tenant tables receive policy coverage metadata

Threat-model focus:

- T1 cross-tenant leakage
- T2 privileged boundary mistakes

Exit criteria:

- Postgres-family tenant table coverage is complete
- extension hooks are safe enough for later integrations work

### Milestone 10. Generated Artifacts And Entity AGENTS

Goal:

- complete the machine-readable and generated-artifact requirements before declaring core done

Deliverables:

- generated `zod` and `types` artifacts
- entity `AGENTS.MD` files
- migration artifact shape under `.orbit/migrations/`

Must-have validations:

- no generated-file drift on build
- every entity directory contains `AGENTS.MD`

Exit criteria:

- core acceptance criteria in the spec are fully satisfied or clearly marked with bounded follow-up items

## 6. First Implementation Slice

The first slice should be:

1. package skeleton
2. ID utilities
3. shared types
4. schema helpers
5. bootstrap tables:
   - `organizations`
   - `users`
   - `organization_memberships`
   - `api_keys`
6. adapter interface and auth lookup contract
7. tenant context helper and runtime-vs-migration authority boundary

Why this slice:

- it proves the package shape
- it locks the shared type layer
- it establishes the authority boundary
- it creates the minimum schema needed for auth, tenancy, and later services
- it creates the earliest possible tenant-safety review point before service breadth starts

Definition of done for slice 1:

- build passes
- ID and shared type tests pass
- bootstrap table definitions compile
- adapter interface is stable enough for later implementation
- tenant context helper behavior is tested for Postgres-family semantics
- `lookupApiKeyForAuth()` contract tests pass
- runtime authority vs migration authority contract tests pass
- one Postgres-family path proves bootstrap migration plus tenant-context behavior together in an integration-style test or harness
- tenant-safety review has run on the slice before Milestone 3 starts
- core-slice review has run on the completed slice before Milestone 3 starts

### Slice 1 Workstream Ownership

To use sub-agents safely, split slice 1 into disjoint write scopes:

1. **Workstream A: package skeleton and exports**
   - owns:
     - `packages/core/package.json`
     - `packages/core/tsconfig.json`
     - `packages/core/vitest.config.ts`
     - `packages/core/src/index.ts`
2. **Workstream B: IDs and shared types**
   - owns:
     - `packages/core/src/ids/*`
     - `packages/core/src/types/errors.ts`
     - `packages/core/src/types/pagination.ts`
     - `packages/core/src/types/api.ts`
     - `packages/core/src/types/entities.ts`
3. **Workstream C: bootstrap schema**
   - owns:
     - `packages/core/src/schema/helpers.ts`
     - `packages/core/src/schema/tables.ts`
     - `packages/core/src/schema/relations.ts`
   - limited in slice 1 to:
     - `organizations`
     - `users`
     - `organization_memberships`
     - `api_keys`
4. **Workstream D: adapter boundary and auth lookup**
   - owns:
     - `packages/core/src/adapters/interface.ts`
     - `packages/core/src/adapters/postgres/tenant-context.ts`
     - adapter test scaffolding for `lookupApiKeyForAuth()` and authority boundaries

Coordination rules:

- one workstream owns one file set; do not overlap write scopes during the same round
- Workstream A lands first, then B/C/D can proceed in parallel
- Workstream D may read B/C outputs but should not rewrite their files
- slice review happens only after the four workstreams are integrated

## 7. Required Skills During Core Execution

Use only these skills at first:

- `orbit-tenant-safety-review`
  Required for:
  - adapter work
  - auth lookup work
  - tenant context work
  - new tenant-scoped tables
- `orbit-schema-change`
  Required for:
  - table additions
  - field additions
  - custom field logic
  - schema-engine behavior
- `orbit-core-slice-review`
  Required for:
  - completed Milestone 0-1 diffs
  - slice-1 integration review before Milestone 3 starts
  - checking build/test evidence against slice acceptance criteria

Do not block the first core slice on building the rest of the skill backlog.

## 8. Validation Strategy

Validation should run at three layers:

### 8.1 Milestone Validation

- unit tests for the touched layer
- build and typecheck
- generated artifact drift check
- for slice 1, include one Postgres-family integration-style proof for bootstrap migration plus tenant context

### 8.2 Contract Validation

- compare behavior against [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- ensure exports stay compatible with downstream package expectations

### 8.3 Security Validation

- tenant-safety review for boundary-affecting changes
- schema-change review for migration-affecting changes
- core-slice review for integrated slice acceptance
- explicit confirmation against threat themes:
  - T1
  - T2
  - T3
  - T6

## 9. Review Gates

Before moving from one milestone group to the next:

- Before Milestone 3 starts:
  require a tenant-safety review outcome for any tenant-scoped table work completed in Milestone 2 and a core-slice review outcome for the integrated slice
- Before Milestone 4 is accepted:
  require a tenant-safety review outcome for adapter, auth lookup, and tenant-context work
- Milestones 5-7:
  require tenant-safety review for new tenant-boundary service work plus CRUD/admin boundary review and audit/idempotency validation
- Milestones 8-9:
  require schema-change review outcome

## 10. Risks To Watch

Most likely core-execution failures:

- implementing entity breadth before proving tenant context and authority boundaries
- treating SQLite as equivalent to Postgres security
- implementing schema apply too early
- mixing admin/system entities back into the generic service path
- allowing service-specific contracts to drift away from shared types

## 11. Done Condition For Core

Core is ready to unblock broad downstream work when all of the following are true:

1. Milestones 1-10 are complete or have only explicitly accepted minor follow-ups.
2. The acceptance criteria in [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md) are met.
3. Tenant-safety review does not report unresolved high-severity issues.
4. Schema engine behavior is previewable, reversible, and correctly authority-gated.
5. API and SDK teams can consume the exports without needing core contract changes.

## 12. Immediate Next Actions

1. Accept this core implementation plan.
2. Confirm the three pre-core skills are available:
   - `orbit-tenant-safety-review`
   - `orbit-schema-change`
   - `orbit-core-slice-review`
3. Assign slice-1 workstreams A-D with non-overlapping file ownership.
4. Start slice 1:
   - Milestone 0
   - Milestone 1
   - bootstrap-table portions of Milestone 2
   - authority-boundary portions of Milestone 4
5. Stop after slice 1 and review before expanding to repository primitives or wave-1 services.
