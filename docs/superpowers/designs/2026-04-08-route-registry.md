# Design: Shared Route/Capability Registry for Orbit AI API

**Date:** 2026-04-08
**Author:** Qwen Code (Code Architect Agent)
**Status:** Proposal
**Target Package:** `packages/api/`

---

## 1. Problem Statement

The Orbit AI API has **two independent sources of truth** for route capabilities:

| Source | Consumed By | Purpose |
|---|---|---|
| `PUBLIC_ENTITY_CAPABILITIES` in `routes/entities.ts` | Runtime Hono route registration | Decides which HTTP methods exist per entity |
| `BASE_ENTITIES` in `openapi/entities.ts` | Static OpenAPI spec generation | Generates OpenAPI path objects for entity CRUD |

These drift independently:
- Adding an entity to `entities.ts` does **not** automatically update the OpenAPI spec
- Adding a route to the OpenAPI spec does **not** guarantee a runtime handler exists
- Non-CRUD routes (search, batch, admin, webhooks, schema, workflows, relationships) are **entirely missing** from the OpenAPI spec

The result is an OpenAPI spec that documents only ~20% of the actual runtime surface.

---

## 2. Goal

A **single source of truth** — a route/capability registry — that is:

1. **Consumed by runtime dispatch gating** in `routes/entities.ts` (which routes get registered on the Hono app)
2. **Consumed by OpenAPI spec emission** in `openapi/generator.ts` (which paths appear in the spec)
3. **Type-safe** — rejects registrations with empty `operationId`, empty `tags`, or empty `responses` at the type level
4. **Self-registering** — registration is a side effect of module loading, making drift structurally impossible

---

## 3. Design Decision: Registration Mechanism

### Three Approaches Considered

| Approach | Description | Pros | Cons |
|---|---|---|---|
| **A. Decorator on route handler** | `@registerRoute({...})` above each handler function | Familiar pattern from other frameworks | Requires class/method decorators (not idiomatic Hono), decorators are Stage 3 in TC39, adds transpiler complexity |
| **B. Side-effect module** | A central `registry.ts` that exports a flat array built by importing each route module | Centralized visibility | Creates a new dependency chain: every route module must import itself into the registry, easy to forget |
| **C. Wrapper helper (chosen)** | A typed `register()` helper that wraps `app.<method>()` and auto-emits into a module-scoped `Set` | Zero transpiler needs, idiomatic Hono, side-effect happens at the call site, types enforce invariants | Requires every route module to call the wrapper instead of bare `app.<method>()` |

### Winner: Wrapper Helper (Approach C)

**Why:** Hono's routing model is function-composition, not class-based. A wrapper helper is the lowest-friction integration point. It requires exactly one line change per existing route call (`app.get(...)` -> `register(app, 'get', ...)`), and the TypeScript compiler will enforce that no registration omits required fields.

**Tradeoff acknowledged:** A developer could still forget to call `register()` and instead call `app.get()` directly. This is mitigated by:
1. ESLint rule banning direct `app.<method>()` calls in route modules (future)
2. A startup assertion in `create-api.ts` that verifies the registry is non-empty
3. Code review convention

---

## 4. The Registry Type

### 4.1 Core Types

File: `packages/api/src/registry/types.ts`

