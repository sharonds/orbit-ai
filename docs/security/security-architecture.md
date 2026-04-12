# Orbit AI Security Architecture

Date: 2026-03-31
Status: Draft
Primary inputs:
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md)
- [orbit-ai-prd.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-prd.md)
- [orbit-ai-ard.md](/Users/sharonsciammas/orbit-ai/docs/strategy/orbit-ai-ard.md)

## 1. Purpose

This document defines the security model for Orbit AI across:

- core services and adapters
- REST API
- SDK direct-DB mode
- CLI
- MCP runtime
- migration engine
- webhook delivery
- Gmail, Google Calendar, and Stripe connectors

The primary security invariant is tenant isolation. Every other control supports that goal.

## 2. Security Principles

Orbit AI should be implemented and operated according to these principles:

1. Tenant isolation over convenience.
2. Least privilege for database roles, API keys, workers, and connectors.
3. Secure-by-default interfaces with explicit escape hatches rather than permissive defaults.
4. Separation of bootstrap/platform authority from normal tenant authority.
5. No secrets in logs, envelopes, audit snapshots, CLI output, or MCP responses.
6. Mutation flows must be attributable, auditable, and replay-resistant.
7. Schema evolution is a privileged operation, not a normal runtime capability.

## 3. Trust Boundaries

Orbit AI crosses several trust boundaries. They must be treated explicitly in implementation and review.

### 3.1 Public Interface Boundary

This includes:

- HTTP requests to `@orbit-ai/api`
- CLI invocations in hosted mode
- MCP requests over stdio or HTTP
- inbound provider webhooks

Everything crossing this boundary is untrusted until validated.

### 3.2 Tenant Runtime Boundary

This is the normal tenant-scoped application path:

- authenticated API key or trusted direct-core context
- tenant-scoped service calls
- repository and adapter operations

This boundary exists to ensure one organization cannot observe or mutate another organization's data.

### 3.3 Platform / Bootstrap Boundary

This includes:

- organization bootstrap
- platform admin routes
- API key issuance and revocation
- migration execution
- hosted operational controls

This boundary must be distinct from ordinary tenant CRUD.

### 3.4 Database Boundary

For Postgres-family adapters, the database is an active security control through:

- roles and privileges
- RLS policies
- transaction-local tenant context

For SQLite, the database is not an isolation boundary. Isolation is enforced only in application code.

### 3.5 Connector / Provider Boundary

Every integration introduces a new external trust boundary:

- Gmail APIs and OAuth tokens
- Google Calendar APIs and sync state
- Stripe APIs, outbound actions, and inbound webhook verification

Connector credentials must be treated as highly sensitive tenant data.

## 4. Tenant Isolation Model

Orbit AI's data isolation model is based on tenant-scoped tables plus adapter enforcement.

### 4.1 Table Classification

- `organizations` is bootstrap-scoped and is not treated as a tenant table.
- Every tenant table must include `organization_id`.
- Plugin and connector tables that hold tenant data must register as tenant-scoped tables.

### 4.2 Runtime Enforcement

Tenant reads and writes must be protected by both:

- explicit service-layer filtering on `organization_id`
- RLS enforcement on Postgres-family adapters

The service layer must never trust caller-provided `organization_id` for public operations. It injects tenant scope from trusted runtime context.

### 4.3 Transaction-Bound Tenant Context

For Postgres-family adapters, all tenant-scoped work must execute inside `withTenantContext(...)` using transaction-local settings.

Required rules:

- tenant context is set inside a transaction
- the transaction uses `set_config(..., true)` or equivalent transaction-local semantics
- no tenant route can bypass `withTenantContext(...)`
- bootstrap routes never enter tenant context

This is mandatory because pooled Postgres connections can leak session state if tenant context is not transaction-bound.

### 4.4 SQLite Caveat

SQLite is valid for local development and for adapter compatibility work where application-level tenant enforcement is acceptable. It is not equivalent to Postgres-family isolation because it has no RLS boundary, and it should not be treated as a tenant-sensitive production security model. The product must document this clearly.

## 5. Postgres and Supabase Role Model

Orbit AI should operate with distinct database roles. The exact final role model still needs to be frozen before production implementation; the role set below is the baseline target model this project should converge on.

### 5.1 Required Roles

- `migration_role`
  Owns schema changes, policies, and extension-level DDL.
- `app_role`
  Executes normal runtime reads and writes.
- `readonly_role`
  Optional operational or reporting role with restricted permissions.
- `platform_admin_role`
  Limited to hosted control-plane and bootstrap workflows where required.

### 5.2 Required Restrictions

- normal request paths must never use Supabase `service_role`
- `app_role` must not create or alter schema, policies, or extensions
- default privileges on `public` must be revoked or tightly controlled
- runtime roles should use pinned `search_path`

The security review should treat any service-role usage on a request path as a release blocker.

## 6. RLS Architecture

RLS is a required control for all tenant-scoped Postgres-family tables.

### 6.1 Policy Expectations

Each tenant table must have policies for:

- `select`
- `insert`
- `update`
- `delete`

Each policy must enforce tenant equality against the transaction-local org context.

### 6.2 Defense In Depth

RLS is necessary but not sufficient. Repositories and services must still include explicit tenant filters.

Reason:

- direct mode must remain auditable and understandable
- application-layer checks catch mistakes earlier
- SQLite requires application enforcement

### 6.3 Extension Tables

