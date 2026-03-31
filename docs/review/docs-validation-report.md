# Orbit AI Docs Validation Report

Date: 2026-03-31
Status: Draft
Scope:
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md)
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md)
- [REVIEW-REPORT.md](/Users/sharonsciammas/orbit-ai/docs/REVIEW-REPORT.md)
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
- [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [database-hardening-checklist.md](/Users/sharonsciammas/orbit-ai/docs/security/database-hardening-checklist.md)

Method:
- local review
- parallel sub-agent validation across product, architecture/spec coherence, and security/operations

## Verdict

The documentation set is materially stronger than before and is close to becoming a stable operating baseline. However, it still has several high-severity inconsistencies at the top-level planning and release-definition layers.

The main issue is not within the package specs themselves. The main issue is that the older strategy documents and the newer product/security/release documents do not yet describe one fully unified `v1`.

Implementation can proceed only after the top-level docs are reconciled on:

1. hosted launch stance
2. adapter rollout
3. v1 versus v1.1 interface scope
4. master-plan architecture updates
5. security authority model in implementation-facing docs

## High Findings

### 1. Hosted launch story is still inconsistent across the strategy and release documents

References:

- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md#L280)
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md#L392)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md#L804)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md#L142)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md#L26)

Problem:

- The PRD still reads as if hosted is a committed day-one product offering with concrete pricing and product shape.
- The ARD still treats hosted isolation as an unresolved architectural decision.
- The product brief and release definition now treat hosted launch form as open: beta or GA alongside the first package release.

Why it matters:

- This affects pricing credibility, security posture, infrastructure planning, release sequencing, and what “v1” means.

Required fix:

- Choose one canonical stance and propagate it everywhere.
- Recommended wording: hosted is part of the product strategy, but hosted GA is conditional on resolving isolation and operating-model decisions; package v1 readiness is the non-negotiable baseline.

### 2. Adapter rollout is not described consistently

References:

- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md#L197)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md#L720)
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md#L363)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md#L166)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md#L41)

Problem:

- The PRD says MVP adapters are Supabase, Neon, and SQLite, with raw Postgres in v1.1.
- The ARD rollout appears to defer Neon relative to the PRD.
- The meta plan and core spec still talk about raw Postgres as a first-class adapter.
- The newer product docs narrow the initial support bar but do not fully align the rest of the set.

Why it matters:

- This affects implementation order, release scope, testing burden, and adapter-specific documentation.

Required fix:

- Freeze one adapter rollout statement:
  - initial supported release adapters
  - architectural portability targets
  - post-v1 adapters

### 3. `v1` versus `v1.1` interface scope is still split across the docs

References:

- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md#L139)
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md#L157)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md#L159)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md#L21)

Problem:

- The PRD still places several interface capabilities in v1.1, including some webhook, idempotency, schema, and MCP transport capabilities.
- The newer product and release docs assume a broader v1 baseline.

Why it matters:

- This changes what engineering should implement now, what release gating means, and how launch messaging reads.

Required fix:

- Create one canonical v1 feature table and update the PRD, product brief, and release definition to match it.

### 4. The meta plan still contains outdated core architecture assumptions

References:

- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md#L64)
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md#L127)
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md#L278)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L341)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L199)

Problem:

- The meta plan still implies `organization_id` on every table and generic public entity routing for all objects.
- The corrected specs now make `organizations` bootstrap-scoped and split bootstrap, public tenant, and admin routes.

Why it matters:

- The meta plan is supposed to be the master document. Right now it can still mislead implementation decisions.

Required fix:

- Update the meta plan to reflect:
  - tenant-scoped tables versus bootstrap tables
  - bootstrap and admin route separation
  - current MCP extension model

### 5. The implementation-readiness story is inconsistent

References:

- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L3)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L3)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md#L3)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L3)
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md#L9)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md#L389)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md#L307)

Problem:

- Several specs say “Ready for implementation.”
- The implementation plan still says implementation should not start until preconditions are resolved.
- The security and release docs say the security baseline must be frozen before broader implementation and release.

Why it matters:

- This affects immediate execution. Right now the docs do not answer one simple question consistently: are we ready to start building packages or not?

Required fix:

- Replace “Ready for implementation” in the package specs with a more precise status such as:
  - “Implementation-ready pending top-level product and security reconciliation”
  - or update the implementation plan to reflect that spec fixes are complete and only strategic decisions remain

### 6. The security authority model is not yet implementation-facing

References:

- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md#L135)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md#L150)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1135)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L622)

Problem:

- The security doc now defines distinct database-role expectations and bans `service_role` on request paths.
- The core and API specs do not yet express that role separation concretely in their implementation-facing contracts.

Why it matters:

- This leaves migration authority, runtime authority, and credential separation under-specified exactly where engineers will build from.

Required fix:

- Add explicit role and authority constraints into the core and API specs, not only the security architecture doc.

### 7. SDK and CLI contract alignment is still incomplete

References:

- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md#L680)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md#L721)
- [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md#L348)

Problem:

- The SDK now defines a record-first public contract with `.withResponse()` for raw envelopes.
- The CLI spec still says JSON formatting is based on the raw SDK envelope.

Why it matters:

- This is an implementation detail that will cause immediate confusion in CLI construction.

Required fix:

- Update the CLI spec to state exactly whether it uses:
  - record-first SDK methods plus explicit raw response paths
  - or direct transport access for envelope-aware JSON output

### 8. Secret redaction is not yet part of the API and MCP object contracts

References:

- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L852)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L249)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md#L142)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md#L238)

Problem:

- Secret-bearing webhook and connector records exist.
- Redaction requirements are stated in the security architecture.
- API and MCP specs do not yet define sanitized read behavior explicitly for these objects.

Why it matters:

- This is a contract-level leakage risk.

Required fix:

- Add explicit response redaction rules for secret-bearing entities in API and MCP specs.

## Medium Findings

### 9. Pricing is more concrete than the unresolved hosting model supports

References:

- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md#L280)
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md#L287)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md#L804)

Problem:

- The pricing table and overage model look decided while the hosting-cost model remains unresolved.

Recommendation:

- Recast current pricing as draft assumptions pending hosted isolation and cost validation.

### 10. Stripe Projects is important strategically but not cleanly classified

References:

- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md#L18)
- [orbit-ai-product-brief.md](/Users/sharonsciammas/orbit-ai/docs/product/orbit-ai-product-brief.md#L205)

Problem:

- Stripe Projects is described as a major distribution channel but also as not a launch dependency.

Recommendation:

- State explicitly: strategic channel, not v1 ship blocker.

### 11. MCP extension model is fixed in package specs but not reflected in top-level planning

References:

- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md#L245)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md#L20)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L483)

Problem:

- The top-level docs still present “23 MCP tools” without distinguishing core tools from extension tools.

Recommendation:

- Update the meta plan and any summary docs to say “23 core MCP tools, plus optional namespaced integration extensions in composite runtimes.”

### 12. `channels` remains ambiguous as a v1 entity

References:

- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md#L159)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L270)

Problem:

- `channels` appears in top-level model discussions but not in the current core object registry.

Recommendation:

- Decide whether `channels` is:
  - a v1 first-party entity
  - an integrations concern
  - or deferred scope

### 13. SQLite wording should remain strictly cautionary

References:

- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1167)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md#L131)
- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md#L45)

Problem:

- SQLite is correctly described as application-enforced only, but some release/product wording still risks sounding more permissive than intended.

Recommendation:

- Keep SQLite language framed as local development and compatibility support, not tenant-sensitive production posture.

### 14. Release gates correctly define target state but not current readiness evidence

References:

- [release-definition-v1.md](/Users/sharonsciammas/orbit-ai/docs/product/release-definition-v1.md#L198)

Problem:

- The release-definition doc requires artifacts like `llms.txt` that do not yet exist.

Recommendation:

- Treat release-definition as target-state gating, and add a short note that current repo status is pre-release and pre-evidence for several gates.

## Recommended Fix Order

1. Reconcile `v1` in the PRD, ARD, product brief, and release definition.
2. Update the meta plan to reflect the corrected architecture:
   tenant-scoped tables, bootstrap/admin route split, MCP core-plus-extension model.
3. Push security authority decisions into implementation-facing specs:
   database roles, migration authority, service-role ban, secret redaction contracts.
4. Fix SDK/CLI return-contract mismatch.
5. Resolve remaining scope ambiguity around `channels`, raw Postgres, and hosted beta versus GA.

## Recommended Next Step

Do not move straight to the implementation plan yet.

The next correct step is a top-level doc reconciliation pass on:

- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md)
- [META-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/META-PLAN.md)
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)

Once those are updated to match the corrected specs and new product/security docs, the documentation set will be in a much better position to support:

1. a focused threat model
2. a skills plan
3. a real package-by-package implementation plan