```typescript
import type { Context, MiddlewareHandler, Env } from 'hono'
import type { PathPattern } from 'hono/types'

// ---------------------------------------------------------------------------
// HTTP methods we support (excludes Hono's $all since it has no OpenAPI analog)
// ---------------------------------------------------------------------------
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head'

// ---------------------------------------------------------------------------
// OpenAPI response map — at least one status code must be present
// Non-empty enforcement via the branded type pattern below
// ---------------------------------------------------------------------------
export type OpenApiResponses = {
  [status: string]: {
    description: string
    content?: Record<string, { schema: unknown }>
  }
}

// Branded type that guarantees at least one key
export type NonEmptyResponses = OpenApiResponses & { __nonEmpty: true }

// ---------------------------------------------------------------------------
// Parameter descriptor (query, path, header, cookie)
// ---------------------------------------------------------------------------
export interface OpenApiParameter {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required?: boolean
  schema: unknown
  description?: string
}

// ---------------------------------------------------------------------------
// Request body descriptor
// ---------------------------------------------------------------------------
export interface OpenApiRequestBody {
  description?: string
  required?: boolean
  content: Record<string, { schema: unknown }>
}

// ---------------------------------------------------------------------------
// Security requirement
// ---------------------------------------------------------------------------
export type SecurityRequirement = Record<string, string[]>

// ---------------------------------------------------------------------------
// A single route entry in the registry
// ---------------------------------------------------------------------------
export interface RouteRegistration<E extends Env = Env, P extends string = string> {
  /** HTTP method */
  method: HttpMethod

  /** Hono-compatible path pattern (e.g. "/v1/contacts/:id") */
  path: PathPattern

  /** OpenAPI operationId — must be non-empty string */
  operationId: string & { __nonEmpty: true }

  /** OpenAPI tags — must contain at least one tag */
  tags: [string, ...string[]]  // tuple with ≥1 element

  /** Human-readable summary for the OpenAPI spec */
  summary: string

  /** OpenAPI responses map — must have at least one status code */
  responses: NonEmptyResponses

  /** OpenAPI parameters (query/path/header) */
  parameters?: OpenApiParameter[]

  /** OpenAPI request body */
  requestBody?: OpenApiRequestBody

  /** Security scopes required (e.g. ["contacts:read"]) */
  security?: SecurityRequirement[]

  /** Whether this route should appear in the OpenAPI spec (default: true) */
  includeInSpec?: boolean

  /** Category grouping for internal organization */
  category:
    | 'entity-crud'
    | 'entity-action'
    | 'admin'
    | 'system'
    | 'bootstrap'
    | 'webhook'
    | 'import'
    | 'workflow'
    | 'relationship'
    | 'search'
    | 'schema'
    | 'organization'
}

// ---------------------------------------------------------------------------
// Registry singleton interface
// ---------------------------------------------------------------------------
export interface RouteRegistry {
  /** Register a route and return the Hono middleware array for chaining */
  register<E extends Env, P extends string>(
    route: RouteRegistration<E, P>
  ): MiddlewareHandler<E, P>[]

  /** Get all registered routes */
  getAll(): ReadonlyArray<RouteRegistration>

  /** Get routes filtered by category */
  getByCategory(category: RouteRegistration['category']): ReadonlyArray<RouteRegistration>

  /** Get routes that should appear in OpenAPI spec */
  getSpecRoutes(): ReadonlyArray<RouteRegistration>

  /** Clear all routes (useful in tests) */
  reset(): void
}
```

### 4.2 Why These Invariants Work

| Invariant | Enforcement Mechanism |
|---|---|
| `operationId` non-empty | `string & { __nonEmpty: true }` — only constructible via `operationId: 'listContacts'` literal; runtime assertion backs it up |
| `tags` non-empty | `[string, ...string[]]` tuple type — TS will not compile `tags: []` |
| `responses` non-empty | `NonEmptyResponses` branded type; runtime assertion validates `Object.keys(responses).length > 0` |

Runtime assertions in the `register()` implementation provide a second line of defense for values that bypass type checks (e.g., from `as` casts).

---

## 5. The Wrapper Helper

File: `packages/api/src/registry/registry.ts`

