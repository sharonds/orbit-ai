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
| T3: OpenAPI capability alignment | ✅ | `b135ee0` | Shared entity-capabilities.ts, generic CRUD gated by capabilities, dedicated imports/webhooks paths retained in spec |
| T4a: Uniqueness race — sequences | ✅ | `75fe264` | tx.run + withDatabase rebind for create/update; 3 spy regression tests |
| T4b: Uniqueness race — tags | ✅ | `86b45ac` | Same pattern + new coerceTagConflict test (gap from pre-flight) |
| T4c: Uniqueness race — sequence-enrollments | ✅ | `0616992` + `b4d3d7f` | Wrap commit + Phase 2 gate fix moving stale-read inside tx |
| T4d: Uniqueness race — payments | ✅ | `f5fb448` + `b4d3d7f` | Wrap commit + Phase 2 gate fix moving assertPaymentTransition inside tx |
| T4e: Uniqueness race — sequence-steps | ✅ | `59d5bbe` + `b4d3d7f` | Wrap commit + Phase 2 gate fix moving assertStepHistoryMutable inside tx |
| T5: Search service fixups (M1+M2) | ✅ | `3b82ac3` | Strip query from runArrayQuery destructure, align sort to camelCase |
| T6: OpenAPI response schema improvement | ✅ | `5d58709` | Wired Envelope/EnvelopePaginated/Error refs into every response |
| T7: Deal update transaction fix (M7) | ✅ | `31b688f` | tx.run wrap + withDatabase rebind on update; updated 7 cross-entity test files in same commit |
| T8: SequenceEventResource list parity | ✅ | `f079853` | Added `response().list()` and parity coverage in existing suites |
| T9 L1: dead resources barrel | ✅ | `dc77e62` | Deletion only |
| T9 L2: cursor cross-runtime | ✅ | `098ef5e` | TextEncoder + btoa fallback, multibyte UTF-8 round-trip test |
| T9 L3: discarded assertFound results | ✅ obsolete | — | Already correct on HEAD; pattern uses bare `assertFound(...)` form |
| T9 L4: HttpTransport timeoutMs | ✅ | `984df71` | Wired AbortSignal.timeout, 3 regression tests |
| T9 L5: SchemaResource return types | ✅ | `ec18b7b` | Type-only annotations, SchemaObjectDefinition + SchemaMigrationResult locals |
| T9 L6: paginationParams export | ✅ obsolete | — | Already addressed by T2 |
| T9 L7: toEnvelope links.next | ✅ | `f1270ec` | Builds links.next with cursor overwrite, 3 regression tests |
| T9 L8: pipeline isDefault uniqueness | ✅ | `7c34ef1` + `f7f75fe` | Wrap commit + Phase 2 gate fix making demoteOtherDefaults walk every page |
| T9 L9: task completedAt preservation | ✅ obsolete | `a1e8f29` | Already correct on HEAD; regression-lock test added |
| T9 L10: fromPostgresJson scalars | ✅ | `8a1aa1f` | number/boolean preserved, SQL NULL distinguished from undefined, 7 branch tests |
| T9 L11: search OOM cap | ✅ | `80ad0ca` + `d016fde` | Initial cap commit + Phase 2 gate fix replacing silent truncation with SEARCH_RESULT_TOO_LARGE throw |
| T9 L12: bootstrap as-any casts | ✅ | `f0d4369` | BootstrapContext + BootstrapAdminCapability typed shims, zero `as any` |
| Phase 2 gate hardening — tx-bound-adapter | ✅ | `f3decb6` | Refuses transaction/beginTransaction/execute/query/runWithMigrationAuthority inside tx callback; 9 regression tests |
| T10: Registry-driven OpenAPI rebuild | ⏳ | — | Structural (depends on T0b full impl) |
| T11: DirectTransport full parity | ⏳ | — | |
| T12: Shared-store idempotency/rate limiting | ⏳ | — | |
| T13: SSRF hardening | ⏳ | — | |
| T14: Cross-transport black-box parity | ⏳ | — | |
| T15: Resolution document | ⏳ | — | This document |

## Test Count Delta