Plugin and integration tables are not exempt. If a connector creates tenant-scoped state, that table must be:

- registered with the core plugin schema extension contract
- included in RLS generation for Postgres-family adapters
- included in application-layer tenant filtering

## 7. Authentication and Authorization

### 7.1 v1 Authentication Model

v1 uses API keys for service-to-service authentication. Orbit AI does not own end-user auth.

For user context:

- the developer's auth provider remains the source of truth
- SDK and direct-core modes may accept trusted `userId` and `orgId` context
- Supabase-native auth integration is adapter-specific and optional

### 7.2 API Key Requirements

API keys must be:

- hashed at rest
- scoped
- revocable
- expirable
- auditable

The user-visible key prefix may be stored for support and diagnostics. Full plaintext keys must never be retrievable after creation.

### 7.3 Authorization Model

Authorization must distinguish:

- bootstrap/platform actions
- admin/system actions
- ordinary tenant CRUD
- read-only versus mutating routes
- connector-managed side effects

This separation must exist in code and route structure, not only in prose.

## 8. Secret and Credential Handling

Orbit AI stores and operates on several secret classes:

- API keys
- webhook secrets
- connector access tokens
- connector refresh tokens
- provider webhook secrets

### 8.1 Baseline Rules

- secrets must not be logged
- secrets must not appear in MCP outputs
- secrets must not appear in CLI JSON output
- secrets must not appear in audit before/after snapshots
- decryption must be limited to the process that needs the value

### 8.2 Encryption Model

Before production release, Orbit AI must freeze one encryption and key-management model for secret-at-rest fields such as:

- `webhooks.secret_encrypted`
- `integration_connections.access_token_encrypted`
- `integration_connections.refresh_token_encrypted`

Allowed implementation choices can vary by deployment, but the model must still define:

- where master keys live
- how envelope encryption or vault lookup works
- who can rotate keys
- how re-encryption is performed

## 9. Webhook Security Model

Orbit AI has three distinct event paths:

- internal domain events
- outbound customer webhooks
- inbound provider webhooks and polling

These paths must remain separate.

### 9.1 Outbound Customer Webhooks

Requirements:

- signed payloads
- timestamped delivery
- replay-resistant verification contract
- bounded retry schedule
- idempotency and event identifiers
- dead-letter or terminal failure state

### 9.2 Inbound Provider Webhooks

Requirements:

- provider-specific signature verification
- replay checks where the provider supports them
- no mixing with customer webhook delivery infrastructure
- minimal processing before verification succeeds

### 9.3 Internal Domain Events

Internal events are for Orbit-owned workflows such as:

- audit fanout
- connector sync triggers
- internal state transitions

They are not an external delivery channel and must not be treated as one.

## 10. Migration and Schema Security

The schema engine is one of the highest-risk surfaces in the product.

### 10.1 Privileged Operation

Schema changes must run under `migration_role` or equivalent elevated authority, not under ordinary runtime credentials.

### 10.2 Safe Defaults

The migration engine must preserve these rules:

- preview first
- rollback metadata recorded
- destructive actions explicitly gated
- production controls stronger than local development controls

### 10.3 Operational Controls

Required controls before production use:

- advisory locking or equivalent serialization
- auditable migration execution
- environment-aware guards
- backup, branch, or snapshot requirements before destructive changes

Plugin and connector schema extensions must pass through the same registry and control flow as first-party migrations.

## 11. Connector Security Model

Gmail, Google Calendar, and Stripe are the first external connectors and should be treated as privileged extensions.

### 11.1 Ownership and Scope

For each connector, Orbit AI must define:

- whether credentials are org-owned, user-owned, or both
- the minimal OAuth scopes or API scopes required
- whether data creation side effects are automatic or approval-gated

### 11.2 Token Lifecycle

Connector token handling must define:

- expiry tracking
- refresh policy
- failure thresholds
- controlled disablement on repeated auth failure

### 11.3 Data Retention

Only required provider metadata should be stored. Provider payloads should not be persisted wholesale by default.

## 12. Audit Logging and Observability

Every sensitive mutation path must be attributable.

### 12.1 Audit Logging Requirements

At minimum, audit coverage must include:

- create, update, and delete operations on tenant records
- schema changes
- API key creation and revocation
- webhook endpoint changes
- connector credential and configuration changes
- privileged admin actions

### 12.2 Redaction

Audit payloads must redact:

- API keys
- webhook secrets
- connector tokens
- provider secrets
- any fields later classified as high-sensitivity

### 12.3 Operational Visibility

Operators need visibility into:

- auth failures
- cross-tenant access denials
- webhook failure rates
- migration failures
- token refresh failures

## 13. Required Security Decisions Before Broad Implementation

The following decisions should be frozen before implementation spreads across packages:

1. final secret-at-rest encryption model
2. final Postgres/Supabase role model
3. RLS test strategy and minimum per-entity coverage
4. webhook signature format and replay window
5. connector credential ownership model
6. production migration authority and approval workflow
7. hosted isolation model for managed offering

## 14. Security Readiness Standard

Orbit AI is not ready for tenant-sensitive production release until:

- tenant context is transaction-bound everywhere it needs to be
- RLS and application filters agree
- request paths do not use elevated service credentials
- secrets are redacted and encrypted consistently
- webhook verification and replay handling are implemented
- migration authority is isolated and auditable

This document is the baseline that implementation and later threat modeling should be measured against.
