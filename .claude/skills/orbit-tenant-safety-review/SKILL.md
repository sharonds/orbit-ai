---
name: orbit-tenant-safety-review
description: Reviews code changes for multi-tenant isolation safety in Orbit AI. Invoke this skill whenever a task touches organization_id, storage adapters, repositories, auth middleware, tenant context, RLS policies, admin/bootstrap boundaries, or adds a new tenant-scoped table or plugin extension. Also use when reviewing PRs or commits that modify files in packages/core/src/adapters/, packages/core/src/entities/, packages/core/src/services/, packages/api/src/middleware/, or any file containing withTenantContext, organization_id filtering, or RLS policy generation. Cross-tenant data exposure is Orbit's #1 threat — when in doubt about whether this skill applies, use it.
---

# Orbit Tenant Safety Review

This skill reviews code changes for tenant isolation safety. Cross-tenant data exposure is Orbit AI's most critical failure mode — it would be existential for a CRM infrastructure product. Every new adapter, service, route, repository, and plugin table must be reviewed through this lens.

## When to skip this skill

- Generic performance optimization with no tenant data path changes
- Frontend/UI-only changes
- Documentation-only changes that don't alter security contracts
- Changes entirely within CLI presentation code only when all of the following are true:
  - no data fetching logic changes
  - no serializer or DTO shape changes
  - no `--json` output changes for secret-bearing or admin-only objects

## Step 1: Load context

Read these files to ground your review in Orbit's actual contracts:

1. `docs/security/security-architecture.md` — sections 4 (Tenant Isolation Model) and 5 (Postgres Role Model) define the rules
2. `docs/specs/01-core.md` — sections on `withTenantContext`, RLS generation, adapter interface, and the runtime vs migration authority split
3. `docs/specs/02-api.md` — sections on auth middleware, tenant context middleware, and route classification (bootstrap vs tenant CRUD)
4. `docs/security/orbit-ai-threat-model.md` — T1 (Cross-Tenant Read/Write) and T2 (Privileged Credential Misuse) are the primary threats this review guards against

You don't need to read all of these end-to-end every time. Read the relevant sections based on what the changed code touches.

## Step 2: Identify what changed

Look at the changed files (staged, unstaged, or the diff under review). Classify each changed file:

- **Tenant data path**: touches entity services, repositories, adapters, or any code that reads/writes tenant-scoped tables
- **Auth/context path**: touches auth middleware, tenant context injection, API key resolution, or request context propagation
- **Schema/migration path**: touches schema engine, RLS generation, migration authority, or table definitions
- **Bootstrap/admin path**: touches organization creation, API key issuance, platform admin routes, or hosted operational controls
- **Connector/integration path**: touches provider credentials, sync state, or integration tables that hold tenant data

If none of these categories apply, this skill doesn't need to produce a full review — just confirm the change doesn't touch tenant boundaries and stop.

## Step 3: Review against the isolation rules

For each changed file that touches a tenant boundary, check these rules. These come directly from the security architecture and threat model:

### Rule 1: Organization context is never caller-controlled

The service layer must inject `organization_id` from trusted runtime context — never from request body, query params, or path params for public operations. The trusted sources are:

- **API mode**: auth middleware resolves API key → `orgId` and injects it into request context
- **Direct mode**: the embedding app provides trusted `context: { userId, orgId }` at SDK initialization
- **MCP mode**: org context comes from the server's configured context, not from tool arguments

If the code accepts `organization_id` from user input and uses it for data scoping, that's a critical finding.

### Rule 2: Runtime paths use runtime credentials only

Request-serving code (API routes, SDK operations, MCP tools, webhook delivery workers) must never use:

- `service_role` credentials (Supabase) — this is a **release blocker**
- `migration_role` credentials — these are only for `runWithMigrationAuthority(...)`
- Any credential that bypasses RLS

The runtime vs migration authority split is a core architectural decision. If you see code that needs elevated credentials on a request path, that's a design problem, not something to work around.

### Rule 3: Postgres-family adapters use `withTenantContext(...)`

All tenant-scoped database operations on Postgres-family adapters must execute inside `withTenantContext(...)`, which sets `app.current_org_id` as a transaction-local setting via `set_config(..., true)`.

