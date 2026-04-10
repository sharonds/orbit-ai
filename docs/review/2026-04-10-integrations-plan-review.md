# 2026-04-10 Integrations Implementation Plan Review

Reviewed file: `docs/execution/integrations-implementation-plan.md`
Reviewer: GitHub Copilot
Status: Reviewed with issues

## Scope

This review validates `docs/execution/integrations-implementation-plan.md` against:

- `docs/specs/06-integrations.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/META-PLAN.md`
- `CLAUDE.md`
- current repository state under `packages/`

The goal is to determine whether the plan is execution-ready and whether any assumptions or directives in the plan conflict with the current codebase or canonical documentation.

## Executive Summary

The plan is strong overall and is grounded in the current repository state. Its major prerequisite claims are real:

- `packages/integrations` does not exist yet
- the CLI integrations command is still a stub
- the MCP package currently exposes a fixed 23-tool registry with no extension seam
- the SDK currently lags core on activity and payment field parity
- core already exposes a plugin schema extension contract that can support connector-owned tables

However, the plan is not fully clean as written. A small set of issues should be corrected before treating it as the authoritative execution baseline.

## Validated Findings

### 1. The package and prerequisite seams are genuinely missing

Confirmed in the current repo:

- `packages/integrations` is not present under `packages/`
- `packages/cli/src/commands/integrations.ts` throws `CliNotImplementedError`
- `packages/mcp/src/server.ts` registers tools from `buildTools()` directly
- MCP tests still assert the fixed 23-tool surface

This validates the need for the plan's package scaffold and consumer-wiring prerequisites.

### 2. Prerequisite A is based on real SDK/core drift

The plan's SDK parity callout is accurate.

Evidence:

- `packages/sdk/src/resources/activities.ts` currently exposes `description`, but core activities are modeled with `body`, `direction`, `durationMinutes`, `outcome`, and `metadata`
- `packages/sdk/src/resources/payments.ts` currently exposes `payment_method`
- `packages/core/src/schema/tables.ts` defines payments with `method`, `externalId`, and `metadata`

This means the plan correctly identifies a real contract mismatch that would affect integrations work.

### 3. Core already has the right extension concept for connector-owned tables

`packages/core/src/adapters/interface.ts` already defines:

- `PluginSchemaExtension`
- `PluginSchemaRegistry`

This supports the general approach in the plan for `integration_connections` and `integration_sync_state` to register through a core schema-extension seam.

## Issues Found

### Issue 1: Per-slice validation command is inconsistent and not shell-safe

The plan says:

- `pnpm --filter @orbit-ai/integrations build && test && typecheck`

As written, that is not a safe command chain because only the first segment is prefixed with `pnpm`.

There is also an internal inconsistency:

- the slice-level "done" definition mentions build + test + typecheck
- section 5.1 says the done definition is build + tests + lint pass
- section 5.4 separately requires lint before every commit

#### Recommendation

Use one consistent validation definition everywhere, for example:

- `pnpm --filter @orbit-ai/integrations build`
- `pnpm --filter @orbit-ai/integrations test`
- `pnpm --filter @orbit-ai/integrations typecheck`
- `pnpm --filter @orbit-ai/integrations lint`

Or replace all of these with one package-level validation script and reference only that.

### Issue 2: Stripe CLI alias wording conflicts with the existing core `payments` command

The plan describes top-level aliases such as:

- `orbit payments link create`
- `orbit payments sync stripe`

But `packages/cli/src/program.ts` already registers the core `payments` command via `registerPaymentsCommand(program)`, and `packages/cli/src/commands/payments.ts` already owns the `payments` command tree.

#### Recommendation

Update the plan wording so Stripe integration work either:

- extends the existing `orbit payments` command tree with integration-specific subcommands, or
- keeps Stripe integration commands under `orbit integrations stripe ...`

The plan should not describe `payments` as a new top-level alias seam.

### Issue 3: Tenant-safety language is more implementation-specific than necessary

