# Orbit AI Database Hardening Checklist

Date: 2026-03-31
Status: Draft
Applies to:
- Supabase
- Neon
- raw Postgres
- SQLite for local development and adapter compatibility work only

Use this checklist before exposing a new table, route, connector, or environment.

## 1. Role and Privilege Hardening

### 1.1 Required

- [ ] separate `migration_role` from `app_role`
- [ ] ensure runtime roles cannot `ALTER`, `CREATE POLICY`, `DROP`, or install extensions
- [ ] revoke unnecessary default privileges from `public`
- [ ] pin `search_path` for runtime roles
- [ ] keep bootstrap or platform-admin database access separate from tenant runtime access

### 1.2 Release Blockers

- [ ] no request-serving path uses Supabase `service_role`
- [ ] no shared admin credential is reused for ordinary tenant CRUD
- [ ] no environment stores production migration credentials where runtime code can access them

## 2. Tenant Isolation and RLS

### 2.1 Table-Level Rules

- [ ] every tenant table has `organization_id not null`
- [ ] `organizations` is treated as bootstrap-scoped, not as a tenant table
- [ ] plugin and connector tenant tables are registered as tenant-scoped

### 2.2 Enforcement Rules

- [ ] RLS is enabled on every tenant table for Postgres-family adapters
- [ ] `select`, `insert`, `update`, and `delete` policies exist for each tenant table
- [ ] repositories still include explicit org filters even with RLS enabled
- [ ] direct-core and API paths both route tenant work through `withTenantContext(...)`

### 2.3 Release Blockers

- [ ] no tenant route can access data without tenant context
- [ ] no table is exposed publicly before RLS and app-layer filtering are both in place
- [ ] at least one cross-tenant deny test exists for each major entity group

## 3. Tenant Context Safety

### 3.1 Postgres-Family Adapters

- [ ] tenant context is set inside a transaction
- [ ] transaction-local settings are used, not connection-global settings
- [ ] tenant context cleanup is guaranteed on success and failure

### 3.2 Pooling Safety

- [ ] behavior is tested under pooled connections
- [ ] pgbouncer or Supabase pooler behavior is verified for transaction-bound context

### 3.3 Release Blockers

- [ ] no code path relies on connection-global session state for tenant isolation
- [ ] no shared transaction wrapper can leak `app.current_org_id` across requests

## 4. Schema and Migration Controls

### 4.1 Required

- [ ] migrations run only under `migration_role`
- [ ] migration execution is serialized with advisory lock or equivalent
- [ ] rollback metadata is recorded
- [ ] destructive changes require explicit approval and stronger environment guards
- [ ] plugin extension tables are registered before migration execution

### 4.2 Pre-Production Checks

- [ ] backup, branch, or snapshot exists before destructive migration
- [ ] preview output is reviewed before apply
- [ ] migration audit trail records actor, environment, and result

### 4.3 Release Blockers

- [ ] runtime app credentials cannot run schema migrations
- [ ] destructive migrations cannot run silently in production

## 5. API Key Storage and Access

### 5.1 Required

- [ ] only hashed API keys are stored
- [ ] visible prefix is stored separately for lookup and support
- [ ] scopes, expiry, revoked timestamp, and last-used metadata are recorded
- [ ] API key actions are audited

### 5.2 Release Blockers

- [ ] no plaintext API key storage
- [ ] no key material in logs, audit rows, MCP output, or CLI JSON
- [ ] key rotation and revocation are tested

## 6. Secret Storage and Encryption

### 6.1 Required

- [ ] webhook secrets are encrypted at rest
- [ ] connector access and refresh tokens are encrypted at rest
- [ ] provider webhook secrets are encrypted or sourced from external secret management
- [ ] decryption is limited to the process that needs the secret

### 6.2 Redaction Rules

- [ ] secrets are excluded from logs
- [ ] secrets are excluded from error payloads
- [ ] secrets are excluded from audit snapshots
- [ ] secrets are excluded from support diagnostics by default

### 6.3 Release Blockers

- [ ] no secret values committed to repo or migration files
- [ ] no undefined or ad hoc secret encryption model in production

