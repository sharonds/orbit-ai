# API/SDK Branch Review — Resolution Document

> Plan: `docs/superpowers/plans/2026-04-08-api-sdk-comprehensive-remediation.md`
> Branch: `api-sdk-execution`
> Started: 2026-04-08

## Baseline Test Counts (captured 2026-04-08)

| Package | Test Files | Tests Passed | Tests Skipped |
|---------|-----------|-------------|---------------|
| `@orbit-ai/core` | 55 passed \| 1 skipped | 270 | 2 |
| `@orbit-ai/sdk` | 11 passed | 171 | 0 |
| `@orbit-ai/api` | 11 passed | 230 | 0 |
| **Total** | **77** | **671** | **2** |

## Task Status

| Task | Status | Commit SHA | Notes |
|------|--------|-----------|-------|
| T0: Baseline capture | ✅ | — | See baseline counts above |
| T0: Route inventory | ✅ | — | `docs/review/2026-04-08-route-surface-inventory.md` |
| T0a: Transaction plumbing design | ✅ | — | `docs/superpowers/designs/2026-04-08-transaction-plumbing.md` |
| T0a-impl: TransactionScope infrastructure | ✅ | `4cb4bef` | TransactionScope interface, beginTransaction() on both adapters, noop scope helper |
| T0b: Route registry design | ✅ | — | `docs/superpowers/designs/2026-04-08-route-registry.md` |
| T1: DirectTransport snake_case mapping | ✅ | `554fa8f` | Added ENTITY_SERVICE_MAP + resolveServiceKey() |
| T2: Shared pagination validation | ✅ | `a40c029` | Extracted paginationParams() to utils, replaced 5 inline Number() calls |
| T3: OpenAPI capability alignment | ✅ | `d30b108` | Shared entity-capabilities.ts, generic CRUD gated by capabilities, dedicated imports/webhooks paths retained in spec (originally `b135ee0`, rewritten during branch cleanup into combined T3/T8 commit) |
| T4a: Uniqueness race — sequences | ✅ | `75fe264` | tx.run + withDatabase rebind for create/update; 3 spy regression tests |
| T4b: Uniqueness race — tags | ✅ | `86b45ac` | Same pattern + new coerceTagConflict test (gap from pre-flight) |
| T4c: Uniqueness race — sequence-enrollments | ✅ | `0616992` + `b4d3d7f` + `d3d4061` | Wrap commit + Phase 2 gate fix moving stale-read inside tx + Codex follow-up rebinding `sequenceEvents` through `withDatabase(txDb)` |
| T4d: Uniqueness race — payments | ✅ | `f5fb448` + `b4d3d7f` | Wrap commit + Phase 2 gate fix moving assertPaymentTransition inside tx |
| T4e: Uniqueness race — sequence-steps | ✅ | `59d5bbe` + `b4d3d7f` + `d3d4061` | Wrap commit + Phase 2 gate fix moving assertStepHistoryMutable inside tx + Codex follow-up rebinding `sequenceEvents` view |
| T5: Search service fixups (M1+M2) | ✅ | `3b82ac3` | Strip query from runArrayQuery destructure, align sort to camelCase |
| T6: OpenAPI response schema improvement | ✅ | `5d58709` + `3c4fb99` | Wired Envelope/EnvelopePaginated/Error refs into every response; Codex follow-up corrected generic-delete from `204` no-body to `200` envelope to match runtime |
| T7: Deal update transaction fix (M7) | ✅ | `31b688f` + `03d83b4` | tx.run wrap + withDatabase rebind on update; updated 7 cross-entity test files in same commit; Codex follow-up rebinds `stages`/`pipelines`/`contacts`/`companies` through `withDatabase(txDb)` so the "stage belongs to pipeline" invariant is linearizable |
| T8: SequenceEventResource list parity | ✅ | `d30b108` + `725e47b` | Added `response().list()` and parity coverage; `725e47b` is a pure type-level follow-up (cast `ListQuery` to the `TransportRequest.query` index shape). Originally landed as `f079853`, rewritten during branch cleanup. |
| T9 L1: dead resources barrel | ✅ | `dc77e62` | Deletion only |
| T9 L2: cursor cross-runtime | ✅ | `098ef5e` | TextEncoder + btoa fallback, multibyte UTF-8 round-trip test |
| T9 L3: discarded assertFound results | ✅ obsolete | — | Already correct on HEAD; pattern uses bare `assertFound(...)` form |
| T9 L4: HttpTransport timeoutMs | ✅ | `984df71` | Wired AbortSignal.timeout, 3 regression tests |
| T9 L5: SchemaResource return types | ✅ | `ec18b7b` | Type-only annotations, SchemaObjectDefinition + SchemaMigrationResult locals |
| T9 L6: paginationParams export | ✅ obsolete | — | Already addressed by T2 |
| T9 L7: toEnvelope links.next | ✅ | `f1270ec` | Builds links.next with cursor overwrite, 3 regression tests |
| T9 L8: pipeline isDefault uniqueness | ✅ | `7c34ef1` + `f7f75fe` + `ba44e42` | Wrap commit + Phase 2 gate fix walking every page + Codex follow-up enforcing the invariant at the schema layer via a partial unique index (`pipelines_org_default_unique_idx`) with matching SQLite statement and in-memory guard |
| T9 L9: task completedAt preservation | ✅ obsolete | `a1e8f29` | Already correct on HEAD; regression-lock test added |
| T9 L10: fromPostgresJson scalars | ✅ | `8a1aa1f` | number/boolean preserved, SQL NULL distinguished from undefined, 7 branch tests |
| T9 L11: search OOM cap | ✅ | `80ad0ca` + `d016fde` + `92764fc` | Initial cap commit + Phase 2 gate fix replacing silent truncation with `SEARCH_RESULT_TOO_LARGE` throw + Codex follow-up mapping the new code to `413` in both `ERROR_STATUS_MAP` and the direct-transport `errorCodeToStatus` |
| T9 L12: bootstrap as-any casts | ✅ | `f0d4369` | BootstrapContext + BootstrapAdminCapability typed shims, zero `as any` |
| Phase 2 gate hardening — tx-bound-adapter | ✅ | `f3decb6` | Refuses transaction/beginTransaction/execute/query/runWithMigrationAuthority inside tx callback; 9 regression tests |
| T10: Registry-driven OpenAPI rebuild | ⏳ | — | Structural (depends on T0b full impl) |
| T11: DirectTransport full parity | ⏳ | — | |
| T12: Shared-store idempotency/rate limiting | ⏳ | — | |
| T13: SSRF hardening | ⏳ | — | |
| T14: Cross-transport black-box parity | ⏳ | — | |
| T15: Resolution document | ⏳ | — | This document |

