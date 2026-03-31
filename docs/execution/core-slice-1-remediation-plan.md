# Orbit AI Core Slice 1 Remediation Plan

Date: 2026-03-31
Status: Executed locally and ready for review acceptance
Package: `@orbit-ai/core`
Depends on:
- [core-slice-1-review.md](/Users/sharonsciammas/orbit-ai/docs/review/core-slice-1-review.md)
- [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
- [core-slice-2-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-slice-2-plan.md)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)

## 1. Purpose

This document turns the slice-1 review findings into an executable remediation plan.

The goal is not to reopen slice 1 broadly. The goal is to fix the blocking issues the review identified, record the review-gate outcome cleanly, and then start slice 2 from a sound baseline.

## 2. Assessment Of The Review

The review is directionally correct and should be treated as the gating artifact for slice 1.

Its strongest conclusions are:

1. the auth naming mismatch is a real cross-cutting defect and must be fixed first
2. tenant-context validation and transaction-local behavior must be tightened before repository work begins
3. the remaining code-quality issues are small, concrete, and cheap to fix now

One sequencing clarification is required:

- SQLite is correctly listed as missing from the original slice-1 target, but it should not block the remediation patch set that unlocks slice 2. It should be planned as a prerequisite before Wave 1 services or Milestone 5, not as a hotfix inside the first remediation pass.

One scope clarification is also required:

- RLS generation remains a Milestone 9 deliverable. It should stay on the tracked follow-up list and not distort the near-term remediation branch.

## 3. Remediation Outcome We Need

Slice 1 should be considered remediated when:

1. all eight "before Milestone 3" findings from the review are fixed
2. the two minor ID tests are added while the related files are already open
3. the specialized review gates are rerun and pass:
   - `orbit-tenant-safety-review`
   - `orbit-core-slice-review`
4. `core-slice-2-plan.md` is treated as unblocked and execution-ready

## 4. Fix Phases

### Phase A. Immediate Blockers Before Slice 2

These are the fixes that should land in the first remediation branch.

#### A1. Auth Naming And Export Consistency

Files:

- `packages/core/src/adapters/interface.ts`
- `packages/core/src/adapters/interface.test.ts`
- `packages/core/src/schema/tables.ts`
- `packages/core/src/index.ts`

Changes:

- rename `ApiKeyAuthLookup.permissions` to `scopes`
- keep naming aligned with:
  - `OrbitAuthContext.scopes`
  - `apiKeys.scopes`
- export `ID_PREFIXES` and `OrbitIdKind` from `src/index.ts`

Why first:

- it removes the highest-risk auth contract mismatch
- it prevents downstream adapter work from encoding the wrong field name

#### A2. Tenant Context Safety Fixes

Files:

- `packages/core/src/adapters/postgres/tenant-context.ts`
- `packages/core/src/adapters/postgres/tenant-context.test.ts`
- `packages/core/src/ids/parse-id.ts`
- `packages/core/src/ids/parse-id.test.ts`

Changes:

- validate `context.orgId` with `assertOrbitId(context.orgId, 'organization')`
- remove the redundant `finally` clear path
- add a lowercase ULID rejection test

Why first:

- this is the most important T1 isolation fix in the review
- the current implementation can accept malformed org identifiers and can mask callback failures

#### A3. Schema Helper And Relation Corrections

Files:

- `packages/core/src/schema/helpers.ts`
- `packages/core/src/schema/tables.ts`
- `packages/core/src/schema/relations.ts`
- `packages/core/src/schema/bootstrap-schema.test.ts`

Changes:

- add `.$onUpdateFn(() => new Date())` to `updatedAt`
- remove the `pgTable` re-export
- remove dead imports from `tables.ts`
- disambiguate the two `organizationMemberships -> users` relations with `relationName`

Why now:

- these are low-cost structural fixes that affect all later schema and repository work

#### A4. Test And Contract Hardening

Files:

- `packages/core/src/ids/generate-id.test.ts`
- `packages/core/src/ids/parse-id.test.ts`
- `packages/core/src/adapters/interface.test.ts`

Changes:

- add a uniqueness assertion for generated IDs
- update the auth lookup test fixture to `scopes`
- keep the existing contract tests aligned with the renamed auth shape

### Phase B. Near-Term Hardening During Slice 2

These are important but should be handled as explicit slice-2-adjacent work, not mixed into the first blocker patch set unless they come naturally.

#### B1. Migration Authority Type Separation

Files:

- `packages/core/src/adapters/interface.ts`
- any adapter tests affected by the type change

Changes:

- introduce a branded `MigrationDatabase` type
- make `runWithMigrationAuthority()` yield `MigrationDatabase`, not `OrbitDatabase`

Reason:

- this is a real T2 boundary hardening improvement
- it fits naturally beside repository and adapter-boundary work in slice 2

#### B2. Restrict Raw Database Access

Files:

- `packages/core/src/adapters/interface.ts`
- any call sites that rely on the public property

Changes:

- remove `database` as a casual public escape hatch, or rename it to an explicitly internal/raw handle with warning comments

Reason:

- it closes an easy tenant-context bypass path before service implementations multiply

#### B3. Transaction-Boundary Proof

Files:

- Postgres-family adapter tests or integration harness for slice 2

Changes:

- add a real-database or adapter-backed test proving tenant GUC state is not visible outside the transaction boundary

Reason:

- the current interface assumes correct transaction behavior but does not prove it on a real connection path

#### B4. Prefix Invariant Test

Files:

- `packages/core/src/ids/prefixes.ts`
- new test file for prefix invariants

Changes:

- assert all prefixes are unique
- assert no prefix is another prefix plus a shared delimiter accident
- document that `assertOrbitId` validates format, not authorization

### Phase C. Later Milestone Follow-Ups

These should stay tracked, but they are not slice-1-remediation blockers.

#### C1. SQLite Adapter

Target:

- before Milestone 5 or Wave 1 services

Reason:

- it was part of the original early-adapter intent, but it should not block the blocker-fix branch

#### C2. Error Detail Redaction Contract

Target:

- when API and richer error surfaces begin

Reason:

- the risk becomes concrete once API, CLI JSON, and MCP error paths expand

#### C3. RLS Generation

Target:

- Milestone 9

Reason:

- this remains a planned capability, not a slice-1 defect

## 5. Workstream Plan

Keep the remediation branch small and deterministic.

### Workstream A. Auth And Tenant Boundary

Owns:

- `packages/core/src/adapters/interface.ts`
- `packages/core/src/adapters/interface.test.ts`
- `packages/core/src/adapters/postgres/tenant-context.ts`
- `packages/core/src/adapters/postgres/tenant-context.test.ts`

Responsibilities:

- `permissions` to `scopes` rename
- `orgId` validation
- `finally` block removal
- tenant-context test updates

### Workstream B. Schema And Relations

Owns:

- `packages/core/src/schema/helpers.ts`
- `packages/core/src/schema/tables.ts`
- `packages/core/src/schema/relations.ts`
- `packages/core/src/schema/bootstrap-schema.test.ts`

Responsibilities:

- `updatedAt` auto-update fix
- `pgTable` re-export removal
- dead import cleanup
- relation disambiguation

### Workstream C. Exports And ID Tests

Owns:

- `packages/core/src/index.ts`
- `packages/core/src/ids/generate-id.test.ts`
- `packages/core/src/ids/parse-id.test.ts`

Responsibilities:

- export `ID_PREFIXES`
- add uniqueness and lowercase-rejection tests

## 6. Branch And Commit Strategy

Recommended branch:

- `core-slice-1-remediation`

Recommended commit sequence:

1. `fix(core): align api key auth scope contract`
2. `fix(core): harden tenant context validation`
3. `fix(core): correct schema helpers and relations`
4. `test(core): add id contract coverage`
5. `docs: record slice 1 remediation status`

If the branch is small enough, commits 2 and 3 may be combined. Do not hide the auth contract fix inside a mixed commit.

## 7. Required Skills And Review Gates

Mandatory reviews for this remediation branch:

- `orbit-tenant-safety-review`
  - required after Workstream A and before merge
- `orbit-schema-change`
  - required after Workstream B because schema helpers and relations are changing
- `orbit-core-slice-review`
  - required on the integrated remediation diff before slice 2 execution starts

## 8. Validation Gates

The remediation branch is not complete until all of these pass:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

And specifically:

- auth lookup tests use `scopes` consistently
- malformed `org_` IDs are rejected before transaction start
- thrown callback errors are not masked by cleanup logic
- membership relations compile and traverse without ambiguity
- `updatedAt` behavior is covered by at least one focused test or schema assertion
- ID export and invariant tests pass

## 9. Exit Criteria

This remediation plan is complete when:

1. the eight must-fix review findings are resolved
2. the two opportunistic ID tests are added
3. the remediation branch passes all validation gates
4. the review gate outcome changes from:
   - slice 1: conditional pass
   - tenant safety: fail
   to:
   - slice 1: pass
   - tenant safety: pass
5. slice 2 can begin without carrying known auth or tenant-boundary defects forward

## 10. Immediate Next Actions

1. Accept this remediation plan.
2. Create branch `core-slice-1-remediation`.
3. Execute Workstreams A-C.
4. Run the three required reviews.
5. Update the KB and slice-2 status after the remediation branch is accepted.