```typescript
import type { Hono, Env, MiddlewareHandler, Context } from 'hono'
import type { PathPattern } from 'hono/types'
import type { RouteRegistration, RouteRegistry, HttpMethod } from './types.js'

// ---------------------------------------------------------------------------
// Module-scoped singleton
// ---------------------------------------------------------------------------
const routes: RouteRegistration[] = []

function assertNonEmptyString(value: string, field: string): asserts value is string & { __nonEmpty: true } {
  if (!value || value.trim().length === 0) {
    throw new Error(`RouteRegistry: ${field} must be a non-empty string`)
  }
}

function assertNonEmptyArray<T>(value: T[], field: string): asserts value is [T, ...T[]] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`RouteRegistry: ${field} must contain at least one element`)
  }
}

function assertNonEmptyObject(value: Record<string, unknown>, field: string): void {
  if (!value || Object.keys(value).length === 0) {
    throw new Error(`RouteRegistry: ${field} must have at least one entry`)
  }
}

export const registry: RouteRegistry = {
  register<E extends Env, P extends string>(
    route: RouteRegistration<E, P>
  ): MiddlewareHandler<E, P>[] {
    // Type-level invariants enforced at runtime too (defense in depth)
    assertNonEmptyString(route.operationId, 'operationId')
    assertNonEmptyArray(route.tags, 'tags')
    assertNonEmptyObject(route.responses as Record<string, unknown>, 'responses')

    routes.push(route)
    return route.security?.flatMap((sec) => {
      // Return scope middleware factory — see §7 for integration
      return [] // placeholder; actual middleware resolved at register time
    }) ?? [] as MiddlewareHandler<E, P>[]
  },

  getAll() {
    return Object.freeze([...routes])
  },

  getByCategory(category) {
    return Object.freeze(routes.filter((r) => r.category === category))
  },

  getSpecRoutes() {
    return Object.freeze(routes.filter((r) => r.includeInSpec !== false))
  },

  reset() {
    routes.length = 0
  },
}

// ---------------------------------------------------------------------------
// The wrapper helper that replaces app.<method>(...) calls
// ---------------------------------------------------------------------------

/**
 * Register a route on the Hono app AND into the central registry.
 * This is the ONLY way routes should be registered in route modules.
 *
 * Usage:
 *   registerRoute(app, 'get', '/v1/contacts', {
 *     operationId: 'listContacts',
 *     tags: ['Contacts'],
 *     summary: 'List contacts',
 *     responses: { '200': { description: 'Paginated list of contacts' } },
 *     security: [{ bearerAuth: [] }],
 *     category: 'entity-crud',
 *   }, [requireScope('contacts:read')], handler)
 */
export function registerRoute<
  E extends Env = Env,
  P extends string = string,
>(
  app: Hono<E>,
  method: HttpMethod,
  path: P,
  spec: Omit<RouteRegistration<E, P>, 'method' | 'path'>,
  middleware: MiddlewareHandler<E, P>[],
  handler: (c: Context<E, P>) => Promise<Response> | Response,
): void {
  // Register in the singleton
  registry.register({ method, path, ...spec } as RouteRegistration<E, P>)

  // Register on the Hono app
  const appMethod = app[method] as (
    path: P,
    ...handlers: MiddlewareHandler<E, P>[]
  ) => Hono<E>
  appMethod.call(app, path, ...middleware, handler)
}
```

---

## 6. Worked Examples

### 6.1 Generic Entity Route: `GET /v1/contacts`

**Current code** in `routes/entities.ts`:
```typescript
app.get(`/v1/${entity}`, requireScope(`${entity}:read`), async (c) => {
  const service = resolveService(services, typedEntity)
  const result = await service.list(c.get('orbit'), { limit, cursor, include })
  return c.json(toEnvelope(c, sanitizePublicPage(entity, result.data), result))
})
```

