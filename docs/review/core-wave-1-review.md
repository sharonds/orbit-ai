# Core Wave 1 Review

Date: 2026-03-31
Branch: `core-wave-1-services`
Scope:
- [core-wave-1-services-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-wave-1-services-plan.md)
- `@orbit-ai/core` Wave 1 service surface

## Outcome

Wave 1 is implemented locally at the service-contract level and passes the current validation suite.

Validation passed:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

## Code Review

No critical or high implementation defects were found in the Wave 1 patch set.

What is now in place:

- tenant CRUD services for `companies`, `contacts`, `pipelines`, `stages`, `deals`, `users`, and `api_keys`
- admin/system read services for `organizations`, `organizationMemberships`, and `apiKeys`
- `search` and `contactContext` service surfaces
- `createCoreServices(adapter, overrides)` registry wiring
- CRUD/list/search coverage for the tenant-scoped Wave 1 entities

## Security Review

No critical or high tenant-safety issues were found.

What passed:

- tenant scope is derived from `ctx.orgId`, not caller-provided `organizationId`
- repository reads and mutations stay organization-scoped for tenant entities
- admin/system services remain structurally separate from tenant CRUD services
- the service surface does not use migration authority
- contact/company and deal/stage/pipeline relationship checks reject cross-graph misuse inside a tenant

## Plan vs Execution Review

No critical or high plan drift was found, but two medium gaps remain:

1. `createCoreServices(adapter)` currently proves the Wave 1 registry using in-memory repositories rather than adapter-backed persistence. This is enough to validate service contracts and downstream planning shape, but not enough to claim full storage-backed core completion.
2. `search` is intentionally bounded and aggregates per-entity results in memory. That matches the “good enough to unblock downstream planning” bar, but it is not the final scalable search implementation.

## Recommendation

Accept Wave 1 as the service-surface milestone.

Do not move straight into API or SDK implementation on the assumption that storage-backed service execution is finished. The next core decision should be:

1. either add an adapter-backed repository integration slice before Wave 2
2. or explicitly accept Wave 1 as a contract/proof milestone and plan that persistence bridge as the next core follow-up

If the current goal is to keep broadening core, Wave 2 planning can start in parallel with that decision, but API-facing execution should wait until the repository-to-adapter bridge is explicit.
