# Changelog

All notable changes to Orbit AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### @orbit-ai/api + @orbit-ai/sdk — camelCase↔snake_case serialization layer

- **Fixed**: All API responses now correctly return `snake_case` field names (e.g. `stage_id`, `organization_id`, `created_at`). Previously, core's camelCase Drizzle records were returned to clients unchanged. Zod's silent `strip()` mode meant incoming `snake_case` request fields like `stage_id` were silently dropped rather than mapped to `stageId` — this fix prevents silent data loss on create/update/move operations.
- **Added**: `packages/api/src/serialization.ts` — `serializeEntityRecord` (camelCase core record → snake_case response) and `deserializeEntityInput` (snake_case request body → camelCase core input), with semantic renames for deal (`name`↔`title`), stage (`position`↔`stage_order`), and note (`body`↔`content`, `user_id`↔`created_by_user_id`).
- **Added**: `packages/sdk/src/transport/serialization.ts` — mirrors the API serialization so `DirectTransport` produces identical snake_case responses to the HTTP transport.
- **Fixed**: `DirectTransport` now dispatches 4-segment workflow paths (`POST /v1/deals/:id/move`, `/sequences/:id/enroll`, `/sequence_enrollments/:id/unenroll`, `/tags/:id/attach`, `/tags/:id/detach`, `/activities/log`) to the correct core service methods. Previously these routes threw "Unhandled dispatch".
- **Security fix**: Webhook `secretEncrypted` field is now stripped from `DirectTransport` responses. Previously it was included (as `secret_encrypted`) when serializing webhook records in-process, diverging from the HTTP transport which always excluded it via `toWebhookRead`. The `signing_secret_last_four` and `signing_secret_created_at` field names are now consistent across both transports.

### @orbit-ai/demo-seed — Initial release

- **New package**: deterministic, multi-tenant demo dataset built on `@orbit-ai/core` services
- Two tenant profiles: `acme` (200 contacts / 40 companies / 15 deals / 300 activities / 50 notes / 30d history) and `beta` (sparse, for cross-org isolation tests)
- Public API: `seed()`, `resetSeed()`, `TENANT_PROFILES`, `createPrng()`
- Three modes for `seed()`: `fail-if-exists` (default), `reset`, `append`
- Determinism guaranteed via fixed-seed PRNG (`seedrandom`); two independent runs produce identical content under a deterministic projection
- All names/domains/emails are synthetic; no real customer data is included
- 30 tests cover PRNG, fixtures, profiles, every entity seeder, and the orchestrator's invariants (counts, determinism, multi-tenant isolation, mode behavior)
- **Contract change** (`resetSeed`): now requires a third argument `{ confirmWipeAllTenantData: true }` and throws before touching the database if the flag is absent. The previous `resetSeed(adapter, orgId)` signature no longer type-checks. Rationale: `resetSeed` does not delete only demo rows — seeded records carry no marker, so the call wipes every row in the listed entity types (activities, notes, deals, contacts, stages, pipelines, companies, tags, users, entity_tags, tasks) for that organization. Docs previously described it as "deletes seeded records", which misrepresented the blast radius; making callers acknowledge the wipe via a typed flag keeps the contract honest. Pre-npm, no deprecation shim.

### @orbit-ai/core — Validator type re-exports

- Re-export entity record types (`OrganizationRecord`, `UserRecord`, `SanitizedUserRecord`, `PipelineRecord`, `StageRecord`, `CompanyRecord`, `ContactRecord`, `DealRecord`, `ActivityRecord`, `NoteRecord`, `TagRecord`) from the package barrel so downstream packages (e.g. `@orbit-ai/demo-seed`) can import them without reaching into validator paths
- **Changed**: Narrowed validator re-exports for pipelines/stages/users/organizations to type-only (`export type *`). Runtime Zod schemas remain accessible via the service modules. Prevents demo-seed and other downstream consumers from unintentionally shipping Zod at runtime.

### @orbit-ai/api + @orbit-ai/core — Post-Stack Audit MEDIUM Fixes