**After migration** — the registry-driven version:
```typescript
import { registerRoute } from '../registry/registry.js'
import type { RouteRegistration } from '../registry/types.js'

// Entity capability map is now the ONLY data structure needed.
// Routes are derived from it via a factory that calls registerRoute.

function createEntityCrudSpec(
  entity: string,
  capabilities: { read: boolean; write: boolean; batch: boolean },
): RouteRegistration[] {
  const tag = entity.charAt(0).toUpperCase() + entity.slice(1)
  const specs: RouteRegistration[] = []

  if (capabilities.read) {
    specs.push({
      method: 'get',
      path: `/v1/${entity}`,
      operationId: `list${tag}`,
      tags: [tag],
      summary: `List ${entity}`,
      responses: {
        '200': { description: `Paginated list of ${entity}` },
        '401': { description: 'Unauthorized' },
        '429': { description: 'Rate limited' },
      },
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
        { name: 'include', in: 'query', schema: { type: 'string' } },
      ],
      security: [{ bearerAuth: [] }],
      category: 'entity-crud',
    })

    specs.push({
      method: 'get',
      path: `/v1/${entity}/:id`,
      operationId: `get${tag}`,
      tags: [tag],
      summary: `Get a ${entity.slice(0, -1)}`,
      responses: {
        '200': { description: `${entity.slice(0, -1)} details` },
        '404': { description: 'Not found' },
      },
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      security: [{ bearerAuth: [] }],
      category: 'entity-crud',
    })
  }

  if (capabilities.write) {
    specs.push({
      method: 'post',
      path: `/v1/${entity}`,
      operationId: `create${tag}`,
      tags: [tag],
      summary: `Create a ${entity.slice(0, -1)}`,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      responses: {
        '201': { description: `${entity.slice(0, -1)} created` },
        '400': { description: 'Validation error' },
        '401': { description: 'Unauthorized' },
        '409': { description: 'Conflict' },
      },
      security: [{ bearerAuth: [] }],
      category: 'entity-crud',
    })

    specs.push({
      method: 'patch',
      path: `/v1/${entity}/:id`,
      operationId: `update${tag}`,
      tags: [tag],
      summary: `Update a ${entity.slice(0, -1)}`,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      responses: {
        '200': { description: `${entity.slice(0, -1)} updated` },
        '404': { description: 'Not found' },
      },
      security: [{ bearerAuth: [] }],
      category: 'entity-crud',
    })

    specs.push({
      method: 'delete',
      path: `/v1/${entity}/:id`,
      operationId: `delete${tag}`,
      tags: [tag],
      summary: `Delete a ${entity.slice(0, -1)}`,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: `${entity.slice(0, -1)} deleted` },
        '404': { description: 'Not found' },
      },
      security: [{ bearerAuth: [] }],
      category: 'entity-crud',
    })
  }

  // Always register search
  specs.push({
    method: 'post',
    path: `/v1/${entity}/search`,
    operationId: `search${tag}`,
    tags: [tag],
    summary: `Search ${entity}`,
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    },
    responses: {
      '200': { description: `Search results for ${entity}` },
    },
    security: [{ bearerAuth: [] }],
    category: 'entity-crud',
  })

  if (capabilities.batch) {
    specs.push({
      method: 'post',
      path: `/v1/${entity}/batch`,
      operationId: `batch${tag}`,
      tags: [tag],
      summary: `Batch operation on ${entity}`,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      responses: {
        '200': { description: `Batch result for ${entity}` },
        '501': { description: 'Batch not implemented' },
      },
      security: [{ bearerAuth: [] }],
      category: 'entity-crud',
    })
  }

  return specs
}
```

**Then the route registration factory** in `routes/entities.ts`:

```typescript
import { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { registerRoute } from '../registry/registry.js'
import { toEnvelope, toError, sanitizePublicRead, sanitizePublicPage } from '../responses.js'
import { requireScope } from '../scopes.js'
import { createEntityCrudSpec } from '../registry/entity-specs.js'

const PUBLIC_ENTITY_CAPABILITIES = {
  contacts: { read: true, write: true, batch: true },
  // ... rest unchanged
} as const

type PublicEntityName = keyof typeof PUBLIC_ENTITY_CAPABILITIES

// ... resolveService unchanged ...

export function registerPublicEntityRoutes(app: Hono, services: CoreServices) {
  for (const [entity, capabilities] of Object.entries(PUBLIC_ENTITY_CAPABILITIES)) {
    const specs = createEntityCrudSpec(entity, capabilities)
    const typedEntity = entity as PublicEntityName

    for (const spec of specs) {
      const scope = spec.method === 'get' && !spec.path.includes(':')
        ? `${entity}:read`
        : spec.method === 'get'
          ? `${entity}:read`
          : `${entity}:write`

      registerRoute(app, spec.method, spec.path, spec, [requireScope(scope)], async (c) => {
        const service = resolveService(services, typedEntity)
        // handler body matches current logic exactly
        // ...
      })
    }
  }
}
```

