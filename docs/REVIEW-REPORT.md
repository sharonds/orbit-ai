# Orbit AI Spec Review Report

Date: 2026-03-31
Scope: `docs/specs/01-core.md` through `docs/specs/06-integrations.md`
Method: parallel review across architecture, interfaces, MCP/integrations, and cross-spec consistency

## Verdict

The specs are directionally strong and the product architecture is coherent, but they are not yet implementation-safe. There are several contract mismatches and extension-model gaps that will create rework if implementation starts immediately.

## Priority Findings

### 1. Request-scoped tenant context is not isolated safely enough for pooled Postgres connections

Severity: Critical

References:

- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1121)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L464)

Problem:

- The core spec defines `enableTenantContext()` / `clearTenantContext()`, but the API middleware shape does not require a transaction boundary or `finally` cleanup.
- On Supabase, Neon, or raw Postgres, request-scoped `current_setting('app.current_org_id')` can leak across pooled connections if it is not bound with `SET LOCAL` inside a transaction.
- This is a correctness and data-isolation issue, not just an implementation preference.

Required fix:

- Require per-request database transactions for any request path that relies on RLS session variables.
- Bind tenant context with `SET LOCAL` or the equivalent inside the transaction.
- Guarantee cleanup in a `finally` block, even on thrown errors.

### 2. The API spec assumes core services and methods that the core spec does not define

Severity: High

References:

- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1291)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1305)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L196)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L351)

Problem:

- The API exposes system entities such as `organizations`, `organization_memberships`, `api_keys`, `entity_tags`, `custom_field_definitions`, `webhook_deliveries`, `audit_logs`, `schema_migrations`, and `idempotency_keys`.
- The shared core `EntityService` contract does not define `batch()`, and the service inventory does not cover most of those entities.
- As written, the API cannot be implemented against the core spec without inventing a second service layer ad hoc.

Required fix:

- Decide whether admin/system entities are part of the same service abstraction or a separate admin service layer.
- Add `batch()` to the shared service contract if batch remains part of the generic API.
- Narrow the endpoint matrix if some entities are intentionally non-public or non-generic.

### 3. The “every table has organization_id” rule is forcing a broken bootstrap model

Severity: High

References:

- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L312)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L319)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L376)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1159)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L198)

Problem:

- The spec forces `organizations.organization_id -> organizations.id` to preserve a literal invariant.
- That creates a bootstrap-hostile schema, conflicts with the tenant-injected service model, and is not even mirrored in the RLS list.
- The API also exposes organization CRUD, which deepens the contradiction around who can create the first organization and under what auth context.

Required fix:

- Rewrite the invariant as “every tenant-scoped table has `organization_id`”.
- Treat `organizations` as the one bootstrap/platform table outside tenant scoping.
- Move org creation to a bootstrap or platform-admin flow, not regular tenant CRUD.

### 4. The CLI spec does not actually register the command surface it claims to support

Severity: High

References:

- [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md#L66)
- [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md#L189)

Problem:

- The command surface lists `seed`, `search`, notes commands, sequence commands, and the `orbit log` workflow.
- The Commander composition only registers `init`, `status`, `doctor`, `migrate`, `context`, `contacts`, `companies`, `deals`, `tasks`, `schema`, `fields`, `report`, `dashboard`, `integrations`, and `mcp`.
- As written, a team could implement the program bootstrap exactly as specified and still miss a large fraction of the advertised CLI.

Required fix:

- Add an explicit command registry table that includes every command group from the command surface.
- Separate `tasks`, `notes`, `sequences`, `search`, `seed`, and `log` into first-class registrations in the same snippet that defines the root program.

### 5. The SDK spec breaks idempotency on retry and leaves the public return contract ambiguous

Severity: High

References:

- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md#L173)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md#L186)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md#L268)

Problem:

- `HttpTransport.request()` generates a fresh `idempotency-key` inside the retry closure. A retried `POST` or `PATCH` will not reuse the same key, which defeats the whole idempotency design.
- Resource methods currently return transport envelopes, but the product examples elsewhere imply record-first ergonomics. The spec never states whether the SDK public surface returns `Envelope<T>` or `T`.
- `AutoPager` is record-first while the resource mutators are envelope-first. That asymmetry will leak into CLI and MCP implementation.

Required fix:

- Generate the idempotency key once per logical request outside the retry loop.
- Choose one public SDK contract:
  - envelope-first everywhere, or
  - record-first for CRUD plus explicit `.withResponse()` escape hatches.
- Make CLI and MCP examples use the same chosen contract.

### 6. The MCP and integrations specs conflict on the tool surface

Severity: High

References:

- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md#L46)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L217)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L320)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L385)

Problem:

- The MCP spec says the server exposes exactly 23 tools.
- The integrations spec then adds connector-specific MCP tools such as `gmail_send_email`, `calendar_create_event`, and `stripe_create_payment_link`.
- That leaves the MCP registry model ambiguous: either the server has a fixed core tool surface, or integrations can extend it dynamically.

Required fix:

- Decide whether integrations extend the MCP server beyond the 23 core tools.
- If the answer is yes, redefine the 23 as “core tools” and specify extension registration rules.
- If the answer is no, move connector actions behind a fixed integration tool pattern.

### 7. The integration plugin model introduces tables and state that core cannot currently own or secure

Severity: High

References:

- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L330)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L255)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L1153)

