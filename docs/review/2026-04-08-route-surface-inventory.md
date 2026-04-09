# Orbit AI API — Complete Route Surface Inventory

**Date:** 2026-04-08  
**Source:** Exhaustive trace of `packages/api/src/create-api.ts` and all route files  
**API Base:** Hono app with `/v1/*` prefix for authenticated routes

---

## Middleware Stack (applied globally in `create-api.ts`)

| Middleware | Path | Purpose |
|---|---|---|
| `requestIdMiddleware` | `*` | Generates/stamps `X-Request-Id` on every request |
| `versionMiddleware` | `/v1/*` | Stamps API version into context |
| `authMiddleware` | `/v1/*` | Bearer token authentication via API key lookup (SHA-256 hash) |
| `tenantContextMiddleware` | `/v1/*` | Sets `organization_id` context for multi-tenancy |
| `rateLimitMiddleware` | `/v1/*` | Rate limiting |
| `idempotencyMiddleware` | `/v1/*` | Idempotency key handling for safe retries |
| `orbitErrorHandler` | `*` (onError) | Global error handler |

**Note:** `/health` and `/openapi.json` are registered BEFORE auth middleware — they are **public** (no auth required). All `/v1/*` routes require auth.

---

## Public Routes (No Auth Required)

| Method | Path | Source File | Type | Auth | Notes |
|---|---|---|---|---|---|
| `GET` | `/health` | `routes/health.ts` | System | None | Returns `{ status: 'ok', timestamp }` |
| `GET` | `/openapi.json` | `routes/health.ts` | System | None | Returns full OpenAPI 3.1 spec |

---

## Authenticated System Routes

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `GET` | `/v1/status` | `routes/health.ts` | System | None (auth required) | Returns status + version + org info |
| `GET` | `/v1/context/:contactId` | `routes/context.ts` | Special | `contacts:read` | Contact context aggregation |

---

## Bootstrap Routes (Platform Setup)

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `POST` | `/v1/bootstrap/organizations` | `routes/bootstrap.ts` | Special | `platform:bootstrap` | Zod-validated: `name`, `slug?`, `metadata?` |
| `POST` | `/v1/bootstrap/api-keys` | `routes/bootstrap.ts` | Special | `platform:bootstrap` | Zod-validated: `organization_id`, `name`, `scopes`, `expires_at?` |

---

## Organization Routes (Current Org)

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `GET` | `/v1/organizations/current` | `routes/organizations.ts` | Special | `organizations:read` | Returns current organization from context |
| `PATCH` | `/v1/organizations/current` | `routes/organizations.ts` | Special | `organizations:write` | Updates current organization |

---

## Schema / Object Routes

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `GET` | `/v1/objects` | `routes/objects.ts` | Special | `schema:read` | List all object types |
| `GET` | `/v1/objects/:type` | `routes/objects.ts` | Special | `schema:read` | Get object type schema |
| `POST` | `/v1/objects/:type/fields` | `routes/objects.ts` | Special | `schema:write` | Add custom field to object type |
| `PATCH` | `/v1/objects/:type/fields/:fieldName` | `routes/objects.ts` | Special | `schema:write` | Update custom field |
| `DELETE` | `/v1/objects/:type/fields/:fieldName` | `routes/objects.ts` | Special | `schema:write` | Delete custom field |
| `POST` | `/v1/schema/migrations/preview` | `routes/objects.ts` | Special | `schema:read` | Preview migration SQL |
| `POST` | `/v1/schema/migrations/apply` | `routes/objects.ts` | Special | `schema:apply` | Apply migration |
| `POST` | `/v1/schema/migrations/:id/rollback` | `routes/objects.ts` | Special | `schema:apply` | Rollback migration |

---

## Search Routes

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `POST` | `/v1/search` | `routes/search.ts` | Special | `search:read` | Zod-validated: `query?`, `object_types?`, `limit?`, `cursor?` |

---