The plan requires helper-level `withTenantContext` wrapping for contact/company lookups.

That intent is correct, but the current architecture already enforces tenant scoping through the SDK direct transport:

- `packages/sdk/src/transport/direct-transport.ts` wraps requests in `adapter.withTenantContext(...)`

For API mode, integrations should not need to reach down and manually drive tenant context at helper level.

#### Recommendation

Rephrase these requirements to focus on behavior rather than one implementation detail. Example:

- all contact/company lookups must remain tenant-scoped through the runtime client/adapter boundary
- negative cross-org tests must prove isolation

This preserves the safety requirement without over-constraining the implementation.

### Issue 4: Repository docs are out of sync with the revised plan

There is clear doc drift:

- `docs/KB.md` still describes integrations as a 17-slice effort
- `docs/KB.md` still says all 6 packages will publish as `0.1.0-alpha.0`
- the reviewed plan says 23 slices and references `0.1.0-alpha.1` after `alpha.0` is already tagged
- `CLAUDE.md` still frames the repo as five implemented packages and integrations as not yet implemented

This is not a code blocker, but it is an execution risk because multiple docs now describe different baselines.

#### Recommendation

If this plan is the accepted baseline, reconcile at minimum:

- `docs/KB.md`
- any other execution summary doc that still references the older integrations rollout
- optionally `CLAUDE.md` for clarity on current package status and release sequencing

### Issue 5: Acceptance wording is slightly ambiguous for Gmail command coverage

The plan intentionally follows the spec example that Gmail has MCP tools but no CLI commands.

That is reasonable, but the acceptance wording can be read as if every connector must expose commands.

#### Recommendation

Clarify the acceptance wording to say:

- each connector exposes installation logic, tools, sync handlers, and commands where applicable per spec

Or explicitly note that Gmail CLI commands are intentionally empty.

### Issue 6: The prerequisite wording is stricter than the actual compilation boundary

The plan says consumer CLI/MCP seams must be completed before integration tool/command slices can compile.

That is stronger than necessary. The integrations package can still define:

- integration command types
- integration tool types
- dynamic registration helpers

before the consuming packages are wired to call them.

#### Recommendation

Soften the wording to say these prerequisites are required before:

- end-to-end consumer wiring
- cross-package validation
- final integration registration tests

rather than before those slices can compile at all.

## Overall Assessment

The plan is directionally correct and mostly well-structured. Its main assumptions are validated by the current repository state, and it correctly identifies real prerequisite gaps.

The issues found are not architectural showstoppers. They are mostly:

- command-definition drift
- wording that overstates coupling or sequencing
- documentation drift with surrounding repo docs

## Recommendation

Treat the plan as execution-capable after a targeted cleanup pass.

### Must-fix before relying on it as the baseline

1. Fix the per-slice validation command and "done" definition inconsistency
2. Fix the `orbit payments` alias wording so it reflects the existing CLI surface
3. Rephrase tenant-scoping requirements to be behavior-focused rather than tied to one helper-level implementation detail

### Should-fix soon after

4. Reconcile `docs/KB.md` with the revised integrations plan
5. Clarify the Gmail no-CLI-command expectation in acceptance wording
6. Relax the prerequisite wording from compile blocker to wiring/e2e blocker

## Referenced Evidence

- `docs/execution/integrations-implementation-plan.md`
- `docs/specs/06-integrations.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/META-PLAN.md`
- `docs/KB.md`
- `CLAUDE.md`
- `packages/cli/src/commands/integrations.ts`
- `packages/cli/src/commands/payments.ts`
- `packages/cli/src/program.ts`
- `packages/mcp/src/server.ts`
- `packages/mcp/src/tools/registry.ts`
- `packages/sdk/src/resources/activities.ts`
- `packages/sdk/src/resources/payments.ts`
- `packages/sdk/src/transport/direct-transport.ts`
- `packages/core/src/adapters/interface.ts`
- `packages/core/src/schema/tables.ts`