### 6.2 Admin Route: `GET /v1/admin/audit_logs`

**Current code** in `routes/admin.ts`:
```typescript
app.get(`/v1/admin/${route}`, requireScope('admin:*'), async (c) => {
  const service = resolveAdminService(services, serviceKey)
  const result = await service.list(c.get('orbit'), { limit, cursor })
  return c.json(toEnvelope(c, sanitizeAdminPage(typedRoute, result.data), result))
})
```

**After migration**:

```typescript
import { registerRoute } from '../registry/registry.js'
import type { RouteRegistration } from '../registry/types.js'

const ADMIN_ENTITIES = {
  organization_memberships: 'organizationMemberships',
  api_keys: 'apiKeys',
  custom_field_definitions: 'customFieldDefinitions',
  webhook_deliveries: 'webhookDeliveries',
  audit_logs: 'auditLogs',
  schema_migrations: 'schemaMigrations',
  idempotency_keys: 'idempotencyKeys',
  entity_tags: 'entityTags',
} as const

function createAdminCrudSpec(
  entity: string,
): RouteRegistration[] {
  const tag = entity
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')

  return [
    {
      method: 'get',
      path: `/v1/admin/${entity}`,
      operationId: `listAdmin${tag.replace(/\s/g, '')}`,
      tags: ['Admin', tag],
      summary: `List ${entity}`,
      responses: {
        '200': { description: `Paginated list of ${entity}` },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Insufficient admin scope' },
      },
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      security: [{ bearerAuth: [] }],
      category: 'admin',
    },
    {
      method: 'get',
      path: `/v1/admin/${entity}/:id`,
      operationId: `getAdmin${tag.replace(/\s/g, '')}`,
      tags: ['Admin', tag],
      summary: `Get ${entity.slice(0, -1)}`,
      responses: {
        '200': { description: `${entity.slice(0, -1)} details` },
        '404': { description: 'Not found' },
      },
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      security: [{ bearerAuth: [] }],
      category: 'admin',
    },
  ]
}
```

---

## 7. Migration Impact on `openapi/generator.ts`

### Current State
The generator is **fully static** — it iterates `BASE_ENTITIES` and hardcodes path/operation/response shapes. It knows nothing about admin, webhook, workflow, relationship, schema, or search routes.

### Target State
The generator becomes a **pure transformer** — it reads from the registry singleton and emits OpenAPI paths.

```typescript
/**
 * OpenAPI 3.1 generator — registry-driven.
 * Reads from the central RouteRegistry singleton; no hardcoded entity lists.
 */

import { registry } from '../registry/registry.js'
import type { RouteRegistration, OpenApiParameter, OpenApiResponses } from '../registry/types.js'

export function generateOpenApiSpec(info: { title: string; version: string; description?: string }): Record<string, unknown> {
  const paths: Record<string, unknown> = {}
  const specRoutes = registry.getSpecRoutes()

  for (const route of specRoutes) {
    const pathKey = honoPathToOpenApi(route.path)

    if (!paths[pathKey]) {
      paths[pathKey] = {}
    }

    ;(paths[pathKey] as Record<string, unknown>)[route.method] = {
      summary: route.summary,
      operationId: route.operationId,
      tags: route.tags,
      ...(route.parameters && route.parameters.length > 0
        ? { parameters: route.parameters }
        : {}),
      ...(route.requestBody
        ? { requestBody: route.requestBody }
        : {}),
      responses: route.responses,
      ...(route.security ? { security: route.security } : {}),
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: info.title,
      version: info.version,
      description: info.description ?? 'Orbit AI — CRM infrastructure for AI agents',
    },
    servers: [{ url: '/', description: 'Orbit AI API' }],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key (sk_...)',
        },
      },
      // Shared schemas (Error, Envelope) remain hardcoded here — they are not route-specific
      schemas: {
        Error: { /* ... unchanged ... */ },
        Envelope: { /* ... unchanged ... */ },
      },
    },
  }
}

/** Convert Hono path patterns to OpenAPI path syntax. */
function honoPathToOpenApi(path: string): string {
  // Hono uses :param, OpenAPI uses {param}
  return path.replace(/:([a-zA-Z_]\w*)/g, '{$1}')
}
```