## Test Count Delta

| Package | T0 baseline | Phase 2 baseline (post-Phase-1) | Phase 2 gate snapshot | Phase 2 final (post gate-fixes) | Post Codex follow-ups (current) | Δ from T0 |
|---------|-------------|----------------------------------|------------------------|----------------------------------|----------------------------------|-----------|
| `@orbit-ai/core` | 270 | 270 | 302 | 309 | 312 | +42 |
| `@orbit-ai/sdk` | 171 | 180 | 181 | 183 | 183 | +12 |
| `@orbit-ai/api` | 230 | 250 | 259 | 259 | 261 | +31 |
| **Total** | **671** | **700** | **742** | **751** | **756** | **+85** |

Progression on top of the Phase 1 baseline of **700**:
- **+42** captured by `pr-review-toolkit:pr-test-analyzer` during the 5-agent gate pass (gate snapshot at **742**).
- **+9** added by the 4 Phase 2 gate follow-up commits (`f3decb6`, `f7f75fe`, `d016fde`, `b4d3d7f`) → **751**.
- **+5** added by the 5 Codex follow-up commits (`92764fc`, `3c4fb99`, `d3d4061`, `03d83b4`, `ba44e42`) → **756**.

Net Phase 2 delta over the Phase 1 baseline is **+56** tests.

## Findings Resolution

### High Findings (H1-H3)
- H1: fixed in `554fa8f` by mapping snake_case entity paths to the correct camelCase service keys in `DirectTransport`.
- H2/H3: still pending — covered by Phase 3 (T10/T11).