- **Fixed** (M-SEC-1): Migration preview/apply routes now validate body with Zod `.safeParse()`, returning 400 `VALIDATION_FAILED` on empty/malformed input
- **Fixed** (M-SEC-2): Cursor payload embeds `orgId`; `decodeCursorWithOrgCheck` verifies org match on decode — propagated to all tenant-scoped repository paths (sqlite, postgres, in-memory)
- **Fixed** (M-SEC-3): Rate limiter eviction changed from O(n) linear scan to O(1) FIFO via Map insertion order
- **Fixed** (M-SCALE-3): Contact context tag lookup replaced 100-way `Promise.all(get())` with single `listByIds()` batch call across all 3 adapters

### @orbit-ai/integrations — Review Fixes (18 issues from PRs #29–#34)

#### Security
- **Fixed**: `findOrCreateContactFromEmail` now passes `organization_id` in contact and company list filters (cross-org bleed prevention)
- **Fixed**: MIME header injection prevented via `sanitizeMimeHeader()` — strips CR/LF from To/Subject/Cc
- **Fixed**: Email and orgId validation guards added to shared contact helper

#### Data Integrity
- **Fixed**: Gmail polling cursor used as `pageToken` only (not `after:` query); `stoppedEarly` tracks `lastCompletedPageToken` correctly
- **Fixed**: `userId` threaded through OAuth credential read/write path (getValidAccessToken → getGmailClient/getCalendarClient → all operations)
- **Fixed**: Schema migration policies use `DROP IF EXISTS` before `CREATE`; `connection_id` FK added with `ON DELETE CASCADE`
- **Fixed**: Idempotency keys use length-prefixed encoding; filter narrowed to include `method`+`path`
- **Fixed**: Stripe sync metadata uses conditional spreads to avoid `undefined` values

#### Runtime
- **Fixed**: Boolean CLI option defaults preserved (not stringified via `String(false)`)
- **Fixed**: `maxAttempts` validated as positive integer >= 1 in retry helper
- **Fixed**: `sanitizeIntegrationMetadata` recurses into arrays and nested arrays
- **Fixed**: Stripe CLI `--amount` validated (NaN/negative/zero rejected)
- **Fixed**: `commander` moved from `devDependencies` to `dependencies`
- **Fixed**: `api_key` and `client_secret` added to `SENSITIVE_KEY_PATTERN` (snake_case coverage)

### @orbit-ai/mcp
- **Fixed**: Activities tool fields renamed `description`→`body`, `user_id`→`logged_by_user_id`; `.parse()`→`.safeParse()`

### @orbit-ai/sdk
- **Fixed**: Missing `await` in wave2 activity test

### @orbit-ai/cli
- **Fixed**: Boolean option defaults preserved in integration CLI commands

### @orbit-ai/integrations
- **Added**: Package scaffold with plugin contract and error model
- **Added**: Integration tables (integration_connections, integration_sync_state) with RLS
- **Added**: Credential store with AES-256-GCM encryption
- **Added**: OAuth2 token lifecycle with auth failure tracking
- **Added**: Gmail connector (OAuth, send/list/get, sync, MCP tools, polling)
- **Added**: Google Calendar connector (OAuth, CRUD events, availability, sync, MCP tools, CLI commands)
- **Added**: Stripe connector (payment links, checkout sync, webhook handler with replay/dedup, MCP tools, CLI commands)
- **Added**: Event bus with routing enforcement (provider ≠ customer events)
- **Added**: Dynamic CLI and MCP tool registration
- **Added**: Retry with exponential backoff and idempotency helpers

### @orbit-ai/sdk
- **Added**: Missing activity fields (body, direction, duration_minutes, metadata, outcome)
- **Added**: Missing payment fields (external_id, metadata)
- **Fixed**: payment_method/method naming with Zod transform alias

### @orbit-ai/mcp
- **Added**: Extension tool seam (`registerExtensionTools`) for integration plugins

### @orbit-ai/cli
- **Added**: Integration command seam with dynamic subcommand registration
- **Added**: `orbit calendar` top-level alias

---

## [0.1.0-alpha.0] — Unreleased

First public pre-release of the Orbit AI monorepo. All 5 packages: `@orbit-ai/core`, `@orbit-ai/api`, `@orbit-ai/sdk`, `@orbit-ai/cli`, `@orbit-ai/mcp`.