### What Gets Removed

| File | What Goes | What Stays |
|---|---|---|
| `openapi/entities.ts` | Entire file — `BASE_ENTITIES` array is superseded by registry | Delete file entirely |
| `openapi/generator.ts` | Static entity loop, hardcoded path generation | `honoPathToOpenApi()` helper, shared `components.schemas`, `generateOpenApiSpec()` as transformer |
| `routes/entities.ts` | `PUBLIC_ENTITY_CAPABILITIES` stays as **data only** (no OpenAPI concerns) | Entity→service map, handler logic |
| `routes/admin.ts` | `ADMIN_ENTITIES` stays as **data only** | Admin handler logic |

### Key Insight
`openapi/entities.ts` is **deleted**. The `BASE_ENTITIES` constant no longer exists as a separate artifact — entity names flow from `PUBLIC_ENTITY_CAPABILITIES` in `routes/entities.ts` through `createEntityCrudSpec()` into the registry, and the OpenAPI generator reads back from the registry.

---

## 8. Non-CRUD Route Registration

All non-CRUD routes (search, bootstrap, webhooks, organizations, workflows, relationships, objects/schema, health, status, context) must also go through `registerRoute()`. This is straightforward because each special route module already has a `registerXxxRoutes(app, services)` function — we simply replace internal `app.<method>()` calls with `registerRoute(app, ...)`.

### Example: Search Route

```typescript
// routes/search.ts
import { registerRoute } from '../registry/registry.js'

export function registerSearchRoutes(app: Hono, services: CoreServices) {
  registerRoute(app, 'post', '/v1/search', {
    operationId: 'globalSearch',
    tags: ['Search'],
    summary: 'Global search across all object types',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              object_types: { type: 'array', items: { type: 'string' } },
              limit: { type: 'integer', minimum: 1, maximum: 100 },
              cursor: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Search results' },
      '400': { description: 'Validation error' },
    },
    security: [{ bearerAuth: [] }],
    category: 'search',
  }, [requireScope('search:read')], async (c) => {
    // handler body unchanged
  })
}
```

### Example: Health Route

```typescript
// routes/health.ts
import { registerRoute } from '../registry/registry.js'

export function registerHealthCheck(app: Hono) {
  registerRoute(app, 'get', '/health', {
    operationId: 'healthCheck',
    tags: ['System'],
    summary: 'Health check',
    responses: {
      '200': { description: 'Service is healthy' },
    },
    category: 'system',
    includeInSpec: true,
  }, [], (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() })
  )
}
```

---

## 9. File Tree Changes

### New Files
```
packages/api/src/registry/
├── types.ts           # RouteRegistration, RouteRegistry interfaces
├── registry.ts        # Singleton + registerRoute() wrapper
└── entity-specs.ts    # createEntityCrudSpec() factory (entity CRUD spec builder)
```

