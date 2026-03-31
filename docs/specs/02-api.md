# Spec 2: `@orbit-ai/api`

Status: Ready for implementation
Package: `packages/api`
Depends on: `@orbit-ai/core`

## 1. Scope

`@orbit-ai/api` exposes Orbit over HTTP using Hono. It is the canonical network interface for:

- CRUD for every externally supported entity plus read/admin access for system entities
- search, batch, timeline, and relationship endpoints
- API key authentication
- cursor pagination and include expansion
- Stripe-style error semantics, idempotency, and date-based versioning
- OpenAPI 3.1 generation
- outbound webhook registration and delivery management

The API package does not own domain rules. It composes `@orbit-ai/core` services.

## 2. Package Structure

```text
packages/api/
├── src/
│   ├── app.ts
│   ├── create-api.ts
│   ├── config.ts
│   ├── context.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── version.ts
│   │   ├── request-id.ts
│   │   ├── rate-limit.ts
│   │   ├── idempotency.ts
│   │   └── error-handler.ts
│   ├── routes/
│   │   ├── entities.ts
│   │   ├── objects.ts
│   │   ├── webhooks.ts
│   │   ├── health.ts
│   │   └── imports.ts
│   ├── openapi/
│   │   ├── registry.ts
│   │   └── schemas.ts
│   └── responses.ts
└── package.json
```

## 3. API Conventions

### 3.1 Base Path and Versioning

- Base path: `/v1`
- Required version header: `Orbit-Version: 2026-04-01`
- Absent header defaults to the current stable version
- Breaking changes require a new calendar date version and 24-month support window

### 3.2 Authentication

- Header: `Authorization: Bearer orbit_live_...`
- API keys resolve to an organization and allowed scopes
- Request context exposes `orgId`, `apiKeyId`, optional `userId`, and `requestId`

### 3.3 Envelope Format

Success responses always return:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_01J1...",
    "cursor": null,
    "next_cursor": null,
    "has_more": false,
    "version": "2026-04-01"
  },
  "links": {
    "self": "/v1/contacts/contact_01J1..."
  }
}
```

Errors always return:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "email must be a valid email address",
    "field": "email",
    "doc_url": "https://orbit-ai.dev/docs/errors#validation_failed",
    "request_id": "req_01J1...",
    "hint": "Provide a syntactically valid email or omit the field",
    "recovery": "Retry the request with a corrected payload",
    "retryable": false
  }
}
```

### 3.4 Includes and Expansion

- Query parameter: `include=company,assigned_to,tags`
- Nested expansion depth is capped at 2
- Unknown include targets return `VALIDATION_FAILED`
- Expanded relationships are attached inside the resource body under `included`

### 3.5 Pagination

- Query params: `limit`, `cursor`
- Default limit: `25`
- Max limit: `100`
- Every list, search, relationship, timeline, import rows, and webhook delivery endpoint is cursor-based

## 4. Hono App Composition

```typescript
// packages/api/src/create-api.ts
import { Hono } from 'hono'
import { requestIdMiddleware } from './middleware/request-id'
import { versionMiddleware } from './middleware/version'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { idempotencyMiddleware } from './middleware/idempotency'
import { registerEntityRoutes } from './routes/entities'
import { registerObjectRoutes } from './routes/objects'
import { registerWebhookRoutes } from './routes/webhooks'
import { registerImportRoutes } from './routes/imports'
import { registerHealthRoutes } from './routes/health'
import type { StorageAdapter } from '@orbit-ai/core'

export interface CreateApiOptions {
  adapter: StorageAdapter
  version: string
}

export function createApi(options: CreateApiOptions) {
  const app = new Hono()

  app.use('*', requestIdMiddleware())
  app.use('/v1/*', versionMiddleware(options.version))
  app.use('/v1/*', authMiddleware(options.adapter))
  app.use('/v1/*', rateLimitMiddleware())
  app.use('/v1/*', idempotencyMiddleware(options.adapter))

  registerHealthRoutes(app)
  registerEntityRoutes(app, options.adapter)
  registerObjectRoutes(app, options.adapter)
  registerWebhookRoutes(app, options.adapter)
  registerImportRoutes(app, options.adapter)

  return app
}
```

## 5. Endpoint Matrix

Every entity below supports the standard collection and item endpoints:

- `GET /v1/<entity>`
- `POST /v1/<entity>`
- `GET /v1/<entity>/:id`
- `PATCH /v1/<entity>/:id`
- `DELETE /v1/<entity>/:id`
- `POST /v1/<entity>/search`
- `POST /v1/<entity>/batch`

Exceptions:

- `audit_logs`, `schema_migrations`, `idempotency_keys`, and `webhook_deliveries` are read-only over HTTP and therefore expose `GET`, `GET/:id`, and `POST /search`, but not mutating routes.
- `organizations`, `organization_memberships`, and `api_keys` are admin-scoped and must enforce elevated scopes.

Public entities:

- `contacts`
- `companies`
- `deals`
- `pipelines`
- `stages`
- `activities`
- `tasks`
- `notes`
- `products`
- `payments`
- `contracts`
- `sequences`
- `sequence_steps`
- `sequence_enrollments`
- `sequence_events`
- `tags`
- `webhooks`
- `users`
- `imports`

Admin and system entities:

- `organizations`
- `organization_memberships`
- `api_keys`
- `custom_field_definitions`
- `webhook_deliveries`
- `audit_logs`
- `schema_migrations`
- `idempotency_keys`
- `entity_tags`

Relationship and workflow endpoints:

- `GET /v1/contacts/:id/timeline`
- `GET /v1/contacts/:id/deals`
- `GET /v1/contacts/:id/activities`
- `GET /v1/contacts/:id/tasks`
- `GET /v1/contacts/:id/tags`
- `GET /v1/companies/:id/contacts`
- `GET /v1/companies/:id/deals`
- `GET /v1/deals/:id/timeline`
- `POST /v1/deals/:id/move`
- `GET /v1/deals/pipeline`
- `GET /v1/deals/stats`
- `POST /v1/activities/log`
- `POST /v1/sequences/:id/enroll`
- `POST /v1/sequence_enrollments/:id/unenroll`
- `POST /v1/tags/:id/attach`
- `POST /v1/tags/:id/detach`

Schema and introspection endpoints:

- `GET /v1/objects`
- `GET /v1/objects/:type`
- `POST /v1/objects/:type/fields`
- `PATCH /v1/objects/:type/fields/:fieldName`
- `DELETE /v1/objects/:type/fields/:fieldName`
- `POST /v1/schema/migrations/preview`
- `POST /v1/schema/migrations/apply`
- `POST /v1/schema/migrations/:id/rollback`

Webhook endpoints:

- `GET /v1/webhooks`
- `POST /v1/webhooks`
- `GET /v1/webhooks/:id`
- `PATCH /v1/webhooks/:id`
- `DELETE /v1/webhooks/:id`
- `GET /v1/webhooks/:id/deliveries`
- `POST /v1/webhooks/:id/redeliver`

Operational endpoints:

- `GET /health`
- `GET /v1/status`
- `GET /v1/context/:contactId`
- `POST /v1/search`

## 6. Generic Route Registration

```typescript
// packages/api/src/routes/entities.ts
import { z } from 'zod'
import type { Hono } from 'hono'
import type { StorageAdapter } from '@orbit-ai/core'

const ENTITY_CAPABILITIES = {
  organizations: { read: true, write: true, batch: false, admin: true },
  organization_memberships: { read: true, write: true, batch: false, admin: true },
  api_keys: { read: true, write: true, batch: false, admin: true },
  contacts: { read: true, write: true, batch: true },
  companies: { read: true, write: true, batch: true },
  deals: { read: true, write: true, batch: true },
  pipelines: { read: true, write: true, batch: false },
  stages: { read: true, write: true, batch: false },
  activities: { read: true, write: true, batch: true },
  tasks: { read: true, write: true, batch: true },
  notes: { read: true, write: true, batch: true },
  products: { read: true, write: true, batch: true },
  payments: { read: true, write: true, batch: true },
  contracts: { read: true, write: true, batch: true },
  sequences: { read: true, write: true, batch: true },
  sequence_steps: { read: true, write: true, batch: false },
  sequence_enrollments: { read: true, write: true, batch: false },
  sequence_events: { read: true, write: false, batch: false },
  tags: { read: true, write: true, batch: true },
  entity_tags: { read: true, write: true, batch: false },
  custom_field_definitions: { read: true, write: true, batch: false, admin: true },
  webhooks: { read: true, write: true, batch: false },
  webhook_deliveries: { read: true, write: false, batch: false, admin: true },
  users: { read: true, write: true, batch: false, admin: true },
  imports: { read: true, write: true, batch: false },
  audit_logs: { read: true, write: false, batch: false, admin: true },
  schema_migrations: { read: true, write: false, batch: false, admin: true },
  idempotency_keys: { read: true, write: false, batch: false, admin: true },
} as const

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  include: z.string().optional(),
})

export function registerEntityRoutes(app: Hono, adapter: StorageAdapter) {
  for (const [entity, capabilities] of Object.entries(ENTITY_CAPABILITIES)) {
    app.get(`/v1/${entity}`, async (c) => {
      const query = listQuerySchema.parse(c.req.query())
      const service = resolveService(adapter, entity)
      const result = await service.list(c.get('orbit'), {
        limit: query.limit,
        cursor: query.cursor,
        include: query.include?.split(',').filter(Boolean),
      })
      return c.json(toEnvelope(c, result.data, result))
    })

    if (capabilities.write) {
      app.post(`/v1/${entity}`, async (c) => {
        const service = resolveService(adapter, entity)
        const body = await c.req.json()
        const created = await service.create(c.get('orbit'), body)
        return c.json(toEnvelope(c, created), 201)
      })
    }

    app.get(`/v1/${entity}/:id`, async (c) => {
      const service = resolveService(adapter, entity)
      const record = await service.get(c.get('orbit'), c.req.param('id'))
      if (!record) return c.json(toError(c, 'RESOURCE_NOT_FOUND', `${entity} not found`), 404)
      return c.json(toEnvelope(c, record))
    })

    if (capabilities.write) {
      app.patch(`/v1/${entity}/:id`, async (c) => {
        const service = resolveService(adapter, entity)
        const record = await service.update(c.get('orbit'), c.req.param('id'), await c.req.json())
        return c.json(toEnvelope(c, record))
      })
    }

    if (capabilities.write) {
      app.delete(`/v1/${entity}/:id`, async (c) => {
        const service = resolveService(adapter, entity)
        await service.delete(c.get('orbit'), c.req.param('id'))
        return c.json(toEnvelope(c, { id: c.req.param('id'), deleted: true }))
      })
    }

    app.post(`/v1/${entity}/search`, async (c) => {
      const service = resolveService(adapter, entity)
      const result = await service.search(c.get('orbit'), await c.req.json())
      return c.json(toEnvelope(c, result.data, result))
    })

    if (capabilities.batch) {
      app.post(`/v1/${entity}/batch`, async (c) => {
        const body = await c.req.json()
        const service = resolveService(adapter, entity)
        const result = await service.batch(c.get('orbit'), body)
        return c.json(toEnvelope(c, result))
      })
    }
  }
}
```

