# API/SDK Comprehensive Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Validation gates are mandatory — each dispatches multiple sub-agents in parallel and must be cleared before the next phase begins.

> Refreshed against current HEAD on 2026-04-08. Every file path, function signature, and adapter contract in this plan has been verified against the actual filesystem. Notable verified facts:
> - `StorageAdapter.transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>)` — accepts **no auth context**, so T0a is a genuine prerequisite for T4/T7.
> - `/v1/search` validates `limit` via a Zod body schema (`search.ts:11`) — correctly excluded from T2.
> - `createDealService(...)` is called from 6 sites (services/index.ts:752 plus 5 test files) — T7's factory change ripples through all of them.
> - `validateWebhookUrl` already exists in `routes/webhooks.ts:50` and already handles `::ffff:*` mapped addresses — T13 extracts, not rewrites.
> - Core services are registered as `sequences`, `sequenceSteps`, `sequenceEnrollments`, `sequenceEvents` (services/index.ts:193-196) — T1's map is correct.

## Goal

Resolve the API/SDK review findings without introducing more drift between:

- runtime route registration
- OpenAPI generation
- SDK resource surface
- DirectTransport behavior

The previous draft mixed valid findings with stale assumptions. This revision treats the remaining work as a combination of:

1. immediate correctness fixes
2. prerequisite design work
3. structural parity work

## Working Rules

- Do not assume the old `401` test baseline is still correct. Capture the current baseline before starting.
- Use currently available explorer subagents to inventory routes and verify scope before structural tasks.
- Do not add a second source of truth for route capabilities. Runtime registration and OpenAPI must share registry data.
- Do not start transaction-based fixes until transaction/context plumbing is designed.
- Prefer extending existing tests over creating redundant suites when coverage already exists.

## Execution Skills

Invoke these during the work — they are not optional boilerplate:

| Skill | When |
|---|---|
| `superpowers:subagent-driven-development` | Meta-skill — wraps the entire plan execution |
| `superpowers:test-driven-development` | Every task that adds or modifies tests (T1-T8, T10-T14) |
| `superpowers:verification-before-completion` | Before checking any task off — run the real command, confirm output |
| `superpowers:systematic-debugging` | When a test fails unexpectedly mid-task (do not shotgun-debug) |
| `superpowers:dispatching-parallel-agents` | At every validation gate (gates fire 3-8 agents in parallel) |
| `superpowers:requesting-code-review` | At every validation gate |
| `superpowers:receiving-code-review` | When processing gate findings — vet each, don't blindly accept or dismiss |
| `superpowers:finishing-a-development-branch` | After the Phase 3 gate passes, to decide merge / PR / cleanup |

## Sub-Agent Architecture

Each agent is picked because it answers a question the others don't. Agents are only invoked where they'll actually fire — no ceremony dispatches.

| Agent | When | Why this one specifically |
|---|---|---|
| `feature-dev:code-architect` | **T0a, T0b, T10 Step 0b, T12 Step 0b** | Designs architectures from existing patterns. The only agent that produces a design-before-code artifact. T0a/T0b are design-only tasks and this is their execution agent. |
| `feature-dev:code-explorer` | **T0 route inventory, T4 pre-flight** | Exhaustive multi-file tracing. Used when completeness matters (full 75+ route inventory; cross-service uniqueness pattern trace). |
| `Explore` (quick/medium) | **T1, T2, T5, T8, T11, T12, T13 reconnaissance** | Fast targeted lookups. Sufficient when the question is "where is X defined?". |
| `superpowers:code-reviewer` | **Every phase gate** | Reviews diff **against this plan** + coding standards. Answers "did we implement what the plan says?". |
| `pr-review-toolkit:code-reviewer` | **Every phase gate** | Reviews against project conventions (CLAUDE.md, tenant safety, style). Answers "does it fit the codebase?". |
| `feature-dev:code-reviewer` | **Final gate only** | Confidence-filtered independent second opinion — only reports high-signal findings. Contrasts with the `pr-review-toolkit` family. |
| `pr-review-toolkit:silent-failure-hunter` | **After T4, T7, T12, T13** | Targets race conditions, swallowed errors, transaction rollback gaps, fallback false-negatives. Wasted elsewhere. |
| `pr-review-toolkit:type-design-analyzer` | **Phase 0 gate (on T0a/T0b design docs), Phase 3 gate (T10 registry, T12 store interface)** | Scores type invariants and enforceability. Critical for Phase 0 because wrong types cascade through every later phase. |
| `pr-review-toolkit:pr-test-analyzer` | **Every phase gate** | Universal coverage check: does each fix have a regression test? |
| `pr-review-toolkit:comment-analyzer` | **Phase 3 gate (T10 registry comments + T15 resolution doc)** | Validates comments and the resolution doc accurately describe the committed code. |
| `pr-review-toolkit:code-simplifier` | **After T9 L-batch + Phase 3 final gate** | Cleans style drift across many small commits. |

**Manual review by user (no agent substitutes):**
- **T13 SSRF correctness** — human reviews the URL validator extraction + any new DNS/IP logic before merge.
- **Phase 3 Stage 2 security sweep** — human verifies idempotency replay semantics, auth-scope coverage on new routes, and OpenAPI admin-path scoping.

## Current Code Reality