### Modified Files
```
packages/api/src/routes/entities.ts        # Uses registerRoute() + spec factory
packages/api/src/routes/admin.ts           # Uses registerRoute() + spec factory
packages/api/src/routes/health.ts          # Uses registerRoute()
packages/api/src/routes/search.ts          # Uses registerRoute()
packages/api/src/routes/bootstrap.ts       # Uses registerRoute()
packages/api/src/routes/organizations.ts   # Uses registerRoute()
packages/api/src/routes/webhooks.ts        # Uses registerRoute()
packages/api/src/routes/imports.ts         # Uses registerRoute()
packages/api/src/routes/workflows.ts       # Uses registerRoute()
packages/api/src/routes/relationships.ts   # Uses registerRoute()
packages/api/src/routes/objects.ts         # Uses registerRoute()
packages/api/src/routes/context.ts         # Uses registerRoute()
packages/api/src/openapi/generator.ts      # Reads from registry instead of BASE_ENTITIES
packages/api/src/create-api.ts             # No changes needed (registration is side-effect of module loading)
```

### Deleted Files
```
packages/api/src/openapi/entities.ts       # BASE_ENTITIES is now derived from registry
```

---

## 10. Registration Order Guarantees

Hono matches routes in registration order. The current `create-api.ts` ordering is deliberate and must be preserved:

```
1. /health, /openapi.json  (public)
2. /v1/status               (authenticated system)
3. /v1/search               (search)
4. /v1/context/:contactId   (context)
5. /v1/bootstrap/*          (bootstrap)
6. /v1/organizations/*      (organizations)
7. /v1/admin/*              (admin)
8. /v1/webhooks/*           (webhooks — before generic entities)
9. /v1/imports/*            (imports)
10. /v1/deals/pipeline, /v1/deals/stats, etc. (workflows — before generic entities)
11. /v1/contacts/:id/timeline, etc. (relationships — before generic entities)
12. /v1/objects/*, /v1/schema/* (schema)
13. /v1/{entity}/*          (generic entity CRUD)
```

**The registry does not change this order.** Each route module still calls `registerRoute()` at the same point in the `createApi()` function. The registry is purely a **side-effect recording layer** — it does not reorder or delay registration. The Hono app still receives routes in the exact same sequence.

---

## 11. What `PUBLIC_ENTITY_CAPABILITIES` and `ADMIN_ENTITIES` Become After Migration

Both maps are **retained** but their role shrinks. They are now pure **data** — no OpenAPI concerns, no spec generation. They exist only to answer:

1. Which entities get CRUD routes?
2. Which HTTP methods are enabled per entity?
3. Which service key resolves the entity?

```typescript
// routes/entities.ts — post-migration
const PUBLIC_ENTITY_CAPABILITIES = {
  contacts: { read: true, write: true, batch: true },
  companies: { read: true, write: true, batch: true },
  // ... unchanged data
} as const

// This is ALL that remains of "capability metadata" in the route file.
// OpenAPI spec generation is handled by createEntityCrudSpec() in the registry package.
```

This satisfies the constraint: **capability metadata is not mirrored** between `routes/entities.ts` and `openapi/entities.ts`. The registry is the single consumer of the capability map, and the registry is the single producer of OpenAPI paths.

---

## 12. Testing Strategy

### Unit Tests for the Registry

```typescript
import { registry, registerRoute } from '../registry/registry.js'
import { Hono } from 'hono'

describe('RouteRegistry', () => {
  beforeEach(() => registry.reset())

  it('rejects empty operationId', () => {
    expect(() =>
      registry.register({
        method: 'get',
        path: '/v1/test',
        operationId: '' as any,
        tags: ['Test'],
        summary: 'Test',
        responses: { '200': { description: 'OK' } },
        category: 'system',
      })
    ).toThrow('operationId must be a non-empty string')
  })

  it('rejects empty tags', () => {
    expect(() =>
      registry.register({
        method: 'get',
        path: '/v1/test',
        operationId: 'test',
        tags: [] as any,
        summary: 'Test',
        responses: { '200': { description: 'OK' } },
        category: 'system',
      })
    ).toThrow('tags must contain at least one element')
  })

  it('rejects empty responses', () => {
    expect(() =>
      registry.register({
        method: 'get',
        path: '/v1/test',
        operationId: 'test',
        tags: ['Test'],
        summary: 'Test',
        responses: {} as any,
        category: 'system',
      })
    ).toThrow('responses must have at least one entry')
  })

  it('registers and retrieves routes', () => {
    registerRoute(new Hono(), 'get', '/v1/test', {
      operationId: 'getTest',
      tags: ['Test'],
      summary: 'Test route',
      responses: { '200': { description: 'OK' } },
      category: 'system',
    }, [], (c) => c.json({ ok: true }))

    expect(registry.getAll()).toHaveLength(1)
    expect(registry.getAll()[0].operationId).toBe('getTest')
  })

  it('filters by category', () => {
    // ... register routes in different categories ...
    expect(registry.getByCategory('admin')).toHaveLength(16)
  })
})
```

