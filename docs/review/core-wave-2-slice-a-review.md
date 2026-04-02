# Core Wave 2 Slice A Review

Date: 2026-04-02
Branch: `core-wave-2-services`
Base commit: `1d98388` `docs: add core wave 2 services plan`
Reviewed scope:
- [core-wave-2-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-services-plan.md)
- `@orbit-ai/core` Slice A implementation for `activities`, `tasks`, `notes`, contact-context integration, and SQLite/Postgres persistence proofs

## Validation Evidence

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

All four passed after the final Slice A fixes.

## Code Review

Findings:

- One medium issue was found during review and fixed before this artifact was written:
  - Slice A user-linked fields (`loggedByUserId`, `assignedToUserId`, `createdByUserId`) originally accepted any valid user ID shape without proving same-tenant ownership at the service boundary.

Final open findings:

- None.

Outcome: `PASS`

## Tenant Safety Review

Boundary touched:

- tenant-scoped repositories for `activities`, `tasks`, and `notes`
- contact-context aggregation over engagement entities
- SQLite and Postgres schema bootstrap extensions for Slice A

Validated controls:

1. Tenant reads and writes still derive scope from trusted `ctx.orgId`
2. New repositories remain explicitly filtered by `organization_id`
3. Contact/company/deal links reject cross-tenant references
4. User-linked fields now reject cross-tenant user references
5. No secret-bearing read surface was introduced by Slice A

Findings:

- No remaining concrete tenant-safety or secret-exposure issues were found after the user-reference validation fix.

Residual risks:

- Slice A validates relation existence inside the tenant, but it does not yet enforce deeper graph-consistency rules such as “deal/contact/company must already agree with each other” across every linked record combination.

Outcome: `PASS`

## Plan Vs Execution

Slice A matches the execution plan:

- added `activities`, `tasks`, and `notes`
- added CRUD/list/search coverage for all three entities
- added relation coverage for contact/company/deal links
- upgraded contact-context to consume real activities/tasks data
- added SQLite and Postgres persistence proofs for the new entity set

No out-of-scope schema-engine, transport, or hardening-prep work was pulled forward.

Outcome: `PASS`

## Recommendation

Slice A is ready as the next accepted `@orbit-ai/core` milestone on `core-wave-2-services`.

The next branch action should be to commit this Slice A patch set, then decide whether to open Slice B immediately on the same branch or after a separate acceptance checkpoint.