## 7. Webhook Hardening

### 7.1 Outbound Customer Webhooks

- [ ] each delivery has event ID, idempotency key, attempt count, and next attempt timestamp
- [ ] signature format is documented
- [ ] replay window is documented and tested
- [ ] retry schedule is bounded
- [ ] terminal failures move to dead-letter or explicit failed state

### 7.2 Inbound Provider Webhooks

- [ ] provider signature verification is implemented before processing
- [ ] replay handling is implemented where supported
- [ ] inbound provider events do not reuse customer outbound delivery pipeline

### 7.3 Release Blockers

- [ ] no webhook endpoint is exposed without verification and retry policy
- [ ] no customer payload is delivered unsigned

## 8. Connector Credential Hardening

### 8.1 Required

- [ ] `integration_connections` and `integration_sync_state` are tenant-scoped
- [ ] ownership model is defined per connector
- [ ] minimal OAuth scopes are documented
- [ ] token expiry and refresh failure state are tracked
- [ ] provider webhook IDs and sync cursors are tracked where needed

### 8.2 Operational Controls

- [ ] repeated refresh failure disables the connector in a controlled way
- [ ] provider metadata storage is limited to required fields
- [ ] connector actions with side effects are auditable

### 8.3 Release Blockers

- [ ] no connector persists tokens unencrypted
- [ ] no connector runs with undocumented broad scopes

## 9. Audit Logging

### 9.1 Required

- [ ] audit logs are append-only to runtime roles
- [ ] access to audit tables is restricted
- [ ] migration actions are audited
- [ ] API key actions are audited
- [ ] webhook configuration changes are audited
- [ ] connector credential changes are audited
- [ ] destructive schema actions are audited

### 9.2 Release Blockers

- [ ] runtime roles cannot silently alter or delete audit history
- [ ] high-sensitivity fields are redacted before write

## 10. Environment-Specific Controls

### 10.1 Supabase

- [ ] service role is isolated from request paths
- [ ] RLS is tested under the relevant auth contexts
- [ ] PostgREST or edge-function usage does not bypass intended policies
- [ ] Vault or secret-storage approach is documented if used
- [ ] auth sync into Orbit `users` is constrained and validated

### 10.2 Neon

- [ ] branch-before-migrate is used for destructive or high-risk changes where supported
- [ ] branch lifecycle and cleanup are documented
- [ ] runtime and migration credentials are separated

### 10.3 Raw Postgres

- [ ] pooler behavior is validated for transaction-bound tenant context
- [ ] role grants and schema permissions are codified and repeatable
- [ ] backup and PITR strategy is defined

### 10.4 SQLite

- [ ] SQLite is documented as application-enforced isolation only
- [ ] SQLite is not presented as equivalent to Postgres multi-tenant security
- [ ] tenant-sensitive production hosting does not rely on SQLite

## 11. Validation and Testing

### 11.1 Required Test Coverage

- [ ] cross-tenant read deny tests
- [ ] cross-tenant write deny tests
- [ ] migration safety tests
- [ ] webhook signature tests
- [ ] replay-protection tests
- [ ] secret redaction tests
- [ ] connector token handling tests

### 11.2 Release Blockers

- [ ] security tests are required before exposing a new tenant table or mutating route
- [ ] there is no untested major entity group in tenant-scoped runtime

## 12. Operational Readiness

### 12.1 Required

- [ ] backups are enabled and restore-tested
- [ ] key rotation runbooks exist
- [ ] incident owner is assigned
- [ ] alerts exist for auth failures, webhook failures, migration failures, and connector auth failures
- [ ] break-glass admin access is documented and controlled

### 12.2 Release Blockers

- [ ] no production environment without backup and restore verification
- [ ] no production environment without key rotation and incident runbooks

## 13. Minimum Standard Before Public Beta

Orbit AI should not expose a multitenant beta until all blocker items in this checklist pass.

If an item is deferred, the deferral must include:

- owner
- rationale
- compensating control
- date for closure

Unchecked blockers are not documentation gaps. They are release blockers.
