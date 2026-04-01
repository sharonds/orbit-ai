# Core Wave 1 Full Review Report

Date: 2026-03-31
Reviewers: Code review agent, Security review agent, Tenant safety review agent, Plan-vs-execution agent, Schema change review agent
Scope: `packages/core/src/` — commits `be48047` (wave 1 service layer) through `5757e73` (postgres persistence bridge plan)
Baseline: main branch at `781cd7a`

## 1. Executive Summary

Wave 1 delivers a complete service layer for all planned entities (contacts, companies, deals, pipelines, stages, users, api-keys) plus admin services, cross-entity search, and contact context aggregation. The SQLite persistence bridge adds real database-backed repositories for all entities, replacing the in-memory stubs.

The review found **4 critical issues**, **6 high issues**, and **6 medium issues** across security and code quality. The most urgent are: `keyHash` exposure through all service read paths, `organization_memberships` tenant classification split, missing org_id validation on `create`, and a TOCTOU race in `update`. The plan-vs-execution alignment is strong — all planned deliverables are present with minor deviations.

## 2. Security Findings

### 2.1 CRITICAL — `ApiKeyRecord.keyHash` returned from all read paths

**Files:** `entities/api-keys/repository.ts:39-93`, `entities/api-keys/service.ts:36-71`
**Threat:** T3 (Secret Leakage)
**Contract:** Security architecture §7.2 — "Full plaintext keys must never be retrievable after creation." §8.1 — "secrets must not appear in audit before/after snapshots."

`ApiKeyRecord` includes `keyHash: string` as a first-class field. Every service method — `get`, `list`, `search`, `create`, `update` — returns the complete record including `keyHash`. The admin service (`services.system.apiKeys`) also exposes `keyHash` through `listAll` and `getAny`.

The hash is not a plaintext key, but it is a cryptographic secret. If HMAC-SHA256 hashing is used, the hash can verify a leaked key or mount a dictionary attack against short keys. Returning it from every read path violates the "never retrievable after creation" intent.

`keyHash` also flows into `SearchResultRecord.record` from the search service, meaning it will reach MCP and API response envelopes once those layers are built.

**Evidence:** `api-keys/service.ts` line 36 returns `repository.get(ctx, id)` which returns full `ApiKeyRecord`. The `ApiKeyRecord` type in `repository.ts` line 10 includes `keyHash: string`. The `lookupApiKeyForAuth` path correctly returns only `ApiKeyAuthLookup` (which omits `keyHash`), but all other paths leak it.

**Fix:** Introduce `SanitizedApiKeyRecord` that omits `keyHash`. All service `get`, `list`, `search`, `create`, and `update` return types should use `SanitizedApiKeyRecord`. Only `lookupApiKeyForAuth` works with the hash internally. The admin `getAny`/`listAll` should also return the sanitized type.

### 2.2 CRITICAL — `organization_memberships` treated as bootstrap, bypassing tenant isolation

**Files:** `repositories/tenant-scope.ts:4-14`, `entities/organization-memberships/repository.ts:40`
**Threat:** T1 (Cross-Tenant Read/Write)
**Contract:** Security architecture §4.1 — "Every tenant table must include `organization_id`." §4.2 — requires explicit service-layer filtering.

`organization_memberships` has an `organization_id` column and is unambiguously tenant data. It is listed in `IMPLEMENTED_TENANT_TABLES` in `tenant-scope.ts`. However, the SQLite repository uses `createBootstrapSqliteRepository`, which applies **no** `organization_id` filter on `get` or `list`. The `OrganizationMembershipRepository` interface omits `ctx` from all methods.

The `createOrganizationMembershipAdminService` ignores its `ctx` parameter (`_ctx`). Any caller with knowledge of a membership ID can retrieve it regardless of which organization it belongs to.

**Evidence:** `organization-memberships/repository.ts` line 40 calls `createBootstrapSqliteRepository`. `sqlite-persistence.test.ts` line 157 calls `services.system.organizationMemberships.get(ctxA, 'mbr_...')` and passes — but the `get` method uses `buildIdPredicate(id)` with no org filter (see `shared.ts` lines 165-170).

