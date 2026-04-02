# Core Wave 2 Slice D Review

Date: 2026-04-02
Branch: `core-wave-2-slice-d`
Reviewer: Codex
Status: Accepted after final remediation and independent review rerun

## Executive Summary

The reopened Slice D findings are now fixed, and the branch is back to an accepted state.

This branch now includes:

- `imports.update(...)` revalidates `startedByUserId` inside the same tenant
- `imports.completedAt` stays coupled to terminal lifecycle states
- `entity_tags.tagId` and `webhook_deliveries.webhookId` require same-tenant parent resolution on write paths
- the frozen `imports.rollbackData` and `webhook_deliveries` persisted fields were restored
- tenant-facing import reads now omit `rollbackData`
- generic webhook-delivery admin reads omit sensitive delivery internals
- legacy `webhooks.status` rows now normalize to the canonical `active|disabled` read model on in-memory, SQLite, and Postgres reads
- SQLite and Postgres proof coverage exercises the Slice D relation, redaction, and legacy-compatibility cases directly

The final independent code review and security review rerun found no remaining blocking issues in Slice D scope.

## Validation Summary

Executed successfully:

- `pnpm --filter @orbit-ai/core test`
- `pnpm --filter @orbit-ai/core typecheck`
- `pnpm --filter @orbit-ai/core build`
- `git diff --check`

Observed results:

- `203` tests passed across `49` test files
- no type errors
- build completed successfully
- no diff formatting issues

## Code Review Result

No blocking code-review findings remain in Slice D scope.

Confirmed:

- service registry shape still matches the Slice D plan
- `system.entityTags` and `system.webhookDeliveries` remain read-only
- tenant-facing import DTOs no longer expose `rollbackData`
- legacy webhook rows normalize on `get`, `list`, and `search`, with in-memory plus SQLite/Postgres persistence coverage
- SQLite and Postgres persistence proofs cover the Slice D entities and the hardened relation checks
- no Slice E metadata work, transport workflows, or schema-engine authority behavior were pulled forward

## Security Review Result

No blocking security findings remain in Slice D scope.

Confirmed:

- import reads strip `rollbackData` at the service boundary while persistence keeps the operational field stored
- webhook service reads redact `secretEncrypted` on `create`, `get`, `list`, and `search`
- webhook-delivery admin reads omit `payload`, `signature`, `idempotencyKey`, and `responseBody`
- legacy webhook status normalization preserves backward-compatible reads without reopening secret surfaces
- `entity_tags` and `webhook_deliveries` reject cross-tenant parent references on in-memory, SQLite, and Postgres write paths
- `imports.startedByUserId` rejects foreign-tenant user references on both create and update
- no Slice D request-path code reaches migration authority or privileged raw adapter surfaces

## Plan Vs Execution Result

Slice D now matches the accepted Wave 2 Slice D plan.

Delivered:

- tenant services: `tags`, `imports`, `webhooks`
- admin/system services: `system.entityTags`, `system.webhookDeliveries`
- contact-context tag integration
- restored persisted metadata fields and explicit delivery redaction behavior
- tenant-facing import DTO sanitization and legacy webhook-status normalization
- SQLite/Postgres validation and regression coverage for the touched entity set

Carry-forward items that remain intentionally out of scope for this branch:

- Postgres RLS DDL and broader tenant-hardening follow-up work
- Slice E metadata entities
- transport-layer webhook workflows
- schema-engine mutation work

## Documentation Result

Updated on this branch:

- [docs/specs/01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [docs/KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

These updates now also record the reopened-review remediation and the final accepted rerun outcome.