| Package | T0 baseline | Phase 2 baseline | Phase 2 final | Δ from T0 |
|---------|-------------|------------------|---------------|-----------|
| `@orbit-ai/core` | 270 | 270 | 309 | +39 |
| `@orbit-ai/sdk` | 171 | 180 | 183 | +12 |
| `@orbit-ai/api` | 230 | 250 | 259 | +29 |
| **Total** | **671** | **700** | **751** | **+80** |

Phase 2 alone added **+51 tests** on top of the Phase 1 baseline of 700.

## Findings Resolution

### High Findings (H1-H3)
- H1: fixed in `554fa8f` by mapping snake_case entity paths to the correct camelCase service keys in `DirectTransport`.
- H2/H3: still pending — covered by Phase 3 (T10/T11).

### Medium Findings (M1-M8)
- M1: fixed in `3b82ac3` (T5) by stripping `query` from the `runArrayQuery` destructure so the per-repo text search isn't re-applied at the merged layer.
- M2: fixed in `3b82ac3` (T5) by aligning the `defaultSort` field name to camelCase `'updatedAt'` matching the emitted `SearchResultRecord` shape.
- M3: fixed in `a40c029` via shared pagination validation.
- M4/M5: addressed in `b135ee0` by aligning generic CRUD capabilities and preserving dedicated imports/webhooks coverage in the spec.
- M6: covered by T6 OpenAPI response schemas (`5d58709`) — every operation now references the shared Envelope/EnvelopePaginated/Error schemas.
- M7: fixed in `31b688f` (T7) by wrapping `deals.update` graph validation in a transaction with the rebound deals repo.
- M8: fixed in `f079853` by adding `SequenceEventResource.response().list()`.

### Low Findings (L1-L12)
- L1: dead barrel deleted in `dc77e62`.
- L2: cross-runtime cursor codec in `098ef5e`.
- L3: obsolete on HEAD — pre-flight recon misread the pattern; all 4 sites already use the bare `assertFound(...)` form. No commit.
- L4: HttpTransport timeoutMs wired in `984df71`.
- L5: SchemaResource return types in `ec18b7b`.
- L6: obsolete on HEAD — already addressed by T2's pagination extraction. No commit.
- L7: links.next populated in `f1270ec`.
- L8: pipeline isDefault demote in `7c34ef1` + page-walking gate fix in `f7f75fe`.
- L9: obsolete on HEAD — regression-lock test only in `a1e8f29`.
- L10: fromPostgresJson scalar/null in `8a1aa1f`.
- L11: search OOM cap in `80ad0ca`, hardened to throw `SEARCH_RESULT_TOO_LARGE` in `d016fde` (gate fix).
- L12: bootstrap as-any removal in `f0d4369`.

### Phase 2 Validation Gate

Five sub-agents dispatched in parallel against the 19 Phase 2 commits:

1. `superpowers:code-reviewer` — spec-vs-execution review against the plan. **PASS** with one PARTIAL on tx-bound-adapter scope (closed by `f3decb6`).
2. `pr-review-toolkit:silent-failure-hunter` — flagged 3 HIGH issues:
   - Stale-read outside tx in payments/sequence-enrollments/sequence-steps update → fixed in `b4d3d7f`.
   - Pipeline `demoteOtherDefaults` bounded at 100 with no continuation → fixed in `f7f75fe`.
   - L11 search cap silently truncates with no client signal → fixed in `d016fde`.
3. `pr-review-toolkit:code-reviewer` — tenant safety. Two IMPORTANT findings on the tx-bound-adapter Proxy → addressed in `f3decb6` (refusal traps for `transaction`/`beginTransaction`/`execute`/`query`/`runWithMigrationAuthority`).
4. `pr-review-toolkit:pr-test-analyzer` — coverage. **CLEAN**: 42 new `it(...)` cases match the +42 Phase 2 delta exactly. No gaps.
5. `pr-review-toolkit:code-simplifier` — L-batch style drift. Cosmetic comment-tag inconsistencies only (deferred — non-blocking).

All HIGH findings closed by 4 follow-up commits (`f3decb6`, `f7f75fe`, `d016fde`, `b4d3d7f`). Final test count: **751 passing** (+51 over Phase 1 baseline). Typecheck and lint clean across all 3 packages.

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