**Fix:** Either (a) move `organization_memberships` to `createTenantSqliteRepository` with `ctx` on all methods, or (b) if intentionally admin-only, explicitly document the access control requirement and remove from `IMPLEMENTED_TENANT_TABLES`.

### 2.3 CRITICAL — `create` in tenant SQLite repository takes no context, doesn't validate `organization_id`

**Files:** `repositories/sqlite/shared.ts:104-110`
**Threat:** T1 (Cross-Tenant Read/Write)
**Contract:** Security architecture §4.2 — "The service layer must never trust caller-provided `organization_id`." §6.2 — "application-layer checks catch mistakes earlier."

The `create` method accepts a pre-built `TRecord` and serializes it directly into an INSERT. It does not take an `OrbitAuthContext`, does not call `assertOrgContext`, and does not verify that `record.organizationId` matches any trusted context. It also uses `adapter.transaction()` instead of `adapter.withTenantContext()`, skipping the `assertOrbitId` validation gate.

The service layer does inject `organizationId: ctx.orgId` before calling `repository.create(...)`, but the repository itself provides zero defense-in-depth. A future caller, plugin, or integration bypassing the service layer would write cross-tenant data with no error.

**Evidence:** `shared.ts` line 105-109 shows `create(record)` with no `ctx`. Compare to `get(ctx, id)` at line 87, `update(ctx, id, patch)` at line 120, `delete(ctx, id)` at line 139 — all take `ctx`. `create` is the only tenant operation without context validation.

**Fix:** Add `ctx: OrbitAuthContext` to `create` in `TenantRepositoryShape`. In `createTenantSqliteRepository.create`, call `assertOrgContext(ctx)`, assert `record.organizationId === orgId`, and wrap in `adapter.withTenantContext(ctx, ...)`.

### 2.4 CRITICAL — `update` is TOCTOU — read and write in separate transactions

**Files:** `repositories/sqlite/shared.ts:120-136`
**Threat:** T1 (Cross-Tenant Read/Write) — data integrity
**Contract:** Implicit requirement for atomic read-modify-write.

The `update` method does:
1. `this.get(ctx, id)` — opens one transaction/context
2. Merges the patch in JS
3. `adapter.withTenantContext(ctx, ...)` with UPDATE — opens a second transaction

Between steps 1 and 3, another writer can modify or delete the row. In SQLite's WAL mode, two concurrent async callers (Node.js event loop) can interleave these awaits. The returned value reflects the pre-write state, not what is actually in the database after the UPDATE.

**Evidence:** `shared.ts` line 121 calls `const current = await this.get(ctx, id)` outside any transaction. Line 130 opens a new `adapter.withTenantContext(ctx, async (db) => { ... })` for the write. These are two separate database operations.

**Fix:** Wrap both the GET and UPDATE inside a single `adapter.withTenantContext(ctx, ...)` call so the check-then-act is atomic.

### 2.5 HIGH — `apiKeyUpdateInputSchema` allows callers to mutate `keyHash` directly

**Files:** `entities/api-keys/service.ts:41-57`
**Threat:** T2 (Privileged Credential Misuse), T3 (Secret Leakage)
**Contract:** Security architecture §7.2 — API keys must be scoped, revocable, auditable.

`apiKeyUpdateInputSchema` is derived from `apiKeyUpdateSchema.omit({ id, organizationId, createdAt, updatedAt })`. Since `api_keys` has a `key_hash` column, `keyHash` is an updatable field. The service at line 49 passes `parsed.keyHash` into the patch if defined.

Any caller with a valid org context and a key's ID can overwrite `keyHash` and `keyPrefix`, effectively taking over any API key.

**Evidence:** `api-keys/service.ts` line 49 — `keyHash: parsed.keyHash ?? current.keyHash`. The Zod schema generated from Drizzle includes `keyHash` as an optional updatable field. No explicit `.omit({ keyHash: true })` exists.

**Fix:** Add `.omit({ keyHash: true, keyPrefix: true })` to `apiKeyUpdateInputSchema`. These are creation-time immutable fields. If rotation is ever needed, add a dedicated `rotateApiKey` method with audit logging.

### 2.6 HIGH — SQLite `withTenantContext` gives callers an unscoped `db` handle

