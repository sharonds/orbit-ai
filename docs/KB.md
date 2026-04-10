# Orbit AI KB

Date: 2026-04-10 (revised)
Status: Active working hub
Current baseline commit: `59d3205` (main) — all 5 packages merged, no stale branches

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
- `@orbit-ai/core` Wave 1 remediation
- `@orbit-ai/core` pre-API hardening follow-up
- `@orbit-ai/core` Postgres persistence bridge
- `@orbit-ai/core` Wave 2 execution plan
- `@orbit-ai/core` Wave 2 Slice A
- `@orbit-ai/core` Wave 2 Slice B
- `@orbit-ai/core` Wave 2 Slice C
- `@orbit-ai/core` Wave 2 Slice D
- `@orbit-ai/core` Wave 2 Slice E
- `@orbit-ai/core` tenant hardening follow-up

Current focus:

- **All 5 core packages are complete and merged to main:**
  - `@orbit-ai/core` — 328 tests
  - `@orbit-ai/api` — 281 tests
  - `@orbit-ai/sdk` — 194 tests
  - `@orbit-ai/cli` — 170 tests (30 commands, JSON/table/CSV/TSV output, direct SQLite + API modes)
  - `@orbit-ai/mcp` — 173 tests (23 core tools, stdio + HTTP transport, SSRF protection, secret redaction)
- **Full suite: 1,145 tests passing.** Build + typecheck: clean. All stale branches deleted.
- **Next package track is `packages/integrations`** — Gmail, Google Calendar, Stripe connectors
  - Execution plan: [integrations-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/integrations-implementation-plan.md)
  - Plan revised 2026-04-10 applying MCP review-loop lessons: 17 small slices, tests in every commit, code review after every commit, sub-agent briefs include Coding Conventions

Not started yet:

- `packages/integrations`
- CLI/MCP wiring for integration connectors (after integrations package is stable)

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
  - [core-wave-2-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-services-plan.md)
  - [core-tenant-hardening-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-tenant-hardening-plan.md)
  - [api-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/api-implementation-plan.md)
  - [sdk-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/sdk-implementation-plan.md)
  - [cli-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/cli-implementation-plan.md)
  - [mcp-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/mcp-implementation-plan.md)
  - [core-wave-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-review.md)
  - [core-wave-1-full-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-full-review.md)
  - [core-wave-1-remediation-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-remediation-review.md)
  - [core-pre-api-hardening-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-pre-api-hardening-review.md)
  - [core-persistence-bridge-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-persistence-bridge-review.md)
  - [core-postgres-persistence-bridge-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-postgres-persistence-bridge-review.md)
  - [core-wave-2-slice-a-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-a-review.md)
  - [core-wave-2-slice-b-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-b-review.md)
  - [core-wave-2-slice-c-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-c-review.md)
  - [core-wave-2-slice-d-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-d-review.md)
  - [core-tenant-hardening-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-tenant-hardening-review.md)
  - [orbit-skills-plan.md](/Users/sharonsciammas/orbit-ai/docs/skills/orbit-skills-plan.md)

## What Is Next

1. **Execute `packages/integrations`** from [integrations-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/integrations-implementation-plan.md)
   - 17 slices: foundation → Gmail → Calendar → Stripe → schema → closeout
   - Dependencies: `googleapis`, `google-auth-library`, `stripe`
   - OAuth2 token lifecycle with `CredentialStore` interface
   - Every slice: tests included, code review after, lint before commit
2. **Wire CLI/MCP to integrations** — only after the package contract is stable
3. **Publish all 6 packages** together as `0.1.0-alpha.0` to npm

## Open Items

These are still open, but they do not block the KB:

