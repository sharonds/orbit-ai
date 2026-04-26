# Plan C5 Execution Ledger

This ledger tracks execution of Plan C.5 from the Codex worktree:

- Worktree: `/Users/sharonsciammas/orbit-ai/.worktrees/plan-c5-migration-engine`
- Branch: `codex/plan-c5-migration-engine`
- Plan source: `/Users/sharonsciammas/orbit-ai/docs/superpowers/plans/2026-04-26-plan-c5-codex-migration-engine.md`
- Historical plan context: `docs/superpowers/plans/2026-04-24-plan-c5-migration-engine.md`

## Scope Rules

- Work only in `/Users/sharonsciammas/orbit-ai/.worktrees/plan-c5-migration-engine`.
- Do not add or stage the untracked parent checkout plan file unless a later task explicitly requires it.
- Every changed file must map to a Plan C5 task ID, validation command, and review result.
- Keep ledger commits separate from implementation commits.
- Implementation commits must include code and tests for their task.
- Do not batch Tasks 2-15 into one implementation session without recording plan drift first.
- Do not include dependency upgrades, release workflow changes, unrelated docs, or Plan B/C/D cleanup unless a task explicitly requires it.
- Preserve unrelated edits made by other workers.

## Plan C Merge Baseline

- Journey 8 currently documents alpha stub passthrough and states it is not a destructive-migration safety gate.
- Journey 8 source evidence: `e2e/src/journeys/08-migration-preview-apply.test.ts`.
- E2E README source evidence: `e2e/README.md`.
- Postgres E2E harness exists.
- Postgres harness source evidence: `e2e/src/harness/build-stack.ts`, `e2e/src/harness/prepare-cli-workspace.ts`, `e2e/src/harness/postgres-safety.ts`, `e2e/src/harness/build-stack.test.ts`, `e2e/src/harness/postgres-safety.test.ts`.

## Baseline Validation Evidence

- git status baseline: clean branch codex/plan-c5-migration-engine tracking origin/main.
- git log latest: 8f6291f Execute Plan C follow-ups.
- `pnpm -r build` failed first because pnpm was not on PATH.
- `corepack pnpm --version` returned 9.12.3.
- `corepack pnpm install` exited 0, with warnings about e2e orbit bin before CLI build.
- `corepack pnpm -r build` exited 0.
- `corepack pnpm -r typecheck` exited 0.
- `corepack pnpm -r test` exited 0; e2e package inside it reported 19 files passed, 23 tests passed, 3 skipped.
- `corepack pnpm -r lint` exited 0.
- `corepack pnpm --filter @orbit-ai/e2e test` exited 0; 19 files passed, 23 tests passed, 3 skipped.
- Baseline notable stderr: Journey 15 CLI JSON.parse failure messages appear but test passes; ExperimentalWarning for SQLite appears; MCP direct mode auth-bypass warning appears.
- Local Postgres validation not run yet at baseline; record as pending/conditional, not claimed.

## Task 1 Validation

Command:

```bash
git status --short --branch
```

Result:

```text
## codex/plan-c5-migration-engine...origin/main
```

Command:

```bash
git log --oneline -5
```

Result:

```text
8f6291f Execute Plan C follow-ups
68ead05 chore(deps): bump drizzle-orm 0.44.7 → 0.45.2 (CVE GHSA-gpj5-g38j-94v9) (#81)
3ec754c Harden Plan B release pipeline (#80)
de88dcf docs: implementation plans B/C/C.5/D and Codex review for cloud execution
69359e9 docs: add reusable security resources (#78)
```

## Task Table