- API routes are composed centrally in `packages/api/src/create-api.ts`.
- Generic entity CRUD is registered from `packages/api/src/routes/entities.ts`.
- Admin routes are registered from `packages/api/src/routes/admin.ts`.
- OpenAPI generation is still static and entity-list driven.
- DirectTransport currently supports generic CRUD, `/v1/search`, and `/v1/context/:id`; it does not have full route parity.
- Core service transaction plumbing is not in place for the sketched transaction fixes.

## Phase 0 — Baseline And Design Prerequisites

### T0: Capture the actual baseline

Before code changes:

- [ ] Run `pnpm -r test` and record counts per package (`@orbit-ai/api`, `@orbit-ai/sdk`, `@orbit-ai/core`) — commit the numbers into the resolution doc as the authoritative reference for the test-count delta at merge time.
- [ ] Dispatch `feature-dev:code-explorer` to produce the full route inventory from `packages/api/src/routes/*.ts` and `packages/api/src/create-api.ts`. Save as `docs/review/2026-04-08-route-surface-inventory.md`. **This artifact is reused by T3, T10, T11 — do not re-inventory there.**
- [ ] Enumerate existing SDK parity/cross-transport tests (`packages/sdk/src/__tests__/*.test.ts`) so T8, T11, T14 extend existing suites rather than duplicating them.

**Mandatory artifacts:**

- `docs/review/2026-04-08-route-surface-inventory.md` — route inventory
- `docs/review/2026-04-08-api-sdk-branch-review-resolution.md` — **initial skeleton with baseline test counts** (not optional)

### T0a: Transaction and auth-context plumbing design

Why:

- `T4` and `T7` cannot be implemented safely with the current core service shape.
- `StorageAdapter.transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>)` accepts **no auth context** (verified in `packages/core/src/adapters/interface.ts:13`), and services like `createDealService()` do not currently receive an adapter dependency.

Execution:

- [ ] Dispatch `feature-dev:code-architect` with the brief: "Design the transaction + auth-context plumbing for Orbit core services. Constraints: (1) tenant context must be preserved inside the transaction callback — decide whether via AsyncLocalStorage, a wrapped ctx parameter, or a txCtx accessor; (2) in-memory and postgres adapters must both implement the chosen pattern; (3) service factories that need transactions must receive them through their deps parameter — list which ones; (4) tests must be able to assert transactional behavior without injecting hooks that don't exist in production code. Read `packages/core/src/adapters/interface.ts`, the in-memory adapter, the postgres adapter, `services/index.ts`, and `entities/deals/service.ts`. Return: interface changes, a worked example wrapping one service, and the migration impact on existing tests that call createDealService()."
- [ ] Save the architect's output as `docs/superpowers/designs/2026-04-08-transaction-plumbing.md`.
- [ ] Review the design against the Phase 0 validation gate before any code changes.

Exit criteria:

- One documented transaction pattern that compiles against the real `adapters/interface.ts` signature
- Explicit decision on AsyncLocalStorage vs explicit txCtx parameter, with tradeoff analysis
- Zero pseudocode referencing APIs that don't exist on HEAD
- Design doc reviewed and approved via Phase 0 validation gate

### T0b: Shared route registry design

Why:

- runtime route capabilities and OpenAPI capabilities currently drift
- `T3`, `T10`, and `T11` depend on a trustworthy route inventory

Execution:

- [ ] Dispatch `feature-dev:code-architect` with the brief: "Design a shared route/capability registry for Orbit's API package. Constraints: (1) single source of truth for generic entity CRUD capabilities consumed by both `routes/entities.ts` (runtime dispatch gating) and `openapi/generator.ts` (spec emission); (2) non-CRUD routes (search, context, admin, bootstrap, webhooks, organizations, workflows, relationships, objects/schema) must also be registered in a way that lets T10 emit OpenAPI paths from the registry; (3) the registry type must reject registrations with empty operationId, empty tags, or empty responses — invariants at the type level; (4) registration must be a side effect of the Hono route module loading, so drift is structurally impossible. Read `packages/api/src/create-api.ts`, `packages/api/src/routes/entities.ts`, `packages/api/src/routes/admin.ts`, and the T0 route inventory. Return: the registry type, the wrapper helper signature that wraps Hono's `app.<method>()` call, a worked example for one generic-entity route and one admin route, and the migration impact on `openapi/generator.ts`."
- [ ] Save the architect's output as `docs/superpowers/designs/2026-04-08-route-registry.md`.
- [ ] Review the design against the Phase 0 validation gate before any code changes.

Constraint:

- Do not mirror capability metadata separately in `routes/entities.ts` and `openapi/entities.ts` — the registry is the only source.

Exit criteria:

- One documented registry pattern that compiles against the real Hono setup in `create-api.ts`
- Explicit decision on registration mechanism (decorator, wrapper helper, or side-effect module) with tradeoff analysis
- Design doc reviewed and approved via Phase 0 validation gate

### 🛂 Phase 0 Validation Gate

**Required skills:** `superpowers:requesting-code-review` + `superpowers:dispatching-parallel-agents`.

Phase 1 through 3 all depend on the T0a and T0b design documents. If the design is wrong, everything downstream needs rework. Before writing a single line of implementation code, dispatch **three sub-agents in parallel** against the design docs:

- [ ] **Agent #1 — `pr-review-toolkit:type-design-analyzer`**
  Scope: `docs/superpowers/designs/2026-04-08-transaction-plumbing.md` and `docs/superpowers/designs/2026-04-08-route-registry.md`
  Brief: "Score the proposed types on encapsulation, invariant expression, and enforceability. For the transaction pattern: can a caller accidentally drop the tenant context inside a transaction callback? Can a caller forget to pass the tx handle to a nested repository call? For the route registry: can a route be registered with empty fields? Can two routes collide on (method, path)? If any invariant is expressible but not expressed, propose tighter types."