**Files:** `adapters/sqlite/adapter.ts:99-102`
**Threat:** T1 (Cross-Tenant Read/Write)
**Contract:** Security architecture §4.3 — "no tenant route can bypass `withTenantContext(...)`." §4.4 — SQLite isolation is app-layer only.

The SQLite `withTenantContext` validates org ID format but then passes a raw `OrbitDatabase` handle to the callback. Unlike Postgres where RLS enforces isolation even if app-level predicates are missing, on SQLite the `db` handle inside the callback has no bound tenant scope. Any query omitting `buildTenantPredicate` silently returns cross-tenant data.

Currently safe because all callers in `shared.ts` explicitly use `buildTenantPredicate(ctx, ...)`. But the contract implies scope safety that doesn't exist.

**Evidence:** `adapter.ts` line 101 — `return this.transaction(fn)` passes through with no tenant binding on the returned `db`.

**Fix:** At minimum, document in JSDoc that the SQLite callback MUST use `buildTenantPredicate` in all queries. Consider a proxy wrapper or lint rule for enforcement.

### 2.7 HIGH — `buildSelectAllStatement` optional predicate silently produces unfiltered reads

**Files:** `repositories/sqlite/shared.ts:64-70`
**Threat:** T1 (Cross-Tenant Read/Write)

The predicate parameter is optional. When called without one (bootstrap repos), it generates `select * from <table>` with no filter. The hazard is structural: a missed predicate silently returns all rows across all tenants. This already manifested in finding 2.2.

**Evidence:** `shared.ts` line 66 — `if (predicate) { ... } return sql\`select * from ${sql.raw(tableName)}\``

**Fix:** Split into `buildTenantSelectStatement(tableName, predicate: required)` and `buildUnfilteredSelectStatement(tableName)`. TypeScript then catches omissions at compile time.

### 2.8 HIGH — `SearchResultRecord.record` includes unsanitized raw entity objects

**Files:** `services/search-service.ts:50-99`
**Threat:** T3 (Secret Leakage)
**Contract:** Security architecture §8.1 — "secrets must not appear in MCP outputs."

`SearchResultRecord` includes `record: Record<string, unknown>` populated directly from raw entity records. For users, this includes `externalAuthId` and `metadata`. For api-keys (if added to search), it would include `keyHash`. When this flows into MCP tool output, agents receive fields that should be redacted.

**Evidence:** `search-service.ts` line 64 — `record: company as unknown as Record<string, unknown>` casts the full entity record.

**Fix:** Define per-entity sanitized summary types for `record`. Strip `externalAuthId`, `metadata`, and any credential-bearing fields.

### 2.9 MEDIUM — `createApiKeyService` exposed on tenant surface with no scope gating

**Files:** `services/index.ts:69`, `entities/api-keys/service.ts`
**Threat:** T2 (Privileged Credential Misuse)
**Contract:** Security architecture §7.3 — requires distinguishing API key management from ordinary CRUD.

`createApiKeyService` is returned as `services.apiKeys` alongside `services.contacts`. It implements the same `EntityService` interface. No scope check (e.g., `admin:api-keys`) gates creation, update, or deletion. A caller who can create contacts can also create API keys.

**Fix:** Move API key management to `services.system` or add scope checks at service/middleware layer.

### 2.10 MEDIUM — Contact email lookup uses fuzzy search, not equality

**Files:** `services/contact-context.ts:38-43`
**Threat:** T1 (indirect — wrong contact within same tenant)

`contacts.search(ctx, { query: input.email })` performs substring matching across name, email, phone, title, source_channel. An email like `john@example.com` matches any contact whose name contains `john`. The post-filter `find` is correct but the 100-record search page may not contain the right record.

**Evidence:** `contact-context.ts` line 38 — `deps.contacts.search(ctx, { query: input.email, limit: 100 })`.

**Fix:** Use `filter: { email: input.email }` for exact equality matching.

### 2.11 MEDIUM — `tableName` via `sql.raw(string)` with no allowlist

**Files:** `repositories/sqlite/shared.ts:39-74`
**Threat:** T2 (SQL injection via plugin table names)

All query builders use `sql.raw(tableName)` where `tableName` is a plain `string`. Currently safe (static literals), but a plugin registering a dynamic table name could inject SQL.

