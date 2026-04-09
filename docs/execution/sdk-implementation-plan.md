# Orbit AI SDK Implementation Plan

Date: 2026-04-03
Status: Execution-ready baseline
Package: `@orbit-ai/sdk`
Depends on:
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
- [api-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/api-implementation-plan.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines how to execute `@orbit-ai/sdk` immediately after the API planning baseline.

The SDK does not own the wire contract. Its job is to expose one client surface that behaves the same in API mode and direct mode while preserving the route, envelope, versioning, error, and redaction behavior owned by the API plan and [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md).

## 2. SDK Objective

Deliver `@orbit-ai/sdk` as the parity client for the accepted Orbit transport contract:

1. bootstrap `packages/sdk`
2. define the shared transport, pagination, retry, and typed-error layers
3. implement HTTP transport that mirrors the accepted API contract exactly
4. implement direct transport that maps core services to the same path and envelope semantics
5. expose resource methods in two waves that follow the API route waves
6. preserve the public record-first contract while exposing raw envelopes only through `.response()` and `list()`
7. require parity and security review gates before CLI `--json` or MCP work treats SDK helpers as stable

This is an SDK milestone. It is not the CLI milestone, not the MCP milestone, and not the integrations milestone.

## 3. In Scope

Package bootstrap:

- `packages/sdk/package.json`
- `packages/sdk/tsconfig.json`
- `packages/sdk/vitest.config.ts`
- `packages/sdk/src/index.ts`

Core SDK surface:

- `client.ts`
- `config.ts`
- `errors.ts`
- `retries.ts`
- `pagination.ts`
- `search.ts`
- `transport/`
- `resources/`

Transport work:

- HTTP mode against `@orbit-ai/api`
- direct mode against `@orbit-ai/core`
- transport-private envelope handling
- typed `OrbitApiError`

Resource work:

- Wave 1 resources aligned to API Wave 1
- Wave 2 resources aligned to API Wave 2
- workflow helpers such as deal move, enroll/unenroll, search, context, schema, and webhook/import helpers where frozen in the SDK spec

Contract proof:

- parity tests across HTTP and direct mode
- response-helper tests for `.response()` and `list()`
- final review artifacts under `docs/review/`

## 4. Out Of Scope

- CLI command execution or formatting details
- MCP tool implementation
- integrations
- OpenAPI code generation as the primary source of truth
- hosted runtime specifics
- inventing SDK-only route, envelope, or error semantics that disagree with the API plan

CLI and MCP can later consume the accepted SDK response helpers. They are not part of this branch.

## 5. Required Execution Principles

1. The API plan is the parity anchor. The SDK may not reopen route, envelope, or error-shape decisions.
2. Public resource methods stay record-first.
3. `list()` returns the first-page envelope directly, and `pages().autoPaginate()` exposes the AutoPager for multi-page iteration. `.response()` is the other public affordance for raw envelopes.
4. `pages().autoPaginate()` yields records, not envelopes.
5. HTTP mode and direct mode must agree on:
   - route semantics
   - success envelope shape
   - error codes
   - cursor metadata
   - redacted read models
6. Direct mode must not use migration authority or any elevated adapter path. It uses the caller-provided trusted context only.
7. Transport internals stay package-private. CLI and MCP should later consume stable SDK affordances, not private transport details.
8. Resource waves follow API wave acceptance; do not build SDK breadth ahead of the matching API contract slice.

## 6. Delivery Slices

### Slice A. Package Bootstrap And Shared SDK Primitives

Goal:

- create `packages/sdk` and lock the package-private transport seam before resource breadth begins

Scope:

- package manifest, TS config, Vitest config, exports
- `client.ts`
- `config.ts`
- `errors.ts`
- `retries.ts`
- `pagination.ts`
- `transport/index.ts`

Required behavior:

- `packages/sdk` builds and typechecks
- `OrbitClientOptions` supports the two documented modes:
  - API mode
  - direct mode
- the package exposes one `OrbitClient`
- transport interfaces use the shared Orbit envelope types imported from `@orbit-ai/core`
- typed `OrbitApiError` exists for the public error surface

Exit criteria:

- the package exists and the shared SDK primitives compile without resource breadth

### Slice B. HTTP Transport And API Contract Baseline

Goal:

- make the HTTP client mirror the accepted API contract exactly

Scope:

- `transport/http-transport.ts`
- retry integration
- query/body/header handling
- error mapping

Required behavior:

- HTTP transport sends:
  - `Authorization: Bearer ...`
  - `Orbit-Version`
  - `Idempotency-Key` for mutating requests, with pass-through when already provided
- error responses become typed `OrbitApiError`
- transport does not reshape envelopes
- query encoding, list pagination, and include handling match the accepted API behavior
- SDK HTTP parity tests use the accepted API plan and implementation artifacts rather than reinterpreting the spec ad hoc

Required review gate:

- after Slice B, confirm the HTTP transport is not inventing headers, envelope metadata, or error behavior that diverges from the accepted API contract

Exit criteria:

- HTTP transport is stable enough to support the Wave 1 SDK resource slice

### Slice C. Direct Transport Parity Boundary

Goal:

- make direct mode behave like HTTP mode without creating a second contract

Scope:

- `transport/direct-transport.ts`
- `dispatchDirectRequest(...)` mapping
- envelope synthesis helpers
- direct-mode error coercion

Required behavior:

- direct mode requires `adapter` and trusted `context.orgId`
- direct dispatch covers the accepted API paths for the current slice rather than inventing SDK-only shortcuts
- direct mode synthesizes the same success envelope shape and cursor metadata as HTTP mode
- direct mode surfaces the same typed error codes as HTTP mode
- direct mode uses request-scoped tenant context only and does not reach migration authority

Required review gate:

- parity review after Slice C confirms direct mode is mapping to API semantics rather than raw-core convenience semantics

Exit criteria:

- HTTP and direct mode agree on the baseline contract for Wave 1 resources

### Slice D. Wave 1 Resource Surface

Goal:

- expose the first useful client surface only after the matching API wave is accepted

Dependency:

- API Wave 1 route slice from [api-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/api-implementation-plan.md) must be accepted first

Scope:

- base resource abstraction
- Wave 1 resources:
  - `contacts`
  - `companies`
  - `deals`
  - `pipelines`
  - `stages`
  - `users`
- `search`
- contact context helper
- list pagination helpers
- deal workflow helpers accepted in the matching API slice

Required behavior:

- public methods return records
- `.response()` returns the raw server envelope unchanged
- `list()` preserves raw envelope metadata (first-page envelope returned directly)
- `pages().autoPaginate()` yields records across both transports
- resource methods call canonical API paths in both transports

Required review gate:

- parity review after Wave 1 confirms the first resource wave is transport-consistent and ready for later CLI `--json` reuse through response helpers

Exit criteria:

- the first SDK surface is stable and can be consumed without reopening API contract questions

### Slice E. Wave 2 Remaining Resources

Goal:

- complete the SDK surface only after the broader API route matrix is accepted

Dependency:

- API Wave 2 route slice from [api-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/api-implementation-plan.md) must be accepted first

Scope:

- remaining resources frozen in [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md):
  - `activities`
  - `tasks`
  - `notes`
  - `products`
  - `payments`
  - `contracts`
  - `sequences`
  - `sequenceSteps`
  - `sequenceEnrollments`
  - `sequenceEvents`
  - `tags`
  - `schema`
  - `webhooks`
  - `imports`
- remaining workflow helpers:
  - deal move
  - enroll/unenroll
  - object/schema helpers
  - webhook/import helpers

Required behavior:

- resource coverage matches the SDK spec without inventing extra public surface
- direct transport only maps paths that already exist in the accepted API matrix
- secret-bearing reads remain sanitized in both modes
- schema helpers preserve the dedicated schema-route contract rather than bypassing through raw-core mutation internals

Required review gate:

- route/resource parity review after Wave 2 confirms the full SDK surface still mirrors the accepted API behavior

Exit criteria:

- the SDK surface is implementation-complete relative to the frozen spec

### Slice F. Final Parity And Security Gates

Goal:

- prove that one client works the same across both modes and is safe for downstream package reuse

Scope:

- parity test matrix
- response-helper tests
- final review artifacts

Required behavior:

- the same SDK calls produce equivalent record shapes and raw envelopes in HTTP and direct modes
- typed `OrbitApiError` is used consistently
- `.response()` and `list()` preserve server-owned `meta`, `links`, and `request_id`
- no SDK helper reconstructs or fabricates transport metadata client-side
- final review confirms the branch did not pull CLI, MCP, or integrations work forward

Required review gates:

- parity review
- security review focused on auth headers, direct-mode authority boundaries, and secret-bearing read models

Exit criteria:

- the SDK is accepted as the stable client layer that later CLI and MCP work can consume without recreating transport logic

## 7. Validation Matrix

At minimum, the SDK branch must prove:

- one `OrbitClient` works in API mode and direct mode
- HTTP transport matches the accepted API contract for headers, versioning, errors, and envelopes
- direct transport synthesizes the same envelope and error semantics
- `pages().autoPaginate()` works across both transports
- `.response()` and `list()` preserve raw envelope metadata without client-side reconstruction
- resource methods return sanitized records where the API contract requires redaction
- resource coverage matches [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md) and the accepted API route matrix

## 8. Branch Exit Criteria

The SDK implementation branch is complete when:

1. `packages/sdk` exists and builds cleanly.
2. HTTP transport is parity-accepted against the API contract.
3. Direct transport is parity-accepted against the same contract.
4. Wave 1 and Wave 2 resource surfaces match the accepted API route waves.
5. Final parity and security reviews return no blocking findings.
6. The accepted SDK surface is explicit enough that later CLI `--json` and MCP work can depend on it without reconstructing envelopes or transport metadata client-side.