## Webhook Routes

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `GET` | `/v1/webhooks` | `routes/webhooks.ts` | Special CRUD | `webhooks:read` | List webhooks (sanitized — no signing_secret) |
| `POST` | `/v1/webhooks` | `routes/webhooks.ts` | Special CRUD | `webhooks:write` | Create with HTTPS + SSRF validation; one-time `signing_secret` exposure |
| `GET` | `/v1/webhooks/:id` | `routes/webhooks.ts` | Special CRUD | `webhooks:read` | Read (sanitized) |
| `PATCH` | `/v1/webhooks/:id` | `routes/webhooks.ts` | Special CRUD | `webhooks:write` | Update with HTTPS + SSRF validation |
| `DELETE` | `/v1/webhooks/:id` | `routes/webhooks.ts` | Special CRUD | `webhooks:write` | Delete webhook |
| `GET` | `/v1/webhooks/:id/deliveries` | `routes/webhooks.ts` | Special | `webhooks:read` | List deliveries for a webhook |
| `POST` | `/v1/webhooks/:id/redeliver` | `routes/webhooks.ts` | Special | `webhooks:write` | Redeliver a failed webhook |

**Notable:** Webhook routes have built-in SSRF protection — private IPs (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, 0.0.0.0), localhost, ::1, link-local, and metadata endpoints are denied. HTTPS-only.

---

## Import Routes

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `GET` | `/v1/imports` | `routes/imports.ts` | Special CRUD | `imports:read` | List imports |
| `POST` | `/v1/imports` | `routes/imports.ts` | Special CRUD | `imports:write` | Create import job |
| `GET` | `/v1/imports/:id` | `routes/imports.ts` | Special CRUD | `imports:read` | Get import by ID |

**Note:** `imports` is intentionally excluded from `PUBLIC_ENTITY_CAPABILITIES` in `entities.ts` — it has dedicated routes in `imports.ts`.

---

## Workflow Routes

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `POST` | `/v1/deals/:id/move` | `routes/workflows.ts` | Special | `deals:write` | Move deal to different stage |
| `GET` | `/v1/deals/pipeline` | `routes/workflows.ts` | Special | `deals:read` | Deals grouped by pipeline stage |
| `GET` | `/v1/deals/stats` | `routes/workflows.ts` | Special | `deals:read` | Deal statistics |
| `POST` | `/v1/sequences/:id/enroll` | `routes/workflows.ts` | Special | `sequences:write` | Enroll contact in sequence |
| `POST` | `/v1/sequence_enrollments/:id/unenroll` | `routes/workflows.ts` | Special | `sequence_enrollments:write` | Unenroll from sequence |
| `POST` | `/v1/tags/:id/attach` | `routes/workflows.ts` | Special | `tags:write` | Attach tag to entity |
| `POST` | `/v1/tags/:id/detach` | `routes/workflows.ts` | Special | `tags:write` | Detach tag from entity |
| `POST` | `/v1/activities/log` | `routes/workflows.ts` | Special | `activities:write` | Log activity (falls back to `create` if `log` not implemented) |

---

## Relationship Routes

| Method | Path | Source File | Type | Scope Required | Notes |
|---|---|---|---|---|---|
| `GET` | `/v1/contacts/:id/timeline` | `routes/relationships.ts` | Special | `contacts:read` | Contact activity timeline |
| `GET` | `/v1/contacts/:id/deals` | `routes/relationships.ts` | Special | `contacts:read` + `deals:read` | Deals associated with contact |
| `GET` | `/v1/contacts/:id/activities` | `routes/relationships.ts` | Special | `contacts:read` + `activities:read` | Activities associated with contact |
| `GET` | `/v1/contacts/:id/tasks` | `routes/relationships.ts` | Special | `contacts:read` + `tasks:read` | Tasks associated with contact |
| `GET` | `/v1/contacts/:id/tags` | `routes/relationships.ts` | Special | `contacts:read` + `tags:read` | Tags on contact |
| `GET` | `/v1/companies/:id/contacts` | `routes/relationships.ts` | Special | `companies:read` + `contacts:read` | Contacts at company |
| `GET` | `/v1/companies/:id/deals` | `routes/relationships.ts` | Special | `companies:read` + `deals:read` | Deals associated with company |
| `GET` | `/v1/deals/:id/timeline` | `routes/relationships.ts` | Special | `deals:read` | Deal activity timeline |