### Medium Findings (M1-M8)
- M1: fixed in `3b82ac3` (T5) by stripping `query` from the `runArrayQuery` destructure so the per-repo text search isn't re-applied at the merged layer.
- M2: fixed in `3b82ac3` (T5) by aligning the `defaultSort` field name to camelCase `'updatedAt'` matching the emitted `SearchResultRecord` shape.
- M3: fixed in `a40c029` via shared pagination validation.
- M4/M5: addressed in `d30b108` by aligning generic CRUD capabilities and preserving dedicated imports/webhooks coverage in the spec.
- M6: covered by T6 OpenAPI response schemas (`5d58709`) — every operation now references the shared Envelope/EnvelopePaginated/Error schemas.
- M7: fixed in `31b688f` (T7) by wrapping `deals.update` graph validation in a transaction with the rebound deals repo.
- M8: fixed in `d30b108` by adding `SequenceEventResource.response().list()` (plus `725e47b` type-only follow-up).

### Low Findings (L1-L12)
- L1: dead barrel deleted in `dc77e62`.
- L2: cross-runtime cursor codec in `098ef5e`.
- L3: obsolete on HEAD — pre-flight recon misread the pattern; all 4 sites already use the bare `assertFound(...)` form. No commit.
- L4: HttpTransport timeoutMs wired in `984df71`.
- L5: SchemaResource return types in `ec18b7b`.
- L6: obsolete on HEAD — already addressed by T2's pagination extraction. No commit.
- L7: links.next populated in `f1270ec`.
- L8: pipeline isDefault demote in `7c34ef1` + page-walking gate fix in `f7f75fe` + schema-level partial unique index in `ba44e42` (Codex follow-up).
- L9: obsolete on HEAD — regression-lock test only in `a1e8f29`.
- L10: fromPostgresJson scalar/null in `8a1aa1f`.
- L11: search OOM cap in `80ad0ca`, hardened to throw `SEARCH_RESULT_TOO_LARGE` in `d016fde` (gate fix), mapped to `413` at the API + direct-transport edges in `92764fc` (Codex follow-up).
- L12: bootstrap as-any removal in `f0d4369`.

### Doc Accuracy Finding (F6)

An independent Codex review of this resolution document itself surfaced three inaccuracies on the previous revision (`5a4537f`):

1. Stale SHAs cited for T3 (`b135ee0`) and T8 (`f079853`) — both were rewritten out of the `api-sdk-execution` branch history when T3/T8 were re-applied as the combined commit `d30b108` (+ `725e47b` type-level follow-up). `git log --oneline api-sdk-execution | grep -E "b135ee0|f079853"` returns nothing.
2. Commit count said "19 Phase 2 commits" without distinguishing the gate-reviewed set from the gate follow-ups, the docs commit, or the Codex follow-ups. Actual range `4cb4bef^..HEAD` now contains **29** commits; see the Phase 2 Validation Gate bucket table for the breakdown.
3. Test delta showed `+42` and `+51` in adjacent sections without reconciling them. The correct progression is **700 → 742 (gate snapshot) → 751 (after 4 gate fixes) → 756 (after 5 Codex follow-ups)**, net `+56` over the Phase 1 baseline. See the updated Test Count Delta table.

**Status: resolved by the commit that introduced this section.**

### Phase 2 Validation Gate

Commit accounting for this section (all counted from `4cb4bef^..HEAD`, total **29** commits):

| Bucket | Count | Commits |
|--------|-------|---------|
| (a) Reviewed at the Phase 2 gate | 19 | T0a (`4cb4bef`), T4a–T4e (`75fe264`, `86b45ac`, `0616992`, `f5fb448`, `59d5bbe`), T5 (`3b82ac3`), T6 (`5d58709`), T7 (`31b688f`), T9 L1/L2/L4/L5/L7/L8/L9/L10/L11/L12 (`dc77e62`, `098ef5e`, `984df71`, `ec18b7b`, `f1270ec`, `7c34ef1`, `a1e8f29`, `8a1aa1f`, `80ad0ca`, `f0d4369`). T3/T8 were already merged into the pre-gate history via `d30b108` + `725e47b` and were reviewed as part of the Phase 1 gate artifact. |
| (b) Phase 2 gate follow-up fixes | 4 | `f3decb6` (tx-bound-adapter refusal traps), `f7f75fe` (pipeline demoteOtherDefaults walks every page), `d016fde` (search cap throws `SEARCH_RESULT_TOO_LARGE`), `b4d3d7f` (state-validation reads moved inside tx) |
| (c) Docs commit (previous revision of this doc) | 1 | `5a4537f` |
| (d) Codex independent review follow-ups | 5 | `92764fc`, `3c4fb99`, `d3d4061`, `03d83b4`, `ba44e42` (see dedicated section below) |
| **Total** | **29** | `git log --oneline 4cb4bef^..HEAD` |

