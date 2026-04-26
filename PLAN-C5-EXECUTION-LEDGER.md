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
| 4 Inject Migration Authority Into Schema Engine | Complete | Implementer `019dc99c-a5b8-7561-b659-634e81234ee5`; schema reviewer `019dc9a5-ae14-76b1-ac2c-3c6ac6fc45c4`; tenant/security reviewers `019dc9a5-aec4-7b40-bdc1-9e9f79694695`, `019dc9ac-e683-7f80-96db-be34a2fa8012`, `019dc9b1-c312-7360-afa7-b657d53a09c6`; code reviewers `019dc9a5-af1e-7412-af08-b9835e293aea`, `019dc9ac-bdd3-7cd0-9fe2-b8fdbb4de17d`, `019dc9b1-c337-7703-90f1-6937486c5154` | `0835b14c2627b80eeff9c2033338a98b5fc8c1a0`; `d5ecd54f3fdc6cc0126c07074415e60961823841`; `fc9734943b0d9d2a202e9cc071ee294e71700c3e` | `packages/core/src/schema-engine/engine.ts`; `packages/core/src/schema-engine/engine.test.ts`; `packages/core/src/services/index.ts`; `packages/core/src/services/index.test.ts`; `packages/api/src/config.ts`; `packages/api/src/create-api.ts`; `packages/sdk/src/__tests__/direct-transport.test.ts` | `corepack pnpm -F @orbit-ai/core test -- src/schema-engine/engine.test.ts src/services/index.test.ts src/entities/schema-migrations/service.test.ts`; `corepack pnpm -F @orbit-ai/sdk test -- src/__tests__/direct-transport.test.ts`; `corepack pnpm -F @orbit-ai/core typecheck`; `corepack pnpm -F @orbit-ai/sdk typecheck`; `corepack pnpm -F @orbit-ai/api typecheck`; `corepack pnpm -F @orbit-ai/core build` | Schema/spec PASS; tenant/security PASS; code-quality APPROVED after fixes. | Real preview/apply/rollback execution remains owned by Tasks 6-8; Task 4 placeholders fail closed and preserve authority boundary. |
| 5 Honor SQLite Migration Database | Complete | Implementer `019dc9b4-2ec5-70d1-827d-a5733b1eda7d`; code reviewer `019dc9b9-59fe-7db0-ad4e-973322a21a67`; database reviewer `019dc9b9-5a2a-7aa1-a280-c69b62bcbdf8`; parent fixture fix | `f4a2cde064d710dbe8320609a96cb95e3f6705e8`; `526f8e5` | `packages/core/src/adapters/sqlite/adapter.ts`; `packages/core/src/adapters/sqlite/adapter.test.ts`; `packages/core/src/services/sqlite-persistence.test.ts` | `corepack pnpm -F @orbit-ai/core test -- src/adapters/sqlite/adapter.test.ts src/adapters/sqlite/schema.test.ts src/services/sqlite-persistence.test.ts`; `corepack pnpm -F @orbit-ai/core typecheck`; `corepack pnpm -F @orbit-ai/core build` | Code review APPROVED; database review PASS. | Requested validation initially exposed a stale SQLite schema-migration fixture; fixed in `526f8e5`. |
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
| Schema-change review | Tasks 2, 3, 4, 6, 8, 9 | Task 2 complete: final focused spec review `019dc985-29e8-76f0-9d03-16c2750dcfc5` returned PASS after fixes. Task 3 schema review blockers fixed in `744c510`; preview-stub finding deferred to Task 6 by plan scope. Task 4 schema/spec review PASS. |
| Code review | Each implementation commit | Task 2 complete: final focused code-quality review `019dc985-28cd-7da1-ba65-f26b0c2aa6a6` returned APPROVED after fixes. Task 4 final focused code review `019dc9b1-c337-7703-90f1-6937486c5154` returned APPROVED. Task 5 code review APPROVED. |
| Security review | Tasks 4, 7, 8, 10, 12, 16, final PR | Task 4 security/authority-boundary reviews PASS after fixes; stale destructive confirmation blocker fixed in `fc97349`. |
| Tenant-safety review | Tasks 3, 4, 7, 8, 9, 14, final PR | Task 3 tenant review `019dc993-184c-7970-8699-75faf5ff8722` returned PASS. Task 4 tenant/runtime-boundary reviews PASS. |
| Database/Postgres review | Tasks 3, 5, 8, 14, 15 | Task 3 database review blockers fixed in `744c510`; focused re-review confirmed Postgres advisory-lock wiring, JSONB serialization, stale fixture fix, and DDL/Drizzle alignment. Task 5 database review PASS. |
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
| Task 4 code/security review | Destructive apply could enter authority without confirmation. | P1 | `d5ecd54f3fdc6cc0126c07074415e60961823841` | Final Task 4 reviews PASS/APPROVED; focused validation passed. |
| Task 4 code/security review | Rollback placeholder returned success-looking `rolled_back` result without real rollback. | P1 | `d5ecd54f3fdc6cc0126c07074415e60961823841` | Final Task 4 reviews PASS/APPROVED; focused validation passed. |
| Task 4 code/security review | Migration authority lacked contextual operation metadata. | P2 | `d5ecd54f3fdc6cc0126c07074415e60961823841` | Tests assert authority context; final reviews PASS/APPROVED. |
| Task 4 code/security review | Unsupported field update/delete entered authority before throwing unsupported. | P2 | `d5ecd54f3fdc6cc0126c07074415e60961823841` | Tests assert fail-closed behavior; final reviews PASS/APPROVED. |
| Task 4 re-review | Destructive confirmation was not bound to apply checksum. | P1 | `fc9734943b0d9d2a202e9cc071ee294e71700c3e` | Final spec/security review PASS; test asserts stale confirmation rejects before authority. |
| Task 5 validation | SQLite persistence fixture used obsolete schema migration record shape after Task 3 ledger fields. | Validation blocker | `526f8e5` | Task 5 requested validation passed after fixture update. |

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
| `0835b14c2627b80eeff9c2033338a98b5fc8c1a0` | 4 | Injected explicit schema migration authority and ledger deps into schema engine and service creation, preserving API runtime adapter boundary. | Initial targeted validation passed; code/security review requested fail-closed fixes. |
| `d5ecd54f3fdc6cc0126c07074415e60961823841` | 4 | Added contextual authority metadata and fail-closed unsupported/destructive placeholders. | Parent rerun passed 33 core tests and 23 SDK direct tests plus core/sdk/api typechecks and core build. |
| `fc9734943b0d9d2a202e9cc071ee294e71700c3e` | 4 | Rejected stale destructive confirmations before authority entry. | Parent rerun passed 34 core tests and 23 SDK direct tests plus core/sdk/api typechecks and core build. |
| `f4a2cde064d710dbe8320609a96cb95e3f6705e8` | 5 | Routed SQLite default migrate through migration authority and added handle-selection regression tests. | Adapter tests passed; combined validation initially failed on stale fixture. |
| `526f8e5` | 5 | Updated SQLite persistence schema migration fixture for executable ledger fields. | Parent rerun: SQLite adapter/persistence tests 17 passed; core typecheck/build passed. |

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
| `packages/core/src/schema-engine/engine.ts` | 4 | Explicit schema engine dependencies, migration authority contract, structured missing-authority errors, contextual authority boundary, and fail-closed placeholders. | Task 4 focused core tests/typecheck/build. | Schema/spec PASS; tenant/security PASS; code review APPROVED. |
| `packages/core/src/schema-engine/engine.test.ts` | 4 | Authority boundary, missing authority, destructive confirmation, stale checksum, rollback placeholder, and fail-closed field operation coverage. | Task 4 focused core tests. | Final Task 4 reviews PASS/APPROVED. |
| `packages/core/src/services/index.ts` | 4 | Wires explicit migration authority into `OrbitSchemaEngine` and adds runtime-adapter service constructor. | Task 4 focused core tests/typecheck/build. | Schema/spec PASS; tenant/security PASS. |
| `packages/core/src/services/index.test.ts` | 4 | Proves explicit authority is used and runtime adapter authority is not derived. | Task 4 focused core tests. | Final Task 4 reviews PASS/APPROVED. |
| `packages/api/src/config.ts` | 4 | Adds explicit API migration authority option while preserving runtime adapter type. | Task 4 API typecheck. | Tenant/security PASS. |
| `packages/api/src/create-api.ts` | 4 | Creates services from runtime adapter without privileged cast; passes only explicit migration authority. | Task 4 API typecheck. | Tenant/security PASS. |
| `packages/sdk/src/__tests__/direct-transport.test.ts` | 4 | DirectTransport migration authority unavailable behavior and no adapter authority use. | Task 4 SDK direct tests. | Tenant/security PASS. |
| `packages/core/src/adapters/sqlite/adapter.ts` | 5 | Default SQLite migration uses `runWithMigrationAuthority` and configured migration database. | Task 5 validation. | Code review APPROVED; database review PASS. |
| `packages/core/src/adapters/sqlite/adapter.test.ts` | 3, 5 | Task 3 ledger column coverage; Task 5 migration-database handle-selection sentinel and cleanup coverage. | Task 5 validation. | Code review APPROVED; database review PASS. |
| `packages/core/src/services/sqlite-persistence.test.ts` | 5 | Updated SQLite schema migration fixture for current ledger record shape and sanitization. | Task 5 validation. | Code review APPROVED; database review PASS. |

## Acceptance Criteria Checklist

- [ ] Every changed file maps to one or more task IDs.
- [ ] Every task has implementation commit SHA(s) or a recorded skip/defer decision.
- [ ] Every task has validation command evidence.
- [ ] Required review gates are complete.
- [ ] Skipped or CI-only validation is explicitly recorded.
- [ ] Plan drift is accepted or reverted.
- [ ] Final concordance maps `git diff --name-only origin/main...HEAD` to task IDs.