---

## Generic Entity CRUD Routes (via `PUBLIC_ENTITY_CAPABILITIES`)

**Source:** `routes/entities.ts` — dynamically generated for each entity in the capabilities map.  
**Pattern:** Each entity gets the same CRUD surface, modulated by `{ read, write, batch }` capabilities.

### Entity Capability Matrix

| Entity | Read | Write | Batch | Search |
|---|---|---|---|---|
| `contacts` | Yes | Yes | Yes | Yes |
| `companies` | Yes | Yes | Yes | Yes |
| `deals` | Yes | Yes | Yes | Yes |
| `pipelines` | Yes | Yes | No | Yes |
| `stages` | Yes | Yes | No | Yes |
| `users` | Yes | Yes | No | Yes |
| `activities` | Yes | Yes | Yes | Yes |
| `tasks` | Yes | Yes | Yes | Yes |
| `notes` | Yes | Yes | Yes | Yes |
| `products` | Yes | Yes | Yes | Yes |
| `payments` | Yes | Yes | Yes | Yes |
| `contracts` | Yes | Yes | Yes | Yes |
| `sequences` | Yes | Yes | Yes | Yes |
| `sequence_steps` | Yes | Yes | No | Yes |
| `sequence_enrollments` | Yes | Yes | No | Yes |
| `sequence_events` | Yes | No | No | Yes |
| `tags` | Yes | Yes | Yes | Yes |

### Routes Generated Per Entity (where capabilities permit)

| Method | Path | Scope Required | Notes |
|---|---|---|---|
| `GET` | `/v1/{entity}` | `{entity}:read` | List with `?limit`, `?cursor`, `?include` |
| `POST` | `/v1/{entity}` | `{entity}:write` | Create (if `write: true`) |
| `GET` | `/v1/{entity}/:id` | `{entity}:read` | Get by ID |
| `PATCH` | `/v1/{entity}/:id` | `{entity}:write` | Update (if `write: true`) |
| `DELETE` | `/v1/{entity}/:id` | `{entity}:write` | Delete (if `write: true`) |
| `POST` | `/v1/{entity}/search` | `{entity}:read` | Entity-specific search |
| `POST` | `/v1/{entity}/batch` | `{entity}:write` | Batch operations (if `batch: true`) |

**Total generic entity routes:** 17 entities x up to 7 routes each = **up to 119 routes** (minus entities without write or batch).

Exact count breakdown:
- 15 entities with write (all except `sequence_events`): 15 x 6 = 90 CRUD routes (GET list, POST create, GET by ID, PATCH, DELETE, POST search)
- 1 entity (`sequence_events`) without write: 1 x 2 = 2 routes (GET list, GET by ID, POST search = 3 routes)
- 12 entities with batch: +12 batch routes
- **Total: 90 + 3 + 12 = 105 generic entity routes**

---

## Admin Routes

**Source:** `routes/admin.ts` — all routes require `admin:*` scope, plus a blanket `requireScope('admin:*')` on `/v1/admin/*`.

### Admin Entity Map

| Admin Entity | Service Key |
|---|---|
| `organization_memberships` | `organizationMemberships` |
| `api_keys` | `apiKeys` |
| `custom_field_definitions` | `customFieldDefinitions` |
| `webhook_deliveries` | `webhookDeliveries` |
| `audit_logs` | `auditLogs` |
| `schema_migrations` | `schemaMigrations` |
| `idempotency_keys` | `idempotencyKeys` |
| `entity_tags` | `entityTags` |

### Routes Generated Per Admin Entity (2 routes each)

| Method | Path | Scope Required | Notes |
|---|---|---|---|
| `GET` | `/v1/admin/{entity}` | `admin:*` | List with `?limit`, `?cursor` |
| `GET` | `/v1/admin/{entity}/:id` | `admin:*` | Get by ID |

**Total admin routes:** 8 entities x 2 routes = **16 routes**

