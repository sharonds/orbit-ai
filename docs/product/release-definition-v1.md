# Orbit AI Release Definition v1

Date: 2026-03-31
Status: Draft
Related:
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [database-hardening-checklist.md](/Users/sharonsciammas/orbit-ai/docs/security/database-hardening-checklist.md)

## 1. Purpose

This document defines what counts as Orbit AI v1.

Its job is to prevent "spec-complete" from being mistaken for "release-ready" and to give a clear pass or fail bar across product, architecture, security, docs, testing, and operations.

## 2. What v1 Means

For this document, v1 means:

- the first implementation-complete Orbit AI release
- self-hostable and package-first
- usable through core, API, SDK, CLI, and MCP
- secure enough for serious pre-production and early production evaluation

The current product strategy still includes a hosted tier and hosted MCP endpoint as part of the broader v1 go-to-market plan.

This document sets the minimum release bar for the package and platform baseline. Hosted is part of the first release window, likely as beta. Hosted GA remains conditional on the still-open isolation and operating-model decisions, but package readiness and security baseline are non-negotiable either way.

## 3. Scope Included In v1

### 3.1 Packages

- `@orbit-ai/core`
- `@orbit-ai/api`
- `@orbit-ai/sdk`
- `@orbit-ai/cli`
- `@orbit-ai/mcp`
- `@orbit-ai/integrations`

### 3.2 Adapter Support

- Supabase
- Neon
- SQLite for local development and limited tenant-aware workflows enforced at the application layer

Raw Postgres remains a target portability path in the core architecture, but it is not treated here as a mandatory initial-release support commitment because the current PRD still stages it after the first adapter wave.

### 3.3 Integration Scope

The only first-party connectors expected in v1 are:

- Gmail
- Google Calendar
- Stripe

## 4. Scope Explicitly Excluded From v1

The following are not required for the minimum package-baseline v1 release:

- full CRM web application UI
- Orbit-owned end-user auth platform
- Python SDK
- generalized workflow engine
- InboxOps beyond clearly defined post-v1 scope
- enterprise field-level encryption as a finished product capability
- broad marketplace of third-party connectors

These can ship later without redefining what v1 means.

## 5. Core Product Release Gates

v1 ships only if a developer or agent can complete the core jobs without undocumented manual repair.

### 5.1 Required User Journeys

All of the following must work end-to-end:

- initialize a project with `orbit init`
- configure an adapter and create working local context
- create, list, get, update, and delete contacts
- create, list, get, update, and delete companies
- create, list, get, update, and delete deals
- move a deal between stages
- inspect schema and add a custom field safely
- preview and apply a reversible migration
- use the SDK in HTTP mode
- use the SDK in direct-core mode
- start the MCP server and execute the core tool flows
- configure Gmail successfully
- configure Google Calendar successfully
- configure Stripe successfully

### 5.2 Fail Conditions

v1 fails this gate if:

- any primary workflow only works through one interface
- any workflow depends on tribal knowledge rather than documented steps
- schema safety features exist in prose but not in working behavior

## 6. Interface Parity Gates

API, SDK, CLI, and MCP must expose a coherent shared contract.

### 6.1 Required Parity

These must match across interfaces where applicable:

- object model and entity names
- prefixed ULID conventions
- pagination behavior
- error codes
- idempotency behavior
- versioning rules
- include and expansion behavior
- admin versus tenant route semantics

### 6.2 Required Evidence

- parity matrix checked into docs or validation artifacts
- explicit handling of any justified interface differences
- no unresolved contract drift between specs and implementation

### 6.3 Fail Conditions

- one interface returns materially different semantics without explicit reason
- idempotency or pagination behaves differently between surfaces
- MCP tools and CLI commands lag the published entity and action inventory

## 7. Architecture and Data Gates

### 7.1 Core Data Model

Pass criteria:

- prefixed ULIDs work consistently
- tenant-scoped tables are modeled consistently
- bootstrap-scoped tables are explicit
- core entity services exist for the intended first-party surface
- custom field registry works
- plugin schema extension model works

### 7.2 Migration Safety