| Task | Status | Subagent/session ID | Implementation commit SHA(s) | Changed files | Validation commands | Review evidence | Notes |
|---|---|---|---|---|---|---|---|
| 1 Create Worktree And Execution Ledger | Complete | Worker `019dc967-ac8a-7550-b393-911eeb19b210`; parent review | `79f637ee349b9585cd1c01d093c204496c04c171` | `PLAN-C5-EXECUTION-LEDGER.md` | `git status --short --branch`; `git log --oneline -5`; parent `git show --stat --oneline HEAD`; parent `sed -n '1,240p' PLAN-C5-EXECUTION-LEDGER.md` | Process review complete: parent verified ledger structure, baseline evidence, Plan C merge evidence, and commit scope. | Worktree already existed per coordinator instruction; verified branch baseline and Plan C merge evidence. |
| 2 Define Migration Domain Contracts | Complete | Implementer `019dc96a-71ce-7231-93e8-3d6339343d67`; spec reviewers `019dc976-bb2f-7643-b176-64f24f883a4e`, `019dc97f-d2f9-7c83-8349-f5602d64683f`, `019dc985-29e8-76f0-9d03-16c2750dcfc5`; code reviewers `019dc976-bc6f-74d2-b028-8841b9c7a46f`, `019dc97f-d3c2-7082-be2f-020bcedcf90c`, `019dc985-28cd-7da1-ba65-f26b0c2aa6a6` | `bca09482372f96cfb43ded4bdc439a9195d08b0e`; `fbffc161`; `d4f45ba` | `packages/core/src/schema-engine/migrations.ts`; `packages/core/src/schema-engine/migrations.test.ts`; `packages/core/src/types/errors.ts`; `packages/core/src/index.ts`; `packages/api/src/middleware/error-handler.ts`; `packages/api/src/__tests__/error-handler.test.ts`; `packages/sdk/src/transport/direct-transport.ts`; `packages/sdk/src/__tests__/transport-parity.test.ts` | `corepack pnpm -F @orbit-ai/core test -- src/schema-engine/migrations.test.ts src/schema-engine/engine.test.ts`; `corepack pnpm -F @orbit-ai/core typecheck`; `corepack pnpm -F @orbit-ai/core build`; `corepack pnpm -F @orbit-ai/api test -- src/__tests__/error-handler.test.ts`; `corepack pnpm -F @orbit-ai/sdk test -- src/__tests__/direct-transport.test.ts src/__tests__/transport-parity.test.ts`; `corepack pnpm -F @orbit-ai/sdk typecheck` | Schema-change/spec review PASS; code-quality review APPROVED. Earlier findings fixed in follow-up commits. | Task 4 authority-injection finding was reviewed as out-of-scope for Task 2 and remains owned by Task 4. |
| 3 Strengthen Migration Ledger Persistence | Complete | Implementer `019dc987-7ce6-7322-97d1-b9e72e9b9882`; schema reviewer `019dc993-17f8-75b0-860b-0a53ddc169e8`; tenant reviewer `019dc993-184c-7970-8699-75faf5ff8722`; database reviewers `019dc993-1888-71c1-aa78-54daca101132`, `019dc999-4410-77d0-8778-755f11055555`, `019dc999-677b-7b92-b1d9-165604c2bb24` | `6be6eda55d5a950bb54e1f78660cdc6742b5ccb8`; `744c510` | `packages/core/src/entities/schema-migrations/validators.ts`; `packages/core/src/entities/schema-migrations/repository.ts`; `packages/core/src/entities/schema-migrations/service.test.ts`; `packages/core/src/schema/tables.ts`; `packages/core/src/schema/zod.test.ts`; `packages/core/src/adapters/sqlite/schema.ts`; `packages/core/src/adapters/sqlite/adapter.test.ts`; `packages/core/src/adapters/postgres/schema.ts`; `packages/core/src/adapters/postgres/schema.test.ts`; `packages/core/src/services/postgres-persistence.test.ts` | `corepack pnpm -F @orbit-ai/core test -- src/entities/schema-migrations src/adapters/sqlite src/adapters/postgres src/schema/zod.test.ts src/services/postgres-persistence.test.ts`; `corepack pnpm -F @orbit-ai/core typecheck`; `corepack pnpm -F @orbit-ai/core build` | Tenant-safety PASS. Schema/database blockers fixed; focused re-reviews confirmed advisory-lock wiring, Postgres persistence, JSONB serialization, and DDL/Drizzle alignment. | Reviewers raised preview-stub behavior during re-review; accepted as Task 6 scope, not Task 3 ledger persistence. |
| 4 Inject Migration Authority Into Schema Engine | Pending | TBD | TBD | TBD | TBD | Schema-change review; tenant-safety review; security review |  |
| 5 Honor SQLite Migration Database | Pending | TBD | TBD | TBD | TBD | Code review; database review |  |
| 6 Implement Migration Preview Classification | Pending | TBD | TBD | TBD | TBD | Schema-change review; code review |  |
| 7 Enforce Destructive Migration Confirmation | Pending | TBD | TBD | TBD | TBD | Security review; tenant-safety review |  |
| 8 Apply And Roll Back Schema Migrations | Pending | TBD | TBD | TBD | TBD | Schema-change review; database review; security review |  |
| 9 Update And Delete Custom Fields Safely | Pending | TBD | TBD | TBD | TBD | Schema-change review; tenant-safety review |  |
| 10 Harden Schema Migration Routes | Pending | TBD | TBD | TBD | TBD | API/SDK/CLI/MCP parity review; security review |  |
| 11 Align SDK Schema Migration Resource Contracts | Pending | TBD | TBD | TBD | TBD | API/SDK/CLI/MCP parity review |  |
| 12 Pass Checksum-Bound Destructive Confirmations In CLI | Pending | TBD | TBD | TBD | TBD | API/SDK/CLI/MCP parity review; security review |  |
| 13 Document C5 MCP Schema Migration Exclusion | Pending | TBD | TBD | TBD | TBD | API/SDK/CLI/MCP parity review; docs review |  |
| 14 Add Postgres Migration Authority Coverage | Pending | TBD | TBD | TBD | TBD | Database/Postgres review; tenant-safety review | Local Postgres baseline is pending/conditional. |
| 15 Prove Migration Preview Apply Safety In E2E | Pending | TBD | TBD | TBD | TBD | E2E review; database/Postgres review |  |
| 16 Document Migration Authority Contract | Pending | TBD | TBD | TBD | TBD | Docs review; security review |  |
| 17 Complete Plan C5 Execution Concordance | Pending | TBD | TBD | TBD | TBD | Final code review; final security review; final tenant-safety review; final parity review |  |