- [ ] **Agent #2 — `superpowers:code-reviewer`**
  Scope: both design docs + the plan at `docs/superpowers/plans/2026-04-08-api-sdk-comprehensive-remediation.md`
  Brief: "Review the T0a and T0b designs against the downstream tasks T3, T4, T7, T10, T11. Confirm every downstream requirement is satisfied by the proposed designs. Flag any downstream task that would require features the designs don't provide. Flag any design choice that makes a downstream task harder than it needs to be."

- [ ] **Agent #3 — `pr-review-toolkit:code-reviewer`**
  Scope: both design docs, read against CLAUDE.md and the existing codebase
  Brief: "Review against Orbit conventions: tenant safety (every write MUST go through withTenantContext), Drizzle ORM usage (never raw SQL), no cross-package relative imports. Also confirm the designs reference real files and real signatures — no pseudocode referencing APIs that don't exist on HEAD. Flag any convention violation."

When processing the three reports, invoke `superpowers:receiving-code-review`. If any agent reports a Critical or High issue, revise the design and re-run that agent. **Do not proceed to Phase 1 until all three agents report clean.**

## Phase 1 — Immediate Correctness Fixes

### T1: DirectTransport snake_case entity mapping

Problem:

- `sequence_steps`, `sequence_enrollments`, and `sequence_events` do not map to the camelCase service keys used by `createCoreServices()`

Scope:

- update `packages/sdk/src/transport/direct-transport.ts`
- extend existing `packages/sdk/src/__tests__/direct-transport.test.ts`

Execution:

- [ ] Grep `packages/core/src/services/index.ts` for the full list of service keys registered on the returned object. **Verified on HEAD:** the relevant camelCase keys are `sequences`, `sequenceSteps`, `sequenceEnrollments`, `sequenceEvents` (lines 193-196). Re-confirm at execution time in case the core surface changed.
- [ ] Extend `ENTITY_SERVICE_MAP` in `direct-transport.ts` with entries only for underscored URL segments that map to a different camelCase key. **Do not add speculative aliases** (no `pipeline_stages` — `pipelines`/`stages` are already non-underscored).
- [ ] Extend existing tests in `direct-transport.test.ts` — locate the adapter/test harness already used there (do not invent a new one). Add one passing test per previously-broken underscored entity.
- [ ] Run `pnpm --filter @orbit-ai/sdk test` and confirm new tests pass, full SDK suite still green.

Exit criteria:

- Direct mode works for `sequence_steps`, `sequence_enrollments`, `sequence_events`
- Map additions are restricted to verified keys from `services/index.ts`
- No new test harness files created

### T2: Shared pagination validation across all remaining query-parsing routes

Problem:

- inline `Number()` parsing still exists in route handlers and allows bad values to flow downstream

Create:

- `packages/api/src/utils/pagination.ts`
- `packages/api/src/__tests__/pagination-utils.test.ts`

Replace inline parsing in (verified call sites via `grep -rn "Number(c.req.query" packages/api/src/routes/` on HEAD):

- `packages/api/src/routes/entities.ts:47` — one occurrence
- `packages/api/src/routes/webhooks.ts:89` **and `:166`** — **two occurrences**, both must be replaced
- `packages/api/src/routes/admin.ts:33` — one occurrence
- `packages/api/src/routes/imports.ts:9` — one occurrence
- `packages/api/src/routes/relationships.ts` — already validates via local helper; replace the local helper with the shared import

Do not include:

- `packages/api/src/routes/search.ts` — `/v1/search` already validates `limit` via Zod body schema (`search.ts:11`: `limit: z.number().int().min(1).max(100).optional()`). Body-driven validation is correct; do not force it to query-param style.

Tests:

- add focused route regressions for invalid `limit` on each affected route family
- ensure `cursor` passthrough still works

Exit criteria:

- no remaining inline `Number(c.req.query('limit'))` usage in authenticated list routes

### T3: Short-term OpenAPI capability alignment

**Depends on:** T0b (route registry design must be finalized before T3 starts — T3 is the first consumer of the registry).

Problem:

- current static generator emits unsupported operations for some entities (covers findings M4 imports, M5 sequence_events)

Scope:

- align generated CRUD operations with the real generic entity capability registry

Files:

- Extract the shared capability module at the path decided by T0b. Expected location per T0b: `packages/api/src/routes/entity-capabilities.ts` (confirm in the T0b design doc before starting).
- Module is consumed by both `packages/api/src/routes/entities.ts` (runtime gating) and `packages/api/src/openapi/generator.ts` (spec emission).

Avoid:

- Adding a second capability source of truth under `packages/api/src/openapi/entities.ts`.

Tests:

- Extend `packages/api/src/__tests__/openapi.test.ts` (do not create a new test file).
- Verify at minimum:
  - `imports` does not advertise unsupported update/delete routes (M4)
  - `sequence_events` remains read-only (M5)
  - At least one full-CRUD entity (e.g. `contacts`) still emits expected operations — proves gating doesn't over-restrict

Exit criteria:

- Generic entity OpenAPI output matches runtime generic entity capabilities
- Only one capability source of truth exists in the codebase (verifiable by grep)

## Phase 2 — Core Correctness And Parity Cleanup

