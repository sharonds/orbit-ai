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
  `lookupApiKey` hook on the storage adapter
- **Tenant context middleware** — injects `orgId` + `userId` into every request so
  entity services are always correctly scoped
- **Idempotency** — `Idempotency-Key` header support with an in-process store (swap
  out for Redis-backed via the `IdempotencyStore` interface)
- **Rate limiting** — per-API-key sliding window, configurable via `RateLimitOptions`
- **Body size limiting** — configurable `maxRequestBodySize` (default 1 MB)
- **Request IDs** — every response carries a `X-Request-Id` header
- **OpenAPI spec** — `GET /v1/openapi.json` auto-generated from the route definitions

## Installation

```bash
pnpm add @orbit-ai/api
# or
npm install @orbit-ai/api
```

Requires **Node.js 22+** and `@orbit-ai/core`.

## Quick server setup

```typescript
import { serve } from '@hono/node-server'
import { createApi } from '@orbit-ai/api'
import { createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'

// 1. Build a storage adapter (SQLite shown — use Postgres for production)
const db = createSqliteOrbitDatabase({ filename: './dev.db' })
const adapter = createSqliteStorageAdapter({
  connect: () => db.connect(),
  disconnect: () => db.disconnect(),
  migrate: () => db.migrate(),
  getSchemaSnapshot: () => db.getSchemaSnapshot(),
  lookupApiKeyForAuth: async (hashedKey) => db.lookupApiKey(hashedKey),
})
await adapter.connect()

// 2. Create the Hono app
const app = createApi({
  adapter,
  version: '0.1.0-alpha',
  // maxRequestBodySize: 2_097_152, // 2 MB override (optional)
})

// 3. Serve
serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('Orbit AI API running on http://localhost:3001')
})
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

GET    /v1/search
GET    /v1/context
POST   /v1/bootstrap
GET    /v1/organizations
POST   /v1/workflows/:entity/:id/transition
GET    /v1/relationships/:entity/:id
```

All responses follow the `OrbitEnvelope` shape:

```json
{
  "data": { ... },
  "meta": { "requestId": "...", "version": "0.1.0-alpha" }
}
```

Errors follow:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Contact not found",
    "retryable": false
  }
}
```

## Authentication

Pass your API key in the `Authorization` header:

```
Authorization: Bearer sk_your_key_here
```

Keys are SHA-256 hashed before lookup. The adapter's `lookupApiKeyForAuth` callback
receives the hashed key and must return the associated org/user context or `null`.

## Configuration reference

```typescript
interface CreateApiOptions {
  adapter: RuntimeApiAdapter   // StorageAdapter minus migrate/runWithMigrationAuthority
  version: string              // Returned in every response's meta.version
  services?: CoreServices      // Optional: pre-built services (useful for tests)
  maxRequestBodySize?: number  // Bytes. Default: 1_048_576 (1 MB)
}
```

## Known alpha limitations

- Idempotency and rate limiting are **in-memory** — single-instance only. For
  multi-instance deployments, implement `IdempotencyStore` and pass it via adapter config.
- API keys are SHA-256 hashed. HMAC-SHA256 + server pepper is planned for v1 GA.
- The full list of known gaps is in
  [`docs/review/2026-04-08-post-stack-audit.md`](../../docs/review/2026-04-08-post-stack-audit.md).

## License

MIT — see [LICENSE](LICENSE).