---

## Complete Route Count Summary

| Category | Route Count |
|---|---|
| Public (no auth) | 2 |
| Authenticated system | 2 |
| Bootstrap | 2 |
| Organization | 2 |
| Schema / Object | 8 |
| Search | 1 |
| Webhook | 7 |
| Import | 3 |
| Workflow | 8 |
| Relationship | 8 |
| Generic entity CRUD | 105 |
| Admin | 16 |
| **Total** | **~164** |

---

## Route Conflicts & Registration Order Notes

1. **`/v1/deals/pipeline` and `/v1/deals/stats`** are registered BEFORE generic entity routes in `create-api.ts`, so they match before `/v1/deals/:id` would catch them.
2. **`/v1/webhooks/*`** is registered BEFORE generic entities to avoid conflicts (webhooks has dedicated routes with special validation).
3. **`/v1/imports/*`** has dedicated routes and is intentionally excluded from `PUBLIC_ENTITY_CAPABILITIES`.
4. **`/v1/activities/log`** is registered before generic entity routes so it matches before `/v1/activities/:id`.
5. **Relationship routes** (`/v1/contacts/:id/timeline`, etc.) are registered before generic entity routes.

---

## OpenAPI Spec vs Runtime Route Discrepancies

### Routes in OpenAPI spec that are also registered at runtime
- `/v1/{entity}` (GET, POST) for all 19 entities in `BASE_ENTITIES`
- `/v1/{entity}/{id}` (GET, PATCH, DELETE) for all 19 entities
- `/health`
- `/v1/status`

### Routes registered at runtime but MISSING from OpenAPI spec
The OpenAPI spec (`openapi/generator.ts`) is a **static spec** covering only base entity CRUD. It does **not** document:

| Route | Category |
|---|---|
| `/v1/search` | Search |
| `/v1/context/:contactId` | Context |
| `/v1/bootstrap/organizations` | Bootstrap |
| `/v1/bootstrap/api-keys` | Bootstrap |
| `/v1/organizations/current` (GET, PATCH) | Organization |
| `/v1/objects` (GET) | Schema |
| `/v1/objects/:type` (GET) | Schema |
| `/v1/objects/:type/fields` (POST, PATCH, DELETE) | Schema |
| `/v1/schema/migrations/preview` | Schema |
| `/v1/schema/migrations/apply` | Schema |
| `/v1/schema/migrations/:id/rollback` | Schema |
| `/v1/webhooks` (full CRUD + deliveries + redeliver) | Webhook |
| `/v1/imports` (GET, POST, GET/:id) | Import |
| `/v1/deals/:id/move` | Workflow |
| `/v1/deals/pipeline` | Workflow |
| `/v1/deals/stats` | Workflow |
| `/v1/sequences/:id/enroll` | Workflow |
| `/v1/sequence_enrollments/:id/unenroll` | Workflow |
| `/v1/tags/:id/attach` | Workflow |
| `/v1/tags/:id/detach` | Workflow |
| `/v1/activities/log` | Workflow |
| All relationship routes (`/v1/contacts/:id/timeline`, etc.) | Relationship |
| All admin routes (`/v1/admin/*`) | Admin |
| `/v1/{entity}/search` | Entity search |
| `/v1/{entity}/batch` | Entity batch |

### Routes in OpenAPI spec but NOT registered at runtime
- **None.** All routes in the OpenAPI spec are registered at runtime.

**Note:** The `BASE_ENTITIES` array in `openapi/entities.ts` includes `imports` and `webhooks`, which do have dedicated routes at runtime (not generic CRUD). The OpenAPI spec generates standard CRUD paths for them, but the actual implementation uses dedicated handlers with additional logic (SSRF validation for webhooks, import job tracking, etc.).

---

## Entity Service Resolution Map

Entities with non-standard service key names:

| Entity | Service Key |
|---|---|
| `sequence_steps` | `sequenceSteps` |
| `sequence_enrollments` | `sequenceEnrollments` |
| `sequence_events` | `sequenceEvents` |

All other entities map directly to their service key name.
