# Core Wave 2 Slice B Review

Date: 2026-04-02
Branch: `core-wave-2-slice-b`
Base commit: `060936f`
Reviewed scope:
- [core-wave-2-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-2-services-plan.md)
- `@orbit-ai/core` Slice B implementation for `products`, `payments`, and `contracts`
- registry, tenant-scope, and SQLite/Postgres persistence proof updates required for Slice B

## Validation Evidence

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

All four passed after the final Slice B fixes.

## Code Review

Findings fixed during the branch pass:

- `createCoreServices(...)` originally wired `products` incorrectly by passing the repository directly into `createProductService(...)` instead of the expected dependency object; the Slice B registry and persistence proofs would fail on first `services.products.create(...)` access until this was corrected.
- Initial Slice B status handling validated timestamp/state coupling before lifecycle transitions, which surfaced the wrong validation path on invalid regressions from paid/signed states. The final services now reject illegal transitions first and retain `paidAt` / `signedAt` correctly for post-settlement or post-signature states.
- The first schema bootstrap patch duplicated the new Slice B bootstrap arrays and exported initializers in both adapter schema files; the duplicate declarations were removed before final validation.
- Product and payment currency defaults were initially too strict at the Zod layer; insert validation now keeps `currency` optional on create so the service-level default remains reachable and aligned with the canonical table defaults.
- Sub-agent review also found that payment and contract status fields were still effectively open-ended. The final services now reject unsupported statuses instead of silently bypassing the transition model.
- Sub-agent review also found that payment duplicate races could still fall through to raw adapter errors. The final payment service now translates external-ID unique-index violations into typed `CONFLICT` errors and adds regression coverage for both repository-thrown unique errors and adapter-backed duplicate writes.

Final open findings:

- None.

Outcome: `PASS`

## Security Review

Boundary touched:

- tenant-scoped repositories for `products`, `payments`, and `contracts`
- tenant-scope classification for the new Slice B tables
- external-ID uniqueness and status-bearing service validation
- SQLite and Postgres schema bootstrap extensions for Slice B

Validated controls:

1. Tenant reads and writes still derive scope from trusted `ctx.orgId`
2. New tables are registered as tenant-scoped in [tenant-scope.ts](/Users/sharonsciammas/orbit-ai/packages/core/src/repositories/tenant-scope.ts)
3. Payment `contactId` / `dealId` links reject cross-tenant references
4. Contract `contactId` / `companyId` / `dealId` links reject cross-tenant references
5. Payment `externalId` uniqueness is enforced per tenant and backed by SQLite/Postgres unique indexes
6. Payment and contract status fields now use closed service-layer lifecycle sets instead of permitting arbitrary text values to bypass transition checks
7. No new admin/system or secret-bearing read surface was introduced by Slice B
8. SQLite and Postgres persistence proofs both pass for the full Slice B entity set
9. Payment duplicate writes now normalize to typed `CONFLICT` responses even when the repository throws a unique-index style error

Findings:

- No remaining concrete tenant-isolation, uniqueness, or secret-exposure issues were found after the final fixes.

Residual risks:

- The canonical core spec defines `payments.status` and `contracts.status` as text fields but does not yet freeze a platform-wide lifecycle enum. Slice B now enforces one service-layer transition model for core correctness; later API/SDK milestones should either adopt that lifecycle explicitly or reconcile it before broader transport exposure.
- Slice B validates relation existence inside the tenant, but it does not yet enforce deeper graph-consistency rules such as “payment contact and deal must already agree with each other” or “contract contact/company/deal must already form a coherent linked graph” across every combination.

Outcome: `PASS`

## Plan Vs Execution

Slice B matches the execution plan:

- added `products`, `payments`, and `contracts`
- added CRUD/list/search coverage for all three entities
- added relation coverage for payment and contract linked records
- added payment external-ID uniqueness checks and persistence-backed uniqueness proof coverage
- added payment and contract lifecycle transition tests
- added SQLite and Postgres persistence proofs for the new entity set
- preserved lazy registry wiring so pre-Slice-B callers do not pay new adapter requirements until the new services are accessed

No out-of-scope schema-engine, transport, or admin/system hardening-prep work was pulled forward.

Outcome: `PASS`

## Recommendation

Slice B is ready as the next accepted `@orbit-ai/core` milestone on `core-wave-2-slice-b`.

The next branch action should be to merge Slice B and then open Slice C on a fresh follow-up branch so automation-state review stays isolated from the revenue/catalog service history.
