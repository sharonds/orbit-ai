# Orbit AI Docs Reconciliation Task List

Date: 2026-03-31
Status: Draft
Based on:
- [docs-validation-report.md](/Users/sharonsciammas/orbit-ai/docs/review/docs-validation-report.md)

## Purpose

This task list turns the validation findings into a concrete update plan for the documentation set.

The goal is to reconcile top-level product, architecture, release, and security documents so the repo has one stable definition of:

- what `v1` is
- what is included in the first implementation wave
- what is still open
- what engineering is allowed to start building against

## Priority 0: Freeze The Top-Level Product Definition

### Task 1. Resolve hosted launch stance

Files:
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)

Decision to make:
- Is hosted part of `v1` as beta?
- Is hosted part of `v1` as GA?
- Or is package GA the only hard `v1` bar, with hosted following immediately after?

Definition of done:
- all four docs use the same hosted-launch wording
- pricing language matches the chosen hosted stance
- no document implies day-one hosted GA if that is still conditional

### Task 2. Freeze adapter rollout

Files:
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md)
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)

Decision to make:
- Which adapters are in the initial supported release?
- Which adapters are architectural portability targets but not release-blocking?
- Which adapters are explicitly post-v1?

Definition of done:
- one adapter table exists across the top-level docs
- Supabase, Neon, SQLite, and raw Postgres are classified consistently
- implementation order and release scope no longer disagree

### Task 3. Freeze `v1` versus `v1.1` interface scope

Files:
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)

Decision to make:
- Which API, SDK, CLI, MCP, webhook, and transport features are true `v1`?
- Which remain `v1.1`?

Definition of done:
- one canonical `v1` feature table exists
- no interface capability is listed as both `v1` and `v1.1`
- release gates align with the same feature inventory

## Priority 1: Update The Master Planning Docs

### Task 4. Update META-PLAN to match corrected architecture

Files:
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md)

Changes required:
- change “every table has `organization_id`” to “every tenant-scoped table has `organization_id`”
- reflect `organizations` as bootstrap-scoped
- reflect bootstrap/public/admin route separation
- reflect “23 core MCP tools” plus optional namespaced integration extensions
- reconcile any outdated entity inventory such as `channels`

Definition of done:
- META-PLAN no longer contradicts the current specs
- an implementer can use META-PLAN as a master document without drifting into old assumptions

### Task 5. Update IMPLEMENTATION-PLAN status and prerequisites

Files:
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)

Changes required:
- replace stale prerequisite language left over from earlier spec fixes
- state clearly whether implementation may begin after top-level reconciliation or whether more design work is required
- align phase gating with the newer product and security docs

Definition of done:
- implementation status is unambiguous
- package teams know whether they can begin and under what constraints

## Priority 2: Push Security Decisions Into Build Docs

### Task 6. Add authority and role model requirements to core and API specs

Files:
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)

Changes required:
- define runtime role versus migration role expectations
- define request-path prohibition on elevated credentials such as Supabase `service_role`
- make migration authority and runtime authority separation implementation-facing

Definition of done:
- engineers can implement adapters and API middleware without inferring security-critical authority boundaries from prose alone

### Task 7. Add explicit secret-redaction contracts to API and MCP specs

Files:
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)

Changes required:
- define sanitized read shape for webhook objects
- define sanitized read shape for connector connection objects
- define what fields are never returned through API, CLI JSON, or MCP

Definition of done:
- no secret-bearing object has an unspecified read contract

## Priority 3: Fix Cross-Package Execution Drift

### Task 8. Resolve SDK and CLI return-contract mismatch

Files:
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
- [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md)

Changes required:
- decide exactly how CLI gets envelope metadata in `--json` mode
- align CLI examples with the SDK’s record-first public contract

Definition of done:
- CLI implementation path is obvious
- there is no ambiguity around record-first vs envelope-first behavior

### Task 9. Resolve remaining entity and scope ambiguity

Files:
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md)

Changes required:
- decide fate of `channels`
- ensure entity inventory is stable across top-level docs and specs
- confirm whether any integration-owned concepts are incorrectly presented as first-party core entities

Definition of done:
- one stable entity inventory exists for v1

## Priority 4: Normalize Messaging

### Task 10. Recast pricing as conditional where needed

Files:
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)

Changes required:
- mark pricing and overages as draft assumptions if hosted economics are not frozen
- separate “pricing hypothesis” from “committed launch package” if necessary

Definition of done:
- business language does not overstate certainty

### Task 11. Clarify Stripe Projects position

Files:
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)

Changes required:
- state clearly that Stripe Projects is a strategic distribution channel, not a v1 ship blocker

Definition of done:
- launch sequencing and distribution strategy are not in tension

### Task 12. Keep SQLite wording cautionary

Files:
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [database-hardening-checklist.md](/Users/sharonsciammas/orbit-ai/docs/security/database-hardening-checklist.md)

Changes required:
- keep SQLite framed as local development and compatibility support, not tenant-sensitive production posture

Definition of done:
- no reader could interpret SQLite as equivalent to Postgres-family multitenant security

## Recommended Execution Order

1. Tasks 1-3
   Freeze `v1` and hosted/adapter scope.
2. Tasks 4-5
   Bring the master planning docs up to date.
3. Tasks 6-8
   Push security and interface-contract clarity into implementation-facing specs.
4. Tasks 9-12
   Clean up residual scope and messaging drift.

## What Comes Next After Reconciliation

Once this task list is complete, the next work should be:

1. write the focused threat model
2. write the Orbit skills plan
3. upgrade the implementation plan into an execution plan tied to the reconciled docs

That order matters because the threat model and skills plan should be built on one stable product and security baseline, not on still-divergent top-level documents.
