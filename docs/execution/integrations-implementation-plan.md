# Orbit AI Integrations Implementation Plan

Date: 2026-04-10
Status: Execution-ready baseline
Package: `@orbit-ai/integrations`
Depends on:
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [core-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/core-implementation-plan.md)
- [api-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/api-implementation-plan.md)
- [sdk-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/sdk-implementation-plan.md)
- [mcp-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/mcp-implementation-plan.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)

## 1. Purpose

This document defines how to execute `@orbit-ai/integrations` as the next package track after the MCP package reaches merge readiness.

The integrations package is the reusable connector/runtime boundary for Orbit. It is not the CLI wrapper, not the MCP wrapper, and not a place to bypass accepted API or SDK contracts. Its job is to provide stable integration primitives, one narrow reference integration, safety boundaries, mapping behavior, and enough test proof to support later CLI and MCP exposure without reworking the package contract.

This document is intentionally precise because it will be executed by AI sub-agents without human clarification. Agents must follow this plan rather than inventing connector breadth, package boundaries, or command surfaces ad hoc during implementation.

## 2. Current Position

Current repository state:

- `@orbit-ai/core`, `@orbit-ai/sdk`, and `@orbit-ai/api` are on `main`
- `@orbit-ai/cli` is complete per the KB and is no longer the active package track
- `@orbit-ai/mcp` is implemented locally, split into reviewable commits, and verified with passing tests/build/typecheck
- `packages/integrations` does not exist yet

This means the next implementation task is the integrations package itself.

Related but separate follow-up work:

- CLI wiring for MCP or integrations commands is not this package track
- MCP exposure of integration capabilities is not this package track
- Both wrapper layers should come after the package contract is stable enough to expose externally

## 3. Objective

Deliver `@orbit-ai/integrations` as the first reusable connector/runtime package for Orbit:

1. bootstrap `packages/integrations`
2. define one shared connector contract and runtime boundary
3. implement one narrow reference integration end-to-end
4. prove mapping, execution, error, and safety behavior with tests
5. run code review, security review, and alignment review in parallel
6. fix validated findings before merge
7. update repo knowledge and review artifacts for merge readiness

This is a package milestone. It is not permission to build broad connector coverage, broaden the CLI surface, or expose speculative MCP tools before the package contract is accepted.

## 4. In Scope

Package bootstrap:

- `packages/integrations/package.json`
- `packages/integrations/tsconfig.json`
- `packages/integrations/vitest.config.ts`
- `packages/integrations/src/index.ts`
- `packages/integrations/README.md`

Runtime boundary:

- shared connector definition contract
- integration config and credentials boundary
- execution context and result envelope
- structured integration error model
- retry and idempotency helpers
- redaction and logging helpers
- capability discovery metadata

Reference implementation:

- one narrow first-party reference integration
- one realistic execution path from Orbit data to external payload shape
- one explicit failure path with structured surfaced errors

Contract proof:

- unit tests for runtime contracts
- unit tests for mapping behavior
- unit tests for retries and structured errors
- unit tests for redaction and secret-safe logging
- integration tests for reference connector execution
- end-to-end happy path and failure path coverage
- review artifacts under `docs/review/`

## 5. Out Of Scope

- broad connector catalog in the first branch
- integration-specific CLI UX or command breadth
- MCP tools that wrap incomplete integration internals
- direct raw network abstractions for unbounded third-party APIs
- speculative sync engines that are not exercised by the reference integration
- long-running orchestration or scheduling infrastructure

If the package needs a seam in another package, the default fix is to add a narrow shared export or contract there first, not to bypass boundaries from inside `@orbit-ai/integrations`.

## 6. Required Execution Principles

### 6.1 Package Boundary

1. `@orbit-ai/integrations` owns connector/runtime logic, not terminal UX and not MCP server behavior.
2. CLI and MCP wrappers are downstream consumers of this package and must not be implemented early just to make demos easier.
3. Connector definitions must be explicit TypeScript objects with documented capability metadata and validation requirements.
4. Every external-facing operation must return structured machine-readable results, not free-form prose.
5. The first implementation branch should prioritize contract correctness and safety over connector breadth.