### T4: Uniqueness race remediation after transaction design lands

Problem:

- service-level preflight uniqueness checks are still race-prone

Initial target set:

- `packages/core/src/entities/sequences/service.ts`
- `packages/core/src/entities/tags/service.ts`
- `packages/core/src/entities/sequence-enrollments/service.ts`
- `packages/core/src/entities/payments/service.ts`
- `packages/core/src/entities/sequence-steps/service.ts`

Approach:

- follow the transaction pattern chosen in `T0a`
- keep DB unique-constraint coercion in place
- regression coverage must include real repository-backed conflict behavior, not only synthetic interleaving

Tests:

- add focused race/conflict tests under `packages/core/src/services/__tests__/` or the affected entity suites

Exit criteria:

- uniqueness-sensitive create/update flows are transactionally safe or explicitly rely on DB uniqueness with stable conflict translation

### T5: Search service fixups

Problem:

- merged search still has correctness issues around query handling and sort field naming

Files:

- `packages/core/src/services/search-service.ts`
- **Both search test files exist on HEAD** — before editing either, read both and determine which is authoritative:
  - `packages/core/src/services/search-service.test.ts`
  - `packages/core/src/services/__tests__/search-service.test.ts`
  - If the two cover different surfaces, extend both. If one is a stale duplicate, consolidate as part of this task and note the deletion in the resolution doc.

Pre-flight:

- [ ] Grep `packages/core/src/services/__tests__/` and the sibling test file for any test that depends on the broken `'updated_at'` snake_case sort field. Each match is either (a) verifying the bug and should be updated, or (b) a legitimate input that needs migrating to `'updatedAt'`.

Requirements:

- Use the actual `SearchQuery` shape from core types — read it, do not assume.
- Fix field-name mismatch between emitted records (`updatedAt` camelCase) and `runArrayQuery()` sorting (currently `'updated_at'` snake_case) — M2.
- Avoid double-applying text search in the merged-result pass — M1. Strip `q` from the `runArrayQuery` input since repositories already handle it.

Exit criteria:

- Merged search pagination and ordering are stable and covered by regression tests
- Both M1 and M2 have explicit regression tests that fail before the fix and pass after

### T6: OpenAPI response schema improvement

Problem:

- current generated responses are mostly descriptions without concrete JSON content schemas

Scope:

- improve `packages/api/src/openapi/generator.ts`
- extend `packages/api/src/__tests__/openapi.test.ts`

Requirements:

- success responses should describe envelope-based JSON bodies
- error responses should reference the shared error shape
- this is broader than a small content-schema tweak

Exit criteria:

- generated paths include meaningful success and error response content schemas

### T7: Deal update transaction fix after T0a

**Depends on:** T0a (transaction plumbing pattern must be finalized).

Problem:

- `deals.update()` validates related graph state outside any transaction (M7)

Files:

- `packages/core/src/entities/deals/service.ts` — the update method
- `packages/core/src/services/index.ts:752` — the production `createDealService(...)` call
- **All five test files that call `createDealService(...)` (verified via `grep -rn "createDealService(" packages/core/`):**
  - `packages/core/src/entities/deals/service.test.ts` (3 occurrences: lines 21, 71, 112)
  - `packages/core/src/entities/payments/service.test.ts:39`
  - `packages/core/src/entities/tasks/service.test.ts:35`
  - `packages/core/src/entities/contracts/service.test.ts:39`

Any change to the `createDealService` factory signature breaks all six call sites — update them in the same commit as the service change so the suite stays green.

Tests:

- Prefer realistic transaction-entry assertions or repository-backed consistency tests.
- Do not depend on nonexistent `injectInterleave`-style hooks. If the in-memory adapter needs a serialization or interleave primitive that doesn't exist, that primitive is a prerequisite from T0a, not invented here.
- One regression test: spy on `adapter.transaction` (or whatever T0a exposes) and assert it is called exactly once per `deals.update()` invocation.

Exit criteria:

- Relation validation and update happen inside the T0a transaction pattern
- All six `createDealService` call sites compile and tests pass
- The deal-update test exercises the transactional path, not just the happy update path

### T8: SequenceEventResource raw list parity

Problem:

- `SequenceEventResource.response()` exposes `get` but not `list`

Files:

- `packages/sdk/src/resources/sequence-events.ts`
- extend existing tests instead of inventing a stale new file:
  - `packages/sdk/src/__tests__/resources-wave2.test.ts`
  - add parity assertions in an existing parity suite if useful

Parity target:

- read-only resource parity means:
  - `get`
  - `list`
  - `response().get`
  - `response().list`
- still no create/update/delete

Exit criteria:

- raw and unwrapped read-only sequence event access match the rest of the SDK surface

### T9: Cleanup batch (L1-L12)

Each item is one separate commit. **Validate each item against current HEAD before editing** — some may already be fixed by earlier phases or may not exist as described. If an item is no longer applicable, mark it `[obsolete on HEAD]` in the commit message and the resolution doc.

- [ ] **L1 — `packages/sdk/src/resources/index.ts` dead barrel**
  Grep for any import of `resources/index` across the repo. If zero, delete the file. Otherwise update those imports to direct paths first, then delete.

- [ ] **L2 — Cursor encoding cross-runtime safety**
  `packages/core/src/query/cursor.ts:21-29` uses `Buffer.from(...).toString('base64url')`. Add a runtime fallback so the SDK works in browser/edge contexts. Add a unit test.