This is mandatory because pooled Postgres connections can leak session state between requests if tenant context isn't transaction-bound. If you see tenant-scoped queries running outside a transaction with tenant context set, that's a high-severity finding.

### Rule 4: New tenant tables have both layers of defense

Every new tenant-scoped table needs:

1. **App-level filtering**: the repository/service explicitly filters on `organization_id` in every query
2. **RLS policy**: for Postgres-family adapters, auto-generated RLS policies enforce `organization_id = orbit.current_org_id()` (or the equivalent generated helper/current-setting text contract used by the active schema layer) on SELECT, INSERT, UPDATE, and DELETE

RLS is necessary but not sufficient — the app layer must also filter, because:
- Direct mode needs to be auditable and understandable without relying on database magic
- SQLite has no RLS at all (it's dev/local only, not a production isolation boundary)
- App-layer checks catch mistakes earlier and produce better error messages

### Rule 5: Bootstrap routes never enter tenant context

Routes that handle organization creation, API key issuance, platform admin operations, or hosted control-plane actions must not call `withTenantContext(...)`. These are structurally separate from tenant CRUD routes.

If bootstrap logic accidentally enters tenant context, it could either fail (no org context set) or worse, operate on the wrong tenant's data.

### Rule 6: Plugin/integration tables are not exempt

If a connector or plugin creates tables that hold tenant data (sync cursors, provider tokens, integration state), those tables must follow the same rules as core entity tables: `organization_id` column, app-level filtering, and RLS policies on Postgres-family adapters.

### Rule 7: Secrets don't cross read boundaries

Tenant-scoped reads must never return:
- API key plaintext (only prefix is retrievable after creation)
- Webhook signing secrets (returned once on creation, never again)
- Connector access/refresh tokens (server-owned, never in API/CLI/MCP output)
- Raw provider error strings that might contain tokens

Check that the changed surface uses the correct redaction contract for that interface:

- **API / SDK**: sanitized DTOs and envelope shapes must omit secret-bearing fields entirely (for example webhook plaintext secrets, webhook delivery payload/signature copies, API key hashes)
- **MCP / integrations**: redaction markers such as `credentials_redacted`, `cursor_redacted`, and `error_redacted` may be the correct evidence depending on the spec

Do not require integration-style redaction markers on API/SDK read models when the contract instead calls for sanitized DTOs.

## Step 4: Produce the review note

Write a concise review note with these sections:

### Boundary touched
Which trust boundary from the security architecture does this change cross? (Tenant Runtime, Platform/Bootstrap, Database, Connector/Provider, or Public Interface)

### Org context source
Where does `organization_id` come from in the changed code? Is it from a trusted source?

### Access mode safety
Does the change remain safe across both API mode (HTTP requests with API key auth) and direct mode (SDK with trusted context)? If MCP is involved, is it safe there too?

### Secret exposure check
Can any secrets or admin-only state leak through the changed paths? This includes API output, SDK direct-mode envelopes, CLI `--json`, MCP tool results, logs, audit snapshots, and connector/webhook DTOs.

### Findings (if any)

If problems are found, list them as a flat list ordered by severity:

```
- [CRITICAL] <description> — <file>:<line>
- [HIGH] <description> — <file>:<line>
- [MEDIUM] <description> — <file>:<line>
```

Severity definitions:
- **CRITICAL**: Direct cross-tenant data exposure or service_role on a request path
- **HIGH**: Missing RLS policy, missing withTenantContext, or migration credentials accessible from runtime
- **MEDIUM**: Missing app-level org filter (RLS may catch it, but defense-in-depth is violated), or missing redaction on a secret-bearing field

### Validation

Explicitly state pass or fail for each of these four checks:

1. **No caller-controlled org context**: Pass/Fail — [brief evidence]
2. **Runtime credentials only**: Pass/Fail — [brief evidence]
3. **Defense-in-depth on new tables**: Pass/Fail or N/A — [brief evidence]
4. **Secrets stay redacted across read surfaces**: Pass/Fail or N/A — [brief evidence]

If any check fails, the review outcome is **FAIL** and the findings must be resolved before the change is safe to merge.
