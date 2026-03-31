# Orbit AI KB

Date: 2026-03-31
Status: Active working hub
Current baseline commit: `03bd6e6`

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

Current focus:

- maintain the repo knowledge base as the live hub
- move from completed slice-1 remediation into slice 2 operational schema and repository primitives
- keep execution docs and skills aligned with implementation progress

Not started yet:

- broad package implementation beyond core slice 1

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
  - [orbit-skills-plan.md](/Users/sharonsciammas/orbit-ai/docs/skills/orbit-skills-plan.md)

## What Is Next

Immediate next actions:

1. Minimum pre-core skills are in place:
   - `orbit-tenant-safety-review`
   - `orbit-schema-change`
   - `orbit-core-slice-review`
2. Start slice 1 from [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md) using the defined workstreams:
   - completed on branch `core-slice-1-execution`
3. Next:
   - accept the slice-1 remediation branch and review outcome
   - execute [core-slice-2-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-2-plan.md)
   - keep tenant-safety review in the loop for repository work

## Open Items

These are still open, but they do not block the KB:

- hosted launch wording beyond the current “restricted hosted v1” posture
- raw Postgres support milestone after the first adapter wave
- public release sequencing across packages
- contribution and open-source governance docs

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

## Working Rule

If a document conflicts with this KB, treat the detailed canonical doc as the source of truth and update the KB immediately after.
