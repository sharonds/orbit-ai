# Core Tenant Hardening — Plan vs Execution Review

Date: 2026-04-03
Branch: core-tenant-hardening (worktree)
Base: a12f4e4 (main after Wave 2 Slice E merge)

## Scope Confirmation

This branch contains tenant hardening only:
- [x] Postgres-family RLS DDL generation (Slice A+B)
- [x] Postgres bootstrap integration for RLS (Slice C)
- [x] Org-leading index audit and DDL (Slice D)
- [x] Proof harness and adapter proofs (Slice E)

Not pulled forward:
- [ ] API route implementation
- [ ] SDK transport or direct-mode implementation
- [ ] CLI or MCP transport work
- [ ] Schema-engine mutation execution
- [ ] Audit middleware or idempotency replay middleware

## Intentional Spec Deviations

1. **Shared allowlist source of truth** (Slice A): `rls.ts` imports `IMPLEMENTED_TENANT_TABLES` from `tenant-scope.ts` instead of defining a module-local `TENANT_TABLES` const as shown in the frozen spec (01-core.md §9). Rationale: single source of truth per Execution Principle 6.

2. **Idempotent policy creation** (Slice B): Added `DROP POLICY IF EXISTS` before each `CREATE POLICY`. The frozen spec uses bare `CREATE POLICY` which would throw on re-bootstrap. This is a spec gap fix, not a deviation from intent.

3. **Separate RLS bootstrap function** (Slice C): Created `applyPostgresRlsDdl(db)` as a standalone function rather than embedding RLS statements into `initializePostgresWave2SliceESchema`. Rationale: pg-mem test infrastructure doesn't support RLS DDL, so separation keeps existing tests green while still providing the bootstrap primitive.

## Org-Leading Index Audit

### Indexes Added (15 tables)
| Table | Index | Justification |
|-------|-------|---------------|
| api_keys | `api_keys_org_idx (organization_id)` | Admin list per org |
| stages | `stages_org_idx (organization_id)` | Org-scoped list queries |
| deals | `deals_org_idx (organization_id)` | Core CRM list per org |
| activities | `activities_org_idx (organization_id)` | Activity feed per org |
| tasks | `tasks_org_idx (organization_id)` | Task list per org |
| notes | `notes_org_idx (organization_id)` | Notes per org |
| products | `products_org_idx (organization_id)` | Product catalog per org |
| contracts | `contracts_org_idx (organization_id)` | Contract list per org |
| sequence_steps | `sequence_steps_org_idx (organization_id)` | RLS filter support |
| sequence_enrollments | `sequence_enrollments_org_idx (organization_id)` | RLS filter support |
| sequence_events | `sequence_events_org_idx (organization_id)` | RLS filter support |
| imports | `imports_org_idx (organization_id)` | Import history per org |
| webhooks | `webhooks_org_idx (organization_id)` | Webhook list per org |
| webhook_deliveries | `webhook_deliveries_org_idx (organization_id)` | RLS filter support |
| schema_migrations | `schema_migrations_org_idx (organization_id)` | Migration history per org |

### Tables With Existing Org-Leading Coverage (12 tables — no change needed)
users, organization_memberships, companies, contacts, pipelines, sequences, tags, entity_tags, payments, custom_field_definitions, audit_logs, idempotency_keys

### Intentional Exceptions
None — all 27 tenant tables now have org-leading index coverage.

## SQLite Impact

SQLite remains unchanged. All new functions (`applyPostgresRlsDdl`, `applyPostgresOrgLeadingIndexes`, `generatePostgresRlsSql`) are Postgres-specific. SQLite enforces tenant isolation through application-level org filters in repositories.

## Security Review Answers

1. Does every implemented tenant table now receive Postgres-family RLS coverage? **Yes** — 27/27 tables covered by `generatePostgresRlsSql()`, verified by drift detection test.
2. Can any request-path runtime code bypass tenant isolation? **No** — runtime paths use least-privilege credentials; RLS + app-layer filters remain in place.
3. Does the shared allowlist make missing tenant-table registration a test failure? **Yes** — drift detection test fails if a table is added to `IMPLEMENTED_TENANT_TABLES` but not covered by RLS.
4. Did any bootstrap or adapter change widen migration authority into runtime paths? **No** — `applyPostgresRlsDdl` and `applyPostgresOrgLeadingIndexes` are documented as migration-authority-only.
5. Are the new indexes justified by actual tenant-scoped access patterns? **Yes** — all repositories use shared helpers that filter on `organization_id` for list/search.
