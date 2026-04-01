# Orbit AI KB

Date: 2026-04-01
Status: Active working hub
Current baseline commit: `5757e73`

## What Orbit Is

Orbit AI is CRM infrastructure for developers and AI agents.

It is not a CRM application. It is the package and interface layer for:

- core CRM schema and services
- REST API
- TypeScript SDK
- CLI
- MCP server
- integrations

## Current Status

Planning and security baseline are in place.

Completed:

- strategy docs
- product brief and release definition
- six implementation specs
- security architecture
- database hardening checklist
- focused threat model
- skills plan
- docs reconciliation and validation reports
- `@orbit-ai/core` slice 1
- `@orbit-ai/core` slice 2 foundations and hardening
- `@orbit-ai/core` Wave 1 service surface
- `@orbit-ai/core` SQLite persistence bridge

Current focus:

- maintain the repo knowledge base as the live hub
- replace the provisional Wave 1 acceptance with a remediated Wave 1 baseline informed by the consolidated full review
- execute the validated Wave 1 remediation plan before resuming the Postgres-family persistence bridge
- keep API/SDK execution blocked until Postgres-family persistence is explicit
- keep execution docs and skills aligned with implementation progress

Not started yet:

- Postgres-family adapter-backed core repository execution
- broad package implementation beyond `@orbit-ai/core`

## Frozen Decisions

- One Orbit project maps to one database.
- Developers choose the project database.
- Initial supported adapters are Supabase, Neon, and SQLite for local/dev.
- A project can be single-organization or multi-organization.
- Hosted Orbit should provision one database per project.
- Hosted v1 restricts live schema apply/rollback.
- Hosted blocks private/internal webhook targets by default.
- SQLite is not a production isolation model.
- IDs use type-prefixed ULIDs.
- API, SDK, CLI, and MCP follow the reconciled envelope/redaction contracts in the specs.

## What Is Canonical

Use these files first:

- Product and strategy:
  - [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md)
  - [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
  - [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md)
- Product management:
  - [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)
  - [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)
- Implementation contracts:
  - [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
  - [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
  - [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
  - [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md)
  - [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)
  - [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md)
- Security:
  - [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
  - [database-hardening-checklist.md](/Users/sharonsciammas/orbit-ai/docs/security/database-hardening-checklist.md)
  - [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- Execution support:
  - [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
  - [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
  - [core-slice-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-1-remediation-plan.md)
  - [core-slice-2-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-2-plan.md)
  - [core-wave-1-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-services-plan.md)
  - [core-wave-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-remediation-plan.md)
  - [core-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-persistence-bridge-plan.md)
  - [core-postgres-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-postgres-persistence-bridge-plan.md)
  - [core-wave-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-review.md)
  - [core-wave-1-full-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-full-review.md)
  - [core-persistence-bridge-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-persistence-bridge-review.md)
  - [orbit-skills-plan.md](/Users/sharonsciammas/orbit-ai/docs/skills/orbit-skills-plan.md)

## What Is Next

Immediate next actions:

1. Minimum pre-core skills are in place:
   - `orbit-tenant-safety-review`
   - `orbit-schema-change`
   - `orbit-core-slice-review`
2. Core execution baseline already completed:
   - slice 1 on `core-slice-1-execution`
   - slice 2 on `core-slice-2-execution`
   - Wave 1 service surface committed on `core-wave-1-services`
   - SQLite persistence bridge committed on `core-wave-1-services`
3. Next:
   - accept and execute [core-wave-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-remediation-plan.md)
   - treat [core-wave-1-full-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-full-review.md) as the consolidated gating review artifact for remediation prioritization
   - re-run tenant-safety, core-slice, and local validation gates on the remediation branch
   - resume [core-postgres-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-postgres-persistence-bridge-plan.md) only after remediation acceptance
   - keep API/SDK execution blocked until that adapter path is explicit

## Open Items

These are still open, but they do not block the KB:

- hosted launch wording beyond the current “restricted hosted v1” posture
- raw Postgres support milestone after the first adapter wave
- public release sequencing across packages
- contribution and open-source governance docs
- whether Postgres-family persistence lands before or alongside core Wave 2

## Decision Log

- 2026-03-31: Reconciled top-level docs and implementation specs into one baseline. See [docs-validation-report.md](/Users/sharonsciammas/orbit-ai/docs/review/docs-validation-report.md) and [docs-reconciliation-task-list.md](/Users/sharonsciammas/orbit-ai/docs/review/docs-reconciliation-task-list.md).
- 2026-03-31: Froze the product model as one Orbit project = one database, with single-org or multi-org inside that project.
- 2026-03-31: Froze hosted security posture to restrict live schema apply/rollback in v1.
- 2026-03-31: Froze hosted outbound webhook policy to block private/internal targets by default.
- 2026-03-31: Finalized the focused threat model in [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md).
- 2026-03-31: Defined the first skills backlog in [orbit-skills-plan.md](/Users/sharonsciammas/orbit-ai/docs/skills/orbit-skills-plan.md).
- 2026-03-31: Upgraded [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md) into the execution-grade baseline.
- 2026-03-31: Created and reviewed [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md); the final sub-agent review returned no findings.
- 2026-03-31: Created the first two execution skills under `.claude/skills/` and tightened them after review to cover CLI contract drift and secret-redaction validation explicitly.
- 2026-03-31: Reconciled [AGENTS.MD](/Users/sharonsciammas/orbit-ai/AGENTS.MD) with the frozen product and execution baseline, and added `orbit-core-slice-review` so completed core slices have an explicit validation gate.
- 2026-03-31: Executed `@orbit-ai/core` slice 1 on branch `core-slice-1-execution`, including package bootstrap, prefixed ULID IDs, shared types, bootstrap schema, adapter authority boundary, and the slice-1 validation proof harness.
- 2026-03-31: Created [core-slice-2-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-2-plan.md) to bridge slice 1 into operational schema, validation, query primitives, and tenant-safe repository foundations.
- 2026-03-31: Accepted [core-slice-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-slice-1-review.md) as the gating review artifact and created [core-slice-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-1-remediation-plan.md) to fix the blocking issues before slice 2 starts.
- 2026-03-31: Executed the slice-1 remediation patch set on branch `core-slice-1-remediation`, reran core validation, and cleared the must-fix auth, tenant-context, and schema-helper issues that were blocking slice 2.
- 2026-03-31: Recorded the remediation review outcome in [core-slice-1-remediation-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-slice-1-remediation-review.md); slice 1 remediation is now ready for acceptance and slice 2 is unblocked.
- 2026-03-31: Executed core slice 2 on branch `core-slice-2-execution`, added the operational schema bridge plus query and repository primitives, and recorded the review outcome in [core-slice-2-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-slice-2-review.md).
- 2026-03-31: Closed the slice-2 hardening follow-ups on branch `core-slice-2-execution`: added `MigrationDatabase`, restricted the raw adapter handle to `unsafeRawDatabase`, added prefix invariant coverage, strengthened the tenant-context proof harness, and landed a baseline SQLite adapter.
- 2026-03-31: Created [core-wave-1-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-services-plan.md) to execute the first core service layer in three slices, starting with service contracts plus `companies` and `contacts`.
- 2026-03-31: Executed the local Wave 1 service surface on branch `core-wave-1-services`, including tenant CRUD for the first seven services, admin/system reads, `search`, `contactContext`, and `createCoreServices(adapter, overrides)`.
- 2026-03-31: Recorded the Wave 1 review outcome in [core-wave-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-review.md); the remaining medium gap is adapter-backed persistence, not tenant safety or service-surface correctness.
- 2026-03-31: Executed the SQLite persistence bridge on branch `core-wave-1-services`, adding a real SQLite runtime database wrapper, Wave 1 schema bootstrap, SQLite-backed repositories, and persistence proof tests.
- 2026-03-31: Recorded the bridge review outcome in [core-persistence-bridge-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-persistence-bridge-review.md); the remaining persistence gap is now Postgres-family adapters, not SQLite.
- 2026-03-31: Committed the Wave 1 service layer as `be48047` and the SQLite persistence bridge as `e7de3a3` on branch `core-wave-1-services`.
- 2026-03-31: Created [core-postgres-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-postgres-persistence-bridge-plan.md) to close the remaining generic Postgres persistence gap before API execution begins.
- 2026-03-31: Revalidated the Wave 1 implementation against a consolidated review and created [core-wave-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-remediation-plan.md) to resolve secret exposure, scope classification, SQLite tenant-boundary, and search/correctness gaps before the Postgres bridge continues.
- 2026-04-01: Added [core-wave-1-full-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-full-review.md) as the consolidated 8-agent Wave 1 review artifact and updated [core-wave-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-remediation-plan.md) to absorb the additional validated must-fix items, including SQLite update atomicity, API key surface placement, helper hardening, and regression-gate expansion.

## Working Rule

If a document conflicts with this KB, treat the detailed canonical doc as the source of truth and update the KB immediately after.