Pass criteria:

- preview is available before apply
- rollback metadata is recorded
- destructive actions require explicit confirmation and stronger gates
- plugin-owned tables follow the same migration control path

### 7.3 Tenant Isolation

Pass criteria:

- tenant context is transaction-bound on Postgres-family adapters
- RLS exists for every tenant-scoped Postgres-family table
- repositories still filter by org scope
- SQLite limitations are documented and tested

### 7.4 Fail Conditions

- any known cross-tenant leakage path remains open
- bootstrap and tenant authority remain mixed
- plugin-owned tables bypass core registration and RLS handling

## 8. Security Gates

### 8.1 Required Controls

- API keys are hashed, scoped, revocable, and auditable
- secrets are encrypted or sourced from approved secret management
- webhook signing and replay handling are implemented
- connector credentials are encrypted and least-privilege
- migration authority is isolated from runtime authority
- audit logs redact sensitive values

### 8.2 Required Review Outcome

v1 should not ship with any unresolved critical or high security findings in:

- tenant isolation
- auth and authorization
- secret handling
- webhook verification
- migration authority
- connector token handling

### 8.3 Fail Conditions

- request paths use elevated credentials such as Supabase `service_role`
- secret redaction is inconsistent
- mutating surfaces lack abuse and replay controls

## 9. Documentation Gates

### 9.1 Required Documentation

- root README with working quickstart
- product brief
- implementation specs
- security architecture
- database hardening checklist
- per-surface docs for API, SDK, CLI, MCP, and integrations
- AGENTS.MD coverage for the intended core entity areas
- `llms.txt`

### 9.2 Required Standard

A new developer should be able to:

- understand what Orbit AI is
- choose an adapter
- initialize a project
- create core records
- customize schema
- run the MCP server

without requiring internal explanation.

### 9.3 Fail Conditions

- docs promise workflows that are missing or incomplete
- examples do not run or are clearly stale
- core product meaning is still spread across too many documents

## 10. Testing Gates

### 10.1 Required Test Types

- unit tests for core primitives
- adapter integration tests
- migration safety tests
- API contract tests
- SDK parity tests
- CLI smoke tests
- MCP smoke tests
- integration connector flow tests
- security tests for tenant isolation and secret handling

### 10.2 Required Coverage Standard

The bar is not a raw percentage. The bar is that every critical workflow and every critical trust boundary has explicit test coverage.

### 10.3 Fail Conditions

- only package-local unit tests exist
- cross-surface parity is untested
- cross-tenant denial behavior is untested

## 11. Operational Readiness Gates

### 11.1 Required

- `orbit status` and equivalent health paths work
- migrations are observable and auditable
- request IDs and useful errors exist
- webhook retry and failure visibility exist
- connector auth failures are visible
- backup and restore expectations are documented for supported production adapters
- support and incident runbooks exist at least in draft form
- if hosted launches with v1, hosted operational runbooks and isolation controls are reviewed to the same standard

### 11.2 Fail Conditions

- operators would need to read source code to debug basic failures
- production migration rollback is undocumented
- webhook or connector failures disappear silently

## 12. Release Levels

### Green

All critical and high gates pass. Remaining work is minor documentation or UX follow-up.

### Yellow

The product is fit for alpha or beta but not v1 GA. Yellow applies when:

- core functionality mostly works
- security baseline is incomplete but compensating controls exist
- documentation or operational readiness is not yet strong enough

### Red

v1 cannot ship. Red applies when any of these remain open:

- tenant isolation gaps
- unresolved high-severity security findings
- major interface parity drift
- incomplete migration safety
- incomplete package readiness on a core surface

## 13. Sign-Off Owners

Every v1 release decision should have named owners for:

- product
- core architecture
- security
- API and SDK
- CLI and MCP
- integrations
- docs
- release coordination

## 14. Final Rule

Orbit AI is v1-ready only when:

- the shared contract is stable across interfaces
- the tenant isolation model is implemented and validated
- the migration engine is safe enough to trust
- the docs support independent adoption
- the security baseline is frozen and enforced

Anything short of that is a milestone, not v1.