### 6.2 Security And Safety

6. Credentials must never be logged or surfaced raw in errors, debug output, or test snapshots.
7. Redaction must be defense-in-depth: both shared error conversion and connector-specific serialization must sanitize secrets.
8. Retry logic must be bounded and explicit; no unbounded loops or silent retry storms.
9. Tenant and organization context must remain explicit in every execution boundary; integrations may not infer or default scope silently.
10. Configurable outbound targets must be validated and constrained; no blind URL forwarding or raw request passthrough helpers.
11. Unsupported capabilities must fail structurally with a typed error, not with partial fake behavior.
12. Idempotency expectations must be explicit for write operations that may be retried.

### 6.3 Testing And Review

13. The package is not merge-ready without tests, even if the reference integration appears to work manually.
14. Review is a required phase, not a nice-to-have. Code review, security review, and alignment review must run in parallel before merge.
15. All validated findings must be fixed before merge unless they are documented as explicit non-blocking follow-ups.
16. A final review pass must confirm plan-versus-execution alignment after fixes are in.

## 7. Implementation Strategy

The branch should be executed in a small-commit sequence. Each slice must leave a coherent review point and must not mix unrelated work.

### Slice A: Package Scaffold

Create the package shell and build/test entrypoints:

- `packages/integrations/package.json`
- `packages/integrations/tsconfig.json`
- `packages/integrations/vitest.config.ts`
- `packages/integrations/src/index.ts`
- `packages/integrations/README.md`

Requirements:

- strict TypeScript
- package-local `build`, `test`, and `typecheck` scripts
- exports only for symbols that will remain stable after the branch
- no premature dependency sprawl

Suggested commit:

- `feat(integrations): scaffold package runtime`

### Slice B: Shared Runtime Contracts

Add the core primitives:

- `IntegrationDefinition`
- `IntegrationContext`
- `IntegrationCredentials`
- `IntegrationCapabilities`
- `IntegrationExecutionResult`
- `IntegrationError`
- `toIntegrationError()`
- redaction helpers
- bounded retry helpers
- idempotency helpers

Requirements:

- all inputs validated at runtime
- structured error codes
- connector capability metadata represented explicitly
- secret-safe string serialization

Suggested commit:

- `feat(integrations): add shared connector contracts`

### Slice C: Reference Integration

Implement one narrow reference integration only.

Selection rules:

- avoid broad bidirectional sync for v1
- prefer a narrow outbound integration shape
- prove config validation, payload mapping, execution, and structured failure handling

Required behavior:

- validate config and credential inputs
- map Orbit-side input into connector payloads
- execute one real connector flow through the runtime contract
- return a stable result envelope
- surface unsupported features through typed errors

Suggested commit:

- `feat(integrations): implement reference integration`

### Slice D: Mapping, Safety, And Observability

Add the cross-cutting production boundaries:

- field mapping and normalization helpers
- identity matching rules
- conflict handling policy
- redacted logs/debug serialization
- retry boundary wiring
- idempotent write protection expectations
- audit/event hooks if required by the chosen connector contract

Requirements:

- free-form payload fields must be bounded
- errors must preserve diagnosis without leaking secrets
- connector code must not embed direct package-specific logging assumptions

Suggested commit:

- `feat(integrations): add mapping and safety guards`

### Slice E: Tests And End-To-End Proof

Add test coverage in layers:

- runtime contract unit tests
- validation tests
- mapping tests
- error conversion tests
- retry behavior tests
- redaction tests
- reference integration execution tests
- end-to-end happy path test
- end-to-end failure path test

Required assertions:

- results are structured
- secrets are redacted
- unsupported capability paths return typed errors
- retries are bounded
- organization/tenant context is required where expected

Suggested commit:

- `test(integrations): add contract and e2e coverage`

### Slice F: Docs And Review Closeout

After implementation and review:

- update `docs/KB.md`
- add review artifact documents under `docs/review/`
- record verification counts and merge readiness
- document any explicitly deferred follow-up work

