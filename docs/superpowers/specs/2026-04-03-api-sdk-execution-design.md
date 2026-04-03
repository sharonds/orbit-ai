# API + SDK Unified Execution Design

Date: 2026-04-03
Status: Approved design
Packages: `@orbit-ai/api`, `@orbit-ai/sdk`
Supersedes: [api-implementation-plan.md](/docs/execution/api-implementation-plan.md) and [sdk-implementation-plan.md](/docs/execution/sdk-implementation-plan.md) as execution drivers (those remain as contract references)
Depends on:
- [IMPLEMENTATION-PLAN.md](/docs/IMPLEMENTATION-PLAN.md)
- [core-implementation-plan.md](/docs/execution/core-implementation-plan.md)
- [api-implementation-plan.md](/docs/execution/api-implementation-plan.md)
- [sdk-implementation-plan.md](/docs/execution/sdk-implementation-plan.md)
- [02-api.md](/docs/specs/02-api.md)
- [03-sdk.md](/docs/specs/03-sdk.md)
- [security-architecture.md](/docs/security/security-architecture.md)
- [orbit-ai-threat-model.md](/docs/security/orbit-ai-threat-model.md)
- [KB.md](/docs/KB.md)

## 1. Purpose

This document is the unified execution driver for `@orbit-ai/api` and `@orbit-ai/sdk`. It replaces the per-package execution plans with a single interleaved sequence that encodes:

- test-first enforcement of security and contract invariants
- safe API/SDK overlap on stable seams
- sub-agent dispatch with non-overlapping file scopes
- lightweight mid-step verification with formal reviews only at wave boundaries
- a remediation protocol that eliminates the cascading remediation branches observed during core execution

## 2. Design Decisions

These decisions are frozen for this execution cycle:

1. **Correct-by-construction AND maximally parallel.** The plan optimizes for both.
2. **Test-first sub-agents.** Each implementation sub-agent writes security/contract tests before implementation code. Tests encode invariants so violations are caught mechanically, not at review.
3. **Overlap on stable seams.** SDK bootstrap and transport work starts after API Slice B (auth/envelope) is review-accepted. SDK resource breadth waits for the matching API wave.
4. **Lightweight mid-step verification + formal end-of-wave reviews.** Automated verification after every step. Full independent review passes only at 3 wave boundaries.

## 3. Lessons From Core Execution

The core package went through 16 PRs and multiple remediation cycles. The recurring failure modes and their prevention mechanisms:

| Core failure | Root cause | Prevention |
|---|---|---|
| `keyHash` leaked through all reads | No test asserting sanitized output existed before implementation | Test-first contract requires sanitization tests before implementation |
| `create` had no context validation | Repository implementer didn't enforce defense-in-depth | Test-first contract requires `ctx` on all tenant mutations |
| TOCTOU in `update` | Implementer split read/write across transactions | Test-first contract asserts single-transaction atomicity |
| Slice D reopened twice | Full review found issues, fix introduced new issues | Wave gate remediation: fix on same branch, re-run only failing reviewer |
| Remediation cascades | Each fix created new plans, branches, reviews | No separate remediation branches; fixes are commits on the execution branch |
| Sub-agent wrote outside scope | Workstream boundaries not enforced mechanically | File ownership is explicit per agent per step; violation = step failure |

## 4. Execution Sequence

10 execution steps organized into 3 waves with 3 formal review gates.

### Step 1. API Package Bootstrap And App Skeleton

Package: `@orbit-ai/api`
Depends on: core baseline on `main`
Branch: `api-sdk-execution` (single branch for the full execution; no per-step or per-package branches)

Sub-agents: 1

- Agent A: `packages/api/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/create-api.ts`, `src/app.ts`, `src/config.ts`, platform entrypoints (`node.ts`, `vercel.ts`, `cloudflare.ts`)

Test-first contract:
- `createApi()` accepts only a runtime-scoped `StorageAdapter` plus version/config
- Package builds and typechecks against `@orbit-ai/core`
- Platform entrypoints resolve to the same factory
- Package exports are narrow and match the frozen structure in [02-api.md](/docs/specs/02-api.md)

Post-step verification:
- `pnpm --filter @orbit-ai/api build` green
- `pnpm --filter @orbit-ai/api typecheck` green
- `pnpm --filter @orbit-ai/api test` green
- `git diff --check` clean

### Step 2. API Auth, Tenant Context, And Envelope Boundary

Package: `@orbit-ai/api`
Depends on: Step 1