**Fix:** Constrain `tableName` to `ImplementedTableName` union or add a runtime allowlist check.

### 2.12 MEDIUM — SQLite `authorityModel` claims elevated migration authority but uses same db handle

**Files:** `adapters/sqlite/adapter.ts:53`

`runWithMigrationAuthority` uses the same database handle as runtime queries when no explicit `migrationDatabase` is provided. The `authorityModel` claims `migrationAuthority: 'elevated'` which is misleading.

**Fix:** Override `authorityModel.notes` to document that SQLite doesn't enforce authority separation at the credential level.

## 3. Code Quality Findings

### 3.1 Search cursor pagination breaks with real adapters

**File:** `services/search-service.ts:36-48`
**Severity:** Critical (correctness time-bomb)

Each per-entity search uses a hard-coded `limit: 100` and strips the original cursor. The merged result set is re-paginated in memory. The cursor encodes position in the merged array, but with real Postgres repositories the ordering isn't stable across calls. Cursor lookups will silently skip or repeat records.

**Fix:** For the current in-memory/SQLite scope this works. Before real Postgres adapters, implement a proper merge-sort pagination strategy or sequential entity querying.

### 3.2 Deal update with `pipelineId`-only change leaves stale `stageId`

**File:** `entities/deals/service.ts:123-128`
**Severity:** Important

When `update` is called with only `pipelineId` (not `stageId`), `resolveDealGraph` receives the existing `stageId` from the current record. The cross-check only fires when `input.stageId` is truthy (line 41-44), so it doesn't catch the scenario where the deal moves to a new pipeline but keeps a stage from the old pipeline.

**Fix:** When `pipelineId` changes and `stageId` is not provided, either auto-assign the first stage of the new pipeline or reject the update.

### 3.3 Deal update re-validates unchanged FKs

**File:** `entities/deals/service.ts:123`
**Severity:** Important

`resolveDealGraph` receives `contactId: parsed.contactId ?? current.contactId` and `companyId: parsed.companyId ?? current.companyId` even when the caller didn't send those fields. This causes unnecessary repository `.get()` calls and will **throw** if a previously-linked entity was deleted.

**Fix:** Only validate FKs that are present in the parsed update payload.

### 3.4 `object_type` as a searchable text field

**File:** `services/search-service.ts:102`
**Severity:** Important

`searchableFields: ['object_type', 'title', 'subtitle']` means a query like `"contact"` matches the literal string in `objectType`, producing confusing results. Object type filtering should be a `filter` key, not a text search field.

**Fix:** Remove `object_type` from `searchableFields`. Add an explicit `objectType` filter option if needed.

### 3.5 `void adapter` silently discards storage adapter (wave 1 service factory — now partially resolved)

**File:** `services/index.ts:40`
**Severity:** Important

The SQLite bridge partially resolves this by wiring real repos when `adapter.name === 'sqlite'`. However, any non-sqlite adapter still hits the `void adapter` path silently. No warning or error is produced.

**Fix:** Throw an error for unsupported adapter types instead of silently falling back to in-memory.

### 3.6 Invalid cursor throws generic `Error`

**File:** `services/service-helpers.ts:118`
**Severity:** Important

`throw new Error('Invalid cursor')` — should use the typed `INVALID_CURSOR` error code from `OrbitErrorShape` so the API layer returns 400, not 500.

**Fix:** Throw an `OrbitError` with code `INVALID_CURSOR`.

### 3.7 Raw SQL in `schema.ts` violates CLAUDE.md

**File:** `adapters/sqlite/schema.ts:5-131`
**Severity:** Important

CLAUDE.md states: "All schema definitions use Drizzle ORM syntax — never raw SQL strings." The entire `SQLITE_WAVE_1_SCHEMA_STATEMENTS` array consists of raw SQL `CREATE TABLE` strings.

**Fix:** Replace with Drizzle `sqliteTable` definitions and use `drizzle-kit/api` for migration.

### 3.8 `fromSqliteJson` lacks error handling

**File:** `repositories/sqlite/shared.ts:229-235`
**Severity:** Important

`JSON.parse(value)` is unguarded. Corrupted JSON in `custom_fields`, `scopes`, `settings`, or `metadata` will throw an uncaught `SyntaxError`.

