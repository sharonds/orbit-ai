# @orbit-ai/api

> Hono-based REST API server for the Orbit AI CRM infrastructure.
> Wraps `@orbit-ai/core` with authentication, scope enforcement, idempotency,
> rate limiting, sanitization, and a full `/v1/*` route surface.

**Status**: `0.1.0-alpha`.

## What this package provides

- **Full REST surface** — `POST/GET/PATCH/DELETE /v1/<entity>` for every Orbit AI
  entity, plus search, context, admin, bootstrap, organization, workflow, and
  relationship routes
- **Authentication middleware** — API-key auth with SHA-256 hashing; pluggable
  `lookupApiKeyForAuth` hook on the storage adapter
- **Tenant context middleware** — injects `orgId` into every request so entity
  services are always correctly scoped
- **Idempotency** — `Idempotency-Key` header support with a pluggable
  `IdempotencyStore` interface (in-memory default, swap for Redis/DB-backed)
- **Rate limiting** — per-API-key sliding window (in-memory, single-instance)
- **Body size limiting** — configurable `maxRequestBodySize` (default 1 MB)
- **Request IDs** — every response carries a `X-Request-Id` header
- **OpenAPI spec** — `GET /v1/openapi.json` auto-generated from the route definitions

## Installation

```bash
pnpm add @orbit-ai/api @orbit-ai/core
# or
npm install @orbit-ai/api @orbit-ai/core
```

Requires **Node.js 22+**.

## Quick server setup

```typescript
import { createApi } from '@orbit-ai/api/node'
import {
  createSqliteStorageAdapter,
  createSqliteOrbitDatabase,
  createCoreServices,
  initializeAllSqliteSchemas,
} from '@orbit-ai/core'

// 1. Build a storage adapter (SQLite shown — use Postgres for production)
const db = createSqliteOrbitDatabase()
await initializeAllSqliteSchemas(db)

const adapter = createSqliteStorageAdapter({
  database: db,
  lookupApiKeyForAuth: async (keyHash) => {
    // Look up the API key by its SHA-256 hash and return auth context
    // In production, query your api_keys table
    return { id: 'key_01', organizationId: 'org_01', scopes: ['*'], revokedAt: null, expiresAt: null }
  },
})

const services = createCoreServices(adapter)

// 2. Create the Hono app
const app = createApi({
  adapter,
  version: '2026-04-01',
  services,
  // idempotencyStore: myRedisStore,  // optional: for multi-instance deployments
  // maxRequestBodySize: 2_097_152,   // optional: 2 MB override
})

// app is a Hono instance — serve it with any Node.js HTTP server
```

## Routes overview

```
GET    /health
GET    /v1/status
GET    /v1/openapi.json

POST   /v1/contacts
GET    /v1/contacts
GET    /v1/contacts/:id
PATCH  /v1/contacts/:id
DELETE /v1/contacts/:id

# Same pattern for: companies, deals, pipelines, stages, users,
# activities, tasks, notes, products, payments, contracts,
# sequences, sequence-steps, sequence-enrollments, sequence-events,
# tags, webhooks, imports

POST   /v1/schema/migrations/preview
POST   /v1/schema/migrations/apply
POST   /v1/schema/migrations/:id/rollback
```

**Field naming convention:** entity request bodies and response records use `snake_case` (e.g. `stage_id`, `organization_id`). The API layer converts to/from the internal camelCase Drizzle representation automatically — entity consumers never see camelCase field names. Schema migration operation payloads are the exception: they use strict semantic camelCase keys such as `entityType`, `fieldName`, and `newFieldName` so API, SDK, DirectTransport, and CLI use one checksum-canonical shape. Some entities have additional semantic renames: `deal.name` (public) ↔ `deal.title` (internal), `stage.position` ↔ `stage.stageOrder`, `note.body` ↔ `note.content`, `note.user_id` ↔ `note.createdByUserId`.

All responses follow the `OrbitEnvelope` shape:

```json
{
  "data": { ... },
  "meta": { "request_id": "req_...", "version": "2026-04-01", "has_more": false, "next_cursor": null }
}
```

## Schema migrations

Migration preview/apply/rollback is available under `/v1/schema/migrations/*`.
Preview requires `schema:read`; apply and rollback require `schema:apply`.

```json
{
  "operations": [
    { "type": "custom_field.delete", "entityType": "contacts", "fieldName": "legacy_status" }
  ]
}
```

Preview returns a checksum bound to the authenticated org, adapter dialect, and
normalized operations. Destructive apply must echo that checksum and include:

```json
{
  "operations": [
    { "type": "custom_field.delete", "entityType": "contacts", "fieldName": "legacy_status" }
  ],
  "checksum": "64-hex-character-checksum",
  "confirmation": {
    "destructive": true,
    "checksum": "64-hex-character-checksum",
    "confirmedAt": "2026-04-26T00:00:00.000Z"
  }
}
```

Apply responses include `migrationId`, `checksum`, `status`,
`appliedOperations`, `rollbackable`, and `rollbackDecision`. `custom_field.delete`
is executable but non-rollbackable unless future value snapshots exist;
`custom_field.rename` is rollbackable. Rollback uses
`POST /v1/schema/migrations/:id/rollback` with the expected rollback checksum and
the same confirmation shape when confirming destructive rollback.

The minimal confirmation shape above is sufficient only outside production-like
environments. When `destructiveMigrationEnvironment` is `staging` or
`production`, core also requires safeguard evidence in
`confirmation.safeguards`: environment acknowledgement, backup or snapshot
evidence, ledger evidence, and a rollback or non-rollbackable decision.

Errors follow:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Contact not found",
    "retryable": false,
    "request_id": "req_..."
  }
}
```

## Configuration reference

```typescript
import type { IdempotencyStore } from '@orbit-ai/api'

interface CreateApiOptions {
  adapter: RuntimeApiAdapter   // StorageAdapter minus migrate/runWithMigrationAuthority
  version: string              // Returned in every response's meta.version
  services?: CoreServices      // Optional: pre-built services (useful for tests)
  migrationAuthority?: SchemaMigrationAuthority // Required for apply/rollback execution
  destructiveMigrationEnvironment?: DestructiveMigrationEnvironment // e.g. test/staging/production
  maxRequestBodySize?: number  // Bytes. Default: 1_048_576 (1 MB)
  idempotencyStore?: IdempotencyStore // Optional: custom store for multi-instance
}
```

`migrationAuthority` is intentionally explicit. `createApi` never recovers
elevated migration credentials from the runtime adapter, so an API process that
omits this option can still serve normal requests and previews but returns
`MIGRATION_AUTHORITY_UNAVAILABLE` for migration execution.
Set `destructiveMigrationEnvironment` from trusted process configuration, not
from request bodies; production-like values enforce the safeguard evidence above
before elevated execution.

## Known alpha limitations

- Rate limiting is **in-memory** — single-instance only. A pluggable `RateLimitStore`
  interface is planned for v1 GA.
- Idempotency defaults to an in-memory store. For multi-instance deployments, pass a
  custom `IdempotencyStore` implementation via `CreateApiOptions.idempotencyStore`.
- API keys are SHA-256 hashed. HMAC-SHA256 + server pepper is planned for v1 GA.
- The full list of known gaps is in
  [`docs/review/2026-04-08-post-stack-audit.md`](../../docs/review/2026-04-08-post-stack-audit.md).

## License

MIT — see [LICENSE](LICENSE).