### Fixed

**`@orbit-ai/mcp`**
- `ZodError` handling switched from `instanceof` to duck-type guard (`name === 'ZodError' && Array.isArray(issues)`) per project convention
- `isOrbitApiError` duck-type guard tightened to require `typeof error.error === 'object'` and `typeof error.status === 'number'`, preventing misclassification of unrelated objects
- `McpToolError` constructor now defaults `hint`/`recovery` from lookup tables so invariant holds at class construction; added defensive fallbacks for code values coerced through `as` casts
- `isSensitiveKey` regex expanded to cover `api_key` / `apiKey` and all camelCase OAuth credential fields (`accessToken`, `refreshToken`, `clientSecret`, `clientId`, `privateKey`)
- `McpIntegrationConnectionRead.object` made required (was incorrectly optional)
- Dead unreachable code removed from HTTP transport error handler
- `safeReadResource` now logs via `writeStderrWarning` before re-throwing, re-throws as `McpToolError` (preserving `code`/`hint`/`recovery`), and is exported for unit testing
- `redactSensitiveText` expanded to redact `key=value` formats: `api_key=`, `refresh_token=`, `client_secret=`, `access_token=`, `client_id=` (both `=` and `:` separators)
- `isZodError` usage in `normalizeToolError` hardened against malformed lookalikes (e.g. `{ name: 'ZodError', issues: [null] }`) — now degrades safely instead of throwing
- `sanitizeSecretBearingRecord` now recursively strips sensitive keys at all nesting depths (arrays and nested objects), not just the top level
- `validateWebhookUrlForDirectMode` now throws `VALIDATION_FAILED` (not `INTERNAL_ERROR`) for non-URL strings
- `BodyTooLargeError` discriminated by `instanceof` class check (replaced fragile string sentinel `isBodyTooLarge`)
- HTTP transport auth failure path: bare catch now logs the error code before destroying the half-open connection
- HTTP transport `transport.close()` cleanup: errors are now logged rather than silently swallowed
- HTTP transport `authenticateRequest`: defensive `err instanceof Error` check before casting to `.message`
- `assertNeverRelationshipType` exhaustiveness guard added to `handleRelateRecords` — compile-time proof all relationship types are handled
- `RATE_LIMITED` and `CONFLICT` added to `McpToolErrorCode` union; `mapApiErrorCode` now maps API-layer rate-limit and conflict/idempotency codes to semantically correct MCP codes
- `isToolErrorShape` now type-checks `typeof message === 'string'` (not just key existence)
- `resourceWithFallback` helper extracted — deduplicates resource registration error handling in `server.ts`
- Unused `JsonTextContent` interface and unused `McpServer` import removed

### Added

**`@orbit-ai/cli`**
- 30 CLI commands via Commander.js covering contacts, companies, deals, users, activities, pipelines, and admin operations
- JSON output contract (`--format json`) on all commands — machine-readable for scripting
- Context system (`orbit init`, `orbit config`) for managing API endpoint and key
- Destructive action guard — `--destructive` flag required for drop/rename operations

**`@orbit-ai/mcp`**
- MCP server with exactly 23 core tools across 8 tiers (Core Records, Pipelines, Activities, Schema, Imports, Sequences, Analytics, Team)
- Attio-style universal record tools with `object_type` parameter: `search_records`, `get_record`, `create_record`, `update_record`, `delete_record`, `relate_records`, `list_related_records`, `bulk_operation`
- Safety annotations on every tool: `readOnlyHint`, `destructiveHint`, `idempotentHint`
- LLM-optimized descriptions — every tool includes "when to use" and "when not to use"
- Structured error responses with `hint` and `recovery` on every failure
- `stdio` transport (default, for local agents) and `HTTP` transport with bearer auth
- `orbit://team-members` and `orbit://schema` MCP resources
- Secret redaction: signing secrets, access tokens, refresh tokens, and API keys never emitted in tool output or errors
- Truncation at 5,000-character limit on text fields
- Gated stubs for `import_records`, `export_records`, `list_related_records`, `run_report`, `get_dashboard_summary` — return `FEATURE_NOT_AVAILABLE` with unlock hint