Sub-agents: 2

- Agent A (middleware): `src/middleware/request-id.ts`, `src/middleware/version.ts`, `src/middleware/auth.ts`, `src/middleware/tenant-context.ts`, `src/middleware/error-handler.ts`
- Agent B (response boundary): `src/context.ts`, `src/responses.ts`, scope helpers

Test-first contract:
- Auth resolves keys only through `adapter.lookupApiKeyForAuth()` — never raw queries
- Revoked and expired keys are rejected
- Request context carries `orgId`, `apiKeyId`, `scopes`, `requestId`
- Bootstrap routes bypass tenant context; public and admin routes do not
- All responses flow through the shared success/error envelope
- Error envelope matches the spec shape from [02-api.md](/docs/specs/02-api.md) section 3.3
- Secret-bearing reads are sanitized at top-level and in `include=` expansions
- No request-serving path can reach migration authority

Threat model focus: T1 (cross-tenant leakage), T2 (privileged credential misuse), T3 (secret leakage)

Post-step verification: same checklist as Step 1 plus all test-first tests green.

### WAVE GATE 1 (after Step 2)

Purpose: confirm the auth/envelope contract is stable enough to anchor SDK work and API route breadth.

Review sub-agents:
- Independent code review sub-agent
- Independent security review sub-agent (auth lookup path, tenant-context boundaries, envelope/error ownership, secret redaction)
- Independent tenant safety review (using `orbit-tenant-safety-review` skill)

Gate question: "Is the auth/envelope contract stable enough to anchor SDK work and route breadth?"

Remediation protocol: fix on same branch; re-run only the specific failing reviewer; escape valve at >3 blocking findings.

### Step 4. API Wave 1 Public Routes + SDK Bootstrap (Parallel)

Packages: `@orbit-ai/api` + `@orbit-ai/sdk`
Depends on: Wave Gate 1 passed

Sub-agents: 3

- Agent A (API routes): `src/routes/health.ts`, `src/routes/entities.ts` for Wave 1 entities (contacts, companies, deals, pipelines, stages, users), `src/routes/search.ts`, contact-context route
- Agent B (SDK bootstrap): `packages/sdk/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/client.ts`, `src/config.ts`, `src/errors.ts`, `src/retries.ts`, `src/pagination.ts`, `src/transport/index.ts`
- Agent C (test-first for Step 5): writes SDK transport parity tests into `packages/sdk/src/__tests__/`

Test-first contract (API routes):
- Each public entity route returns correct envelope shape
- Scope checks distinguish read vs write
- Cursor pagination, `include=`, and `links.self` are consistent across all Wave 1 routes
- No bootstrap, admin, or schema routes leak into public surface
- Route resolution goes through core services only

Test-first contract (SDK bootstrap):
- `OrbitClient` instantiates in both API mode and direct mode
- `OrbitApiError` is typed and consistent with API error envelope
- Transport interface compiles against core envelope types
- `OrbitClientOptions` supports the two documented modes

Post-step verification: both packages build, typecheck, and test green.

### Step 5. SDK HTTP Transport + Direct Transport

Package: `@orbit-ai/sdk`
Depends on: Wave Gate 1 passed (runs in parallel with Step 4 completion)

Sub-agents: 2

- Agent A (HTTP transport): `src/transport/http-transport.ts`, retry integration, query/body/header handling, error mapping
- Agent B (direct transport): `src/transport/direct-transport.ts`, `dispatchDirectRequest()`, envelope synthesis, error coercion

Test-first contract:
- HTTP transport sends `Authorization: Bearer ...`, `Orbit-Version`, `Idempotency-Key` for mutating requests
- HTTP error responses become typed `OrbitApiError`
- HTTP transport does not reshape envelopes
- Direct transport requires `adapter` and trusted `context.orgId`
- Direct transport synthesizes same success envelope shape and cursor metadata as HTTP mode
- Direct transport surfaces same typed error codes as HTTP mode
- Direct transport uses request-scoped tenant context only — no migration authority
- HTTP and direct mode produce identical envelope shapes for the same operation

Threat model focus: T1 (tenant-context parity in direct mode), T2 (authority boundaries in direct mode)

Post-step verification: SDK builds, typechecks, tests green. Parity tests from Step 4 Agent C pass.

### WAVE GATE 2 (after Steps 4-5)

Purpose: confirm API Wave 1 contract and SDK transport are stable enough to anchor resource breadth.