`resolveService()` maps route names to `@orbit-ai/core` services. No API-layer business logic is allowed beyond HTTP translation.

## 7. Request and Response Shapes

### 7.1 Resource Shape

Every resource object must include:

- `id`
- `object`
- `organization_id`
- `created_at`
- `updated_at`

Example:

```json
{
  "id": "contact_01J1YQ3PS6GQYQ4B4P2S9R7T0V",
  "object": "contact",
  "organization_id": "org_01J1YQ2CFQ0A1T8C2M2T4W4R19",
  "name": "Jane Doe",
  "email": "jane@acme.com",
  "company_id": "company_01J1YQ4M9STY6T2ZBW15XQ7P8C",
  "custom_fields": {
    "wedding_date": "2026-06-01"
  },
  "created_at": "2026-04-01T09:00:00.000Z",
  "updated_at": "2026-04-01T09:00:00.000Z"
}
```

### 7.2 Batch Endpoint Contract

`POST /v1/<entity>/batch`

```json
{
  "operations": [
    {
      "idempotency_key": "idem_01J1...",
      "action": "create",
      "data": { "name": "Jane Doe" }
    },
    {
      "idempotency_key": "idem_01J1...",
      "action": "update",
      "id": "contact_01J1...",
      "data": { "status": "customer" }
    }
  ]
}
```

Response:

```json
{
  "data": [
    { "ok": true, "result": { "id": "contact_01J1..." } },
    { "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "status is invalid" } }
  ],
  "meta": {
    "request_id": "req_01J1...",
    "cursor": null,
    "next_cursor": null,
    "has_more": false,
    "version": "2026-04-01"
  },
  "links": {
    "self": "/v1/contacts/batch"
  }
}
```

## 8. Auth Middleware

```typescript
// packages/api/src/middleware/auth.ts
import type { MiddlewareHandler } from 'hono'
import { eq, isNull, or } from 'drizzle-orm'
import { apiKeys } from '@orbit-ai/core'
import type { StorageAdapter } from '@orbit-ai/core'

export function authMiddleware(adapter: StorageAdapter): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return c.json(toError(c, 'AUTH_INVALID_API_KEY', 'Missing bearer token'), 401)
    }

    const raw = auth.slice('Bearer '.length)
    const keyHash = await hashApiKey(raw)
    const key = await adapter.database.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    })

    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
      return c.json(toError(c, 'AUTH_INVALID_API_KEY', 'API key is invalid or expired'), 401)
    }

    c.set('orbit', {
      orgId: key.organizationId,
      apiKeyId: key.id,
      requestId: c.get('requestId'),
    })

    await adapter.enableTenantContext(c.get('orbit'))
    await next()
  }
}
```

Scope enforcement:

- read endpoints require `*.read` or `*`
- write endpoints require `*.write` or `*`
- schema endpoints require `schema.write`
- webhook endpoints require `webhooks.write`

## 9. Rate Limiting

Defaults:

- 100 requests per rolling minute per API key
- 1,000 write requests per rolling hour per API key
- 10 concurrent idempotent write locks per API key

Headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

Implementation order:

1. Upstash Redis for hosted deployments
2. in-memory token bucket fallback for self-hosted single-node mode

429 responses must include `Retry-After`.

## 10. Idempotency

Mutating endpoints require or auto-generate an idempotency key:

- accepted header: `Idempotency-Key`
- if absent on `POST`, `PATCH`, `DELETE`, the server creates one and returns it in `Idempotency-Key`
- server stores request hash and response body in `orbit.idempotency_keys`
- same key + same route + same body returns cached response
- same key + different body returns `409 IDEMPOTENCY_CONFLICT`

```typescript
// packages/api/src/middleware/idempotency.ts
export function idempotencyMiddleware(adapter: StorageAdapter): MiddlewareHandler {
  return async (c, next) => {
    if (!['POST', 'PATCH', 'DELETE'].includes(c.req.method)) return next()
    const key = c.req.header('idempotency-key') ?? `idem_${crypto.randomUUID()}`
    c.header('Idempotency-Key', key)
    c.set('idempotencyKey', key)
    await next()
  }
}
```

## 11. Webhooks

Orbit adopts the Standard Webhooks model.

### 11.1 Events

MVP event names:

- `contact.created`
- `contact.updated`
- `contact.deleted`
- `company.created`
- `company.updated`
- `deal.created`
- `deal.updated`
- `deal.deleted`
- `deal.stage_moved`
- `activity.logged`
- `task.created`
- `task.completed`
- `payment.created`
- `contract.signed`
- `sequence.enrolled`
- `sequence.unenrolled`
- `schema.field_created`
- `schema.entity_created`

### 11.2 Delivery Contract

Headers:

- `webhook-id`
- `webhook-timestamp`
- `webhook-signature`
- `idempotency-key`

Body:

```json
{
  "id": "evt_01J1...",
  "type": "deal.stage_moved",
  "created": "2026-04-01T09:00:00.000Z",
  "data": {
    "object": {
      "id": "deal_01J1...",
      "object": "deal",
      "stage_id": "stage_01J1..."
    },
    "previous_attributes": {
      "stage_id": "stage_01J1OLD..."
    }
  }
}
```

Retry schedule: `0m, 1m, 5m, 30m, 2h, 12h`.

## 12. OpenAPI Generation

OpenAPI is generated from route schemas, not handwritten.

```typescript
// packages/api/src/openapi/registry.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

export const api = new OpenAPIHono()

export const contactCreateRoute = createRoute({
  method: 'post',
  path: '/v1/contacts',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            company_id: z.string().optional(),
            custom_fields: z.record(z.unknown()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Contact created',
    },
  },
})
```

Generated outputs:

- `packages/api/openapi/openapi.json`
- `packages/api/openapi/openapi.yaml`

The SDK and MCP specs consume this OpenAPI artifact for verification, not as their only source of truth.

## 13. Includes, Timeline, and Relationships

Relationship endpoints must resolve through core services, not bespoke joins in the route layer.

Timeline semantics:

- `contacts/:id/timeline` merges activities, notes, tasks, payments, contracts, and deal stage moves
- `deals/:id/timeline` merges activities, notes, tasks, payments, contracts, and pipeline transitions
- timeline items are sorted descending by event timestamp and paginated with cursor

Example timeline item:

```json
{
  "id": "activity_01J1...",
  "object": "timeline_event",
  "event_type": "activity.logged",
  "occurred_at": "2026-04-01T09:00:00.000Z",
  "record": {
    "id": "activity_01J1...",
    "object": "activity",
    "type": "email"
  }
}
```

## 14. Deployment Targets

The package must ship these entry points:

- `@orbit-ai/api/node`
- `@orbit-ai/api/vercel`
- `@orbit-ai/api/cloudflare`

All three use the same `createApi()` factory. Platform files only adapt request/response plumbing.

## 15. Acceptance Criteria

1. Every entity and workflow endpoint listed in this spec exists and is documented in OpenAPI.
2. Success responses always match `{ data, meta, links }`.
3. Error responses always match the Orbit error shape.
4. Auth, rate limiting, idempotency, include expansion, and cursor pagination are applied uniformly.
5. Webhook events include full payloads and Standard Webhooks-compatible headers.
6. `Orbit-Version` handling is enforced by middleware.
7. API code imports shared envelope, error, and pagination types from `@orbit-ai/core` without redefining them.