**Fix:** Wrap in `try/catch` and return the fallback on parse error.

### 3.9 Duplicated deserialization in `ApiKeyRepository`

**File:** `entities/api-keys/repository.ts:149-198`
**Severity:** Important

`getAny` and `listAll` duplicate the entire 14-field deserialize block inline. Schema changes must be updated in three places.

**Fix:** Extract a standalone `deserializeApiKeyRow` function at module scope.

### 3.10 Bootstrap `listRows` wraps read in write transaction

**File:** `repositories/sqlite/shared.ts:174-178`
**Severity:** Minor

`organizations.list()` and `organizationMemberships.list()` acquire a write lock via `adapter.transaction()` for a pure read. Under WAL mode this blocks concurrent writers.

**Fix:** Use `adapter.query(...)` directly for read-only operations.

### 3.11 Missing test coverage

**Files:** `sqlite-persistence.test.ts`, entity test files
**Severity:** Important

- No cross-tenant `update` or `delete` isolation tests (only `get` is tested)
- No `contact-context` test file
- No dedicated test files for `stages` and `deals` (only in combined pipeline test)
- Deal update edge cases (pipeline-only change, deleted FK) uncovered

## 4. Tenant Safety Review Results

### Wave 1 Service Layer

| Check | Result | Evidence |
|-------|--------|----------|
| No caller-controlled org context | **Pass** | `organizationId` always from `ctx.orgId`, omitted from all input schemas |
| Runtime credentials only | **Pass** | No `runWithMigrationAuthority` or `service_role` on any request path |
| Defense-in-depth on new tables | **Pass** (with org-membership caveat) | All tenant tables have app-level org filter via `assertOrgContext` |
| Secrets stay redacted | **Fail** | `keyHash` exposed through all `ApiKeyService` read operations |

**Outcome: FAIL** — keyHash exposure must be resolved.

### SQLite Persistence Bridge

| Check | Result | Evidence |
|-------|--------|----------|
| No caller-controlled org context | **Pass** | `organization_id` flows from `OrbitAuthContext.orgId` exclusively |
| Runtime credentials only | **Pass** | No elevated credentials on any request path |
| Defense-in-depth on new tables | **Fail** | `organization_memberships` misclassified; `create` skips validation |
| Secrets stay redacted | **Pass** (with note) | `keyHash` accessible via admin paths but no plaintext leakage |

**Outcome: FAIL** — org-membership classification and `create` validation must be resolved.

## 5. Schema Change Review Results

### Classification

**Additive safe** — all changes are new tables, services, repositories. No columns modified, dropped, or renamed.

### ID Prefixes

All 9 wave 1 entity prefixes verified correct and registered: `org`, `mbr`, `user`, `key`, `contact`, `company`, `deal`, `pipeline`, `stage`.

### Tenant Scoping

All wave 1 tables except `organizations` correctly include `organization_id`. Services inject from `ctx.orgId`. Classification split on `organization_memberships` noted.

### Interface Contracts

- **Pagination/filter/search:** Internal only — `runArrayQuery` powers all in-memory/SQLite repos
- **API envelope:** Not yet implemented
- **SDK types:** Not yet implemented
- **MCP tools:** Not yet implemented
- **CLI --json:** Not yet implemented
- **Redaction/serializers:** `keyHash` flagged for redaction when API layer is built

### Validation

1. **ID prefix correct:** Pass
2. **Tenant vs bootstrap explicit:** Pass (with org-membership caveat)
3. **Interface contracts assessed:** Pass
4. **Secret-bearing surfaces assessed:** Flag — `keyHash` redaction needed at API layer

## 6. Plan vs Execution

### Implemented as Planned

- All 7 tenant-scoped entity services (companies, contacts, pipelines, stages, deals, users, api-keys)
- All 3 admin/system read services (organizations, org-memberships, api-keys)
- `createCoreServices` registry with correct shape
- Cross-entity search service (6 entity types)
- `contactContext` service with explicit empty lists for out-of-scope entities
- Relationship invariants (contact→company, stage→pipeline, deal→stage/pipeline)
- Tenant safety via `ctx.orgId` throughout
- Build and test gates passing
- SQLite persistence bridge for all wave 1 entities