Five sub-agents dispatched in parallel against the 19 Phase 2 commits in bucket (a):

1. `superpowers:code-reviewer` — spec-vs-execution review against the plan. **PASS** with one PARTIAL on tx-bound-adapter scope (closed by `f3decb6`).
2. `pr-review-toolkit:silent-failure-hunter` — flagged 3 HIGH issues:
   - Stale-read outside tx in payments/sequence-enrollments/sequence-steps update → fixed in `b4d3d7f`.
   - Pipeline `demoteOtherDefaults` bounded at 100 with no continuation → fixed in `f7f75fe`.
   - L11 search cap silently truncates with no client signal → fixed in `d016fde`.
3. `pr-review-toolkit:code-reviewer` — tenant safety. Two IMPORTANT findings on the tx-bound-adapter Proxy → addressed in `f3decb6` (refusal traps for `transaction`/`beginTransaction`/`execute`/`query`/`runWithMigrationAuthority`).
4. `pr-review-toolkit:pr-test-analyzer` — coverage. **CLEAN**: 42 new `it(...)` cases match the +42 Phase 2 gate-snapshot delta exactly (700 → 742). No gaps. (The 4 gate follow-up commits and 5 Codex follow-up commits later brought the total to 756 — see the Test Count Delta table above.)
5. `pr-review-toolkit:code-simplifier` — L-batch style drift. Cosmetic comment-tag inconsistencies only (deferred — non-blocking).

All HIGH findings closed by 4 follow-up commits (`f3decb6`, `f7f75fe`, `d016fde`, `b4d3d7f`). Gate-clean test count: **751 passing** (+51 over Phase 1 baseline). Typecheck and lint clean across all 3 packages. Current post-Codex test count is **756 passing** (+56 over Phase 1 baseline).

### Codex independent review follow-ups

After the Phase 2 gate was marked clean, an independent Codex review pass surfaced five additional findings. All were closed in dedicated commits between `5a4537f` (previous doc snapshot) and HEAD. Each finding is listed with the commit that closed it, the subject line, and what the fix actually changed.

1. **`92764fc` — `fix(api,sdk): map SEARCH_RESULT_TOO_LARGE at the API and direct-transport edges (Codex review)`**
   - Finding: the Phase 2 gate fix (`d016fde`) added `SEARCH_RESULT_TOO_LARGE` to the core error-code union and made the search service throw it, but neither `packages/api/src/middleware/error-handler.ts` `ERROR_STATUS_MAP` nor `packages/sdk/src/transport/direct-transport.ts` `errorCodeToStatus` knew about the code. Both fell through to a generic 500 `INTERNAL_ERROR`, defeating the guardrail.
   - Fix: add `SEARCH_RESULT_TOO_LARGE: 413` to both status maps. `413 Payload Too Large` is the correct semantic — the request was well-formed but the response cannot be materialized without exceeding `MAX_SEARCH_ROWS_PER_TYPE`.

2. **`3c4fb99` — `fix(api): OpenAPI generic delete matches runtime 200-envelope shape (Codex review)`**
   - Finding: T6 (`5d58709`) wired the OpenAPI generator's generic entity delete to advertise `'204': { description: 'deleted (no body)' }`, but the runtime in `routes/entities.ts` returns `200 { data: { id, deleted: true }, meta, links }` via `toEnvelope`. Any SDK codegen trusting the spec would have modelled generic deletes as no-content and either thrown or silently discarded the body. Webhook deletes were already correct (they used `envelopeResponse('Webhook deleted')`); only generic deletes had the mismatch.
   - Fix: spec now declares the 200 envelope for generic deletes, matching runtime. New regression test in `packages/api/src/__tests__/openapi.test.ts` asserts `/v1/contacts/{id}.delete` exposes 200 (not 204) with the Envelope `$ref`, and that webhook delete stays consistent.