- hosted launch wording beyond the current “restricted hosted v1” posture
- raw Postgres support milestone after the first adapter wave
- public release sequencing across packages
- contribution and open-source governance docs
- CLI/MCP primary-track sequencing after API and SDK package baselines are underway

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
- 2026-04-01: Executed the Wave 1 remediation plan on branch `core-wave-1-remediation`, landing the SQLite tenant-boundary hardening workstreams plus follow-up fixes for sanitized API key reads, explicit unsupported-adapter failure, and trusted-context create paths in commits `f732700`, `3991d12`, `f99ca7d`, `e23096b`, and `476bbc5`.
- 2026-04-01: Recorded the completed remediation review in [core-wave-1-remediation-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-1-remediation-review.md); Wave 1 remediation is accepted and the next core gate is the Postgres-family persistence bridge.
- 2026-04-01: Landed a pre-bridge hardening follow-up in `516880f` to remove `externalAuthId` from user search fields, stop exporting the raw API key repository from the public package index, make deal pipeline clearing explicit when a stage still exists, and standardize not-found paths on typed `OrbitError` responses.
- 2026-04-01: Completed the pre-API hardening follow-up on branch `core-pre-api-hardening` in `50c109c` and `8da507c`, adding fail-closed filter handling, explicit repository allowlists, sanitized user service reads, typed relation errors, and bootstrap/admin filter stabilization.
- 2026-04-01: Recorded the final review outcome in [core-pre-api-hardening-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-pre-api-hardening-review.md); the next core gate is the Postgres-family persistence bridge.
- 2026-04-01: Executed the Postgres persistence bridge on branch `core-postgres-persistence-bridge` in `ba3dfb1`, adding the generic Postgres runtime adapter, Postgres-backed Wave 1 repositories, and the integrated persistence proof harness.
- 2026-04-01: Refined the Postgres bridge proof harness in `5572e15`, tightening the adapter and registry tests that validate tenant reuse, auth lookup, and persistence reuse.
- 2026-04-01: Recorded the bridge review outcome in [core-postgres-persistence-bridge-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-postgres-persistence-bridge-review.md); the next core step is the next package-level implementation slice, pending instruction.
- 2026-04-02: Committed [core-wave-2-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-services-plan.md) on `main` in `1d98388` and opened branch `core-wave-2-services` to execute Wave 2 starting with Slice A.
- 2026-04-02: Executed Core Wave 2 Slice A locally on branch `core-wave-2-services`, covering `activities`, `tasks`, `notes`, contact-context integration, and SQLite/Postgres persistence proofs; recorded the outcome in [core-wave-2-slice-a-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-a-review.md).
- 2026-04-02: Opened branch `core-wave-2-slice-b` from `main` at `060936f` to keep Wave 2 Slice B reviewable as a separate branch after Slice A merged.
- 2026-04-02: Executed Core Wave 2 Slice B locally on branch `core-wave-2-slice-b`, covering `products`, `payments`, and `contracts`, plus tenant-scope registration, SQLite/Postgres persistence proofs, and Slice B review documentation in [core-wave-2-slice-b-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-b-review.md).
- 2026-04-02: Landed a Slice B follow-up hardening patch on `core-wave-2-slice-b` to block repository-level `organizationId` mutation in shared tenant repositories and Slice B in-memory repositories, added regression coverage, and explicitly left Postgres RLS DDL plus broader org-index work for a separate tenant-hardening follow-up.
- 2026-04-02: Executed Core Wave 2 Slice C on branch `core-wave-2-slice-c`, covering `sequences`, `sequence_steps`, `sequence_enrollments`, and append-style `sequence_events`, plus lazy registry wiring, tenant-scope registration, and SQLite/Postgres persistence proofs.
- 2026-04-02: Landed a Slice C follow-up hardening patch on `core-wave-2-slice-c` to block history-breaking step/enrollment reparenting and parent deletes once event history exists, and enabled SQLite foreign-key enforcement for the Slice C graph while leaving broader Postgres RLS/index hardening for a separate follow-up.
- 2026-04-02: Applied the Slice C review remediation pass on `core-wave-2-slice-c`, adding the missing enrollment-only delete guard regression test, enforcing `exitedAt` for `sequence_enrollments.status = 'exited'`, mapping duplicate sequence names to typed `CONFLICT` errors, and documenting the current `(sequenceId, contactId, status)` reenrollment-history constraint.
- 2026-04-02: Closed the final Slice C review gap on `core-wave-2-slice-c` by adding regression coverage for duplicate sequence-name updates and for repository-thrown `sequences_org_name_idx` conflicts being coerced to typed `CONFLICT` errors on both create and update.
- 2026-04-02: Executed Core Wave 2 Slice D on branch `core-wave-2-slice-d`, covering `tags`, `imports`, `webhooks`, `system.entityTags`, and `system.webhookDeliveries`, plus contact-context tag integration and SQLite/Postgres persistence proofs.
- 2026-04-02: Landed the Slice D hardening pass on `core-wave-2-slice-d`, restoring the frozen `imports.rollbackData` and `webhook_deliveries` storage fields, enforcing same-tenant relation resolution for `entity_tags`, `imports.startedByUserId`, and `webhook_deliveries.webhookId`, tightening import lifecycle validation, and sanitizing delivery admin reads.
- 2026-04-02: Recorded the final Slice D review outcome in [core-wave-2-slice-d-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-d-review.md); the remaining carry-forwards stay on the separate tenant-hardening branch rather than the Slice D branch.
- 2026-04-02: Re-ran the final Slice D code review and security review with independent sub-agent passes; the review artifact was reopened after finding that `imports.rollbackData` still leaks through generic tenant import reads and that the tightened `webhooks.status` enum breaks reads of legacy `inactive|failed` persisted rows.
- 2026-04-02: Fixed the reopened Slice D findings by sanitizing tenant import DTOs, normalizing legacy webhook statuses on read and search paths, expanding regression coverage, rerunning core validation, and rerunning independent code/security review passes with no blocking findings; [core-wave-2-slice-d-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-wave-2-slice-d-review.md) is accepted again.

