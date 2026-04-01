# Core Wave 1 Remediation Review

Date: 2026-04-01
Branch: `core-wave-1-remediation`
Scope:
- remediation workstreams from [core-wave-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-remediation-plan.md)
- integrated worker commits:
  - `f732700` `fix(core): harden sqlite tenant boundary`
  - `3991d12` `feat(core): harden workstream c logic`
  - `f99ca7d` `test(core): add workstream c regressions`
- local remediation commits:
  - `e23096b` `fix(core): sanitize api key service surfaces`
  - `476bbc5` `fix(core): require trusted tenant context on create`

## Validation Evidence

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

All four passed on the remediation branch after the final code changes.

## Code Review

Findings:

- [MEDIUM] The long-form core spec still shows the pre-remediation API key registry shape, while the implemented remediation moves API key mutation under the explicit `system` surface and returns sanitized records there. This is doc drift, not a code blocker. [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1486) [index.ts](/Users/sharonsciammas/orbit-ai/packages/core/src/services/index.ts#L103)

Residual risks:

- Search remains Wave-1 scale and intentionally materializes per-entity result sets before the final merged page. That is acceptable for this remediation branch and remains a later performance concern, not a correctness blocker.

Outcome: `PASS WITH DOC FOLLOW-UP`

## Tenant Safety Review

Boundary touched:
- Tenant runtime
- Database / SQLite repository boundary
- Public interface / secret-bearing API key read shapes

Org context source:
- Tenant-scoped creates, reads, updates, and deletes now derive org scope from `ctx.orgId`.
- Tenant repositories assert `record.organizationId === ctx.orgId` on create paths before any write occurs.

Access mode safety:
- Runtime code paths use runtime adapter primitives only.
- SQLite tenant repository writes run through `withTenantContext(ctx, ...)`.
- Unsupported non-SQLite adapters now fail loudly instead of silently degrading to in-memory persistence.

Secret exposure check:
- API key reads now return sanitized records that omit `keyHash`.
- Generic update no longer accepts `keyHash` or `keyPrefix`.
- Search summaries do not expose internal-only user or key fields.

Findings:

- None.

Validation:

1. No caller-controlled org context: Pass — tenant create paths now require trusted `ctx` and enforce org-match checks before insert.
2. Runtime credentials only: Pass — remediation stayed within runtime adapter primitives and did not introduce migration-authority access.
3. Defense-in-depth on new tables: Pass — `organization_memberships` is consistently tenant-scoped and SQLite repositories keep explicit org filters.
4. Secrets stay redacted across read surfaces: Pass — API key reads sanitize `keyHash` away on tenant and system surfaces.

Outcome: `PASS`

## Plan Vs Execution Review

Scope reviewed:
- Wave 1 remediation plan execution
- integrated SQLite boundary, search/contact-context, API key, and registry changes
- validation evidence listed above

Findings:

- [MEDIUM] The remediation outcome intentionally supersedes the original Wave 1 API key placement, but that updated contract has only been pushed into the remediation docs and KB so far, not the broad core spec example. [core-wave-1-remediation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-remediation-plan.md#L203) [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1486)

Validation:

1. Slice scope is respected: Pass — the diff stayed within the remediation plan areas: API keys, SQLite tenant repositories, search/contact-context, deals, cursor handling, and service registry hardening.
2. Workstream ownership stayed clean: Pass — worker changes landed in discrete workstreams and the final integration only touched the trusted-context create contract and API key surface alignment.
3. Required build/test evidence exists: Pass — full core test, typecheck, build, and diff checks all passed after integration.
4. Shared contracts still match the core spec: Pass with follow-up — runtime behavior matches the remediation plan, with one remaining doc pushdown on the API key registry example.
5. Required specialized reviews ran where needed: Pass — this review includes tenant-safety coverage and remediation-plan reconciliation.
6. Postgres-family proof exists when required: N/A — this remediation branch does not implement the Postgres-family persistence bridge.

Outcome: `READY FOR POSTGRES PERSISTENCE BRIDGE`
