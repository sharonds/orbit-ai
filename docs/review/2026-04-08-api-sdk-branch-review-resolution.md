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
| T0b: Route registry design | ✅ | — | `docs/superpowers/designs/2026-04-08-route-registry.md` |
| T1: DirectTransport snake_case mapping | ✅ | `554fa8f` | Added ENTITY_SERVICE_MAP + resolveServiceKey() |
| T2: Shared pagination validation | ✅ | `a40c029` | Extracted paginationParams() to utils, replaced 5 inline Number() calls |
| T3: OpenAPI capability alignment | ✅ | `b135ee0` | Shared entity-capabilities.ts, generic CRUD gated by capabilities, dedicated imports/webhooks paths retained in spec |
| T4: Uniqueness race remediation | ⏳ | — | Depends on T0a implementation |
| T5: Search service fixups | ⏳ | — | |
| T6: OpenAPI response schema improvement | ⏳ | — | |
| T7: Deal update transaction fix | ⏳ | — | Depends on T0a implementation |
| T8: SequenceEventResource list parity | ✅ | `f079853` | Added `response().list()` and parity coverage in existing suites |
| T9 L-batch (L1-L12) | ⏳ | — | |
| T10: Registry-driven OpenAPI rebuild | ⏳ | — | Structural (depends on T0b full impl) |
| T11: DirectTransport full parity | ⏳ | — | |
| T12: Shared-store idempotency/rate limiting | ⏳ | — | |
| T13: SSRF hardening | ⏳ | — | |
| T14: Cross-transport black-box parity | ⏳ | — | |
| T15: Resolution document | ⏳ | — | This document |

## Test Count Delta

| Package | Baseline | Current | Delta |
|---------|----------|---------|-------|
| `@orbit-ai/core` | 270 | 270 | 0 |
| `@orbit-ai/sdk` | 171 | 175 | +4 |
| `@orbit-ai/api` | 230 | 244 | +14 |
| **Total** | **671** | **689** | **+18** |

## Findings Resolution

### High Findings (H1-H3)
- H1: fixed in `554fa8f` by mapping snake_case entity paths to the correct camelCase service keys in `DirectTransport`.
- H2/H3: not started yet.

### Medium Findings (M1-M8)
- M3: fixed in `a40c029` via shared pagination validation.
- M4/M5: addressed in `b135ee0` by aligning generic CRUD capabilities and preserving dedicated imports/webhooks coverage in the spec.
- M8: fixed in `f079853` by adding `SequenceEventResource.response().list()`.
- M1, M2, M6, M7: pending.

### Low Findings (L1-L12)
_TBD_

### Deferred Work
- T4, T7 depend on implementing the T0a transaction plumbing design.
- T10-T15 remain structural follow-up work.

### Direct-Mode Exclusions That Remain
- DirectTransport still lacks full non-CRUD route parity pending T11.

## Validation Gates

- [ ] Phase 0 Gate (T0a/T0b designs)
- [ ] Phase 1 Gate (T1-T3)
- [ ] Phase 2 Gate (T4-T9)
- [ ] Phase 3 Gate Stage 1 (8 agents)
- [ ] Phase 3 Gate Stage 2 (manual security review)
- [ ] Phase 3 Gate Stage 3 (final commit)

## Manual Security Review Sign-off (Phase 3 Stage 2)

- [ ] T13 SSRF validator: ___ (initials) — ___ (date)
- [ ] T12 idempotency replay: ___ (initials) — ___ (date)
- [ ] Auth scopes on new routes: ___ (initials) — ___ (date)
- [ ] OpenAPI admin path security: ___ (initials) — ___ (date)