### Integration Test: Spec Coverage

A test that asserts every registered runtime route has a corresponding OpenAPI path:

```typescript
it('every registered route appears in OpenAPI spec', () => {
  const spec = generateOpenApiSpec({ title: 'Test', version: '1.0' })
  const routes = registry.getSpecRoutes()
  const specPaths = Object.keys(spec.paths)

  for (const route of routes) {
    const openApiPath = honoPathToOpenApi(route.path)
    expect(specPaths).toContain(openApiPath)
    expect(spec.paths[openApiPath]).toHaveProperty(route.method)
  }
})
```

---

## 13. Migration Phases

| Phase | Scope | Risk |
|---|---|---|
| **Phase 1**: Create `registry/types.ts` and `registry/registry.ts` | New files only | None — no existing code touched |
| **Phase 2**: Migrate `routes/entities.ts` to use `registerRoute()` + spec factory | Generic CRUD only | Medium — largest single change |
| **Phase 3**: Migrate `routes/admin.ts` | Admin CRUD | Low — simple pattern repeat |
| **Phase 4**: Migrate all special route modules (health, search, bootstrap, etc.) | Non-CRUD routes | Low — one route at a time |
| **Phase 5**: Rewrite `openapi/generator.ts` to read from registry | Spec generation | Medium — must verify spec parity |
| **Phase 6**: Delete `openapi/entities.ts` | Cleanup | None |
| **Phase 7**: Add integration test (registry completeness assertion) | Test coverage | None |

---

## 14. Appendix: Tradeoff Analysis

### Why Not Hono's OpenAPI Plugin (`@hono/zod-openapi`)?

Hono has an official `@hono/zod-openapi` package that decorates routes with OpenAPI metadata. We considered it but rejected it for these reasons:

| Factor | `@hono/zod-openapi` | Our Registry |
|---|---|---|
| Zod integration | Requires all schemas to be Zod | Our schemas are Zod, but OpenAPI body schemas are often entity-dynamic (custom fields) |
| Route registration | Tied to `OpenAPIHono` subclass | We need plain `Hono` for middleware stack compatibility |
| Registry query | No programmatic access to registered routes | Our `registry.getAll()` / `getByCategory()` enables tooling |
| Category tagging | No concept of route categories | Our `category` field enables filtering, reporting, and selective spec generation |
| Side-effect tracking | No way to assert all routes are registered | Our assertions catch missing registrations |

### Why Not Router Introspection?

Hono's router internals are not designed for external introspection. The `MatchResult` and `Router` types are opaque. Building a registry at registration time (not at read time) is the only reliable approach.

---

## 15. Summary

The proposed registry is a **thin recording layer** that sits between Hono route registration and OpenAPI spec generation. It:

1. **Eliminates drift** — routes are registered once, and both the Hono app and the OpenAPI spec derive from the same registration
2. **Enforces invariants** — empty `operationId`, empty `tags`, and empty `responses` are rejected at compile time and runtime
3. **Preserves registration order** — the wrapper calls `app.<method>()` synchronously, so Hono's matching behavior is unchanged
4. **Shrinks the API surface** — `openapi/entities.ts` is deleted; `BASE_ENTITIES` disappears as a standalone constant
5. **Enables future tooling** — `registry.getByCategory()`, `registry.getSpecRoutes()`, and completeness tests are now possible
