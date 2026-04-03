# Orbit AI API Implementation Plan

Date: 2026-04-03
Status: Execution-ready baseline
Package: `@orbit-ai/api`
Depends on:
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
- [core-tenant-hardening-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-tenant-hardening-plan.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [security-architecture.md](/Users/sharonsciammas/orbit-ai/docs/security/security-architecture.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines how to execute `@orbit-ai/api` now that `@orbit-ai/core` is far enough along to unblock package work.

The API is the canonical transport contract for Orbit. SDK, CLI `--json`, and MCP must align to the route, envelope, auth, versioning, and redaction behavior owned by [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md). This plan exists to turn that spec into an execution sequence without re-deciding the wire contract in downstream packages.

## 2. API Objective

Deliver `@orbit-ai/api` as the accepted HTTP contract for Orbit:

1. bootstrap the package and `createApi()` factory in `packages/api`
2. enforce API key auth through `lookupApiKeyForAuth()` rather than route-local credential shortcuts
3. enforce tenant-context and authority boundaries correctly for bootstrap, public, admin, and schema routes
4. centralize success envelopes, error envelopes, and sanitized serialization
5. deliver routes in two execution waves:
   - Wave 1 public transport baseline
   - Wave 2 remaining public, bootstrap, admin/system, schema, and webhook/import slices
6. generate OpenAPI from real route schemas
7. require contract and security review acceptance before SDK work treats the API behavior as frozen

This milestone is about the transport contract. It is not the CLI milestone, not the MCP milestone, and not an invitation to redesign hosted runtime behavior beyond what the spec already freezes.

## 3. In Scope

Package bootstrap:

- `packages/api/package.json`
- `packages/api/tsconfig.json`
- `packages/api/vitest.config.ts`
- `packages/api/src/index.ts`
- `packages/api/src/create-api.ts`
- `packages/api/src/app.ts`
- thin platform entrypoints for:
  - `@orbit-ai/api/node`
  - `@orbit-ai/api/vercel`
  - `@orbit-ai/api/cloudflare`

Transport boundary:

- request ID and version middleware
- auth middleware using `adapter.lookupApiKeyForAuth()`
- tenant-context middleware using `adapter.withTenantContext(...)`
- scope enforcement helpers
- envelope and error helpers in one shared response boundary
- read sanitization for secret-bearing objects

Route surface:

- `health`, `status`, `search`, and contact-context routes
- Wave 1 public entity routes
- Wave 2 remaining public entity routes
- bootstrap routes
- `/v1/admin/*` routes
- object/schema routes
- workflow and relationship routes
- webhook registration and delivery-read routes

Contract artifacts:

- route-schema registration
- generated `openapi.json` and `openapi.yaml`
- test coverage and review artifacts under `docs/review/`

## 4. Out Of Scope

- SDK implementation details
- CLI `--json` execution details
- MCP tool execution details
- integrations
- hosted runtime specifics beyond the frozen package entrypoints and contract seams already defined in the spec
- broad webhook worker/runtime design beyond the route contract and security boundaries already frozen in the spec
- schema-engine redesign beyond the dedicated schema routes already specified

Those all depend on this API contract being accepted first.

## 5. Required Execution Principles

1. The API spec owns route and envelope behavior. Do not re-decide it in the SDK branch.
2. `authMiddleware()` must resolve keys through `adapter.lookupApiKeyForAuth()` only. It may not query raw `api_keys` rows or reach for elevated credentials.
3. Request-serving paths must stay on runtime authority. They may not use migration authority, owner roles, `service_role`, or any other bypass credential.
4. Bootstrap routes stay outside tenant context, but they do not widen database authority.
5. Public and admin tenant routes both run inside `adapter.withTenantContext(...)`.
6. Route handlers must return through one shared envelope/error/serialization boundary.
7. Secret-bearing reads must be sanitized consistently for top-level reads and `include=` expansions.
8. OpenAPI must be generated from actual route schemas, not handwritten sidecar docs.
9. Rate limiting and idempotency may stage after the route baseline, but no accepted slice may invent behavior that conflicts with [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md).

## 6. Delivery Slices

### Slice A. Package Bootstrap And App Skeleton

Goal:

- create `packages/api` and lock the app-composition seam before route breadth begins

Scope:

- package manifest, TS config, Vitest config, exports
- `src/index.ts`
- `src/create-api.ts`
- `src/app.ts`
- config and context modules
- thin platform entrypoints

Required behavior:

- `packages/api` builds and typechecks against `@orbit-ai/core`
- `createApi()` accepts a runtime-scoped `StorageAdapter` plus version/config inputs
- the package exports are narrow and match the frozen package structure
- platform entrypoints stay thin wrappers around the same `createApi()` factory

Exit criteria:

- `pnpm --filter @orbit-ai/api build` is green once the package exists
- the package can host middleware and routes without forcing downstream contract decisions

### Slice B. Auth, Tenant Context, And Envelope Boundary

Goal:

- make the authority model, request context, and serialization boundary executable before broad route work

Scope:

- `src/middleware/request-id.ts`
- `src/middleware/version.ts`
- `src/middleware/auth.ts`
- `src/middleware/tenant-context.ts`
- `src/middleware/error-handler.ts`
- shared scope helpers
- `src/context.ts`
- `src/responses.ts`

Required behavior:

- request IDs are assigned once and flow into success and error envelopes
- `Orbit-Version` resolution is centralized
- auth hashes the presented API key and resolves it only through `lookupApiKeyForAuth()`
- request context stores `orgId`, `apiKeyId`, `scopes`, and `requestId` using the shared core context shape
- bootstrap paths bypass tenant context; public and admin tenant paths do not
- route code does not emit ad hoc envelopes or raw errors
- serialization helpers own:
  - `{ data, meta, links }`
  - error envelope mapping
  - sanitized webhook and webhook-delivery reads
  - nested sanitization for `include=` payloads

Required review gate:

- run a contract/security review after Slice B to confirm auth lookup, tenant-context boundaries, and envelope/error ownership are correct before route breadth is added

Exit criteria:

- middleware order is fixed and review-accepted
- one shared response boundary exists for all later routes

### Slice C. Wave 1 Public Route Slice

Goal:

- prove the public transport contract on the smallest useful route surface before the broader matrix lands

Scope:

- `GET /health`
- `GET /v1/status`
- `POST /v1/search`
- `GET /v1/context/:contactId`
- public route registration for the first contract slice:
  - `contacts`
  - `companies`
  - `deals`
  - `pipelines`
  - `stages`
  - `users`

Required behavior:

- public list/get/create/update/delete/search routes use shared middleware and envelope helpers
- public `batch` only exists where the capability map allows it
- scope checks distinguish read vs write paths
- route resolution goes through core services only
- cursor pagination, `include=`, and `links.self` are consistent on the Wave 1 surface
- no bootstrap, admin/system, or schema routes are pulled into this slice

Required review gate:

- contract review after Wave 1 confirms route naming, envelope metadata, and public redaction are stable enough to anchor the first SDK resource wave

Exit criteria:

- the Wave 1 transport baseline is accepted as the first downstream parity target

### Slice D. Wave 2 Remaining Public And System Slice

Goal:

- complete the route matrix without weakening the boundaries proven in Slices B and C

Scope:

- remaining public entity routes:
  - `activities`
  - `tasks`
  - `notes`
  - `products`
  - `payments`
  - `contracts`
  - `sequences`
  - `sequence_steps`
  - `sequence_enrollments`
  - `sequence_events`
  - `tags`
  - `webhooks`
  - `imports`
- relationship and workflow endpoints
- bootstrap routes
- `GET/PATCH /v1/organizations/current`
- `/v1/admin/*` routes
- `/v1/objects*` and `/v1/schema/migrations/*` routes

Required behavior:

- admin/system entities stay under explicit `/v1/admin/*` routing rather than the public registry
- bootstrap routes remain separate and do not enter tenant context
- schema routes stay explicit and do not leak migration authority into generic entity request paths
- workflow endpoints resolve through core services rather than route-local joins or one-off repo calls
- webhook and webhook-delivery reads remain sanitized across public and admin surfaces
- the route surface matches the matrix frozen in [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)

Required review gate:

- route-matrix review after Slice D confirms the API surface is complete without pulling CLI, MCP, or integrations work forward

Exit criteria:

- the real route surface is implementation-complete relative to the spec matrix

### Slice E. Contract Hardening, Idempotency, Rate Limiting, And OpenAPI

Goal:

- finish the cross-cutting transport contract and publish the artifacts downstream packages will verify against

Scope:

- `src/middleware/rate-limit.ts`
- `src/middleware/idempotency.ts`
- route schemas and OpenAPI registry
- generated OpenAPI artifacts
- final review artifacts

Required behavior:

- mutating routes accept or generate `Idempotency-Key`
- idempotency state uses the accepted core idempotency storage/service boundary rather than ad hoc route memory
- same key plus same route plus same body replays the stored response
- same key plus different body returns `409 IDEMPOTENCY_CONFLICT`
- rate limiting emits the documented headers and `Retry-After`
- OpenAPI is generated from route schemas and written to:
  - `packages/api/openapi/openapi.json`
  - `packages/api/openapi/openapi.yaml`
- the final review confirms that API request paths still do not reach migration authority

Required review gates:

- contract review on the generated OpenAPI and live route behavior
- security review on auth, tenant context, idempotency, secret redaction, and webhook boundaries

Exit criteria:

- the API contract is accepted as the source of truth for SDK parity work

## 7. Validation Matrix

At minimum, the API branch must prove:

- auth middleware uses `lookupApiKeyForAuth()` and rejects revoked/expired keys
- bootstrap routes bypass tenant context while admin/public tenant routes do not
- request-serving code cannot reach migration authority
- all responses flow through the shared success/error boundary
- secret-bearing reads are sanitized on top-level and included records
- public/admin/schema/bootstrap routes match the documented route matrix
- idempotency and rate-limit behavior match the spec once Slice E lands
- generated OpenAPI reflects the real route surface

## 8. Branch Exit Criteria

The API implementation branch is complete when:

1. `packages/api` exists and builds cleanly.
2. The middleware and serialization boundary are review-accepted.
3. The route matrix from [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md) is implemented.
4. Generated OpenAPI is present and contract-reviewed.
5. Final contract and security reviews return no blocking findings.
6. The accepted API behavior is explicit enough that the SDK can use it as a parity anchor without reopening route or envelope decisions.