3. **`d3d4061` — `fix(core): history-mutable check reads sequence_events through rebound view (Codex review)`**
   - Finding: the Phase 2 gate fix `b4d3d7f` moved the `current` get inside `tx.run` for sequence-enrollments and sequence-steps, but still called `assertEnrollmentHistoryMutable` / `assertStepHistoryMutable` with the unbound `deps.sequenceEvents` repo. The guard read opened a fresh connection outside the enclosing transaction, leaving the exact race the fix claimed to close still open: a concurrent event insert could slip between the guard and the reparent.
   - Fix: `withDatabase()` added to `SequenceEventRepository` interface and all 3 implementations (in-memory, SQLite, Postgres). Both services now open `tx.run` and call the history-mutable check with `txSequenceEvents = deps.sequenceEvents.withDatabase(txDb)`. `delete` in both services was previously outside any transaction; it is now wrapped too.

4. **`03d83b4` — `fix(core): deals.update graph validation reads through rebound repos (Codex review)`**
   - Finding: T7 (`31b688f`) wrapped `deals.update` in `tx.run` and rebound only the deals repo. `resolveDealGraph` and the inline contact/company existence checks still reached through the unbound `deps.stages`, `deps.pipelines`, `deps.contacts`, `deps.companies`. The "stage belongs to pipeline" invariant (a cross-entity consistency check with no backing composite FK) was still a stale-read race: concurrent `deals.update(..., { stageId: X, pipelineId: P1 })` and `stages.update(X, { pipelineId: P2 })` could commit inconsistent state.
   - Fix: `withDatabase()` added to `StageRepository`, `ContactRepository`, `CompanyRepository` interfaces (and all 3 adapter impls each). `resolveDealGraph` now takes a `graphDeps` bundle so the caller chooses bound-vs-unbound; inside `deals.update` all graph reads go through the tx-bound dependencies.

5. **`ba44e42` — `fix(core): L8 single-default pipeline enforced by DB partial unique index (Codex review)`**
   - Finding: Codex flagged that L8 was over-marked complete. The service-level `demoteOtherDefaults` (from `7c34ef1` + `f7f75fe`) closed the same-transaction race, but two concurrent Postgres transactions could still each pass their own demote check and both write a default. The plan called for a concurrent test; the original test was sequential only.
   - Fix: new Drizzle partial unique index `pipelines_org_default_unique_idx` on `(organization_id) WHERE is_default = true` in `schema/tables.ts`. Emitted as a separate Postgres bootstrap step via a new `POSTGRES_PARTIAL_UNIQUE_INDEX_STATEMENTS` array and `includePartialUniqueIndexes` option (defaulting true). SQLite adapter mirrors the statement with `where is_default = 1`. In-memory repo mirrors the guarantee via a new `assertDefaultUniqueness` guard on `create`/`update`, and `coercePipelineConflict` surfaces the unique-violation as a structured conflict. Wave 1 bootstrap statement count stays at 28; the partial index is emitted by a separate gated step.

### Deferred Work
- T10-T15 remain structural follow-up work for Phase 3.

### Direct-Mode Exclusions That Remain
- DirectTransport still lacks full non-CRUD route parity pending T11.

## Validation Gates

- [x] Phase 0 Gate (T0a/T0b designs)
- [x] Phase 1 Gate (T1-T3)
- [x] Phase 2 Gate (T4-T9) — 5 agents in parallel; 4 HIGH findings closed by follow-up commits before gate marked clean
- [ ] Phase 3 Gate Stage 1 (8 agents)
- [ ] Phase 3 Gate Stage 2 (manual security review)
- [ ] Phase 3 Gate Stage 3 (final commit)

## Manual Security Review Sign-off (Phase 3 Stage 2)

- [ ] T13 SSRF validator: ___ (initials) — ___ (date)
- [ ] T12 idempotency replay: ___ (initials) — ___ (date)
- [ ] Auth scopes on new routes: ___ (initials) — ___ (date)
- [ ] OpenAPI admin path security: ___ (initials) — ___ (date)