- [ ] **L3 — Discarded `assertFound` results in update methods**
  Files: `packages/core/src/entities/webhooks/service.ts:71`, `notes/service.ts:100`, `products/service.ts:45`, `activities/service.ts:104`. Each fetches the record then ignores it. Convert to a bare existence check (`assertFound(await repo.get(ctx, id), '…')` with no assignment) — preserves the early-fail semantic.

- [ ] **L4 — `HttpTransport.timeoutMs` is ignored**
  `packages/sdk/src/transport/http-transport.ts` — wire `AbortSignal.timeout(this.options.timeoutMs)` into the `fetch()` call. Add a regression test that asserts the request is aborted past the timeout.

- [ ] **L5 — `SchemaResource` methods lack return type annotations**
  `packages/sdk/src/resources/schema.ts:7-41` — annotate every method's return type explicitly using exported types from `@orbit-ai/core`.

- [ ] **L6 — `paginationParams` not exported**
  Already addressed by T2 (extracted to `packages/api/src/utils/pagination.ts`). Mark complete after T2 lands.

- [ ] **L7 — `toEnvelope` never populates `links.next`**
  `packages/api/src/responses.ts:9-33`. When `hasMore === true`, build the next URL by setting `cursor` to `meta.next_cursor` on the current request URL. Add an envelope test that round-trips a cursor.

- [ ] **L8 — Pipeline `isDefault` uniqueness**
  `packages/core/src/entities/pipelines/service.ts`. On create/update with `isDefault: true`, wrap in `adapter.transaction` (using the T0a pattern) and demote the prior default. Add a concurrent-create test.

- [ ] **L9 — `completedAt` lost on already-completed task updates**
  `packages/core/src/entities/tasks/service.ts:72-87`. Only set `completedAt` on the transition from non-completed to completed; preserve otherwise. Test: complete a task → update title → verify `completedAt` unchanged.

- [ ] **L10 — `fromPostgresJson` loses scalar primitives**
  `packages/core/src/repositories/postgres/shared.ts:203-216`. Add explicit handling for `number`, `boolean`, `null`, plus the existing string/object cases. Unit tests for each branch.

- [ ] **L11 — Search `fetchAllPages` OOM risk (interim — re-evaluate after T10)**
  Add a hard ceiling `MAX_SEARCH_ROWS = 5000` per entity type with a warning log. **This is a temporary safety net.** If T10 reworks search to push pagination down to repositories (eliminating `fetchAllPages` entirely), delete this cap and its test in the same T10 commit. Do not leave dead defensive code.

- [ ] **L12 — `as any` casts in bootstrap routes**
  `packages/api/src/routes/bootstrap.ts:35` and `:53`. Define a typed handler context (`Context<{ Variables: { orbit: OrbitAuthContext } }>`) and remove the casts. If a cast hides a missing property, fix the type, do not re-introduce the cast.

After the L-batch is complete, dispatch `pr-review-toolkit:code-simplifier` against the L-batch commits to catch style drift (covered by the Phase 2 validation gate below).

## Phase 3 — Structural Parity Work

### T10: Registry-driven OpenAPI rebuild from the actual route surface

Problem:

- the static generator does not reflect the real API composition

Inputs:

- `T0` route inventory
- `T0b` shared route registry design
- `packages/api/src/create-api.ts`

Likely files:

- `packages/api/src/openapi/registry.ts`
- `packages/api/src/openapi/schemas.ts`
- `packages/api/src/openapi/generator.ts`
- `packages/api/src/__tests__/openapi-registry.test.ts`

Requirements:

- cover the real registered route surface, not just generic entities
- include:
  - search
  - context
  - bootstrap
  - organizations
  - admin
  - webhooks
  - imports
  - workflows
  - relationships
  - objects/schema routes
  - generic entity CRUD

Validation:

- route inventory and generated spec must match at the path+method level
- do not rely on nonexistent files such as `routes/contacts.ts`

Exit criteria:

- OpenAPI generation is driven from a registry grounded in the current router composition

### T11: DirectTransport full parity with registered API routes

Problem:

- DirectTransport still lacks most non-CRUD route support

Use the route inventory from `T0` and the registry work from `T10` to enumerate parity scope.

Must explicitly assess:

- workflows
- relationships
- object/schema routes
- imports
- organization routes
- admin routes
- webhook deliveries and redelivery
- any route intentionally excluded from direct mode

Implementation guidance:

- use explicit route matching or a route table (the T0b registry should make this trivial)
- avoid accumulating one-off path conditionals
- **Any intentionally unsupported route MUST be listed in T15's resolution doc under "direct-mode exclusions that remain"** with the rationale and the runtime error the SDK throws.

Tests:

- extend existing `packages/sdk/src/__tests__/transport-parity.test.ts`
- do not replace real failures with envelope-shape fallbacks

Exit criteria:

- Either true dispatch parity exists, or exclusions are explicit, tested, and documented in T15

### T12: Shared-store idempotency and rate limiting

Problem:

- both idempotency and rate limiting are process-local today

Files likely involved:

- `packages/api/src/middleware/idempotency.ts`
- `packages/api/src/middleware/rate-limit.ts`
- new shared-store abstractions as needed

Design requirements:

- define store contracts first
- define in-flight locking behavior for idempotency
- define request canonicalization and request-hash rules
- define replay rules and what response shapes are safe to replay
- define TTL and cleanup behavior
- decide whether rate limiting shares infrastructure or only patterns

Do not reduce this to:

- “replace Map with table”

Exit criteria:

- multi-instance-safe semantics are documented and implemented for the chosen production path

### T13: SSRF hardening with explicit execution target

Problem:

- current SSRF guard is inline request-time URL validation in `packages/api/src/routes/webhooks.ts`
- the previous draft referred vaguely to DNS checks “before the HTTP call” without identifying any outbound delivery implementation in this package

Scope this task clearly:

- extract the current URL validator into a reusable helper/module
- improve request-time validation as appropriate
- if outbound delivery code exists in-repo at implementation time, add resolver-based validation there too
- if outbound delivery does not exist here, document the runtime hook point that must enforce DNS/IP validation later

Exit criteria:

- no ambiguous “somewhere before delivery” requirement remains in the plan

### T14: Cross-transport black-box parity tests

Problem:

- current parity tests do not consistently prove behavioral equivalence under shared state

Requirements:

- shared fixture setup for HTTP and direct transports
- same backing data
- same requests
- explicit comparison of results, not just independent success

Do not:

- add another suite that only checks envelope shape

Prefer:

- extending existing parity suites where practical
- creating one new black-box suite only if it adds clearly new confidence

Exit criteria:

- transport parity is demonstrated under identical state and assertions

### T15: Resolution document

Create or update:

- `docs/review/2026-04-08-api-sdk-branch-review-resolution.md`

It must include:

- which findings were fixed
- which were re-scoped
- any intentionally deferred work
- any direct-mode exclusions that remain
- references to the route inventory and registry decisions

Do not mark the review resolved unless:

- test coverage demonstrates the claimed fixes
- the OpenAPI and runtime route inventories reconcile

## Validation Gates

Each gate dispatches multiple sub-agents in parallel against the phase diff. **Required skills before every gate:** `superpowers:requesting-code-review` + `superpowers:dispatching-parallel-agents`. When processing reports, invoke `superpowers:receiving-code-review`.

The Phase 0 gate is defined inline above (after T0b). Phase 1, 2, 3 gates are below.

### 🛂 Phase 1 Validation Gate

Before proceeding to Phase 2, run the affected package tests and dispatch **three sub-agents in parallel** (single message, three Agent calls):

- [ ] **Agent #1 — `superpowers:code-reviewer`**
  Scope: `git diff main..HEAD` restricted to Phase 1 files (T1, T2, T3)
  Brief: "Review the Phase 1 diff AGAINST the plan at `docs/superpowers/plans/2026-04-08-api-sdk-comprehensive-remediation.md` tasks T1-T3. Confirm: T1's ENTITY_SERVICE_MAP additions are restricted to verified service keys from `services/index.ts`; T2 replaced all 5 inline `Number()` occurrences (entities.ts:47, webhooks.ts:89 AND :166, admin.ts:33, imports.ts:9) and did NOT touch search.ts; T3 introduced exactly one capability source of truth (per T0b design). Report deviations."

- [ ] **Agent #2 — `pr-review-toolkit:code-reviewer`**
  Scope: same diff
  Brief: "Review against project conventions in CLAUDE.md and existing api/sdk style. Confirm pagination util is imported (not duplicated) in every modified route file. Confirm OpenAPI capability registry is consumed by both `routes/entities.ts` and `openapi/generator.ts` (no drift). Report High/Medium issues only."

- [ ] **Agent #3 — `pr-review-toolkit:pr-test-analyzer`**
  Scope: same diff
  Brief: "Verify Phase 1 tests cover the regressions they target. T1: confirm tests for all three underscored entities. T2: confirm every modified route has a NaN/0/101 rejection test. T3: confirm coverage of imports + sequence_events PLUS at least one full-CRUD entity to prove gating doesn't over-restrict."

If any agent reports findings, fix inline (do not start Phase 2). Re-run the affected agents after fixes.

### 🛂 Phase 2 Validation Gate

Before proceeding to Phase 3, run the affected package tests and dispatch **five sub-agents in parallel** (single message, five Agent calls):

- [ ] **Agent #1 — `superpowers:code-reviewer`**
  Scope: Phase 2 diff (T4-T9)
  Brief: "Review against the plan. Confirm the T0a transaction pattern is applied consistently across all 5 services in T4 (sequences, tags, sequence-enrollments, payments, sequence-steps) and the T7 deal update. Confirm L-batch landed as separate commits (one per L-item, not one mega-commit). Flag any task that looks half-done."

- [ ] **Agent #2 — `pr-review-toolkit:silent-failure-hunter`**
  Scope: same diff
  Brief: "We just added transaction wrappers around uniqueness checks (T4: 5 services) and deal update (T7: M7). We also touched search (T5) and the L-batch (T9). Hunt for: (a) catch blocks that swallow rollback errors; (b) race-condition windows we missed; (c) error paths where the transaction commits but the function returns a misleading success; (d) any new fallback that masks a CONFLICT as 200; (e) L3's dropped existence checks now masking not-found as success. High/Critical only."

- [ ] **Agent #3 — `pr-review-toolkit:code-reviewer`**
  Scope: same diff
  Brief: "Review against CLAUDE.md tenant-safety conventions. The transaction pattern from T0a MUST propagate tenant context to every nested repository call inside the transaction body — flag any spot where ctx leaks. Confirm M1 (search) doesn't break existing search-service tests by changing repository contracts."