Review sub-agents:
- Independent code review sub-agent (both packages)
- Independent security review sub-agent (route-level scope enforcement, SDK transport authority boundaries, HTTP/direct parity)
- Contract review (route naming, envelope metadata, pagination consistency)

Gate question: "Is the Wave 1 contract stable enough to anchor SDK resource breadth and API Wave 2?"

Remediation protocol: same as Wave Gate 1.

### Step 7. API Wave 2 Routes + SDK Wave 1 Resources (Parallel)

Packages: `@orbit-ai/api` + `@orbit-ai/sdk`
Depends on: Wave Gate 2 passed

Sub-agents: 3

- Agent A (API Wave 2 routes): remaining public entity routes (activities, tasks, notes, products, payments, contracts, sequences, sequence_steps, sequence_enrollments, sequence_events, tags, webhooks, imports), relationship and workflow endpoints, bootstrap routes, `GET/PATCH /v1/organizations/current`, `/v1/admin/*` routes, `/v1/objects*` and `/v1/schema/migrations/*` routes
- Agent B (SDK Wave 1 resources): `src/resources/base-resource.ts`, Wave 1 resource files (contacts, companies, deals, pipelines, stages, users), `src/search.ts`, contact context helper, list pagination helpers, deal workflow helpers
- Agent C (test-first for Step 8): writes idempotency/rate-limit/OpenAPI invariant tests into `packages/api/src/__tests__/` and SDK Wave 2 parity tests into `packages/sdk/src/__tests__/`

Test-first contract (API Wave 2):
- Remaining entity routes satisfy same envelope/scope/pagination invariants as Wave 1
- Admin/system entities stay under `/v1/admin/*`
- Bootstrap routes remain outside tenant context
- Schema routes do not leak migration authority into generic entity request paths
- Webhook and webhook-delivery reads are sanitized across public and admin surfaces
- Route surface matches the matrix frozen in [02-api.md](/docs/specs/02-api.md)

Test-first contract (SDK Wave 1 resources):
- Resource methods return records, not envelopes
- `.response()` returns raw server envelope unchanged
- `list().firstPage()` preserves raw envelope metadata
- `list().autoPaginate()` yields records across both transports
- Resource methods call canonical API paths in both transports

Threat model focus: T1, T2, T3 (secret leakage in webhook/import reads), T4 (outbound webhook SSRF on registration routes)

Post-step verification: both packages build, typecheck, test green.

### Step 8. API Contract Hardening + SDK Wave 2 Resources (Parallel)

Packages: `@orbit-ai/api` + `@orbit-ai/sdk`
Depends on: Step 7

Sub-agents: 3

- Agent A (API hardening): `src/middleware/rate-limit.ts`, `src/middleware/idempotency.ts`, route schemas, OpenAPI registry, generated `openapi.json` and `openapi.yaml`
- Agent B (SDK Wave 2 resources): remaining resource files (activities, tasks, notes, products, payments, contracts, sequences, sequenceSteps, sequenceEnrollments, sequenceEvents, tags, schema, webhooks, imports), remaining workflow helpers (deal move, enroll/unenroll, object/schema helpers, webhook/import helpers)
- Agent C (SDK parity harness): parity test matrix across HTTP and direct modes for the full resource surface

Test-first contract (API hardening):
- Mutating routes accept or generate `Idempotency-Key`
- Same key + same route + same body replays stored response
- Same key + different body returns `409 IDEMPOTENCY_CONFLICT`
- Rate limiting emits documented headers and `Retry-After`
- OpenAPI generated from route schemas matches real routes
- Final check: API request paths still do not reach migration authority

Test-first contract (SDK Wave 2):
- Resource coverage matches [03-sdk.md](/docs/specs/03-sdk.md)
- Direct transport only maps paths in the accepted API matrix
- Secret-bearing reads sanitized in both modes
- Schema helpers preserve dedicated schema-route contract

Threat model focus: T1-T6 full coverage

Post-step verification: both packages build, typecheck, test green.

### Step 9. SDK Final Parity And Security Gates

Package: `@orbit-ai/sdk`
Depends on: Step 8

Sub-agents: 1

- Agent A: final parity tests, `.response()` and `list().firstPage()` tests, review artifact preparation

Test-first contract:
- Same SDK calls produce equivalent record shapes and raw envelopes in HTTP and direct modes
- `OrbitApiError` is used consistently
- `.response()` and `list().firstPage()` preserve server-owned `meta`, `links`, and `request_id`
- No SDK helper reconstructs or fabricates transport metadata client-side
- SDK surface matches [03-sdk.md](/docs/specs/03-sdk.md) and the accepted API route matrix

