# Orbit AI Core Wave 2 Services Plan

Date: 2026-04-01
Status: Ready for execution planning
Package: `@orbit-ai/core`
Depends on:
- [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
- [core-wave-1-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-services-plan.md)
- [core-postgres-persistence-bridge-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-postgres-persistence-bridge-review.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines the second core service execution wave for `@orbit-ai/core`.

Wave 1 proved the base CRM graph and the real SQLite and Postgres persistence paths. Wave 2 completes the remaining first-party entity and admin surface so the core package can support the generic API, SDK, CLI, and MCP registration models without large service-contract gaps.

## 2. Wave Objective

Deliver the remaining first-party services and admin/system services while preserving the accepted core contracts:

1. tenant scope still derives from trusted `ctx.orgId`
2. secret-bearing objects stay sanitized at service read surfaces
3. admin/system services stay structurally separate from tenant CRUD services
4. Wave 1 service contracts do not drift
5. SQLite and Postgres persistence paths continue to pass unchanged

Wave 2 is about coverage, relationship correctness, and safe persistence behavior. It is not the schema-engine milestone and not the transport milestone.

## 3. In Scope

Tenant-scoped services:

- `activities`
- `tasks`
- `notes`
- `products`
- `payments`
- `contracts`
- `sequences`
- `sequenceSteps`
- `sequenceEnrollments`
- `sequenceEvents`
- `tags`
- `webhooks`
- `imports`

System/admin services:

- `system.webhookDeliveries`
- `system.customFieldDefinitions`
- `system.auditLogs`
- `system.schemaMigrations`
- `system.idempotencyKeys`
- `system.entityTags`

Supporting repository and service files under:

- `packages/core/src/entities/`
- `packages/core/src/repositories/`
- `packages/core/src/services/`
- `packages/core/src/index.ts`

Supporting tests under:

- `packages/core/src/entities/**/*.test.ts`
- `packages/core/src/services/**/*.test.ts`

## 4. Out Of Scope

- schema-engine mutation flows
- custom-field schema application logic
- automatic audit-write instrumentation across all mutations
- full idempotency enforcement across all service entry points
- search redesign
- API, SDK, CLI, or MCP implementation
- Supabase- or Neon-specific adapter specialization

These remain later milestones even though Wave 2 introduces the persisted entities they depend on.

## 5. Required Execution Principles

1. Do not rewrite accepted Wave 1 service contracts.
2. Keep secret-bearing records sanitized at service read boundaries.
3. Keep tenant-scoped repositories explicitly filtered by `organization_id`, even on Postgres-family adapters.
4. Keep bootstrap/admin surfaces explicit.
5. Do not fold later audit/idempotency middleware behavior into ad hoc service logic.
6. Prefer one coherent entity cluster per slice instead of one giant patch.

## 6. Service Surface To Deliver

### 6.1 Tenant Service Pattern

Wave 2 should default to the same `EntityService<TCreate, TUpdate, TRecord>` pattern already proven in Wave 1:

- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`

This default applies to the CRUD-oriented entities in Wave 2:

- `activities`
- `tasks`
- `notes`
- `products`
- `payments`
- `contracts`
- `sequences`
- `sequenceSteps`
- `sequenceEnrollments`
- `tags`
- `webhooks`

Entities with narrower semantics should stay narrow and explicit:

- `sequenceEvents`
  - append/read oriented; do not force generic update/delete if the entity behaves like history
- `imports`
  - status/lifecycle oriented; only expose delete if the implementation needs it and the persistence model supports it safely

### 6.2 Admin/System Read Services

Wave 2 admin services should use the read-only `AdminEntityService<TRecord>` pattern:

- `get`
- `list`

This applies to:

- `system.webhookDeliveries`
- `system.customFieldDefinitions`
- `system.auditLogs`
- `system.schemaMigrations`
- `system.idempotencyKeys`
- `system.entityTags`

### 6.3 Registry Completion

At the end of Wave 2, `createCoreServices(adapter)` should expose the full first-party registry defined in [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md), excluding only the later schema-engine and hardening milestones.

## 7. Recommended Delivery Slices

Wave 2 should execute in five slices.

### Slice A. Engagement Graph

Goal:

- establish the communication and follow-up entity set

Scope:

- `activities`
- `tasks`
- `notes`

Required behavior:

- activities can link to contact, company, and deal
- tasks can link to contact, company, and deal and preserve due-date semantics
- notes can link to contact, company, and deal
- contact-context support data is no longer placeholder-only for activities and tasks

Exit criteria:

- CRUD/list/search tests pass for all three entities
- relation tests pass for contact/company/deal links
- contact-context tests use real activities/tasks data from this slice

### Slice B. Revenue And Catalog

Goal:

- add the revenue-adjacent operational entities

Scope:

- `products`
- `payments`
- `contracts`

Required behavior:

- products preserve catalog ordering and active state
- payments preserve external ID uniqueness and status transitions
- contracts preserve status and linked contact/company/deal associations

Exit criteria:

- CRUD/list/search tests pass
- uniqueness and relation tests pass
- tenant-safety review passes on external ID and status-bearing records

### Slice C. Sequences And Automation State

Goal:

- add the automation graph without transport-level orchestration

Scope:

- `sequences`
- `sequenceSteps`
- `sequenceEnrollments`
- `sequenceEvents`

Required behavior:

- sequence steps stay scoped to their parent sequence
- enrollments stay scoped to contact plus sequence
- sequence events are append-style history records
- sequence graph queries preserve tenant and parent ownership

Exit criteria:

- CRUD/list/search or read-only semantics are implemented as intended per entity
- parent-child invariants are enforced and tested
- sequence entities persist correctly on both SQLite and Postgres paths

### Slice D. Tagging, Imports, And Delivery Metadata

Goal:

- add the remaining operational metadata entities

Scope:

- `tags`
- `imports`
- `system.entityTags`
- `webhooks`
- `system.webhookDeliveries`

Required behavior:

- tags support tenant CRUD
- entity-tag joins are read-safe and organization-scoped
- imports preserve lifecycle/status tracking
- webhook service surfaces keep secrets redacted
- webhook delivery admin reads keep response/error payloads sanitized or explicitly redacted

Exit criteria:

- secret-bearing object tests pass
- tagging and import lifecycle tests pass
- admin/system separation tests pass for delivery metadata

### Slice E. Core Metadata And Hardening Prep

Goal:

- add the final core metadata entities that later milestones consume

Scope:

- `system.customFieldDefinitions`
- `system.auditLogs`
- `system.schemaMigrations`
- `system.idempotencyKeys`
- final `services/index.ts` and export wiring

Required behavior:

- admin/system read services exist and match the core spec naming
- persisted record shapes are stable enough for later audit, schema-engine, and idempotency milestones
- no request-path service reaches migration authority

Exit criteria:

- the full Wave 2 registry is available from `createCoreServices(adapter)`
- the next milestones are hardening and schema-engine work, not missing entity surfaces

## 8. Workstream Ownership

Use disjoint write scopes and parallelize only where write sets do not overlap.

### Workstream A. Engagement And Revenue Cluster

Owns:

- service and repository files for:
  - `activities`
  - `tasks`
  - `notes`
  - `products`
  - `payments`
  - `contracts`

Responsibilities:

- CRUD/list/search behavior
- relationship invariants
- entity-specific tests

### Workstream B. Automation And Metadata Cluster

Owns:

- service and repository files for:
  - `sequences`
  - `sequenceSteps`
  - `sequenceEnrollments`
  - `sequenceEvents`
  - `tags`
  - `imports`
  - `webhooks`
  - `webhookDeliveries`
  - `entityTags`
  - `customFieldDefinitions`
  - `auditLogs`
  - `schemaMigrations`
  - `idempotencyKeys`

Responsibilities:

- parent-child graph correctness
- secret-bearing read sanitization
- admin/system read services

### Workstream C. Registry, Contact Context, And Integrated Proofs

Owns:

- `packages/core/src/services/contact-context.ts`
- `packages/core/src/services/index.ts`
- integrated Wave 2 tests
- execution review artifact

Responsibilities:

- wire the completed registry
- upgrade contact-context behavior to consume real activities/tasks/tags where available
- verify both SQLite and Postgres paths remain green

## 9. Sub-Agent Execution Plan

Execute Wave 2 with a small number of sub-agents at a time.

Recommended pattern:

1. One worker owns Workstream A.
2. One worker owns Workstream B.
3. The main thread owns Workstream C and integration.

Rules:

- do not run parallel workers on the same entity cluster
- do not let workers edit `services/index.ts` concurrently
- integrate one slice at a time before starting the next slice
- after each integrated slice, run tests and required reviews before opening the next write scope

## 10. Testing To Execute

### 10.1 Per-Slice Tests

For every slice:

- CRUD/list/search or read-only semantics tests for each new entity
- relationship invariants and negative tests
- SQLite-backed persistence path tests for the touched entities
- Postgres-backed persistence path tests for the touched entities

### 10.2 Cross-Cutting Tests

Wave 2 must add or expand tests for:

- admin/system read separation
- secret redaction on webhook and delivery surfaces
- external ID uniqueness where applicable
- append/history semantics where applicable
- contact-context integration with activities, tasks, and tags
- service registry shape after Wave 2 wiring

### 10.3 Full Validation Gates

For every integrated slice and again at Wave 2 completion:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

## 11. Required Reviews

### 11.1 Code Review

After each integrated slice:

- run a findings-first code review
- focus on relationship bugs, contract drift, and missing tests

### 11.2 Security Review

After each integrated slice:

- run `orbit-tenant-safety-review`
- treat these areas as mandatory security review surfaces:
  - tenant-scoped repositories
  - admin/system services
  - webhook and delivery records
  - idempotency and audit metadata
  - custom field definition reads

Threat-model focus for Wave 2:

- T1 cross-tenant read/write exposure
- T3 secret leakage
- T5 webhook/event persistence correctness

### 11.3 Plan Vs Execution Review

After each integrated slice and at Wave 2 completion:

- run `orbit-core-slice-review`
- confirm the implemented slice matches this plan and does not pull later schema-engine or transport work forward

### 11.4 Schema Review

Run `orbit-schema-change` only if Wave 2 changes the accepted table set, bootstrap SQL, or persisted shapes in ways not already frozen by [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md).

## 12. Exit Criteria

Wave 2 is complete only when all of the following are true:

1. All Wave 2 tenant services exist with coherent CRUD/list/search behavior where intended.
2. All Wave 2 admin/system read services exist with the expected naming and read boundaries.
3. SQLite and Postgres persistence paths both pass for the new entity set.
4. Secret-bearing surfaces remain sanitized.
5. Contact-context and service-registry integrations are updated to reflect the expanded entity set where Wave 2 requires it.
6. Code review passes.
7. Security review passes.
8. Plan-vs-execution review passes.

## 13. Recommended Next Action

The next implementation step after accepting this plan is:

1. create branch `core-wave-2-services`
2. execute Slice A first
3. run tests
4. run code review, tenant-safety review, and plan-vs-execution review
5. only then open Slice B