Problem:

- The integrations spec adds `integration_connections` and `integration_sync_state`.
- The core spec’s object registry, RLS generator, and first-party schema list do not define how plugin-owned tables are discovered, migrated, or covered by tenant policy generation.
- Without an extension contract, integrations either become out-of-band tables or require ad hoc core edits for every connector.

Required fix:

- Add a plugin schema extension contract to core:
  - plugin-provided table manifests
  - plugin RLS registration
  - plugin migration hooks
  - plugin object metadata registration where needed
- Decide whether connector tables are:
  - core-owned extension tables, or
  - package-local tables explicitly excluded from universal object APIs.

### 8. The integrations event model is underspecified and mixes internal events with outbound customer webhooks

Severity: High

References:

- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L15)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L74)
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L413)

Problem:

- The integrations spec says connectors consume “API-layer events” and may run through “the webhook delivery worker or an internal event bus”.
- Those are materially different systems:
  - internal domain events
  - outbound customer webhook delivery
  - inbound provider webhooks and polling jobs
- Gmail, Calendar, and Stripe cannot be implemented cleanly until those paths are separated.

Required fix:

- Add a clear event architecture with three distinct paths:
  - internal Orbit domain events
  - outbound customer webhooks
  - inbound provider webhooks and polling jobs
- Map each connector workflow to the correct path explicitly.

### 9. The API spec claims every entity endpoint exists, but the operational contract is still too generic to build safely

Severity: Medium

References:

- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L157)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L257)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L248)

Problem:

- The endpoint matrix is broad, but only one concrete OpenAPI route example is provided.
- The generic route registration loop does not show how admin-only entities enforce stronger scopes.
- `POST /v1/search` exists in the endpoint list, but no request/response contract is specified.
- Read-only and admin-only system entities are mixed into the same generic route pattern without an explicit capability or authorization contract beyond a brief note.

Required fix:

- Add capability metadata to the route registry and show scope enforcement in the route example.
- Define typed request and response examples for:
  - `POST /v1/search`
  - `POST /v1/deals/:id/move`
  - `POST /v1/schema/migrations/preview`
  - one read-only admin entity
- Split public vs admin routes in the package structure if the scope model differs materially.

### 10. The MCP spec does not yet meet its own “show tool definitions in TypeScript” bar

Severity: Medium

References:

- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md#L97)
- [05-mcp.md](/Users/sharonsciammas/orbit-ai/docs/specs/05-mcp.md#L195)

Problem:

- The spec enumerates 23 tools, but only one actual TypeScript tool definition is shown.
- Most tools are described in prose or JSON examples only.
- That leaves important ambiguities in input shape, required vs optional params, and output form.

Required fix:

- Add one TypeScript definition block per tool group at minimum, with the full input schemas for all 23 tools captured in code, not prose alone.
- Define a shared helper layer for common params such as `object_type`, `cursor`, `limit`, `include`, and `idempotency_key`.

### 11. Shared naming conventions and pagination contracts are still mixed between wire-level and internal contracts

Severity: Medium

References:

- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L220)
- [01-core.md](/Users/sharonsciammas/orbit-ai/docs/specs/01-core.md#L246)
- [02-api.md](/Users/sharonsciammas/orbit-ai/docs/specs/02-api.md#L305)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md#L277)

Problem:

- `PageMeta` is snake_case, but `PaginatedResult` remains camelCase.
- The API route examples pass internal pagination results directly into `toEnvelope(...)` without specifying the translation boundary.
- SDK record types are snake_case, while some internal TypeScript contracts elsewhere use camelCase names such as `orgId`, `apiKeyId`, and `requestId`.
- That may be a valid internal/external split, but the specs do not state the translation boundary explicitly.

Required fix:

- Add one short rule to the core spec:
  - wire format is snake_case
  - internal service and adapter context may use camelCase
- Add serializer/deserializer ownership:
  - API owns wire serialization
  - SDK normalizes nothing unless explicitly requested

## Lower-Priority Risks

### 12. Base entity coverage still needs a single canonical answer

Severity: Medium

Problem:

- Repo-level docs mention `channels` as a base entity, but the core spec does not define a `channels` table.
- The specs are internally mostly consistent without it, but the repo-level architecture will confuse implementers unless one source of truth wins.

Recommendation:

- Update the meta plan or core spec so the canonical base entity set is unambiguous before implementation starts.

### 13. Connector persistence is still missing the minimum safe schema detail

Severity: Medium

References:

- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md#L330)

Problem:

- `integration_connections` is only partially defined.
- `integration_sync_state` is named but not defined.
- There is no normalized schema for OAuth refresh metadata, sync cursors, provider subscription IDs, or failure tracking.

Recommendation:

- Fully specify `integration_connections` and `integration_sync_state` before connector implementation begins.

### 14. Global search is now present in API and CLI but is only lightly grounded in core

Severity: Low

Problem:

- The SDK and API mention cross-entity search, but the core spec only hints at a `search-service.ts` and does not provide the ranking/indexing contract that the other packages assume.

Recommendation:

- Add a dedicated search section to the core spec before implementation begins.

## Recommended Next Step

Do not begin coding packages yet. First tighten the specs around the critical and high-severity findings above, then freeze a corrected v1 baseline and only then start the phased implementation plan.