Post-step verification: SDK builds, typechecks, tests green. Full parity matrix passes.

### WAVE GATE 3 (after Step 9)

Purpose: final acceptance of both packages as the stable base for CLI and MCP.

Review sub-agents:
- Independent code review sub-agent (both packages)
- Independent security review sub-agent (both packages, full T1-T6)
- Parity review using `orbit-api-sdk-parity` skill
- Contract review (generated OpenAPI matches real routes, SDK matches API)

Gate question: "Are both packages accepted as the stable base for CLI and MCP?"

Remediation protocol: same as other gates.

## 5. Sub-Agent Dispatch Model

### File Ownership Rules

- One sub-agent owns one file set per step
- No agent writes to another agent's file scope
- An agent that needs to read another agent's output waits for that agent to complete
- Test-first agents write tests into `__tests__/` directories scoped to their target step
- File ownership violation = step failure

### Total Agent Dispatches

- ~15 implementation sub-agents across Steps 1-9
- ~3 test-first sub-agents (Steps 4, 7 pre-write tests for the next step)
- ~9 review sub-agents across 3 wave gates (3 reviewers x 3 gates)
- ~27 total sub-agent dispatches

## 6. Verification Layers

### Layer 1: Post-Step Automated Verification (after every step)

```
pnpm --filter @orbit-ai/api test
pnpm --filter @orbit-ai/api typecheck
pnpm --filter @orbit-ai/api build
pnpm --filter @orbit-ai/sdk test        # when SDK steps are active
pnpm --filter @orbit-ai/sdk typecheck
pnpm --filter @orbit-ai/sdk build
git diff --check
```

Plus:
- Test-first tests that were red at step start are now green
- No test was skipped or deleted to make the step pass
- File ownership boundaries were respected

### Layer 2: Wave Gate Formal Reviews (3 gates only)

See Wave Gates 1, 2, and 3 above for specific reviewer assignments and gate questions.

### Layer 3: Remediation Protocol

When a wave gate finds issues:
- Fix on the same branch, not a new remediation branch
- Commit fixes, re-run Layer 1 automated verification
- Re-run only the specific review sub-agent that found the issue
- If >3 blocking findings from a single gate: stop and create a focused remediation plan (escape valve)

This eliminates the core execution pattern of: review -> remediation plan -> remediation branch -> re-review -> remediation of the remediation.

## 7. Skills Required

### Existing skills:
- `orbit-tenant-safety-review` — Wave Gates 1, 2, 3
- `orbit-schema-change` — available if any step touches schema
- `orbit-core-slice-review` — not used (core-specific)

### New skill needed:
- `orbit-api-sdk-parity` — Wave Gates 2 and 3. Validates:
  - SDK resource methods map 1:1 to API routes
  - HTTP and direct transport produce identical envelope/error shapes
  - Secret-bearing reads sanitized in both modes
  - `.response()` and `list().firstPage()` preserve server-owned metadata

### Superpowers skills per step:
- `superpowers:test-driven-development` — every step
- `superpowers:verification-before-completion` — every step
- `superpowers:dispatching-parallel-agents` — Steps 4, 5, 7, 8
- `superpowers:subagent-driven-development` — Steps 4, 7, 8
- `superpowers:requesting-code-review` — Wave Gates 1, 2, 3

## 8. Branch Exit Criteria

The unified API + SDK execution branch is complete when:

1. `packages/api` and `packages/sdk` exist and build cleanly
2. API middleware and serialization boundary are review-accepted
3. API route matrix from [02-api.md](/docs/specs/02-api.md) is implemented
4. Generated OpenAPI is present and contract-reviewed
5. SDK HTTP transport is parity-accepted against the API contract
6. SDK direct transport is parity-accepted against the same contract
7. Wave 1 and Wave 2 resource surfaces match the accepted API route waves
8. Final parity and security reviews (Wave Gate 3) return no blocking findings
9. Both packages are explicit enough that CLI and MCP work can depend on them without reopening contract decisions

## 9. Spec References

The API and SDK implementation plans remain as contract references:
- [api-implementation-plan.md](/docs/execution/api-implementation-plan.md) — route matrix, envelope shape, auth model, required behavior per API slice
- [sdk-implementation-plan.md](/docs/execution/sdk-implementation-plan.md) — transport contract, resource methods, parity requirements per SDK slice

This design document is the execution driver. The per-package plans define *what* must be true. This document defines *how* and *when*.