- 2026-04-02: Executed Core Wave 2 Slice E on branch `core-wave-2-slice-e`, covering `system.customFieldDefinitions`, `system.auditLogs`, `system.schemaMigrations`, `system.idempotencyKeys`, final Wave 2 registry wiring, adapter bootstrap for all four entities, and SQLite/Postgres persistence proofs. `auditLogs.before/after`, `schemaMigrations.sqlStatements/rollbackStatements`, and `idempotencyKeys.requestHash/responseBody` are redacted in admin reads. No audit middleware, idempotency middleware, or schema-engine execution was pulled forward.
- 2026-04-03: Created [core-tenant-hardening-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-tenant-hardening-plan.md) to execute the deferred Postgres RLS DDL, org-leading tenant index review, and shared table-name allowlist assertions as a separate follow-up after Wave 2.
- 2026-04-03: Executed the core tenant hardening plan on branch `core-tenant-hardening` (Slices A-E): transactional Postgres bootstrap with `orbit` schema creation and `search_path` pinning, table DDL, baseline org-leading indexes for tenant filters/RLS, RLS enabled by default, and drift detection tests. The pg-mem persistence proofs use `includeRls: false` because pg-mem does not implement RLS DDL. Review artifact at [core-tenant-hardening-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-tenant-hardening-review.md).
- 2026-04-03: Reviewed and revised the worker-facing tenant-hardening implementation plan in [2026-04-03-core-tenant-hardening.md](/Users/sharonsciammas/orbit-ai/docs/superpowers/plans/2026-04-03-core-tenant-hardening.md) so it now matches the accepted execution baseline: idempotent RLS policy DDL, migration-authority-only bootstrap integration, explicit mid-sequence and final tenant-safety review gates, targeted SQLite validation, and fresh independent code/security review passes. The plan is now execution-ready.
- 2026-04-03: Marked the tenant-hardening follow-up as merged into the accepted core baseline in the KB, and created [api-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/api-implementation-plan.md) plus [sdk-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/sdk-implementation-plan.md) so API is the next package-level track and SDK follows with API as the transport-parity anchor.
- 2026-04-09: Created [cli-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/cli-implementation-plan.md) as the next package-level execution baseline, explicitly grounding CLI work in the checked-in API/SDK packages and calling out current dependency gaps for direct adapter resolution and `@orbit-ai/mcp`.
- 2026-04-09: Created [mcp-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/mcp-implementation-plan.md) as the MCP execution baseline, fixing the package around the 23-tool core contract and calling out current dependency gates for schema, export, and analytics tool families.
- 2026-04-09: Completed `@orbit-ai/cli` on branch `feat/cli` (7 implementation slices, A–G). Codex review surfaced 11 issues; all fixed. Three agent-panel review rounds (6 reviewers) surfaced 17 additional issues; all fixed. Final state: 161 tests, 17 test files, 0 typecheck errors, clean build. Key fixes: Commander `exitOverride` + `instanceof CommanderError`, `isJsonMode()` unification, `apiKeyEnv` config resolution, nested-cwd discovery, `--profile` implementation, SQLite default path + `file://hostname` rejection, synchronous `write+exit` throughout, `confirmAction` extracted to `utils/prompt.ts` with stdin EOF/error cleanup, `seed` count validation, `migrate` no-flags guard. PR opened and merged to main.
- 2026-04-09: Analyzed PRs #22–26 Copilot/Codex review comments (24 findings across 5 PRs). All addressed on branch `fix/pr-review-findings`: `SEARCH_RESULT_TOO_LARGE` HTTP 400 parity, duplicate import fix, `PAYLOAD_TOO_LARGE` 413, `deleteField` SDK type, `AbortSignal.timeout` leak fix, `links.next` suppressed for all POST search routes (entity + global), `beginTransaction` DRY via `withTenantContext` delegation, `--format` choices guard, dashboard await, seed error contract, `orgName` typed, config trust hardening, security review artifact added. Final state: 328+194+281+170 = **973 tests passing**.
- 2026-04-10: Executed `@orbit-ai/mcp` locally across the plan slices: package bootstrap, shared registry/error/output runtime, 23-tool fixed registry, stdio + HTTP transport seams, `_untrusted` resources, dependency-gated import/export/analytics tools, and direct-mode SSRF protections. Final local proof: 93 passing tests, clean typecheck, clean build.
- 2026-04-10: Ran independent code review, security review, and plan-alignment review on the MCP implementation. Fixed the validated findings: bracketed IPv6 loopback SSRF bypass, missing HTTP request-level error boundary, and missing KB/review-artifact closeout. Review artifacts: [2026-04-10-mcp-security-review.md](/Users/sharonsciammas/orbit-ai/docs/review/2026-04-10-mcp-security-review.md) and [2026-04-10-mcp-final-review.md](/Users/sharonsciammas/orbit-ai/docs/review/2026-04-10-mcp-final-review.md).
- 2026-04-10: Wrote [integrations-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/integrations-implementation-plan.md) as the next execution baseline after MCP. The plan explicitly separates `packages/integrations` from later CLI/MCP wrapper work, defines implementation slices A-H, requires unit/integration/end-to-end coverage, and bakes in parallel code review, security review, and plan-alignment review before merge.

## Working Rule

If a document conflicts with this KB, treat the detailed canonical doc as the source of truth and update the KB immediately after.