**`@orbit-ai/core`**
- Drizzle ORM schema definitions for all 12 base CRM entities: contacts, companies,
  deals, pipelines, stages, activities, tasks, notes, products, payments, contracts,
  sequences (plus tags, imports, users, entity-tags, webhooks)
- Storage adapter interface (`StorageAdapter`) with a shared contract for all backends
- SQLite adapter (`SqliteStorageAdapter`) using Node.js built-in `node:sqlite` — zero
  external dependencies for local development and testing
- Postgres adapter (`PostgresStorageAdapter`) with RLS policy support — production target
- Supabase and Neon support via the Postgres adapter
- Entity services for all entities — type-safe CRUD + cursor-based paginated list with
  `orgId`-scoped queries enforced on every call
- Tenant context isolation: `{ orgId, userId }` required on all service methods
- Transaction scope utilities (`NoopTransactionScope`, `TxBoundAdapter`)
- Migration engine with schema snapshot registry and reversible migrations

**`@orbit-ai/api`**
- Hono-based REST server exposing `/v1/*` routes for all entities
- API-key authentication middleware (SHA-256 hashed keys)
- Tenant context middleware (injects `orgId` + `userId` from the authenticated key)
- Idempotency middleware (`Idempotency-Key` header, in-memory store)
- Rate limiting middleware (sliding window, per-API-key, in-memory)
- Request body size limiting (default 1 MB, configurable)
- Request ID middleware (`X-Request-Id` on every response)
- Error handler middleware — maps core errors to structured `{ error: { code, message, retryable } }` responses
- OpenAPI spec generation (`GET /v1/openapi.json`)
- Health check (`GET /health`) and status route (`GET /v1/status`)
- Scope enforcement on all entity routes
- Input sanitization middleware

**`@orbit-ai/sdk`**
- `OrbitClient` TypeScript client with 22 typed resource properties
- `HttpTransport` — makes authenticated requests to an `@orbit-ai/api` server
- `DirectTransport` — dispatches directly to core services (for tests and trusted server-side use)
- `BaseResource` — shared `create`, `get`, `update`, `delete`, `list`, `pages` implementation
- `AutoPager` — `async iterable` cursor-based pagination (`for await` support)
- `OrbitApiError` — typed error class with `.error.code`, `.error.message`, `.status`
- All 22 resource classes: contacts, companies, deals, pipelines, stages, users,
  activities, tasks, notes, products, payments, contracts, sequences, sequenceSteps,
  sequenceEnrollments, sequenceEvents, tags, webhooks, imports, search, schema

**Examples**
- `examples/nodejs-quickstart` — minimal runnable Node.js example

**CI**
- GitHub Actions workflow for build, typecheck, and test on every PR

**Documentation**
- Root `README.md` — honest package list, architecture diagram, quick-start snippet
- `packages/core/README.md`, `packages/api/README.md`, `packages/sdk/README.md`
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
- `.env.example` — all environment variables documented
- `docs/review/2026-04-08-post-stack-audit.md` — post-stack audit report

### Changed

- **`@orbit-ai/sdk`**: `SchemaResource.deleteField()` return type changed from
  `{ id: string; deleted: true }` to `{ deleted: true; field: string }` to match
  the actual API response shape. Consumers destructuring `{ id }` from the result
  should switch to `{ field }`.

### Known limitations (alpha)

- **In-memory idempotency and rate limiting** — not suitable for multi-instance
  deployments. Implement `IdempotencyStore` for distributed use.
- **SHA-256 API key hashing** — HMAC-SHA256 + server pepper is planned for v1 GA.
- **No RLS on SQLite** — SQLite adapter relies solely on application-layer `orgId`
  filtering. Use Postgres for production multi-tenant deployments.
- **Search and batch types** — type definitions exist but the implementations are
  incomplete. Do not rely on them for production data.
- **CLI and MCP are implemented** but not yet published to npm.
- **Not yet published to npm** — clone and build from source to use.

---

<!-- Keep this at the bottom — new entries go above this line -->
[0.1.0-alpha.0]: https://github.com/orbit-ai/orbit-ai/releases/tag/v0.1.0-alpha.0