## Review Gates

| Gate | Required before | Evidence placeholder |
|---|---|---|
| Process review | Task 1 commit | Complete for Task 1: parent verified commit `79f637e` changes only `PLAN-C5-EXECUTION-LEDGER.md` and contains required baseline/worktree evidence. |
| Schema-change review | Tasks 2, 3, 4, 6, 8, 9 | Task 2 complete: final focused spec review `019dc985-29e8-76f0-9d03-16c2750dcfc5` returned PASS after fixes. Task 3 schema review blockers fixed in `744c510`; preview-stub finding deferred to Task 6 by plan scope. |
| Code review | Each implementation commit | Task 2 complete: final focused code-quality review `019dc985-28cd-7da1-ba65-f26b0c2aa6a6` returned APPROVED after fixes. |
| Security review | Tasks 4, 7, 8, 10, 12, 16, final PR | TBD |
| Tenant-safety review | Tasks 3, 4, 7, 8, 9, 14, final PR | Task 3 tenant review `019dc993-184c-7970-8699-75faf5ff8722` returned PASS. |
| Database/Postgres review | Tasks 3, 5, 8, 14, 15 | Task 3 database review blockers fixed in `744c510`; focused re-review confirmed Postgres advisory-lock wiring, JSONB serialization, stale fixture fix, and DDL/Drizzle alignment. |
| API/SDK/CLI/MCP parity review | Tasks 10, 11, 12, 13, final PR | TBD |
| Final concordance review | Task 17 | TBD |

## Deferred Items

- Local Postgres validation: pending/conditional at baseline; do not claim until run locally or validated by CI.
- Neon branch-before-migrate validation: pending/conditional until implementation determines configured coverage path.
- CI-only validation: TBD.
- Restricted-role Postgres RLS proof beyond Plan C5 migration authority scope: TBD unless a later task explicitly includes it.
- Cross-database data migration such as SQLite to Postgres: deferred by historical Plan C5 scope.

## Skipped Or CI-Only Validation

| Item | Status | Reason | Required follow-up |
|---|---|---|---|
| Local Postgres validation | Pending/conditional | Not run yet at baseline | Run locally when available or require GitHub CI Postgres success before merge. |
| Neon branch-before-migrate | TBD | Depends on configured adapter path | Record implementation decision and CI/local evidence. |

## Plan Drift

| Date | Task | Drift | Decision | Commit |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

## Review Findings And Fixes