- [ ] **Agent #4 — `pr-review-toolkit:pr-test-analyzer`**
  Scope: same diff
  Brief: "T4: confirm at least one race test per uniqueness service (5 total). T7: confirm the deal-update test exercises the transactional path (spy on adapter.transaction or repository-backed interleave), not just the happy path. T9 L-batch: confirm L4, L7, L8, L9, L10 each have a regression test, not just a refactor commit. Tally test count delta from the T0 baseline."

- [ ] **Agent #5 — `pr-review-toolkit:code-simplifier`**
  Scope: only the L-batch commits (T9 L1-L12)
  Brief: "11 small unrelated changes just landed. Look for inconsistent style across them (formatting, naming, error message wording, import ordering). Suggest a single tidy-up commit if there's drift. Do NOT change behaviour."

If T4 transaction wrapping is non-obvious or silent-failure-hunter flags rollback gaps, **invoke `superpowers:systematic-debugging`** before patching: reproduce the failure, confirm the root cause, then fix.

### 🛂 Phase 3 Validation Gate (Final, multi-agent + manual security review)

**Stage 1 — dispatch eight sub-agents in parallel** (single message, eight Agent calls):

- [ ] **Agent #1 — `superpowers:code-reviewer`**
  Scope: `git diff main..HEAD` (full branch)
  Brief: "Final review AGAINST the plan. For each task T0-T15, confirm it was implemented as specified. List any deferred or skipped sub-steps. List any task that lacks the required regression test. Report PASS/FAIL per task."

- [ ] **Agent #2 — `pr-review-toolkit:code-reviewer`**
  Scope: full Phase 3 diff (T10-T15)
  Brief: "Final review of registry-driven OpenAPI, full direct transport parity, shared idempotency, SSRF hardening, and cross-transport tests. Verify the registry truly cannot drift — i.e. it's structurally impossible to add a route without registering it (or there's a CI check that catches drift). Flag any architectural concerns."

- [ ] **Agent #3 — `pr-review-toolkit:type-design-analyzer`**
  Scope: the new T10 registry types and the T12 `IdempotencyStore` interface
  Brief: "Score the new types on encapsulation, invariant expression, and enforceability. Specifically: can a caller register a route with empty operationId? Empty responses? Mismatched path placeholders? Can a caller construct an IdempotencyStore implementation that returns inconsistent results across the in-memory and postgres backends? If any invariant is expressible but not expressed, propose tighter types."

- [ ] **Agent #4 — `pr-review-toolkit:silent-failure-hunter`**
  Scope: T11 (direct transport parity), T12 (idempotency store), T13 (SSRF hardening)
  Brief: "Hunt for silent failures in: (a) DirectTransport parity handlers — do any catch errors and convert them to success?; (b) idempotency store fallbacks when the postgres store is unreachable; (c) SSRF validator returning false-positives or false-negatives in URL edge cases (CNAME chains, IPv6, dual-stack, link-local, IPv4-mapped IPv6). NOTE: the user does a manual security review for T13 — your job is the silent-failure angle, not security correctness."

- [ ] **Agent #5 — `pr-review-toolkit:pr-test-analyzer`**
  Scope: full diff main..HEAD
  Brief: "Across all phases, verify: (1) every High finding (H1, H2, H3) has a regression test that fails before the fix and passes after; (2) every Medium finding has a regression test; (3) cross-transport parity covers at least 8 scenarios under shared state; (4) the OpenAPI registry test asserts the path count matches the T0 inventory (no drift). Tally test count delta from the T0 baseline. Report any gap."

- [ ] **Agent #6 — `pr-review-toolkit:comment-analyzer`**
  Scope: new doc-comments in Phase 3 + the resolution doc at `docs/review/2026-04-08-api-sdk-branch-review-resolution.md`
  Brief: "Verify comments accurately describe the code, especially the registry pattern, the IdempotencyStore interface, and the SSRF validator. Spot-check 5 random findings in the resolution doc against their cited commit SHAs — does the commit actually fix what the doc claims? Flag any aspirational or stale claims."

- [ ] **Agent #7 — `pr-review-toolkit:code-simplifier`**
  Scope: full diff main..HEAD
  Brief: "Final simplification pass. Look for: dead code from removed fallbacks, redundant type assertions added then made obsolete by later refactors, duplicated helpers across phases that should consolidate, unnecessarily wide try/catch blocks introduced for transactions, and the L11 search OOM cap if T10 made it obsolete. Suggest a single tidy-up commit. Do NOT change behaviour."

- [ ] **Agent #8 — `feature-dev:code-reviewer`**
  Scope: full diff main..HEAD — INDEPENDENT, no prior context
  Brief: "Independent confidence-filtered review. You have NOT seen the prior agent reports. We just merged 23 fixes and 5 architectural items into the api-sdk-execution branch. Is this branch ready to merge to main? List Blockers, High-priority, and Polish. Only report findings you have HIGH confidence in. The next consumer is the MCP package — we want a solid foundation."

When processing the 8 reports, cross-check findings: if 2+ agents flag the same issue, it's almost certainly real. If only one agent flags it, vet carefully.

**Stage 2 — Manual security review (user, no agent)**

The user (project owner) personally reviews:

- [ ] **T13 SSRF validator extraction + any new DNS/IP logic** in the file referenced by T13 — confirm the validator is invoked at the right point in the request lifecycle and covers all private/reserved IPv4 + IPv6 ranges.
- [ ] **T12 idempotency replay surface** — confirm: same key + same body → replay; same key + different body → 409 conflict; expired key → fresh request.
- [ ] **Auth scopes on every new route registered via the T10 registry.** Spot-check 10 routes from `docs/review/2026-04-08-route-surface-inventory.md`, confirming each has `requireScope(...)` middleware and the scope matches the operation's blast radius.
- [ ] **OpenAPI generator output for admin paths** — manually generate the spec and grep for `/admin/` paths; confirm each has `security: [{ bearerAuth: ['platform'] }]` (or whatever the platform scope is named).

Sign each item off in the resolution doc with reviewer initials and date.

**Stage 3 — Final commit + branch finalization**

If any Blocker or High issue appears in any agent report or in manual review, fix and re-run the affected agents. Once all clean:

```bash
git commit --allow-empty -m "chore(review): Phase 3 validation gates + manual security review passed — see 2026-04-08 resolution doc"
```

Then invoke `superpowers:finishing-a-development-branch` to choose merge / PR / cleanup strategy.

## Sub-Agent Quick Reference

| When | Agent(s) | Why |
|---|---|---|
| **T0** route inventory | `feature-dev:code-explorer` | Exhaustive multi-file trace; output reused by T3, T10, T11 |
| **T0a** transaction design | `feature-dev:code-architect` | Architecture before code |
| **T0b** route registry design | `feature-dev:code-architect` | Architecture before code |
| **Phase 0 gate** | `pr-review-toolkit:type-design-analyzer` + `superpowers:code-reviewer` + `pr-review-toolkit:code-reviewer` | 3 in parallel — verify designs before any code |
| **T1** key verification | `Grep` (no agent) | One file lookup |
| **T4** pre-flight | `feature-dev:code-explorer` | 5-service exhaustive trace + adapter contract verification |
| **T11/T12/T13** recon | `Explore` | Quick lookups |
| **T10/T12** design | `feature-dev:code-architect` | Architecture before implementation |
| **Phase 1 gate** | `superpowers:code-reviewer` + `pr-review-toolkit:code-reviewer` + `pr-review-toolkit:pr-test-analyzer` | 3 in parallel |
| **Phase 2 gate** | Above 3 + `pr-review-toolkit:silent-failure-hunter` + `pr-review-toolkit:code-simplifier` | 5 in parallel |
| **Phase 3 gate Stage 1** | Above 5 + `pr-review-toolkit:type-design-analyzer` + `pr-review-toolkit:comment-analyzer` + `feature-dev:code-reviewer` | 8 in parallel |
| **Phase 3 gate Stage 2** | **MANUAL — user review** | Security correctness, no agent substitutes |
| **After all gates** | `superpowers:finishing-a-development-branch` | Decide merge / PR / cleanup |

## Final Verification Checklist

- [ ] `pnpm -r test` reports the expected count (T0 baseline + new tests, target ≥ baseline + 50)
- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm -r lint` passes (no new warnings)
- [ ] `pnpm -r build` succeeds
- [ ] `docs/review/2026-04-08-api-sdk-branch-review-resolution.md` is checked in and references every finding (H1-H3, M1-M8, L1-L12, deferred 1-5) by commit SHA
- [ ] Both Phase 0 design docs (`2026-04-08-transaction-plumbing.md`, `2026-04-08-route-registry.md`) are checked in
- [ ] Route inventory (`2026-04-08-route-surface-inventory.md`) is checked in
- [ ] All 4 phase validation gates passed (Phase 0, 1, 2, 3 Stage 1)
- [ ] Phase 3 Stage 2 manual security review signed off with user initials + date
- [ ] No `as any` casts introduced beyond the deliberate `(this.services as any)` lookup in DirectTransport (and that one has a justifying comment)
- [ ] `superpowers:finishing-a-development-branch` invoked to decide merge vs PR vs cleanup

## Notes for the Executor

- **Do not skip validation gates.** They are the entire point of this plan being multi-phase.
- **Each agent dispatch is its own context** — brief them with file paths, line numbers, and the specific task ID. The agent has not seen this plan.
- **Dispatch gate agents in parallel** via a single message with multiple Agent tool calls — that's what `superpowers:dispatching-parallel-agents` is for.
- **If an agent reports a finding you disagree with**, invoke `superpowers:receiving-code-review` before pushing back. Don't blindly implement OR blindly dismiss.
- **For unexpected test failures**, invoke `superpowers:systematic-debugging` — reproduce, hypothesize, verify, then fix. Don't shotgun-debug.
- **Before claiming any task done**, invoke `superpowers:verification-before-completion` — run the actual test command and confirm output before checking the box.
- **Commit frequently.** Each task in this plan is ≤ 1 commit; the L-batch is 11 separate commits. Small commits make agent dispatch and rollback cheap.
- **Update the resolution doc after every phase**, not just at the end.
- **Manual security review (T13 + Phase 3 Stage 2) is non-negotiable** — no agent substitutes for human eyes on the SSRF validator and idempotency replay surface.

## Summary Of What Changed From The Old Draft

- added a prerequisite phase for baseline capture and transaction/registry design
- removed stale references to nonexistent helpers, files, and route modules
- expanded `T2` to the real remaining pagination call sites and removed `/v1/search`
- reframed `T3`/`T10` around shared route registries instead of OpenAPI-only metadata
- made `T7` explicitly dependent on transaction/context plumbing
- moved `T8` to existing SDK test files
- strengthened `T11` and `T14` so they measure real parity instead of partial shape checks
- clarified `T12` and `T13` so they describe behavioral requirements, not placeholders
