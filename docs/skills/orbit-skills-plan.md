# Orbit AI Skills Plan

Date: 2026-03-31
Status: Draft
Depends on:
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
- [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md)

## 1. Purpose

This document defines the first Orbit-specific Codex skills to create before broad implementation work.

The goal is not “more automation.” The goal is to reduce the specific failure modes already identified in Orbit’s docs and threat model:

- tenant-isolation regressions
- API/SDK/CLI/MCP contract drift
- unsafe schema changes
- connector secret leakage
- documentation and implementation divergence

Each skill must be justified by a repeated workflow or a high-risk review need. If a workflow is one-off, it should stay in normal task planning instead of becoming a skill.

## 2. Planning Rules

Every Orbit skill should follow these rules:

1. It must solve a recurring Orbit workflow, not a generic coding problem.
2. It must produce a concrete artifact or validation outcome.
3. It must be narrow enough to trigger reliably.
4. It must not duplicate another skill’s responsibility.
5. It must define a validation step, not just a generation step.

Skill output should usually be one of:

- a code change in a defined write scope
- a review report
- a parity checklist
- a validation note
- a doc update

## 3. Rollout Strategy

Create skills in this order:

1. `orbit-tenant-safety-review`
2. `orbit-schema-change`
3. `orbit-api-sdk-parity`
4. `orbit-mcp-tool-authoring`
5. `orbit-integration-extraction`
6. `orbit-docs-consistency`
7. `orbit-release-readiness`

Reason for this order:

- Skills 1-2 reduce the highest-risk architectural mistakes before package work expands.
- Skills 3-5 reduce cross-package drift during implementation.
- Skills 6-7 help stabilize docs and release quality once implementation is underway.

## 4. Skill Backlog

### 4.1 `orbit-tenant-safety-review`

Purpose:

- Review changes that touch tenant-scoped data paths, adapter logic, auth lookup, RLS assumptions, or request context propagation.

When it should trigger:

- any task touching `organization_id`
- any task touching adapters, repositories, auth middleware, tenant context, RLS, or admin/bootstrap boundaries
- any new table or plugin extension marked tenant-scoped

Primary inputs:

- changed files
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)

Required outputs:

- a concise review note covering:
  - tenant boundary touched
  - trusted source of org context
  - whether request path and direct mode both remain safe
  - whether secrets or admin-only state can cross the boundary
- if problems are found, a flat findings list ordered by severity

Validation rule:

- the skill must explicitly confirm:
  - no caller-controlled `organization_id` is trusted
  - runtime paths do not require elevated credentials
  - new tenant-scoped tables/services include both app-level filtering and Postgres-family RLS expectations where applicable

Out of scope:

- generic performance review
- frontend UX review

### 4.2 `orbit-schema-change`

Purpose:

- Guide schema and custom-field work so migrations, metadata, adapters, API, SDK, CLI, and MCP stay aligned.

When it should trigger:

- adding a table
- adding or promoting a field
- changing a custom field contract
- changing migration or schema-engine behavior

Primary inputs:

- target entity or table
- requested schema change
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)

Required outputs:

- implementation checklist for the exact schema change
- impacted packages and files
- safety classification:
  - additive safe
  - additive with migration review
  - destructive blocked without explicit approval

Validation rule:

- the skill must confirm all of:
  - ID prefix choice is correct
  - tenant-scoped vs bootstrap-scoped classification is explicit
  - pagination/filter/search contracts are unaffected or updated
  - exposed interfaces are listed if the change affects API, SDK, CLI, or MCP

Out of scope:

- connector-specific provider mapping details unless they materially alter core schema

### 4.3 `orbit-api-sdk-parity`

Purpose:

- Keep API, SDK, and CLI behavior aligned on envelopes, pagination, errors, idempotency, and non-CRUD actions.

When it should trigger:

- any change to route contracts
- any change to SDK transport/resource behavior
- any change to CLI `--json` semantics

Primary inputs:

- changed API/SDK/CLI files
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
- [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md)

Required outputs:

- parity checklist covering:
  - route path
  - request shape
  - response envelope
  - pagination behavior
  - error behavior
  - idempotency behavior
- explicit note for any intentionally deferred parity gap

Validation rule:

- the skill must confirm:
  - SDK record-first methods still match API envelopes through `.response()` or `firstPage()`
  - CLI `--json` does not invent metadata
  - non-CRUD routes have an SDK path when exposed publicly

Out of scope:

- MCP-specific semantic tool design unless it depends directly on API/SDK parity

### 4.4 `orbit-mcp-tool-authoring`

Purpose:

- Add or modify MCP tools without drifting from the 23-tool core model, safety annotations, or sanitized-output contracts.

When it should trigger:

- new MCP tool
- change to tool schema
- change to tool output shape
- change to tool descriptions or safety hints

Primary inputs:

- target tool name
- intended workflow
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md) for extension tools

