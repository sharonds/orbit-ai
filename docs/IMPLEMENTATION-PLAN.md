# Orbit AI Implementation Plan

Date: 2026-03-31
Status: Execution baseline
Related:
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [orbit-skills-plan.md](/Users/sharonsciammas/orbit-ai/docs/skills/orbit-skills-plan.md)

## 1. Purpose

This document is the execution-grade implementation plan for Orbit AI.

It replaces the earlier “what order should we build things in” plan with a concrete delivery baseline:

- what is already frozen
- what can start now
- what must happen before core execution
- what each phase must produce
- what validation gates must pass before moving on

## 2. Current Readiness

The planning baseline is now in place.

Completed:

- strategy docs reconciled
- product brief and release definition
- implementation specs for core, API, SDK, CLI, MCP, and integrations
- security architecture and database hardening checklist
- focused threat model
- skills plan
- KB hub

What this means:

- broad documentation reconciliation is complete
- package implementation can begin now from the core execution plan
- the next real implementation target is `@orbit-ai/core`

## 3. Frozen Baseline

Execution should assume these decisions are fixed unless a later explicit decision supersedes them:

- one Orbit project maps to one database
- developers choose the project database
- initial supported adapter wave is Supabase, Neon, and SQLite for local/dev
- a project may be single-organization or multi-organization
- hosted Orbit provisions one database per project
- hosted v1 restricts live schema apply/rollback
- hosted blocks private/internal webhook targets by default
- SQLite is not treated as a production isolation boundary
- runtime and migration authority are separate
- secret-bearing reads must be sanitized across API, CLI, MCP, and integrations

## 4. Execution Principles

Implementation must follow these rules:

1. `@orbit-ai/core` is the source of truth for schema, IDs, shared types, tenant context, and migration behavior.
2. No package may invent a competing wire contract when one already exists in the specs.
3. Security-sensitive shortcuts are not allowed in order to “get moving faster.”
4. The first package goal is a correct core, not broad surface-area progress.
5. Start with the minimum skills required for safe execution, not the full skill backlog.

## 5. Immediate Execution-Enablement Tasks

These tasks should happen before broad package coding:

### Task A. Finalize This Execution Plan

Output:

- this document upgraded from sequencing to execution baseline

Done when:

- phase ordering is stable
- phase gates are explicit
- immediate next actions are unambiguous

### Task B. Decide Core Plan Location

Decision:

- create a separate core execution plan file rather than embedding all core detail here

Recommended location:

- `docs/execution/core-implementation-plan.md`

Reason:

- core will accumulate the most detail and should not overload the program-level plan

### Task C. Create Minimum Pre-Core Skills

Create only:

1. `orbit-tenant-safety-review`
2. `orbit-schema-change`
3. `orbit-core-slice-review`

Reason:

- they directly reduce the top two categories of pre-core mistakes:
  - tenant-isolation regressions
  - schema drift and unsafe migration work
- they add a completed-diff review gate for core slice 1 work outside schema changes

### Task D. Prepare Core Execution Plan

Output:

- a focused implementation plan for `@orbit-ai/core`

It should break core into:

- foundations
- domain schema and repositories
- services
- schema engine
- adapter implementations
- validation

## 6. Program Phases

### Phase 0. Execution Enablement

Status:

- complete

Outputs:

- KB hub
- execution-grade implementation plan
- first three Orbit skills
- core-only implementation plan

Exit criteria:

- the KB is accepted as the current working hub
- this implementation plan is accepted as the execution baseline
- the first three skills exist and validate
- the core implementation plan is ready to drive work

### Phase 1. Core Foundations

Package:

- `@orbit-ai/core`

Scope:

- ID utilities and parsers
- shared error, envelope, pagination, and search types
- bootstrap entities: organizations, users, memberships, API keys
- tenant-aware adapter interface
- migration bootstrap
- internal page metadata to wire mapping boundary
- transaction-bound tenant context

Threat-model focus:

- T1 cross-tenant leakage
- T2 privileged credential misuse

Exit criteria:

- bootstrap schema can migrate cleanly
- runtime vs migration authority is enforced in the adapter contract
- tenant context is transaction-bound on Postgres-family adapters
- shared types are stable enough for API and SDK implementation

### Phase 2. Core Domain Schema And Services

Package:

- `@orbit-ai/core`

Scope:

- first-party entity tables and relations
- CRUD repositories and services
- admin/system service separation
- audit logging
- search service
- contact context
- batch behavior where still part of the public contract

Threat-model focus:

- T1 cross-tenant leakage
- T3 secret leakage through read models

Exit criteria:

- core entity services exist for the intended v1 surface
- explicit admin/system entities are not mixed into generic public services
- cursor pagination is stable across implemented entities

### Phase 3. Schema Engine And Policy Generation

Package:

- `@orbit-ai/core`

Scope:

- custom field registry
- `addField`, `addEntity`, `promoteField`
- reversible migration records
- Postgres RLS generation
- plugin schema extension hooks

Threat-model focus:

- T2 privileged authority misuse
- T6 unsafe schema evolution

Exit criteria:

- preview/apply/rollback behavior matches the spec
- destructive behavior remains blocked or explicitly gated
- plugin-owned tenant tables can register safely