| Review | Finding | Priority | Fix commit | Verification |
|---|---|---|---|---|
| Task 2 spec review | Preview output lacked summary, adapter, trusted scope, and confirmation instructions. | High | `fbffc161` | Final spec review PASS; core/API/SDK targeted validation passed. |
| Task 2 spec/code review | Public operation schemas used arbitrary `z.unknown()` values and did not guarantee checksumable semantic payloads. | High/Medium | `fbffc161`; `d4f45ba` | Final spec review PASS; core migrations tests 12 passed. |
| Task 2 spec review | Hostile caller-field tests missed `organization_id`, `appliedBy`, and `applied_by_user_id`. | Medium | `fbffc161` | Final spec review PASS. |
| Task 2 code review | API and SDK duplicated migration error status maps instead of using canonical core mapping. | Medium | `fbffc161` | API error-handler and SDK transport-parity tests passed. |
| Task 2 code review | Checksum canonicalization used locale-sensitive key ordering. | Medium | `d4f45ba` | Final spec review PASS; migrations test covers `localeCompare` not being used. |
| Task 2 code review | Missing migration authority injection was raised during review. | P1, out of scope for Task 2 | Deferred to Task 4 by plan scope | Must be verified during Task 4. |
| Task 3 schema/database review | Postgres migration lock path was process-local and did not call advisory-lock helper. | P1 | `744c510` | Expanded core validation passed; focused re-review confirmed `runWithMigrationAuthority` and advisory-lock SQL are wired and tested. |
| Task 3 database review | Postgres persistence fixture was stale after new required ledger fields. | P1 | `744c510` | `corepack pnpm -F @orbit-ai/core test -- src/services/postgres-persistence.test.ts` included in expanded validation and passed. |
| Task 3 database review | Postgres JSONB forward/reverse operation arrays were bound raw. | P2 | `744c510` | Expanded validation passed and re-review confirmed round-trip coverage. |
| Task 3 re-review | Schema engine preview remains stubbed. | P1, out of scope for Task 3 | Deferred to Task 6 by plan scope | Must be verified during Task 6 preview-classification work. |

## Implementation Commits

| Commit | Task(s) | Summary | Validation |
|---|---|---|---|
| `79f637ee349b9585cd1c01d093c204496c04c171` | 1 | Started Plan C5 execution ledger with baseline, scope rules, review gates, deferred items, and concordance placeholders. | `git status --short --branch`; `git log --oneline -5` |
| `1bd4394` | 1 | Recorded Task 1 process review in ledger. | `git diff -- PLAN-C5-EXECUTION-LEDGER.md`; `git status --short --branch` |
| `bca09482372f96cfb43ded4bdc439a9195d08b0e` | 2 | Added schema migration domain contracts, checksum helper, migration error codes, and API/SDK status tests. | Implementer targeted commands passed; follow-up reviews requested changes. |
| `fbffc161` | 2 | Completed preview contract metadata, canonical semantic value validation, hostile caller-field tests, and canonical status helper usage. | Implementer targeted commands passed; parent rerun passed. |
| `d4f45ba` | 2 | Tightened executable-shaped payload rejection and deterministic checksum key ordering. | Parent rerun: core migrations/engine tests 18 passed; API error-handler 10 passed; SDK direct/parity 53 passed; core/API/SDK typechecks passed. |
| `6be6eda55d5a950bb54e1f78660cdc6742b5ccb8` | 3 | Extended schema migration ledger fields, schemas, repositories, DDL, sanitization, rollback preconditions, and lock semantics. | Initial targeted validation passed; schema/database reviews requested fixes. |
| `744c510` | 3 | Wired Postgres advisory locking, fixed Postgres JSONB operation serialization, and updated Postgres persistence coverage. | Parent rerun: 9 core test files passed, 58 tests passed, 2 skipped; core typecheck/build passed. |

## Final Concordance Placeholder

Before PR, map every path from:

```bash
git diff --name-only origin/main...HEAD
```

to task IDs:

| Path | Task ID(s) | Rationale | Validation | Review evidence |
|---|---|---|---|---|
| `PLAN-C5-EXECUTION-LEDGER.md` | 1, 17 | Execution ledger and final concordance | `git status --short --branch`; `git log --oneline -5`; final `git diff --name-only origin/main...HEAD` TBD | Task 1 process review complete; final concordance review TBD |
| `packages/core/src/schema-engine/migrations.ts` | 2 | Domain operation/input/output contracts, strict schemas, checksum canonicalization. | Task 2 targeted core tests/typecheck/build. | Spec review PASS; code review APPROVED. |
| `packages/core/src/schema-engine/migrations.test.ts` | 2 | Contract validation, checksum, hostile caller fields, and raw executable-shaped payload regression tests. | Task 2 targeted core tests. | Spec review PASS; code review APPROVED. |
| `packages/core/src/types/errors.ts` | 2 | Migration error codes and canonical status mapping. | Task 2 targeted core typecheck/build plus API/SDK tests. | Spec review PASS; code review APPROVED. |
| `packages/core/src/index.ts` | 2 | Exports migration domain contracts. | Task 2 targeted core typecheck/build. | Spec review PASS; code review APPROVED. |
| `packages/api/src/middleware/error-handler.ts` | 2 | Uses canonical migration error status mapping. | API error-handler tests. | Code review APPROVED. |
| `packages/api/src/__tests__/error-handler.test.ts` | 2 | API migration error status coverage. | API error-handler tests. | Code review APPROVED. |
| `packages/sdk/src/transport/direct-transport.ts` | 2 | Uses canonical migration error status mapping in direct mode. | SDK direct-transport and transport-parity tests. | Code review APPROVED. |
| `packages/sdk/src/__tests__/transport-parity.test.ts` | 2 | HTTP/direct migration error status parity coverage. | SDK transport-parity tests. | Code review APPROVED. |
| `packages/core/src/entities/schema-migrations/validators.ts` | 3 | Executable ledger record schema, status schema, status patch schema, and sanitized admin-read shape. | Task 3 expanded core validation. | Tenant-safety PASS; database re-review accepted ledger scope. |
| `packages/core/src/entities/schema-migrations/repository.ts` | 3 | Ledger persistence, status updates, rollback preconditions, migration lock semantics, Postgres advisory lock wiring, and JSONB serialization. | Task 3 expanded core validation including Postgres persistence. | Schema/database blockers fixed; tenant-safety PASS. |
| `packages/core/src/entities/schema-migrations/service.test.ts` | 3 | Ledger isolation, rollback precondition, lock contention, unrelated concurrency, and Postgres advisory-lock wiring tests. | Task 3 expanded core validation. | Schema/database blockers fixed. |
| `packages/core/src/schema/tables.ts` | 3 | Drizzle schema migration ledger columns and index. | Task 3 expanded core validation. | Database re-review confirmed DDL/Drizzle alignment. |
| `packages/core/src/schema/zod.test.ts` | 3 | Schema migration zod contract coverage for new ledger fields. | Task 3 expanded core validation. | Database re-review confirmed. |
| `packages/core/src/adapters/sqlite/schema.ts` | 3 | SQLite schema migration ledger columns and index. | Task 3 expanded core validation. | Database re-review confirmed DDL alignment. |
| `packages/core/src/adapters/sqlite/adapter.test.ts` | 3 | SQLite schema initialization coverage for ledger columns. | Task 3 expanded core validation. | Database re-review confirmed. |
| `packages/core/src/adapters/postgres/schema.ts` | 3 | Postgres schema migration ledger columns and index. | Task 3 expanded core validation. | Database re-review confirmed DDL alignment. |
| `packages/core/src/adapters/postgres/schema.test.ts` | 3 | Postgres schema DDL coverage for ledger columns and index. | Task 3 expanded core validation. | Database re-review confirmed. |
| `packages/core/src/services/postgres-persistence.test.ts` | 3 | Postgres ledger persistence fixture and semantic operation round-trip coverage. | Task 3 expanded core validation. | Database re-review confirmed stale fixture and JSONB issues fixed. |

## Acceptance Criteria Checklist

- [ ] Every changed file maps to one or more task IDs.
- [ ] Every task has implementation commit SHA(s) or a recorded skip/defer decision.
- [ ] Every task has validation command evidence.
- [ ] Required review gates are complete.
- [ ] Skipped or CI-only validation is explicitly recorded.
- [ ] Plan drift is accepted or reverted.
- [ ] Final concordance maps `git diff --name-only origin/main...HEAD` to task IDs.