### Partially Implemented

- `contactContext.lastContactDate` — uses only `contact.lastContactedAt`, not max(contact, activity)
- Search — naive fan-out with 100-per-entity cap; cursor stability not robust for cross-page

### Not Yet Implemented (Correctly Deferred)

- `audit-service.ts` — deferred per plan §4
- Idempotency — deferred per plan §4
- `AGENTS.MD` per entity directory — required by spec §14 but not in wave 1 plan
- Adapter-backed Postgres persistence — SQLite bridge delivered, Postgres plan written

### Deviations from Plan

- `createCoreServices` has extra `overrides` parameter (additive, useful for testing)
- `ContactContextResult` uses concrete record types instead of `Record<string, unknown>` (stricter)
- `index.ts` export surface wider than spec §2 (exposes repository/query internals)
- `void adapter` partially resolved (SQLite wired, other adapters silently ignored)

### Items Beyond Plan Scope

- `service-helpers.ts` in-memory query engine (practical workaround for adapter bridge gap)
- `BatchCapableEntityService` interface (from spec, no implementation yet)
- `CoreServices` type export (useful consumer-facing type)
- `OrganizationRepository.create` method (useful for testing, beyond read-only admin plan)

## 7. Priority Fix Schedule

### Must Fix Before Next Milestone

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1 | `keyHash` exposure (2.1) | Critical | Create `SanitizedApiKeyRecord` omitting `keyHash`; use on all service returns |
| 2 | `keyHash` mutability (2.5) | High | Add `.omit({ keyHash: true, keyPrefix: true })` to update schema |
| 3 | `org_memberships` classification (2.2) | Critical | Move to tenant repo OR explicitly document as admin-only and remove from `IMPLEMENTED_TENANT_TABLES` |
| 4 | `create` no context (2.3) | Critical | Add `ctx` param, call `assertOrgContext`, wrap in `withTenantContext` |
| 5 | `update` TOCTOU (2.4) | Critical | Wrap GET + UPDATE in single `withTenantContext` call |
| 6 | Deal `pipelineId`-only update (3.2) | Important | Validate stage-pipeline consistency on pipeline change |
| 7 | Contact email lookup (2.10) | Medium | Use equality filter, not free-text search |
| 8 | API key service placement (2.9) | Medium | Move to `services.system` or add scope gating |

### Should Fix Soon

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 9 | `buildSelectAllStatement` split (2.7) | High | Separate tenant vs unfiltered variants |
| 10 | Search `object_type` (3.4) | Important | Remove from searchable fields |
| 11 | `fromSqliteJson` error handling (3.8) | Important | Add try/catch with fallback |
| 12 | Invalid cursor error type (3.6) | Important | Use `INVALID_CURSOR` OrbitError |
| 13 | Duplicated deserialization (3.9) | Important | Extract shared function |
| 14 | Deal FK re-validation (3.3) | Important | Only validate changed FKs |
| 15 | Cross-tenant mutation tests (3.11) | Important | Add update/delete isolation tests |

### Track for Later

| # | Finding | Target | Fix |
|---|---------|--------|-----|
| 16 | Raw SQL schema (3.7) | Before Postgres bridge | Replace with Drizzle definitions |
| 17 | SQLite authority model notes (2.12) | Before release | Document limitation |
| 18 | `tableName` allowlist (2.11) | Before plugin system | Add runtime check |
| 19 | Search cursor stability (3.1) | Before Postgres adapters | Proper merge-sort strategy |
| 20 | `SearchResultRecord` sanitization (2.8) | Before API/MCP layer | Per-entity summary types |

## 8. Review Gate Status

| Gate | Status |
|------|--------|
| `orbit-tenant-safety-review` | **FAIL** — 2 critical tenant isolation issues (org-memberships, create validation) + 1 secret exposure |
| `orbit-schema-change` | **Pass** — additive safe, all prefixes correct, tenant scoping correct with noted caveat |
| Code quality | **Conditional pass** — 4 critical + 6 important issues; must-fix items listed above |

The next milestone may begin in parallel with fixing items 1-8 from the must-fix list. Items 1-5 (security criticals) should be resolved before any code builds on the service or repository interfaces.
