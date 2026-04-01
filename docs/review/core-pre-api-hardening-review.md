# Core Pre-API Hardening Review

Date: 2026-04-01
Branch: `core-pre-api-hardening`
Commits:
- `b11d1a9` `feat(core): add array query filter allowlist`
- `80cb524` `fix(core): type relation and user update errors`
- `50c109c` `fix(core): close pre-api hardening gaps`
- `8da507c` `fix(core): stabilize repository filter allowlists`

## Scope

This review covers the pre-API hardening follow-up on top of the accepted Wave 1 remediation baseline. The changes close the remaining pre-bridge issues around:

- blocked-filter rejection
- explicit repository filter allowlists
- sanitized user service surfaces
- typed relation and validation errors
- public surface cleanup around repository override exposure

## Validation Evidence

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

All four passed on branch `core-pre-api-hardening`.

## Code Review

Findings:

- None.

Outcome: `PASS`

## Tenant Safety Review

Boundary touched:
- Tenant runtime
- Public interface
- Service validation and repository query contract

Org context source:
- Tenant scope still comes from trusted `ctx.orgId`.
- The hardening diff did not add any caller-controlled organization selector.

Access mode safety:
- No elevated runtime authority was introduced.
- The diff stays within repository helpers, entity services, and core surface shaping.

Secret exposure check:
- Blocked filter fields now reject explicitly instead of widening result sets.
- User service read surfaces now omit `externalAuthId`.
- API key read surfaces remain sanitized.

Findings:

- None.

Validation:

1. No caller-controlled org context: Pass — tenant scope still derives from trusted `ctx`.
2. Runtime credentials only: Pass — no elevated runtime credential path was introduced.
3. Defense-in-depth on new tables: N/A — this diff does not add or reclassify tables.
4. Secrets stay redacted across read surfaces: Pass — blocked-field queries reject and sensitive fields no longer leak from the reviewed service surfaces.

Outcome: `PASS`

## Recommendation

This branch is ready to serve as the new pre-API baseline. The next core step is:

- execute [core-postgres-persistence-bridge-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-postgres-persistence-bridge-plan.md)