Suggested commit:

- `docs(integrations): record execution and review closeout`

## 8. Verification Matrix

Minimum required verification:

- `pnpm --filter @orbit-ai/integrations test`
- `pnpm --filter @orbit-ai/integrations typecheck`
- `pnpm --filter @orbit-ai/integrations build`

Run additional verification if cross-package seams change:

- dependent package build(s)
- targeted dependent tests

The branch is not merge-ready if any of these are skipped without explicit reason.

## 9. End-To-End Coverage Requirements

The E2E suite must prove more than isolated helper behavior.

Happy path coverage must prove:

1. valid config and credentials are accepted
2. Orbit-side input is normalized correctly
3. mapping produces the expected external payload shape
4. execution succeeds through the shared runtime
5. the returned result envelope is structured and stable

Failure path coverage must prove:

1. invalid config is rejected structurally
2. bounded retries behave as expected
3. final surfaced errors are typed and redacted
4. no partial-success path is reported as success
5. tenant or organization context failures are surfaced clearly

## 10. Parallel Review Plan

When the branch is green, run these review lanes in parallel:

### Review Lane A: Code Review

Focus:

- correctness
- contract clarity
- abstraction quality
- mapping assumptions
- missing tests
- package-coupling mistakes

Expected output:

- findings only
- file references
- severity ordering
- explicit statement if there are no blocking findings

### Review Lane B: Security Review

Focus:

- credential handling
- secret leakage
- tenant isolation and org scoping
- SSRF or raw-network abuse paths
- unsafe retries
- weak transport or serialization boundaries

Expected output:

- findings only
- file references
- severity ordering
- explicit statement if there are no blocking findings

### Review Lane C: Plan-Alignment Review

Focus:

- package boundaries
- whether CLI or MCP surfaces were pulled in too early
- whether implementation matches this plan
- whether docs, tests, and exported contract agree

Expected output:

- misalignments only
- file references where useful
- explicit statement if there are no blocking alignment findings

### Optional Review Lane D: Test Review

Focus:

- E2E realism
- negative-path coverage
- flakiness risk
- over-mocking that hides real behavior gaps

This lane is useful if the branch grows beyond the expected narrow scope.

## 11. Findings Triage Rules

All review findings must be categorized before final merge readiness:

- `must-fix` before merge
- `acceptable-follow-up`
- `rejected` with reasoning

Do not merge with unresolved high-severity findings.
Do not hide issues by reclassifying them without written rationale.

## 12. Final Review And Merge Gate

After fixes land:

1. rerun the verification matrix
2. rerun a lightweight final review pass
3. confirm the branch still matches the plan
4. update KB and review artifacts
5. confirm no known blocking issues remain

Merge gate:

- package tests pass
- package typecheck passes
- package build passes
- dependent verification passes if relevant
- review lanes are complete
- all required fixes are in
- docs are updated
- deferred work is explicitly listed and non-blocking

## 13. Relationship To CLI And MCP

This package track must stay separate from wrapper work.

Correct sequencing:

1. finish and merge `@orbit-ai/mcp`
2. implement and merge `@orbit-ai/integrations`
3. add CLI commands that wrap stable MCP and integration package seams
4. add MCP exposure for integrations only when the package contract is stable enough to support it cleanly

This separation is intentional. Building CLI or MCP wrappers too early couples unstable package internals to user-facing command or tool surfaces and increases rework.

## 14. Recommended Branch Closeout Sequence

1. implement slices A through E in small commits
2. run verification
3. run code review, security review, and alignment review in parallel
4. fix validated findings
5. rerun verification
6. run final review
7. update KB and review docs
8. merge if clean

## 15. Definition Of Done

The integrations task is complete when:

- `packages/integrations` exists and is buildable
- the connector/runtime contract is explicit and stable enough for downstream use
- one reference integration is implemented end-to-end
- unit, integration, and E2E coverage are in place
- parallel reviews ran and their validated findings were fixed
- final verification is green
- KB and review artifacts are updated
- the branch is ready to merge without known blocking gaps