Required outputs:

- tool-definition checklist
- correct safety annotations
- output contract decision:
  - core entity DTO
  - sanitized secret-bearing DTO
  - workflow/action result
- note on whether the tool belongs in core 23 or an extension namespace

Validation rule:

- the skill must confirm:
  - tool belongs to the correct tier
  - description is optimized for selection and misuse avoidance
  - secret-bearing objects are sanitized
  - extension tools do not shadow core tool names

Out of scope:

- generic LLM prompt writing unrelated to Orbit tool selection

### 4.5 `orbit-integration-extraction`

Purpose:

- Extract Gmail, Google Calendar, and Stripe functionality into Orbit’s connector model without porting app-specific assumptions from the source CRM.

When it should trigger:

- connector extraction from `~/smb-sale-crm-app`
- new provider sync logic
- connector credential/state changes
- extension CLI or MCP command work tied to connectors

Primary inputs:

- source files from the legacy CRM
- target connector package files
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)

Required outputs:

- extraction plan listing:
  - what is reusable
  - what must be rewritten
  - what must be dropped
- connector contract checklist covering:
  - install flow
  - credential ownership
  - sanitized reads
  - inbound provider flow
  - outbound/internal event use

Validation rule:

- the skill must confirm:
  - no app UI state or app-specific business wording leaks into the package
  - raw provider secrets never cross read boundaries
  - customer outbound webhooks are not reused as the connector event bus

Out of scope:

- generic OAuth advice not tied to Orbit’s connector model

### 4.6 `orbit-docs-consistency`

Purpose:

- Re-check that top-level plans, product docs, security docs, and package specs still describe the same product.

When it should trigger:

- after major doc edits
- after scope changes
- before execution-plan updates
- before packaging or release-readiness reviews

Primary inputs:

- changed docs
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)
- package specs

Required outputs:

- validation report with:
  - critical contradictions
  - medium drift
  - missing decisions
  - recommended reconciliation order

Validation rule:

- the skill must check at minimum:
  - hosted stance
  - adapter rollout
  - v1 vs v1.1 scope
  - tenant model terminology
  - security posture wording

Out of scope:

- grammar-only editing

### 4.7 `orbit-release-readiness`

Purpose:

- Evaluate whether a package milestone or v1 release candidate meets Orbit’s product, security, and interface bar.

When it should trigger:

- before package alpha/beta tags
- before declaring hosted beta readiness
- before v1 release decisions

Primary inputs:

- implementation diff or release candidate state
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)

Required outputs:

- release gate report:
  - pass
  - pass with exceptions
  - fail
- exception list with owners and blocking status

Validation rule:

- the skill must explicitly assess:
  - tenant isolation controls
  - secret redaction behavior
  - interface parity across API/SDK/CLI/MCP
  - adapter support bar for the target milestone
  - documentation completeness for the shipped surface

Out of scope:

- roadmap ideation

## 5. Skill Creation Sequence

### Phase A: Security-Critical Review Skills

Create first:

1. `orbit-tenant-safety-review`
2. `orbit-schema-change`

Why:

- These two guard the most expensive mistakes before implementation accelerates.

### Phase B: Cross-Package Contract Skills

Create next:

3. `orbit-api-sdk-parity`
4. `orbit-mcp-tool-authoring`
5. `orbit-integration-extraction`

Why:

- These reduce the most likely source of implementation drift across packages.

### Phase C: Governance Skills

Create later:

6. `orbit-docs-consistency`
7. `orbit-release-readiness`

Why:

- These are most useful once there is ongoing implementation and release motion to review.

## 6. Minimum Skill Template Requirements

Every created Orbit skill should include:

- a clear trigger description in frontmatter
- the exact Orbit files/specs it should read first
- a short workflow, not a long essay
- a required validation step
- explicit “out of scope” lines to avoid over-triggering

Recommended bundled resources by skill:

- `orbit-tenant-safety-review`
  References: threat model, security architecture, core/API spec excerpts
- `orbit-schema-change`
  References: entity inventory, ID rules, schema-engine rules, interface impact checklist
- `orbit-api-sdk-parity`
  References: API/SDK/CLI parity checklist template
- `orbit-mcp-tool-authoring`
  References: core 23-tool inventory, safety annotation checklist, sanitized DTO checklist
- `orbit-integration-extraction`
  References: extraction checklist, forbidden carry-over patterns from the legacy app

## 7. Definition Of Done For This Plan

This plan is complete when:

1. The first two skills are created from this document.
2. Each created skill has a deterministic validation path.
3. No two Orbit skills have overlapping primary ownership.
4. The implementation plan can reference these skills by name during execution.

## 8. Immediate Next Action

Create `orbit-tenant-safety-review` first.

Reason:

- It directly addresses Orbit’s top threat: tenant isolation failure.
- It will be useful immediately across core, API, adapter, and integration work.
