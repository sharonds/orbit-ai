# Orbit AI Core Wave 2 Slice D Plan

Date: 2026-04-02
Status: Drafted for execution
Package: `@orbit-ai/core`
Depends on:
- [core-wave-2-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-services-plan.md)
- [core-wave-2-slice-c-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-c-review.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [database-hardening-checklist.md](/Users/sharonsciammas/orbit-ai/docs/security/database-hardening-checklist.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines the execution plan for Core Wave 2 Slice D in `@orbit-ai/core`.

Slice C completed the automation graph. Slice D adds the remaining operational metadata entities and the first secret-bearing read surfaces that must stay safe before API, SDK, CLI, and MCP transport work begins.

## 2. Slice Objective

Deliver the Slice D entity set while preserving the accepted Wave 1 and Wave 2 contracts:

1. tenant scope still derives from trusted `ctx.orgId`
2. secret-bearing fields never leak through generic service reads
3. admin/system services stay structurally separate from tenant CRUD services
4. SQLite and Postgres persistence paths both remain green
5. later transport workflows are not pulled forward into ad hoc core service behavior

Slice D is about entity coverage, redaction safety, and read-boundary correctness. It is not the transport milestone, not the schema-engine milestone, and not the full webhook execution milestone.

## 3. In Scope

Tenant-scoped services:

- `tags`
- `imports`
- `webhooks`

Admin/system read services:

- `system.entityTags`
- `system.webhookDeliveries`

Supporting repository, schema, and service files under:

- `packages/core/src/entities/`
- `packages/core/src/repositories/`
- `packages/core/src/services/`
- `packages/core/src/schema/`
- `packages/core/src/adapters/`
- `packages/core/src/index.ts`

Supporting tests under:

- `packages/core/src/entities/**/*.test.ts`
- `packages/core/src/services/**/*.test.ts`
- `packages/core/src/schema/**/*.test.ts`

## 4. Out Of Scope

- Slice E entities:
  - `system.customFieldDefinitions`
  - `system.auditLogs`
  - `system.schemaMigrations`
  - `system.idempotencyKeys`
- schema-engine mutation flows
- audit middleware or automatic audit-write instrumentation
- full idempotency middleware behavior
- API, SDK, CLI, or MCP route/tool implementation
- webhook delivery worker execution or retry engine behavior
- hosted SSRF enforcement and outbound destination policy enforcement
- inbound webhook signature verification flows
- transport-level workflow endpoints such as:
  - tag attach/detach
  - webhook redeliver
  - one-time plaintext webhook secret return on create

These remain later milestones even though Slice D introduces persisted entities they depend on.

## 5. Required Execution Principles

1. Do not rewrite accepted Wave 1, Slice A, Slice B, or Slice C service contracts.
2. Keep secret-bearing records sanitized at service read boundaries.
3. Keep tenant-scoped repositories explicitly filtered by `organization_id`, even on Postgres-family adapters.
4. Keep admin/system surfaces explicit and read-only where the Wave 2 plan says they are read-only.
5. Do not invent later transport workflows in the core registry just because the API specs mention them.
6. Do not invent a new secret-at-rest model in this slice; use the persisted fields already frozen by the spec.
7. Prefer explicit redaction or omission over “best effort” exposure for webhook and delivery fields.

## 6. Service Surface To Deliver

### 6.1 Tenant Service Pattern

Use the existing `EntityService<TCreate, TUpdate, TRecord>` pattern for:

- `tags`
- `webhooks`

Expected methods:

- `create`
- `get`
- `update`
- `delete`
- `list`
- `search`

### 6.2 Status-Oriented Tenant Service

`imports` is status/lifecycle oriented.

The default Slice D service shape should be:

- `create`
- `get`
- `update`
- `list`
- `search`

`delete` should be omitted unless the implementation can justify a safe and coherent persistence model for it. The default plan assumption is no public `delete` for `imports` in Slice D.

### 6.3 Admin/System Read Services

Use the read-only `AdminEntityService<TRecord>` pattern for:

- `system.entityTags`
- `system.webhookDeliveries`

Expected methods:

- `get`
- `list`

Do not expose tenant CRUD services named `entityTags` or `webhookDeliveries` from the public registry in this slice.

## 7. Entity Delivery Contract

### 7.1 Tags

Goal:

- add tenant-scoped tag CRUD and search behavior

Required behavior:

- tag name is tenant-scoped and unique within one organization
- tags support tenant CRUD/list/search
- tag reads and searches remain safe to expose through later public registries
- tag records are available for contact-context integration where Slice D requires it

Required tests:

- create/get/update/delete/list/search
- tenant isolation
- tenant-scoped uniqueness on `name`
- SQLite/Postgres persistence proof coverage

### 7.2 Entity Tags

Goal:

- add the polymorphic join surface needed for tags without widening the public core registry

Required behavior:

- `entity_tags` stays organization-scoped
- `tagId` must resolve inside the same tenant
- read paths are safe for admin/system access and future relationship helpers
- duplicate joins are blocked by the `(organizationId, tagId, entityType, entityId)` uniqueness contract
- join reads can support “tags on a known record” lookups without cross-tenant leakage

Registry rule:

- `entity_tags` is exposed only as `system.entityTags` in Slice D

Implementation note:

- if mutation helpers are needed internally for tests or contact-context integration, keep them below the public registry surface and do not treat them as accepted public CRUD services in this slice

Required tests:

- admin/system list/get coverage
- tenant-scoped join lookup coverage
- duplicate join rejection
- cross-tenant join rejection
- contact tag lookup coverage if contact-context consumes this slice
- SQLite/Postgres persistence proof coverage

### 7.3 Imports

Goal:

- add persisted import lifecycle/status tracking without transport orchestration

Required behavior:

- imports preserve entity type, file name, row counters, and lifecycle timestamps
- the implementation freezes one coherent service-layer lifecycle model before code lands
- `completedAt` must stay consistent with terminal lifecycle states
- row counters remain stable and non-negative
- `startedByUserId`, when provided, must resolve inside the same tenant

Execution rule:

- because the canonical table shape leaves `status` as text, the slice implementation must define and document a minimal accepted status set and transition model in code review artifacts before merge

Required tests:

- create/get/update/list/search
- lifecycle transition tests
- timestamp/state coupling tests
- started-by relation tests
- tenant isolation and negative relation tests
- SQLite/Postgres persistence proof coverage

### 7.4 Webhooks

Goal:

- add tenant-scoped webhook CRUD while keeping secrets redacted on reads

Required behavior:

- webhook persistence uses the canonical fields:
  - `secretEncrypted`
  - `secretLastFour`
  - `secretCreatedAt`
- generic service reads must never expose plaintext webhook secrets
- `get`, `list`, and `search` return a sanitized record shape aligned with the later `WebhookRead` contract
- the sanitized record shape preserves:
  - `url`
  - `events`
  - `status`
  - `description`
  - `secretLastFour`
  - `secretCreatedAt`
  - timestamps
- `secretEncrypted` is write-only from the service consumer perspective unless a clearly internal record shape is needed below the public service boundary
- `status` uses one coherent service-level lifecycle model for Slice D and does not remain open-ended text in practice

Execution rule:

- one-time plaintext secret return on create is explicitly out of scope for this core slice and belongs to later transport-layer behavior

Required tests:

- create/get/update/delete/list/search
- sanitized read tests for get/list/search
- no secret-bearing fields in search summaries or read surfaces
- lifecycle/status tests
- tenant isolation
- SQLite/Postgres persistence proof coverage

### 7.5 Webhook Deliveries

Goal:

- add read-safe admin/system visibility into webhook delivery history

Required behavior:

- `system.webhookDeliveries` is read-only in Slice D
- delivery reads should align with the later `WebhookDeliveryRead` contract where possible and preserve at least:
  - `webhookId`
  - `eventId`
  - `status`
  - `responseStatus`
  - `attemptCount`
  - `nextAttemptAt`
  - `deliveredAt`
  - `lastError`
  - timestamps
- delivery reads never expose:
  - raw signatures
  - raw signed payload copies when they are not explicitly redacted
  - raw retry-worker internals
  - raw response bodies unless the accepted DTO explicitly allows a sanitized/truncated form
- if `payload` or `responseBody` remain accessible at all, the slice must define whether each field is:
  - omitted
  - sanitized
  - truncated
  - replaced with an explicit redaction marker
- `webhookId` must resolve inside the same tenant
- duplicate `(webhookId, eventId)` rows are blocked

Execution rule:

- default to omission or explicit redaction markers for sensitive delivery fields rather than partial pass-through

Required tests:

- admin/system list/get coverage
- redaction/sanitization tests for delivery reads
- tenant isolation tests
- uniqueness tests for `(webhookId, eventId)`
- SQLite/Postgres persistence proof coverage

## 8. Contact Context And Registry Integration

Slice D must update the integrated registry and related cross-cutting services where the Wave 2 plan requires it.

Required integration work:

- `createCoreServices(adapter)` exposes:
  - `tags`
  - `imports`
  - `webhooks`
  - `system.entityTags`
  - `system.webhookDeliveries`
- `packages/core/src/index.ts` export wiring stays aligned with the accepted Slice D service surface
- `contact-context.ts` upgrades from placeholder tags to real tag reads if the entity/tag implementation is sufficient to support it safely

Execution rule:

- do not widen `contact-context` beyond direct, well-scoped tag lookup if the slice does not yet have a coherent relation service for broader entity graph reads

## 9. Workstream Ownership

Use disjoint write scopes and keep `services/index.ts` in the main thread.

### Workstream A. Metadata Entities

Owns:

- `tags`
- `imports`
- `webhooks`

Responsibilities:

- service and repository implementation
- entity-specific validation
- entity-specific tests

### Workstream B. Admin And Join Surfaces

Owns:

- `entityTags`
- `webhookDeliveries`

Responsibilities:

- read-only admin/system service behavior
- join correctness
- sanitization behavior for delivery reads

### Workstream C. Integration And Proofs

Owns:

- `packages/core/src/services/index.ts`
- `packages/core/src/services/contact-context.ts`
- integrated persistence tests
- review artifact and KB updates

Responsibilities:

- final registry wiring
- contact-context tag integration
- SQLite/Postgres integrated proof coverage
- final validation

## 10. Testing To Execute

### 10.1 Per-Entity Tests

`tags`:

- create/get/update/delete/list/search
- tenant isolation
- unique tenant name

`imports`:

- create/get/update/list/search
- lifecycle/status transitions
- counter and timestamp invariants
- started-by user relation

`webhooks`:

- create/get/update/delete/list/search
- sanitized read contract
- status transitions
- no plaintext secret exposure

`system.entityTags`:

- get/list only
- org-scoped lookup behavior
- duplicate join rejection

`system.webhookDeliveries`:

- get/list only
- sanitized or explicitly redacted read contract
- tenant isolation
- `(webhookId, eventId)` uniqueness

### 10.2 Cross-Cutting Tests

Wave 2 Slice D must add or expand tests for:

- admin/system read separation
- secret redaction on webhook and delivery surfaces
- contact-context integration with real tags where implemented
- service registry shape after Slice D wiring
- SQLite-backed persistence path for Slice D entities
- Postgres-backed persistence path for Slice D entities

### 10.3 Full Validation Gates

Before review and again after review fixes:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

## 11. Required Reviews

### 11.1 Code Review

Run a findings-first code review after the integrated slice lands.

Focus:

- contract drift against the accepted Wave 2 plan
- wrong service surface width
- missing lifecycle validation
- missing tests
- contact-context regression risk

### 11.2 Security Review

Run `orbit-tenant-safety-review` after the integrated slice lands.

This review should be executed as a dedicated tenant-safety and secret-surface pass.

Mandatory security review surfaces:

- tenant-scoped repositories for `tags`, `imports`, and `webhooks`
- admin/system services for `entityTags` and `webhookDeliveries`
- webhook secret-bearing fields
- delivery payload and error-body surfaces
- contact-context tag integration

Threat-model focus:

- T1 cross-tenant read/write exposure
- T3 secret leakage
- T5 webhook/event persistence correctness

Security review questions the branch must answer:

1. Can webhook secrets leak through get/list/search, registry aggregation, or contact-context reads?
2. Can delivery payloads, signatures, response bodies, or worker-only fields leak through admin/system reads?
3. Can tag or entity-tag reads cross tenant boundaries?
4. Can imports or webhooks mutate in ways that bypass tenant scope or coherent lifecycle validation?
5. Does any request-path service reach migration authority or other privileged adapter surfaces?

### 11.3 Plan Vs Execution Review

Run `orbit-core-slice-review` after implementation and after any review-driven fixes.

It must confirm:

- Slice D matches the accepted Wave 2 plan
- no Slice E metadata work was pulled forward
- no transport workflows were pulled forward
- no schema-engine or migration-authority behavior was pulled forward

### 11.4 Schema Review

Run schema review if Slice D changes:

- accepted bootstrap SQL
- persisted record shapes
- the accepted table set beyond what is already frozen by [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)

The schema review should pay special attention to:

- tag uniqueness
- entity-tag join uniqueness
- webhook-delivery uniqueness
- secret-bearing field storage assumptions

## 12. Documentation Updates Required

Slice D must update:

- [docs/KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- [docs/review/core-wave-2-slice-d-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-d-review.md)

If the implementation freezes a concrete import lifecycle model or delivery redaction contract not already explicit in the canonical docs, update the relevant canonical documentation as part of the branch rather than leaving the behavior implicit in tests only.

## 13. Commit Plan

Prefer small commits in this order:

1. schema, validators, repositories, and core entity services for `tags`, `imports`, and `webhooks`
2. admin/system read surfaces for `entityTags` and `webhookDeliveries`
3. registry wiring, contact-context integration, and persistence proofs
4. review-driven hardening fixes
5. KB and review artifact updates

## 14. Exit Criteria

Slice D is complete only when all of the following are true:

1. `tags`, `imports`, and `webhooks` exist with coherent service behavior intended by this plan.
2. `system.entityTags` and `system.webhookDeliveries` exist with the expected read-only admin/system boundaries.
3. Webhook and delivery read surfaces remain sanitized or explicitly redacted.
4. Tagging and import lifecycle tests pass.
5. SQLite and Postgres persistence paths both pass for the touched entity set.
6. Contact-context and registry integrations are updated where Slice D requires them.
7. Code review passes.
8. Security review passes.
9. Plan-vs-execution review passes.

## 15. Recommended Next Action

After accepting this plan:

1. merge `core-wave-2-slice-c`
2. create a fresh branch for Slice D from updated `main`
3. execute the slice in the commit order above
4. run validation and the three review passes before opening the PR
