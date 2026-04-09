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
```

All responses follow the `OrbitEnvelope` shape:

```json
{
  "data": { ... },
  "meta": { "request_id": "req_...", "version": "2026-04-01", "has_more": false, "next_cursor": null }
}
```

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
  maxRequestBodySize?: number  // Bytes. Default: 1_048_576 (1 MB)
  idempotencyStore?: IdempotencyStore // Optional: custom store for multi-instance
}
```

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