### Phase 4. API Server

Package:

- `@orbit-ai/api`

Scope:

- auth middleware
- scope enforcement
- request ID, versioning, idempotency, rate limiting
- public, admin, bootstrap, and schema routes
- webhook registration and delivery worker
- OpenAPI generation

Threat-model focus:

- T2 privileged credential misuse
- T3 secret leakage
- T4 outbound webhook SSRF
- T5 replay and verification failures

Exit criteria:

- OpenAPI matches real routes
- secret-bearing reads are sanitized
- webhook and schema routes enforce the intended stronger controls

### Phase 5. SDK

Package:

- `@orbit-ai/sdk`

Scope:

- transport abstraction
- HTTP transport
- direct transport
- resource classes
- retries, idempotency, and version headers
- explicit `.response()` and `list()` / `pages()` behavior

Threat-model focus:

- T1 tenant-context parity in direct mode
- T3 envelope and secret-handling drift

Exit criteria:

- API mode and direct mode expose the same public semantics
- non-CRUD routes needed by CLI and MCP have SDK support

### Phase 6. CLI

Package:

- `@orbit-ai/cli`

Scope:

- command registry
- output formatters
- `orbit init`
- `orbit context`
- reporting/dashboard commands
- embedded `orbit mcp serve`

Threat-model focus:

- T3 secret leakage in JSON output
- operator misuse around direct mode and schema flows

Exit criteria:

- `--json` is machine-safe and envelope-correct
- direct mode and hosted mode are both configurable

### Phase 7. MCP

Package:

- `@orbit-ai/mcp`

Scope:

- 23 core tools
- tool runtime and transports
- resources
- sanitized output rules

Threat-model focus:

- T3 secret leakage
- prompt-driven misuse of unsafe tools

Exit criteria:

- core 23-tool registry matches the spec
- error recovery guidance and safety annotations are implemented

### Phase 8. Integrations

Package:

- `@orbit-ai/integrations`

Scope:

- plugin loader
- Gmail connector
- Google Calendar connector
- Stripe connector
- connector tables and serializers
- inbound provider flows
- extension CLI and MCP registration

Threat-model focus:

- T3 secret leakage
- T4 outbound and provider-boundary abuse
- T5 provider replay and verification failures

Exit criteria:

- connectors install without modifying core package code
- connector state is tenant-scoped and sanitized on read
- customer outbound webhooks are not reused as the connector event bus

## 7. Execution Order

Program order:

1. finish Phase 0
2. execute Phases 1-3 for `@orbit-ai/core`
3. start Phase 4 and Phase 5 once core contracts stabilize
4. start CLI and MCP once SDK and API behavior are stable enough to consume
5. start integrations only after core plugin hooks, secret-redaction model, and webhook semantics are reliable

Recommended overlap:

- API and SDK may overlap late in core Phase 3
- CLI and MCP may overlap after API and SDK core contracts settle
- integrations should lag core/API by design

## 8. Required Skills By Phase

Use these skills during execution:

- Phase 0:
  - minimum pre-core skills:
    - `orbit-tenant-safety-review`
    - `orbit-schema-change`
    - `orbit-core-slice-review`
- Phases 1-3:
  - `orbit-tenant-safety-review`
  - `orbit-schema-change`
  - `orbit-core-slice-review`
- Phases 4-6:
  - add `orbit-api-sdk-parity`
- Phase 7:
  - add `orbit-mcp-tool-authoring`
- Phase 8:
  - add `orbit-integration-extraction`

Do not create the full skills backlog before core unless execution proves it is necessary.

## 9. Validation Gates

Every phase must pass these gates before the next one is considered stable:

1. typecheck on all touched packages
2. regenerated artifacts checked for drift
3. docs updated for any contract changes
4. new tests added for new security-sensitive behavior
5. package interfaces still align with the specs

Additional mandatory security gates:

- T1 gate:
  no unresolved tenant-isolation or org-scope leakage path
- T2 gate:
  no request-serving path uses elevated or migration credentials
- T3 gate:
  no secret-bearing object has an unspecified or untested read contract
- T4 gate:
  hosted outbound webhook/network policy is implemented before hosted release claims
- T5 gate:
  webhook verification and replay handling are implemented before connector release claims
- T6 gate:
  schema mutation controls are implemented before hosted schema-apply exposure

## 10. Tracking Model

During execution, track each phase using:

- status:
  - not started
  - in progress
  - validation
  - done
- owner or active workstream
- blocked or unblocked
- validation evidence

The KB should be updated whenever:

- a phase changes status
- a major decision changes
- a new blocking issue appears

## 11. Risks To Watch During Execution

Most likely execution risks:

- core implementation starts before the minimum pre-core skills exist
- API/SDK/CLI behavior drifts during parallel work
- schema engine work outruns the security model
- connector extraction starts before the secret-handling model is proven
- the KB stops being updated and the team begins operating from stale assumptions

## 12. Immediate Next Actions

Next actions in order:

1. accept this execution-grade implementation plan
2. use `docs/execution/core-implementation-plan.md` as the active core execution driver
3. confirm the three pre-core execution skills validate
4. assign slice-1 workstreams with non-overlapping ownership
5. begin `@orbit-ai/core` implementation from Phase 1
