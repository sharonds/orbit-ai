# API + SDK Unified Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `@orbit-ai/api` and `@orbit-ai/sdk` as the accepted HTTP and client contracts for Orbit AI, using test-first enforcement, safe parallel overlap, and wave-gate reviews.

**Architecture:** A unified execution branch (`api-sdk-execution`) implements both packages in 10 interleaved tasks across 3 waves. Each task writes security/contract tests before implementation. SDK bootstrap and transport start after API auth/envelope is review-accepted (Wave Gate 1). SDK resources wait for matching API waves. Three formal review gates replace per-slice remediation cycles. Task numbering in this plan is execution-oriented; design-step numbers remain cross-reference IDs only.

**Tech Stack:** TypeScript (strict), Hono (API), Vitest, Zod, `@orbit-ai/core` (services, adapters, types)

**Branch:** `api-sdk-execution` from `main`

**Depends on:**
- [2026-04-03-api-sdk-execution-design.md](/docs/superpowers/specs/2026-04-03-api-sdk-execution-design.md) (approved design)
- [core-tenant-hardening-plan.md](/docs/execution/core-tenant-hardening-plan.md) (tenant/security prerequisite)
- [02-api.md](/docs/specs/02-api.md) (API contract reference)
- [03-sdk.md](/docs/specs/03-sdk.md) (SDK contract reference)
- [security-architecture.md](/docs/security/security-architecture.md)
- [orbit-ai-threat-model.md](/docs/security/orbit-ai-threat-model.md)

---

## File Structure

### `packages/api/`

```
packages/api/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    — public exports: createApi, types
│   ├── create-api.ts               — Hono app factory
│   ├── app.ts                      — app composition (middleware + routes)
│   ├── config.ts                   — CreateApiOptions type
│   ├── context.ts                  — Hono context variable types
│   ├── responses.ts                — toEnvelope, toError, sanitization
│   ├── scopes.ts                   — scope check helpers
│   ├── middleware/
│   │   ├── request-id.ts           — X-Request-Id assignment
│   │   ├── version.ts              — Orbit-Version resolution
│   │   ├── auth.ts                 — API key auth via lookupApiKeyForAuth
│   │   ├── tenant-context.ts       — withTenantContext wrapper
│   │   ├── error-handler.ts        — global error → error envelope
│   │   ├── rate-limit.ts           — rate limit headers + 429 (Step 8)
│   │   └── idempotency.ts          — idempotency key middleware (Step 8)
│   ├── routes/
│   │   ├── health.ts               — GET /health, GET /v1/status
│   │   ├── entities.ts             — generic public entity CRUD/search/batch
│   │   ├── admin.ts                — /v1/admin/* read/write routes
│   │   ├── bootstrap.ts            — /v1/bootstrap/* routes
│   │   ├── search.ts               — POST /v1/search
│   │   ├── context.ts              — GET /v1/context/:contactId
│   │   ├── workflows.ts            — deal move, enroll, tag attach/detach
│   │   ├── relationships.ts        — contact timeline, company contacts, etc.
│   │   ├── organizations.ts        — GET/PATCH /v1/organizations/current
│   │   ├── objects.ts              — /v1/objects*, schema routes
│   │   ├── webhooks.ts             — webhook + delivery routes
│   │   └── imports.ts              — import routes
│   ├── openapi/
│   │   ├── registry.ts             — route schema registration (Step 8)
│   │   ├── schemas.ts              — shared request/response schema definitions
│   │   └── generator.ts            — OpenAPI JSON/YAML emission from registry (Step 8)
│   ├── __tests__/
│   │   ├── create-api.test.ts
│   │   ├── middleware.test.ts
│   │   ├── envelope.test.ts
│   │   ├── routes-wave1.test.ts
│   │   ├── routes-wave2.test.ts
│   │   ├── admin-routes.test.ts
│   │   ├── bootstrap-routes.test.ts
│   │   ├── workflow-routes.test.ts
│   │   ├── sanitization.test.ts
│   │   ├── idempotency.test.ts
│   │   └── rate-limit.test.ts
│   ├── node.ts                     — thin Node.js entrypoint
│   ├── vercel.ts                   — thin Vercel entrypoint
│   └── cloudflare.ts               — thin Cloudflare entrypoint
├── openapi/
│   ├── openapi.json                — generated (Step 8)
│   └── openapi.yaml                — generated (Step 8)
```

### `packages/sdk/`

```
packages/sdk/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    — public exports: OrbitClient, types
│   ├── client.ts                   — OrbitClient class
│   ├── config.ts                   — OrbitClientOptions type
│   ├── errors.ts                   — OrbitApiError
│   ├── retries.ts                  — retry with exponential backoff
│   ├── pagination.ts               — AutoPager
│   ├── search.ts                   — SearchResource
│   ├── transport/
│   │   ├── index.ts                — OrbitTransport interface + createTransport
│   │   ├── http-transport.ts       — HTTP mode
│   │   └── direct-transport.ts     — direct mode via core services
│   ├── resources/
│   │   ├── base-resource.ts        — BaseResource<TRecord, TCreate, TUpdate>
│   │   ├── contacts.ts
│   │   ├── companies.ts
│   │   ├── deals.ts
│   │   ├── pipelines.ts
│   │   ├── stages.ts
│   │   ├── users.ts
│   │   ├── activities.ts
│   │   ├── tasks.ts
│   │   ├── notes.ts
│   │   ├── products.ts
│   │   ├── payments.ts
│   │   ├── contracts.ts
│   │   ├── sequences.ts
│   │   ├── sequence-steps.ts
│   │   ├── sequence-enrollments.ts
│   │   ├── sequence-events.ts
│   │   ├── tags.ts
│   │   ├── schema.ts
│   │   ├── webhooks.ts
│   │   └── imports.ts
│   └── __tests__/
│       ├── client.test.ts
│       ├── errors.test.ts
│       ├── retries.test.ts
│       ├── pagination.test.ts
│       ├── http-transport.test.ts
│       ├── direct-transport.test.ts
│       ├── transport-parity.test.ts
│       ├── resources-wave1.test.ts
│       ├── resources-wave2.test.ts
│       └── parity-matrix.test.ts
```

---

## Task 1: Create Branch And API Package Scaffold

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/config.ts`
- Create: `packages/api/src/create-api.ts`
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/node.ts`
- Create: `packages/api/src/vercel.ts`
- Create: `packages/api/src/cloudflare.ts`
- Create: `packages/api/src/__tests__/create-api.test.ts`

- [ ] **Step 1: Create execution branch**

```bash
git checkout -b api-sdk-execution main
```

- [ ] **Step 2: Write the failing test for createApi**

```typescript
// packages/api/src/__tests__/create-api.test.ts
import { describe, it, expect } from 'vitest'
import { createApi } from '../create-api.js'
import type { RuntimeApiAdapter } from '../config.js'

function stubAdapter(): RuntimeApiAdapter {
  return {
    name: 'sqlite',
    dialect: 'sqlite',
    supportsRls: false,
    supportsBranching: false,
    supportsJsonbIndexes: false,
    authorityModel: { runtimeAuthority: 'request-scoped', migrationAuthority: 'elevated', requestPathMayUseElevatedCredentials: false, notes: [] },
    unsafeRawDatabase: {} as any,
    users: {} as any,
    connect: async () => {},
    disconnect: async () => {},
    lookupApiKeyForAuth: async () => null,
    transaction: async (fn) => fn({} as any),
    execute: async () => ({}),
    query: async () => [],
    withTenantContext: async (_ctx, fn) => fn({} as any),
    getSchemaSnapshot: async () => ({ customFields: [], tables: [] }),
  }
}

describe('createApi', () => {
  it('returns a Hono app instance', () => {
    const app = createApi({ adapter: stubAdapter(), version: '2026-04-01' })
    expect(app).toBeDefined()
    expect(app.fetch).toBeTypeOf('function')
  })

  it('accepts only runtime-scoped adapter (no migration authority)', () => {
    const adapter = stubAdapter()
    // The adapter's runWithMigrationAuthority throws — createApi should not call it
    const app = createApi({ adapter, version: '2026-04-01' })
    expect(app).toBeDefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @orbit-ai/api test
```

Expected: FAIL — `packages/api` does not exist yet.

- [ ] **Step 4: Create package.json**

```json
// packages/api/package.json
{
  "name": "@orbit-ai/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./node": {
      "types": "./dist/node.d.ts",
      "import": "./dist/node.js"
    },
    "./vercel": {
      "types": "./dist/vercel.d.ts",
      "import": "./dist/vercel.js"
    },
    "./cloudflare": {
      "types": "./dist/cloudflare.d.ts",
      "import": "./dist/cloudflare.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@orbit-ai/core": "workspace:*",
    "hono": "^4.7.0",
    "zod": "^4.1.11"
  }
}
```

- [ ] **Step 5: Create tsconfig.json**

```json
// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "node_modules/.cache/tsconfig.api.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 6: Create vitest.config.ts**

```typescript
// packages/api/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      enabled: false,
    },
  },
})
```

- [ ] **Step 7: Create config.ts**

```typescript
// packages/api/src/config.ts
import type { StorageAdapter } from '@orbit-ai/core'

export type RuntimeApiAdapter = Omit<StorageAdapter, 'migrate' | 'runWithMigrationAuthority'>

export interface CreateApiOptions {
  /** Runtime-scoped adapter facade only. Must not expose migration authority. */
  adapter: RuntimeApiAdapter
  /** Calendar-date API version, e.g. '2026-04-01' */
  version: string
}
```

- [ ] **Step 8: Create create-api.ts**

```typescript
// packages/api/src/create-api.ts
import { Hono } from 'hono'
import type { CreateApiOptions } from './config.js'

export function createApi(options: CreateApiOptions) {
  const app = new Hono()

  // Middleware and routes will be added in Steps 2-8.
  // For now, prove the factory compiles and returns a Hono app.

  return app
}
```

- [ ] **Step 9: Create app.ts (re-export for composition)**

```typescript
// packages/api/src/app.ts
export { createApi } from './create-api.js'
export type { CreateApiOptions } from './config.js'
```

- [ ] **Step 10: Create index.ts**

```typescript
// packages/api/src/index.ts
export { createApi } from './create-api.js'
export type { CreateApiOptions } from './config.js'
```

- [ ] **Step 11: Create platform entrypoints**

```typescript
// packages/api/src/node.ts
export { createApi } from './create-api.js'
export type { CreateApiOptions } from './config.js'
```

```typescript
// packages/api/src/vercel.ts
export { createApi } from './create-api.js'
export type { CreateApiOptions } from './config.js'
```

```typescript
// packages/api/src/cloudflare.ts
export { createApi } from './create-api.js'
export type { CreateApiOptions } from './config.js'
```

- [ ] **Step 12: Install dependencies and run tests**

```bash
pnpm install
pnpm --filter @orbit-ai/api test
```

Expected: PASS — both tests green.

- [ ] **Step 13: Run full verification**

```bash
pnpm --filter @orbit-ai/api build && pnpm --filter @orbit-ai/api typecheck && git diff --check
```

Expected: all green.

- [ ] **Step 14: Commit**

```bash
git add packages/api/
git commit -m "feat(api): step 1 — package bootstrap and app skeleton"
```

---

## Task 2: API Middleware — Request ID And Version

**Files:**
- Create: `packages/api/src/middleware/request-id.ts`
- Create: `packages/api/src/middleware/version.ts`
- Create: `packages/api/src/context.ts`
- Modify: `packages/api/src/__tests__/middleware.test.ts`
- Modify: `packages/api/src/create-api.ts`

- [ ] **Step 1: Write failing tests for request-id and version middleware**

```typescript
// packages/api/src/__tests__/middleware.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'

describe('requestIdMiddleware', () => {
  it('assigns a request ID to every request', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }))

    const res = await app.request('/test')
    const body = await res.json() as { requestId: string }
    expect(body.requestId).toMatch(/^req_/)
  })

  it('preserves a client-provided X-Request-Id', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }))

    const res = await app.request('/test', {
      headers: { 'x-request-id': 'req_custom123' },
    })
    const body = await res.json() as { requestId: string }
    expect(body.requestId).toBe('req_custom123')
  })
})

describe('versionMiddleware', () => {
  it('resolves Orbit-Version from header', async () => {
    const app = new Hono()
    app.use('*', versionMiddleware('2026-04-01'))
    app.get('/test', (c) => c.json({ version: c.get('orbitVersion') }))

    const res = await app.request('/test', {
      headers: { 'orbit-version': '2026-03-01' },
    })
    const body = await res.json() as { version: string }
    expect(body.version).toBe('2026-03-01')
  })

  it('defaults to server version when header is absent', async () => {
    const app = new Hono()
    app.use('*', versionMiddleware('2026-04-01'))
    app.get('/test', (c) => c.json({ version: c.get('orbitVersion') }))

    const res = await app.request('/test')
    const body = await res.json() as { version: string }
    expect(body.version).toBe('2026-04-01')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @orbit-ai/api test
```

Expected: FAIL — middleware files do not exist.

- [ ] **Step 3: Create context.ts (Hono variable types)**

```typescript
// packages/api/src/context.ts
import type { OrbitAuthContext } from '@orbit-ai/core'

export interface OrbitApiVariables {
  requestId: string
  orbitVersion: string
  orbit: OrbitAuthContext & { userId?: string }
}

declare module 'hono' {
  interface ContextVariableMap extends OrbitApiVariables {}
}
```

- [ ] **Step 4: Implement request-id middleware**

```typescript
// packages/api/src/middleware/request-id.ts
import type { MiddlewareHandler } from 'hono'
import { generateId } from '@orbit-ai/core'

export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const existing = c.req.header('x-request-id')
    const requestId = existing ?? `req_${generateId('idempotencyKey').split('_')[1]}`
    c.set('requestId', requestId)
    c.header('x-request-id', requestId)
    await next()
  }
}
```

Note: `generateId('idempotencyKey')` produces `idem_<ULID>`. We extract the ULID suffix and prepend `req_`. If your ID system has a dedicated `request` kind, use that instead. Otherwise a simple `crypto.randomUUID()` with `req_` prefix works:

```typescript
// Alternative if no request ID kind exists:
const requestId = existing ?? `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`
```

- [ ] **Step 5: Implement version middleware**

```typescript
// packages/api/src/middleware/version.ts
import type { MiddlewareHandler } from 'hono'

export function versionMiddleware(defaultVersion: string): MiddlewareHandler {
  return async (c, next) => {
    const version = c.req.header('orbit-version') ?? defaultVersion
    c.set('orbitVersion', version)
    await next()
  }
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @orbit-ai/api test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/context.ts packages/api/src/middleware/request-id.ts packages/api/src/middleware/version.ts packages/api/src/__tests__/middleware.test.ts
git commit -m "feat(api): step 2a — request-id and version middleware"
```

---

## Task 3: API Middleware — Auth And Tenant Context

**Files:**
- Create: `packages/api/src/middleware/auth.ts`
- Create: `packages/api/src/middleware/tenant-context.ts`
- Create: `packages/api/src/scopes.ts`
- Modify: `packages/api/src/__tests__/middleware.test.ts`

- [ ] **Step 1: Write failing tests for auth middleware**

```typescript
// Append to packages/api/src/__tests__/middleware.test.ts
import { authMiddleware } from '../middleware/auth.js'
import { tenantContextMiddleware } from '../middleware/tenant-context.js'
import type { StorageAdapter, ApiKeyAuthLookup } from '@orbit-ai/core'

function mockAdapter(lookup: ApiKeyAuthLookup | null): StorageAdapter {
  return {
    name: 'sqlite',
    dialect: 'sqlite',
    supportsRls: false,
    supportsBranching: false,
    supportsJsonbIndexes: false,
    authorityModel: { runtimeAuthority: 'request-scoped', migrationAuthority: 'elevated', requestPathMayUseElevatedCredentials: false, notes: [] },
    unsafeRawDatabase: {} as any,
    users: {} as any,
    connect: async () => {},
    disconnect: async () => {},
    migrate: async () => {},
    runWithMigrationAuthority: async () => { throw new Error('forbidden') },
    lookupApiKeyForAuth: async () => lookup,
    transaction: async (fn) => fn({} as any),
    execute: async () => ({}),
    query: async () => [],
    withTenantContext: async (_ctx, fn) => fn({} as any),
    getSchemaSnapshot: async () => ({ customFields: [], tables: [] }),
  }
}

const validKey: ApiKeyAuthLookup = {
  id: 'key_01TEST',
  organizationId: 'org_01TEST',
  userId: 'user_01TEST',
  scopes: ['contacts:read', 'contacts:write'],
  revokedAt: null,
  expiresAt: null,
}

describe('authMiddleware', () => {
  it('resolves a valid API key through lookupApiKeyForAuth', async () => {
    const adapter = mockAdapter(validKey)
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.get('/test', (c) => c.json({ orgId: c.get('orbit').orgId }))

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer orbit_live_testkey' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { orgId: string }
    expect(body.orgId).toBe('org_01TEST')
  })

  it('rejects missing bearer token with 401', async () => {
    const adapter = mockAdapter(null)
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.get('/test', (c) => c.json({ ok: true }))

    const res = await app.request('/test')
    expect(res.status).toBe(401)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('AUTH_INVALID_API_KEY')
  })

  it('rejects revoked key with 401', async () => {
    const revokedKey = { ...validKey, revokedAt: new Date('2026-01-01') }
    const adapter = mockAdapter(revokedKey)
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.get('/test', (c) => c.json({ ok: true }))

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer orbit_live_revoked' },
    })
    expect(res.status).toBe(401)
  })

  it('rejects expired key with 401', async () => {
    const expiredKey = { ...validKey, expiresAt: new Date('2020-01-01') }
    const adapter = mockAdapter(expiredKey)
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.get('/test', (c) => c.json({ ok: true }))

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer orbit_live_expired' },
    })
    expect(res.status).toBe(401)
  })

  it('sets scopes and apiKeyId on context', async () => {
    const adapter = mockAdapter(validKey)
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.get('/test', (c) => {
      const ctx = c.get('orbit')
      return c.json({ apiKeyId: ctx.apiKeyId, scopes: ctx.scopes, userId: ctx.userId })
    })

    const res = await app.request('/test', {
      headers: { authorization: 'Bearer orbit_live_testkey' },
    })
    const body = await res.json() as { apiKeyId: string; scopes: string[]; userId?: string }
    expect(body.apiKeyId).toBe('key_01TEST')
    expect(body.scopes).toEqual(['contacts:read', 'contacts:write'])
    expect(body.userId).toBe('user_01TEST')
  })

  it('never calls runWithMigrationAuthority', async () => {
    const adapter = mockAdapter(validKey)
    let migrationCalled = false
    adapter.runWithMigrationAuthority = async () => { migrationCalled = true; return {} as any }
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.get('/test', (c) => c.json({ ok: true }))

    await app.request('/test', {
      headers: { authorization: 'Bearer orbit_live_testkey' },
    })
    expect(migrationCalled).toBe(false)
  })
})

describe('tenantContextMiddleware', () => {
  it('wraps request in tenant context for non-bootstrap paths', async () => {
    let tenantContextCalled = false
    const adapter = mockAdapter(validKey)
    adapter.withTenantContext = async (ctx, fn) => {
      tenantContextCalled = true
      expect(ctx.orgId).toBe('org_01TEST')
      return fn({} as any)
    }
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.use('*', tenantContextMiddleware(adapter))
    app.get('/v1/contacts', (c) => c.json({ ok: true }))

    await app.request('/v1/contacts', {
      headers: { authorization: 'Bearer orbit_live_test' },
    })
    expect(tenantContextCalled).toBe(true)
  })

  it('skips tenant context for bootstrap paths', async () => {
    let tenantContextCalled = false
    const adapter = mockAdapter(validKey)
    adapter.withTenantContext = async (_ctx, fn) => {
      tenantContextCalled = true
      return fn({} as any)
    }
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', authMiddleware(adapter))
    app.use('*', tenantContextMiddleware(adapter))
    app.post('/v1/bootstrap/organizations', (c) => c.json({ ok: true }))

    await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { authorization: 'Bearer orbit_live_test' },
    })
    expect(tenantContextCalled).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @orbit-ai/api test
```

Expected: FAIL — auth.ts and tenant-context.ts do not exist.

- [ ] **Step 3: Implement auth middleware**

```typescript
// packages/api/src/middleware/auth.ts
import type { MiddlewareHandler } from 'hono'
import type { StorageAdapter } from '@orbit-ai/core'
import { OrbitError } from '@orbit-ai/core'
import '../context.js'

async function hashApiKey(raw: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function authMiddleware(adapter: StorageAdapter): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header('authorization')
    if (!auth?.startsWith('Bearer ')) {
      throw new OrbitError({ code: 'AUTH_INVALID_API_KEY', message: 'Missing bearer token', retryable: false })
    }

    const raw = auth.slice('Bearer '.length)
    const keyHash = await hashApiKey(raw)
    const key = await adapter.lookupApiKeyForAuth(keyHash)

    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
      throw new OrbitError({
        code: 'AUTH_INVALID_API_KEY',
        message: 'API key is invalid, revoked, or expired',
        retryable: false,
      })
    }

    c.set('orbit', {
      orgId: key.organizationId,
      apiKeyId: key.id,
      scopes: key.scopes,
      requestId: c.get('requestId'),
      userId: key.userId ?? undefined,
    })
    await next()
  }
}
```

- [ ] **Step 4: Implement tenant-context middleware**

```typescript
// packages/api/src/middleware/tenant-context.ts
import type { MiddlewareHandler } from 'hono'
import type { StorageAdapter } from '@orbit-ai/core'
import { OrbitError } from '@orbit-ai/core'
import '../context.js'

const BOOTSTRAP_PATH_PREFIX = '/v1/bootstrap/'

/** Tenant context bypass allow-list. Only paths in this list skip withTenantContext.
 *  Update this list AND add a test when adding new platform-boundary route groups. */
const TENANT_CONTEXT_BYPASS_PREFIXES = ['/v1/bootstrap/'] as const

export function tenantContextMiddleware(adapter: StorageAdapter): MiddlewareHandler {
  return async (c, next) => {
    const isBypass = TENANT_CONTEXT_BYPASS_PREFIXES.some((p) => c.req.path.startsWith(p))
    if (isBypass) {
      await next()
      return
    }

    // Fail-closed: if auth context is missing on a non-bootstrap path, reject immediately.
    // This prevents silent pass-through without tenant isolation.
    const ctx = c.get('orbit')
    if (!ctx?.orgId) {
      throw new OrbitError({
        code: 'AUTH_CONTEXT_REQUIRED',
        message: 'Tenant context is required for this path',
        retryable: false,
      })
    }

    await adapter.withTenantContext(ctx, async () => {
      await next()
    })
  }
}
```

- [ ] **Step 5: Create scope helpers**

```typescript
// packages/api/src/scopes.ts
import type { MiddlewareHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import '../context.js'

export function requireScope(scope: string): MiddlewareHandler {
  return async (c, next) => {
    const ctx = c.get('orbit')
    if (!ctx?.scopes) {
      throw new OrbitError({
        code: 'AUTH_INSUFFICIENT_SCOPE',
        message: `Required scope: ${scope}`,
        retryable: false,
      })
    }

    const [resource, action] = scope.split(':')
    const hasScope =
      ctx.scopes.includes(scope) ||
      ctx.scopes.includes('*') ||
      (resource && ctx.scopes.includes(`${resource}:*`)) ||
      // admin:* only satisfies admin-prefixed scopes, not public entity scopes
      (scope.startsWith('admin:') && ctx.scopes.includes('admin:*'))

    if (!hasScope) {
      throw new OrbitError({
        code: 'AUTH_INSUFFICIENT_SCOPE',
        message: `Required scope: ${scope}`,
        retryable: false,
      })
    }

    await next()
  }
}
```

All auth, tenant-context, and scope failures must throw `OrbitError` and flow through `errorHandlerMiddleware`; they must not emit ad hoc `c.json({ error: ... })` payloads.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @orbit-ai/api test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/middleware/auth.ts packages/api/src/middleware/tenant-context.ts packages/api/src/scopes.ts packages/api/src/__tests__/middleware.test.ts
git commit -m "feat(api): step 2b — auth and tenant-context middleware"
```

---

## Task 4: API Response Boundary — Envelope, Errors, And Sanitization

**Files:**
- Create: `packages/api/src/responses.ts`
- Create: `packages/api/src/middleware/error-handler.ts`
- Create: `packages/api/src/__tests__/envelope.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/api/src/__tests__/envelope.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { toEnvelope, toError, toWebhookRead, toWebhookDeliveryRead } from '../responses.js'
import { errorHandlerMiddleware } from '../middleware/error-handler.js'
import { requestIdMiddleware } from '../middleware/request-id.js'
import { versionMiddleware } from '../middleware/version.js'
import { OrbitError } from '@orbit-ai/core'

describe('toEnvelope', () => {
  it('wraps single record in { data, meta, links }', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', versionMiddleware('2026-04-01'))
    app.get('/v1/contacts/contact_01TEST', (c) => {
      return c.json(toEnvelope(c, { id: 'contact_01TEST', name: 'Jane' }))
    })

    const res = await app.request('/v1/contacts/contact_01TEST')
    const body = await res.json() as any
    expect(body.data.id).toBe('contact_01TEST')
    expect(body.meta.request_id).toMatch(/^req_/)
    expect(body.meta.version).toBe('2026-04-01')
    expect(body.meta.has_more).toBe(false)
    expect(body.links.self).toBe('/v1/contacts/contact_01TEST')
  })

  it('wraps paginated result with cursor metadata', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', versionMiddleware('2026-04-01'))
    app.get('/v1/contacts', (c) => {
      return c.json(
        toEnvelope(c, [{ id: 'contact_01' }], {
          data: [{ id: 'contact_01' }],
          nextCursor: 'abc123',
          hasMore: true,
        }),
      )
    })

    const res = await app.request('/v1/contacts')
    const body = await res.json() as any
    expect(body.meta.next_cursor).toBe('abc123')
    expect(body.meta.has_more).toBe(true)
  })
})

describe('toError', () => {
  it('returns standard error envelope', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.get('/test', (c) => {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Contact not found'), 404)
    })

    const res = await app.request('/test')
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
    expect(body.error.message).toBe('Contact not found')
    expect(body.error.request_id).toMatch(/^req_/)
  })
})

describe('errorHandlerMiddleware', () => {
  it('catches OrbitError and returns error envelope', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', errorHandlerMiddleware())
    app.get('/test', () => {
      throw new OrbitError({ code: 'VALIDATION_FAILED', message: 'Invalid email', field: 'email' })
    })

    const res = await app.request('/test')
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(body.error.field).toBe('email')
  })

  it('catches unknown errors as INTERNAL_ERROR', async () => {
    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.use('*', errorHandlerMiddleware())
    app.get('/test', () => {
      throw new Error('unexpected')
    })

    const res = await app.request('/test')
    expect(res.status).toBe(500)
    const body = await res.json() as any
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('sanitization', () => {
  it('toWebhookRead strips secretEncrypted', () => {
    const raw = {
      id: 'webhook_01',
      organizationId: 'org_01',
      url: 'https://example.com/hook',
      events: ['contact.created'],
      status: 'active',
      description: null,
      secretEncrypted: 'ENCRYPTED_BLOB',
      secretLastFour: 'abcd',
      secretCreatedAt: '2026-04-01',
      createdAt: '2026-04-01',
      updatedAt: '2026-04-01',
    }
    const sanitized = toWebhookRead(raw)
    expect(sanitized).not.toHaveProperty('secretEncrypted')
    expect(sanitized).not.toHaveProperty('secret_encrypted')
    expect(sanitized.signing_secret_last_four).toBe('abcd')
  })

  it('toWebhookDeliveryRead strips payload, signature, responseBody', () => {
    const raw = {
      id: 'whdel_01',
      organizationId: 'org_01',
      webhookId: 'webhook_01',
      eventId: 'evt_01',
      status: 'succeeded',
      responseStatus: 200,
      attemptCount: 1,
      nextAttemptAt: null,
      deliveredAt: '2026-04-01',
      lastError: null,
      payload: '{"secret":"data"}',
      signature: 'hmac_abc',
      idempotencyKey: 'idem_01',
      responseBody: 'ok',
      createdAt: '2026-04-01',
      updatedAt: '2026-04-01',
    }
    const sanitized = toWebhookDeliveryRead(raw)
    expect(sanitized).not.toHaveProperty('payload')
    expect(sanitized).not.toHaveProperty('signature')
    expect(sanitized).not.toHaveProperty('idempotencyKey')
    expect(sanitized).not.toHaveProperty('responseBody')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @orbit-ai/api test
```

Expected: FAIL.

- [ ] **Step 3: Implement responses.ts**

```typescript
// packages/api/src/responses.ts
import type { Context } from 'hono'
import type { InternalPaginatedResult, OrbitEnvelope, OrbitErrorCode } from '@orbit-ai/core'
import { toWirePageMeta } from '@orbit-ai/core'
import './context.js'

export function toEnvelope<T>(
  c: Context,
  data: T,
  page?: InternalPaginatedResult<unknown>,
): OrbitEnvelope<T> {
  return {
    data,
    meta: page
      ? toWirePageMeta({
          requestId: c.get('requestId'),
          version: c.get('orbitVersion'),
          page,
        })
      : {
          request_id: c.get('requestId'),
          cursor: null,
          next_cursor: null,
          has_more: false,
          version: c.get('orbitVersion'),
        },
    links: {
      self: c.req.path,
    },
  }
}

export function toError(
  c: Context,
  code: OrbitErrorCode,
  message: string,
  extra?: { field?: string; hint?: string; recovery?: string; retryable?: boolean },
) {
  return {
    error: {
      code,
      message,
      request_id: c.get('requestId'),
      doc_url: `https://orbit-ai.dev/docs/errors#${code.toLowerCase()}`,
      retryable: false,
      ...extra,
    },
  }
}

export interface WebhookRead {
  id: string
  object: 'webhook'
  organization_id: string
  url: string
  events: string[]
  status: 'active' | 'disabled'
  description: string | null
  signing_secret_last_four: string | null
  signing_secret_created_at: string | null
  created_at: string
  updated_at: string
}

export function toWebhookRead(record: Record<string, unknown>): WebhookRead {
  return {
    id: String(record.id),
    object: 'webhook',
    organization_id: String(record.organization_id ?? record.organizationId),
    url: String(record.url),
    events: Array.isArray(record.events) ? (record.events as string[]) : [],
    status: (record.status as WebhookRead['status']) ?? 'active',
    description: (record.description as string | null) ?? null,
    signing_secret_last_four:
      String(record.secret_last_four ?? record.secretLastFour ?? '').slice(-4) || null,
    signing_secret_created_at:
      (record.secret_created_at as string | null) ??
      (record.secretCreatedAt as string | null) ??
      null,
    created_at: String(record.created_at ?? record.createdAt),
    updated_at: String(record.updated_at ?? record.updatedAt),
  }
}

export interface WebhookDeliveryRead {
  id: string
  object: 'webhook_delivery'
  organization_id: string
  webhook_id: string
  event_id: string
  status: 'pending' | 'succeeded' | 'failed'
  response_status: number | null
  attempt_count: number
  next_retry_at: string | null
  delivered_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export function toWebhookDeliveryRead(record: Record<string, unknown>): WebhookDeliveryRead {
  return {
    id: String(record.id),
    object: 'webhook_delivery',
    organization_id: String(record.organization_id ?? record.organizationId),
    webhook_id: String(record.webhook_id ?? record.webhookId),
    event_id: String(record.event_id ?? record.eventId),
    status: (record.status as WebhookDeliveryRead['status']) ?? 'pending',
    response_status:
      (record.response_status as number | null) ?? (record.responseStatus as number | null) ?? null,
    attempt_count: Number(record.attempt_count ?? record.attemptCount ?? 0),
    next_retry_at:
      (record.next_attempt_at as string | null) ?? (record.nextAttemptAt as string | null) ?? null,
    delivered_at:
      (record.delivered_at as string | null) ?? (record.deliveredAt as string | null) ?? null,
    last_error:
      (record.last_error as string | null) ?? (record.lastError as string | null) ?? null,
    created_at: String(record.created_at ?? record.createdAt),
    updated_at: String(record.updated_at ?? record.updatedAt),
  }
}

export function sanitizePublicRead(entity: string, record: unknown): unknown {
  if (entity === 'webhooks') return toWebhookRead(record as Record<string, unknown>)
  return sanitizeNestedSensitiveReads(record)
}

export function sanitizePublicPage(entity: string, rows: unknown[]): unknown[] {
  return rows.map((row) => sanitizePublicRead(entity, row))
}

export function toApiKeyRead(record: Record<string, unknown>): Record<string, unknown> {
  const { keyHash, encryptedKey, ...safe } = record
  return safe
}

export function toIdempotencyKeyRead(record: Record<string, unknown>): Record<string, unknown> {
  const { requestHash, responseBody, ...safe } = record
  return safe
}

export function toAuditLogRead(record: Record<string, unknown>): Record<string, unknown> {
  const REDACTED_SNAPSHOT_FIELDS = ['keyHash', 'encryptedKey', 'secretEncrypted', 'accessTokenEncrypted', 'refreshTokenEncrypted']
  const sanitizeSnapshot = (snapshot: unknown): unknown => {
    if (!snapshot || typeof snapshot !== 'object') return snapshot
    const s = snapshot as Record<string, unknown>
    return Object.fromEntries(Object.entries(s).filter(([k]) => !REDACTED_SNAPSHOT_FIELDS.includes(k)))
  }
  return {
    ...record,
    before: sanitizeSnapshot(record.before),
    after: sanitizeSnapshot(record.after),
  }
}

export function sanitizeAdminRead(entity: string, record: unknown): unknown {
  if (entity === 'webhook_deliveries') return toWebhookDeliveryRead(record as Record<string, unknown>)
  if (entity === 'api_keys') return toApiKeyRead(record as Record<string, unknown>)
  if (entity === 'idempotency_keys') return toIdempotencyKeyRead(record as Record<string, unknown>)
  if (entity === 'audit_logs') return toAuditLogRead(record as Record<string, unknown>)
  return sanitizeNestedSensitiveReads(record)
}

export function sanitizeAdminPage(entity: string, rows: unknown[]): unknown[] {
  return rows.map((row) => sanitizeAdminRead(entity, row))
}

function sanitizeNestedSensitiveReads(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  if (record.object === 'webhook') return toWebhookRead(record)
  if (record.object === 'webhook_delivery') return toWebhookDeliveryRead(record)
  return Object.fromEntries(
    Object.entries(record).map(([key, nested]) => {
      if (Array.isArray(nested)) {
        return [key, nested.map((item) => sanitizeNestedSensitiveReads(item))]
      }
      return [key, sanitizeNestedSensitiveReads(nested)]
    }),
  )
}
```

- [ ] **Step 4: Implement error-handler middleware**

```typescript
// packages/api/src/middleware/error-handler.ts
import type { MiddlewareHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import type { OrbitErrorCode } from '@orbit-ai/core'
import '../context.js'

const ERROR_STATUS_MAP: Partial<Record<OrbitErrorCode, number>> = {
  AUTH_INVALID_API_KEY: 401,
  AUTH_INSUFFICIENT_SCOPE: 403,
  AUTH_CONTEXT_REQUIRED: 401,
  RATE_LIMITED: 429,
  VALIDATION_FAILED: 400,
  INVALID_CURSOR: 400,
  RESOURCE_NOT_FOUND: 404,
  RELATION_NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  SCHEMA_INVALID_FIELD: 400,
  SCHEMA_ENTITY_EXISTS: 409,
  SCHEMA_DESTRUCTIVE_BLOCKED: 403,
  SCHEMA_INCOMPATIBLE_PROMOTION: 400,
  MIGRATION_FAILED: 500,
  ADAPTER_UNAVAILABLE: 503,
  ADAPTER_TRANSACTION_FAILED: 500,
  RLS_GENERATION_FAILED: 500,
  WEBHOOK_DELIVERY_FAILED: 502,
  INTERNAL_ERROR: 500,
}

export function errorHandlerMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next()
    } catch (err) {
      if (err instanceof OrbitError) {
        const status = ERROR_STATUS_MAP[err.code] ?? 500
        return c.json(
          {
            error: {
              code: err.code,
              message: err.message,
              field: err.field,
              request_id: c.get('requestId'),
              hint: err.hint,
              recovery: err.recovery,
              retryable: err.retryable ?? false,
            },
          },
          status as any,
        )
      }

      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            request_id: c.get('requestId'),
            retryable: false,
          },
        },
        500,
      )
    }
  }
}
```

- [ ] **Step 5: Wire middleware into create-api.ts**

```typescript
// packages/api/src/create-api.ts
import { Hono } from 'hono'
import type { CreateApiOptions } from './config.js'
import { requestIdMiddleware } from './middleware/request-id.js'
import { versionMiddleware } from './middleware/version.js'
import { authMiddleware } from './middleware/auth.js'
import { tenantContextMiddleware } from './middleware/tenant-context.js'
import { errorHandlerMiddleware } from './middleware/error-handler.js'
import './context.js'

export function createApi(options: CreateApiOptions) {
  const app = new Hono()

  // Global middleware
  app.use('*', requestIdMiddleware())
  app.use('*', errorHandlerMiddleware())

  // /v1/* middleware
  app.use('/v1/*', versionMiddleware(options.version))
  app.use('/v1/*', authMiddleware(options.adapter))
  app.use('/v1/*', tenantContextMiddleware(options.adapter))

  // Routes will be registered in Steps 4+

  return app
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @orbit-ai/api test
```

Expected: PASS.

- [ ] **Step 7: Run full verification**

```bash
pnpm --filter @orbit-ai/api build && pnpm --filter @orbit-ai/api typecheck && git diff --check
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/responses.ts packages/api/src/middleware/error-handler.ts packages/api/src/__tests__/envelope.test.ts packages/api/src/create-api.ts
git commit -m "feat(api): step 2c — envelope, error handler, and sanitization boundary"
```

---

## WAVE GATE 1

**After Tasks 1-4 are committed, run the formal review.**

- [ ] **Step 1: Run full verification**

```bash
pnpm --filter @orbit-ai/api test && pnpm --filter @orbit-ai/api typecheck && pnpm --filter @orbit-ai/api build
```

- [ ] **Step 2: Dispatch independent code review sub-agent**

Scope: all files in `packages/api/src/`. Focus on: middleware ordering, response boundary correctness, export hygiene.

- [ ] **Step 3: Dispatch independent security review sub-agent**

Focus: auth lookup path uses only `lookupApiKeyForAuth()`, tenant-context bypass is limited to bootstrap paths, error envelopes do not leak internal state, no path calls `runWithMigrationAuthority`.

- [ ] **Step 4: Dispatch tenant safety review**

Use `orbit-tenant-safety-review` skill. Focus: tenant-context middleware correctly wraps non-bootstrap paths, auth context flows `orgId` from the adapter lookup.

- [ ] **Step 5: Write review artifact**

Create `docs/review/2026-04-03-api-sdk-wave-gate-1.md` with findings, severity, reviewer identity, decision, and remediation status.

- [ ] **Step 6: Apply remediation if needed**

Fix any blocking findings on the same branch. Re-run only the specific reviewer that found the issue.

- [ ] **Step 7: Commit gate acceptance**

```bash
git commit --allow-empty -m "review: wave gate 1 accepted — auth/envelope contract stable"
```

---

## Task 5: API Wave 1 Public Routes — Health, Status, Search, Context

**Files:**
- Create: `packages/api/src/routes/health.ts`
- Create: `packages/api/src/routes/search.ts`
- Create: `packages/api/src/routes/context.ts`
- Create: `packages/api/src/__tests__/routes-wave1.test.ts`
- Modify: `packages/api/src/create-api.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/api/src/__tests__/routes-wave1.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createApi } from '../create-api.js'
import type { StorageAdapter, ApiKeyAuthLookup, CoreServices } from '@orbit-ai/core'
import { createCoreServices } from '@orbit-ai/core'

// Minimal mock adapter for route testing
function routeTestAdapter(): StorageAdapter {
  // Use the shared core SQLite test adapter fixture or an equivalent in-memory adapter.
  // It must support createCoreServices and return a valid auth lookup for the test org.
  return {} as any
}

describe('health routes', () => {
  it('GET /health returns 200 without auth', async () => {
    const app = createApi({ adapter: routeTestAdapter(), version: '2026-04-01' })
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('ok')
  })

  it('GET /v1/status returns 200 with auth', async () => {
    const app = createApi({ adapter: routeTestAdapter(), version: '2026-04-01' })
    const res = await app.request('/v1/status', {
      headers: { authorization: 'Bearer orbit_live_test' },
    })
    expect(res.status).toBe(200)
  })
})

describe('search route', () => {
  it('POST /v1/search returns envelope with data array', async () => {
    const app = createApi({ adapter: routeTestAdapter(), version: '2026-04-01' })
    const res = await app.request('/v1/search', {
      method: 'POST',
      headers: {
        authorization: 'Bearer orbit_live_test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: 'jane', limit: 10 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.data).toBeInstanceOf(Array)
    expect(body.meta).toBeDefined()
    expect(body.meta.request_id).toBeDefined()
  })
})

describe('context route', () => {
  it('GET /v1/context/:contactId returns envelope', async () => {
    const app = createApi({ adapter: routeTestAdapter(), version: '2026-04-01' })
    const res = await app.request('/v1/context/contact_01TEST', {
      headers: { authorization: 'Bearer orbit_live_test' },
    })
    // May return 404 if contact doesn't exist in stub — that's acceptable
    expect([200, 404]).toContain(res.status)
    const body = await res.json() as any
    if (res.status === 200) {
      expect(body.data).toBeDefined()
      expect(body.meta).toBeDefined()
    } else {
      expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
    }
  })
})
```

- [ ] **Step 2: Implement health routes**

```typescript
// packages/api/src/routes/health.ts
import type { Hono } from 'hono'
import { toEnvelope } from '../responses.js'

export function registerHealthRoutes(app: Hono) {
  // GET /health — no auth required
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // GET /v1/status — requires auth (handled by /v1/* middleware)
  app.get('/v1/status', (c) => {
    return c.json(
      toEnvelope(c, {
        status: 'ok',
        version: c.get('orbitVersion'),
        timestamp: new Date().toISOString(),
      }),
    )
  })
}
```

- [ ] **Step 3: Implement search route**

```typescript
// packages/api/src/routes/search.ts
import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'

export function registerSearchRoutes(app: Hono, services: CoreServices) {
  app.post('/v1/search', async (c) => {
    const body = await c.req.json()
    const result = await services.search.search(c.get('orbit'), {
      query: body.query,
      limit: body.limit,
      cursor: body.cursor,
    })
    return c.json(toEnvelope(c, result.data, result))
  })
}
```

- [ ] **Step 4: Implement context route**

```typescript
// packages/api/src/routes/context.ts
import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError } from '../responses.js'

export function registerContextRoutes(app: Hono, services: CoreServices) {
  app.get('/v1/context/:contactId', async (c) => {
    const contactId = c.req.param('contactId')
    const result = await services.contactContext.getContactContext(c.get('orbit'), {
      contactId,
    })
    if (!result) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Contact not found'), 404)
    }
    return c.json(toEnvelope(c, result))
  })
}
```

- [ ] **Step 5: Wire routes into create-api.ts**

Add to `createApi()` after middleware:

```typescript
import { registerHealthRoutes } from './routes/health.js'
import { registerSearchRoutes } from './routes/search.js'
import { registerContextRoutes } from './routes/context.js'
import { createCoreServices } from '@orbit-ai/core'

// Inside createApi():
const services = createCoreServices(options.adapter)

registerHealthRoutes(app)
registerSearchRoutes(app, services)
registerContextRoutes(app, services)
```

- [ ] **Step 6: Run tests and verify**

```bash
pnpm --filter @orbit-ai/api test && pnpm --filter @orbit-ai/api typecheck && pnpm --filter @orbit-ai/api build
```

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/ packages/api/src/__tests__/routes-wave1.test.ts packages/api/src/create-api.ts
git commit -m "feat(api): step 4a — health, search, and context routes"
```

---

## Task 6: API Wave 1 — Generic Public Entity Routes

**Files:**
- Create: `packages/api/src/routes/entities.ts`
- Modify: `packages/api/src/__tests__/routes-wave1.test.ts`
- Modify: `packages/api/src/create-api.ts`

- [ ] **Step 1: Write failing tests for generic entity routes**

```typescript
// Append to packages/api/src/__tests__/routes-wave1.test.ts

describe('public entity routes', () => {
  const WAVE_1_ENTITIES = ['contacts', 'companies', 'deals', 'pipelines', 'stages', 'users']

  for (const entity of WAVE_1_ENTITIES) {
    describe(`GET /v1/${entity}`, () => {
      it('returns envelope with data array', async () => {
        const app = createApi({ adapter: routeTestAdapter(), version: '2026-04-01' })
        const res = await app.request(`/v1/${entity}`, {
          headers: { authorization: 'Bearer orbit_live_test' },
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.data).toBeInstanceOf(Array)
        expect(body.meta.request_id).toBeDefined()
        expect(body.meta.version).toBe('2026-04-01')
        expect(body.links.self).toBe(`/v1/${entity}`)
      })
    })

    describe(`POST /v1/${entity}/search`, () => {
      it('returns envelope with data array', async () => {
        const app = createApi({ adapter: routeTestAdapter(), version: '2026-04-01' })
        const res = await app.request(`/v1/${entity}/search`, {
          method: 'POST',
          headers: {
            authorization: 'Bearer orbit_live_test',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ query: 'test' }),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.data).toBeInstanceOf(Array)
      })
    })
  }

  it('does not expose bootstrap routes under /v1/<entity>', async () => {
    const app = createApi({ adapter: routeTestAdapter(), version: '2026-04-01' })
    const res = await app.request('/v1/organizations', {
      headers: { authorization: 'Bearer orbit_live_test' },
    })
    expect(res.status).toBe(404)
  })

  it('does not expose admin entities under /v1/<entity>', async () => {
    const app = createApi({ adapter: routeTestAdapter(), version: '2026-04-01' })
    const res = await app.request('/v1/audit_logs', {
      headers: { authorization: 'Bearer orbit_live_test' },
    })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Implement generic public entity routes**

```typescript
// packages/api/src/routes/entities.ts
import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { z } from 'zod'
import { toEnvelope, toError, sanitizePublicRead, sanitizePublicPage } from '../responses.js'

const PUBLIC_ENTITY_CAPABILITIES = {
  contacts: { read: true, write: true, batch: true },
  companies: { read: true, write: true, batch: true },
  deals: { read: true, write: true, batch: true },
  pipelines: { read: true, write: true, batch: false },
  stages: { read: true, write: true, batch: false },
  users: { read: true, write: true, batch: false },
} as const

type PublicEntityName = keyof typeof PUBLIC_ENTITY_CAPABILITIES

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  include: z.string().optional(),
})

function resolveService(services: CoreServices, entity: PublicEntityName) {
  return services[entity as keyof CoreServices] as any
}

export function registerPublicEntityRoutes(app: Hono, services: CoreServices) {
  for (const [entity, capabilities] of Object.entries(PUBLIC_ENTITY_CAPABILITIES)) {
    const typedEntity = entity as PublicEntityName

    // GET /v1/<entity>
    app.get(`/v1/${entity}`, async (c) => {
      const query = listQuerySchema.parse(c.req.query())
      const service = resolveService(services, typedEntity)
      const result = await service.list(c.get('orbit'), {
        limit: query.limit,
        cursor: query.cursor,
        include: query.include?.split(',').filter(Boolean),
      })
      return c.json(toEnvelope(c, sanitizePublicPage(entity, result.data), result))
    })

    // POST /v1/<entity>
    if (capabilities.write) {
      app.post(`/v1/${entity}`, async (c) => {
        const service = resolveService(services, typedEntity)
        const body = await c.req.json()
        const created = await service.create(c.get('orbit'), body)
        return c.json(toEnvelope(c, sanitizePublicRead(entity, created)), 201)
      })
    }

    // GET /v1/<entity>/:id
    app.get(`/v1/${entity}/:id`, async (c) => {
      const service = resolveService(services, typedEntity)
      const record = await service.get(c.get('orbit'), c.req.param('id'))
      if (!record) return c.json(toError(c, 'RESOURCE_NOT_FOUND', `${entity} not found`), 404)
      return c.json(toEnvelope(c, sanitizePublicRead(entity, record)))
    })

    // PATCH /v1/<entity>/:id
    if (capabilities.write) {
      app.patch(`/v1/${entity}/:id`, async (c) => {
        const service = resolveService(services, typedEntity)
        const record = await service.update(c.get('orbit'), c.req.param('id'), await c.req.json())
        return c.json(toEnvelope(c, sanitizePublicRead(entity, record)))
      })
    }

    // DELETE /v1/<entity>/:id
    if (capabilities.write) {
      app.delete(`/v1/${entity}/:id`, async (c) => {
        const service = resolveService(services, typedEntity)
        await service.delete(c.get('orbit'), c.req.param('id'))
        return c.json(toEnvelope(c, { id: c.req.param('id'), deleted: true }))
      })
    }

    // POST /v1/<entity>/search
    app.post(`/v1/${entity}/search`, async (c) => {
      const service = resolveService(services, typedEntity)
      const result = await service.search(c.get('orbit'), await c.req.json())
      return c.json(toEnvelope(c, sanitizePublicPage(entity, result.data), result))
    })

    // POST /v1/<entity>/batch
    if (capabilities.batch) {
      app.post(`/v1/${entity}/batch`, async (c) => {
        const service = resolveService(services, typedEntity)
        const body = await c.req.json()
        const result = await (service as any).batch(c.get('orbit'), body)
        return c.json(toEnvelope(c, result))
      })
    }
  }
}
```

- [ ] **Step 3: Wire entity routes into create-api.ts**

Add to `createApi()`:

```typescript
import { registerPublicEntityRoutes } from './routes/entities.js'

// Inside createApi(), after other routes:
registerPublicEntityRoutes(app, services)
```

- [ ] **Step 4: Run tests and verify**

```bash
pnpm --filter @orbit-ai/api test && pnpm --filter @orbit-ai/api typecheck && pnpm --filter @orbit-ai/api build
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/entities.ts packages/api/src/__tests__/routes-wave1.test.ts packages/api/src/create-api.ts
git commit -m "feat(api): step 4b — generic public entity routes for Wave 1"
```

---

## Task 7: SDK Package Bootstrap

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/sdk/vitest.config.ts`
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/src/client.ts`
- Create: `packages/sdk/src/config.ts`
- Create: `packages/sdk/src/errors.ts`
- Create: `packages/sdk/src/retries.ts`
- Create: `packages/sdk/src/pagination.ts`
- Create: `packages/sdk/src/transport/index.ts`
- Create: `packages/sdk/src/__tests__/client.test.ts`
- Create: `packages/sdk/src/__tests__/errors.test.ts`
- Create: `packages/sdk/src/__tests__/retries.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/sdk/src/__tests__/client.test.ts
import { describe, it, expect } from 'vitest'
import { OrbitClient } from '../client.js'
import { OrbitClient as PublicOrbitClient } from '../index.js'

describe('OrbitClient', () => {
  it('instantiates in API mode with apiKey and baseUrl', () => {
    const client = new OrbitClient({
      apiKey: 'orbit_live_test',
      baseUrl: 'http://localhost:3000',
    })
    expect(client).toBeDefined()
    expect(client.contacts).toBeDefined()
    expect(client.companies).toBeDefined()
    expect(client.deals).toBeDefined()
    expect(PublicOrbitClient).toBeDefined()
  })

  it('instantiates in direct mode with adapter and context', () => {
    const client = new OrbitClient({
      adapter: {} as any,
      context: { orgId: 'org_01TEST' },
    })
    expect(client).toBeDefined()
  })

  it('throws if neither apiKey nor adapter is provided', () => {
    expect(() => new OrbitClient({})).toThrow()
  })

  it('throws if both apiKey and adapter are provided', () => {
    expect(
      () =>
        new OrbitClient({
          apiKey: 'orbit_live_test',
          adapter: {} as any,
          context: { orgId: 'org_01TEST' },
        }),
    ).toThrow('exactly one mode')
  })
})
```

```typescript
// packages/sdk/src/__tests__/errors.test.ts
import { describe, it, expect } from 'vitest'
import { OrbitApiError } from '../errors.js'

describe('OrbitApiError', () => {
  it('constructs from error shape and status', () => {
    const err = new OrbitApiError(
      { code: 'RESOURCE_NOT_FOUND', message: 'Not found' },
      404,
    )
    expect(err.status).toBe(404)
    expect(err.error.code).toBe('RESOURCE_NOT_FOUND')
    expect(err.message).toBe('Not found')
  })
})
```

```typescript
// packages/sdk/src/__tests__/retries.test.ts
import { describe, it, expect } from 'vitest'
import { retry } from '../retries.js'
import { OrbitApiError } from '../errors.js'

describe('retry', () => {
  it('returns result on first success', async () => {
    const result = await retry(async () => 'ok', { maxRetries: 2 })
    expect(result).toBe('ok')
  })

  it('retries on retryable error', async () => {
    let attempts = 0
    const result = await retry(
      async () => {
        attempts++
        if (attempts < 3) {
          throw new OrbitApiError({ code: 'INTERNAL_ERROR', message: 'fail', retryable: true }, 500)
        }
        return 'ok'
      },
      { maxRetries: 3 },
    )
    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })

  it('does not retry non-retryable errors', async () => {
    let attempts = 0
    await expect(
      retry(
        async () => {
          attempts++
          throw new OrbitApiError({ code: 'VALIDATION_FAILED', message: 'bad', retryable: false }, 400)
        },
        { maxRetries: 3 },
      ),
    ).rejects.toThrow()
    expect(attempts).toBe(1)
  })
})
```

- [ ] **Step 2: Create package.json**

```json
// packages/sdk/package.json
{
  "name": "@orbit-ai/sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@orbit-ai/core": "workspace:*"
  }
}
```

- [ ] **Step 3: Create tsconfig.json and vitest.config.ts**

```json
// packages/sdk/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "node_modules/.cache/tsconfig.sdk.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

```typescript
// packages/sdk/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { enabled: false },
  },
})
```

- [ ] **Step 4: Implement config.ts**

```typescript
// packages/sdk/src/config.ts
import type { StorageAdapter } from '@orbit-ai/core'

export interface OrbitClientOptions {
  /** API key for HTTP mode */
  apiKey?: string
  /** Base URL for HTTP mode (default: http://localhost:3000) */
  baseUrl?: string
  /** Storage adapter for direct mode */
  adapter?: StorageAdapter
  /** Trusted context for direct mode. Require orgId; userId is optional. */
  context?: { userId?: string; orgId: string }
  /** API version header (default: 2026-04-01) */
  version?: string
  /** Request timeout in ms */
  timeoutMs?: number
  /** Max retries for retryable errors (default: 2) */
  maxRetries?: number
}
```

- [ ] **Step 5: Implement errors.ts**

```typescript
// packages/sdk/src/errors.ts
import type { OrbitErrorShape } from '@orbit-ai/core'

export class OrbitApiError extends Error {
  constructor(
    public readonly error: OrbitErrorShape,
    public readonly status: number,
  ) {
    super(error.message)
    this.name = 'OrbitApiError'
  }

  static async fromResponse(response: Response): Promise<OrbitApiError> {
    const body = (await response.json()) as { error: OrbitErrorShape }
    return new OrbitApiError(body.error, response.status)
  }
}
```

- [ ] **Step 6: Implement retries.ts**

```typescript
// packages/sdk/src/retries.ts
import { OrbitApiError } from './errors.js'

export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number },
): Promise<T> {
  let attempt = 0
  let delayMs = 250
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      const shouldRetry =
        error instanceof OrbitApiError &&
        error.error.retryable === true &&
        attempt < options.maxRetries

      if (!shouldRetry) throw error

      await new Promise((resolve) => setTimeout(resolve, delayMs))
      attempt += 1
      delayMs *= 2
    }
  }
}
```

- [ ] **Step 7: Implement transport/index.ts**

```typescript
// packages/sdk/src/transport/index.ts
import type { OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'

export interface TransportRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
}

export interface OrbitTransport {
  rawRequest<T>(input: TransportRequest): Promise<OrbitEnvelope<T>>
  request<T>(input: TransportRequest): Promise<OrbitEnvelope<T>>
}

export function createTransport(options: OrbitClientOptions): OrbitTransport {
  if (options.apiKey && options.adapter) {
    throw new Error('OrbitClient must use exactly one mode: API key or adapter + context')
  }
  if (options.apiKey) {
    // HTTP transport — implemented in Step 5
    throw new Error('HTTP transport not yet implemented')
  }
  if (options.adapter && options.context?.orgId) {
    // Direct transport — implemented in Step 5
    throw new Error('Direct transport not yet implemented')
  }
  throw new Error('OrbitClient requires either apiKey (API mode) or adapter + context (direct mode)')
}
```

- [ ] **Step 8: Implement pagination.ts**

```typescript
// packages/sdk/src/pagination.ts
import type { OrbitEnvelope, ListQuery } from '@orbit-ai/core'
import type { OrbitTransport } from './transport/index.js'

function serializeListQuery(query: ListQuery): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (query.limit !== undefined) result.limit = query.limit
  if (query.cursor) result.cursor = query.cursor
  if (query.include?.length) result.include = query.include.join(',')
  return result
}

export class AutoPager<T> {
  constructor(
    private readonly transport: OrbitTransport,
    private readonly path: string,
    private readonly initialQuery: ListQuery,
  ) {}

  async firstPage(): Promise<OrbitEnvelope<T[]>> {
    return this.transport.request<T[]>({
      method: 'GET',
      path: this.path,
      query: serializeListQuery(this.initialQuery),
    })
  }

  async *autoPaginate(): AsyncGenerator<T, void, undefined> {
    let cursor = this.initialQuery.cursor
    for (;;) {
      const page = await this.transport.request<T[]>({
        method: 'GET',
        path: this.path,
        query: serializeListQuery({ ...this.initialQuery, cursor }),
      })
      for (const row of page.data) yield row
      if (!page.meta.has_more || !page.meta.next_cursor) return
      cursor = page.meta.next_cursor
    }
  }
}
```

- [ ] **Step 9: Implement client.ts (stub — resources added in later tasks)**

```typescript
// packages/sdk/src/client.ts
import type { OrbitClientOptions } from './config.js'
import { createTransport, type OrbitTransport } from './transport/index.js'

export class OrbitClient {
  private readonly transport: OrbitTransport

  // Resource accessors will be added in Tasks 9+
  readonly contacts: any
  readonly companies: any
  readonly deals: any
  readonly pipelines: any
  readonly stages: any
  readonly users: any

  constructor(public readonly options: OrbitClientOptions) {
    this.transport = createTransport(options)
    // Resources will be initialized in Tasks 9+
    this.contacts = {}
    this.companies = {}
    this.deals = {}
    this.pipelines = {}
    this.stages = {}
    this.users = {}
  }
}
```

- [ ] **Step 10: Implement index.ts**

```typescript
// packages/sdk/src/index.ts
export { OrbitClient } from './client.js'
export type { OrbitClientOptions } from './config.js'
export { OrbitApiError } from './errors.js'
export type { OrbitTransport, TransportRequest } from './transport/index.js'
export { AutoPager } from './pagination.js'
```

- [ ] **Step 11: Install dependencies and run tests**

```bash
pnpm install
pnpm --filter @orbit-ai/sdk test
```

Expected: PASS — client, errors, and retries tests green. Client tests will need adjustment if `createTransport` throws on stub — modify client test to catch or mock.

- [ ] **Step 12: Run full verification**

```bash
pnpm --filter @orbit-ai/sdk build && pnpm --filter @orbit-ai/sdk typecheck && git diff --check
```

- [ ] **Step 13: Commit**

```bash
git add packages/sdk/
git commit -m "feat(sdk): step 4c — package bootstrap, client, errors, retries, pagination"
```

---

## Task 8: SDK HTTP Transport And Direct Transport

**Files:**
- Create: `packages/sdk/src/transport/http-transport.ts`
- Create: `packages/sdk/src/transport/direct-transport.ts`
- Create: `packages/sdk/src/__tests__/http-transport.test.ts`
- Create: `packages/sdk/src/__tests__/direct-transport.test.ts`
- Create: `packages/sdk/src/__tests__/transport-parity.test.ts`
- Modify: `packages/sdk/src/transport/index.ts`

- [ ] **Step 1: Write failing tests for HTTP transport**

```typescript
// packages/sdk/src/__tests__/http-transport.test.ts
import { describe, it, expect, vi } from 'vitest'
import { HttpTransport } from '../transport/http-transport.js'

describe('HttpTransport', () => {
  it('sends Authorization: Bearer header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: {}, meta: {}, links: {} }), { status: 200 }),
    )
    globalThis.fetch = fetchSpy

    const transport = new HttpTransport({
      apiKey: 'orbit_live_testkey',
      baseUrl: 'http://localhost:3000',
    })
    await transport.rawRequest({ method: 'GET', path: '/v1/contacts' })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [, init] = fetchSpy.mock.calls[0]!
    expect(init.headers.authorization).toBe('Bearer orbit_live_testkey')
  })

  it('sends Orbit-Version header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: {}, meta: {}, links: {} }), { status: 200 }),
    )
    globalThis.fetch = fetchSpy

    const transport = new HttpTransport({
      apiKey: 'orbit_live_testkey',
      baseUrl: 'http://localhost:3000',
      version: '2026-03-01',
    })
    await transport.rawRequest({ method: 'GET', path: '/v1/contacts' })

    const [, init] = fetchSpy.mock.calls[0]!
    expect(init.headers['orbit-version']).toBe('2026-03-01')
  })

  it('sends Idempotency-Key for mutating requests', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: {}, meta: {}, links: {} }), { status: 200 }),
    )
    globalThis.fetch = fetchSpy

    const transport = new HttpTransport({
      apiKey: 'orbit_live_testkey',
      baseUrl: 'http://localhost:3000',
    })
    await transport.rawRequest({ method: 'POST', path: '/v1/contacts', body: { name: 'Jane' } })

    const [, init] = fetchSpy.mock.calls[0]!
    expect(init.headers['idempotency-key']).toBeDefined()
  })

  it('does not send Idempotency-Key for GET requests', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: {}, meta: {}, links: {} }), { status: 200 }),
    )
    globalThis.fetch = fetchSpy

    const transport = new HttpTransport({
      apiKey: 'orbit_live_testkey',
      baseUrl: 'http://localhost:3000',
    })
    await transport.rawRequest({ method: 'GET', path: '/v1/contacts' })

    const [, init] = fetchSpy.mock.calls[0]!
    expect(init.headers['idempotency-key']).toBeUndefined()
  })

  it('throws OrbitApiError on error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found' } }),
        { status: 404 },
      ),
    )

    const transport = new HttpTransport({
      apiKey: 'orbit_live_testkey',
      baseUrl: 'http://localhost:3000',
    })

    const { OrbitApiError } = await import('../errors.js')
    await expect(transport.rawRequest({ method: 'GET', path: '/v1/contacts/bad' })).rejects.toBeInstanceOf(OrbitApiError)
  })
})
```

- [ ] **Step 2: Write failing tests for direct transport**

```typescript
// packages/sdk/src/__tests__/direct-transport.test.ts
import { describe, it, expect } from 'vitest'
import { DirectTransport } from '../transport/direct-transport.js'

describe('DirectTransport', () => {
  it('requires adapter and context.orgId', () => {
    expect(() => new DirectTransport({})).toThrow('Direct transport requires adapter and context.orgId')
    expect(() => new DirectTransport({ adapter: {} as any })).toThrow()
  })

  it('does not call runWithMigrationAuthority', async () => {
    let migrationCalled = false
    const adapter = {
      name: 'sqlite' as const,
      dialect: 'sqlite' as const,
      supportsRls: false,
      supportsBranching: false,
      supportsJsonbIndexes: false,
      authorityModel: { runtime: true, migration: false },
      unsafeRawDatabase: {} as any,
      users: {} as any,
      connect: async () => {},
      disconnect: async () => {},
      migrate: async () => {},
      runWithMigrationAuthority: async () => { migrationCalled = true; return {} as any },
      lookupApiKeyForAuth: async () => null,
      transaction: async (fn: any) => fn({} as any),
      execute: async () => ({}),
      query: async () => [],
      withTenantContext: async (_ctx: any, fn: any) => fn({} as any),
      getSchemaSnapshot: async () => ({ tables: [], version: '' }),
    }

    // Creating the transport should not call migration authority
    const transport = new DirectTransport({
      adapter,
      context: { orgId: 'org_01TEST' },
    })
    expect(migrationCalled).toBe(false)
  })
})
```

- [ ] **Step 3: Implement HTTP transport**

```typescript
// packages/sdk/src/transport/http-transport.ts
import type { OrbitEnvelope } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'
import type { OrbitTransport, TransportRequest } from './index.js'
import { OrbitApiError } from '../errors.js'
import { retry } from '../retries.js'

export class HttpTransport implements OrbitTransport {
  constructor(private readonly options: OrbitClientOptions) {}

  async rawRequest<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
    const idempotencyKey =
      input.headers?.['idempotency-key'] ??
      (input.method === 'GET' ? undefined : crypto.randomUUID())

    return retry(
      async () => {
        const url = new URL(input.path, this.options.baseUrl ?? 'http://localhost:3000')
        if (input.query) {
          for (const [key, value] of Object.entries(input.query)) {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
          }
        }

        const headers: Record<string, string> = {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
          'orbit-version': this.options.version ?? '2026-04-01',
          ...input.headers,
        }
        if (idempotencyKey) {
          headers['idempotency-key'] = idempotencyKey
        }

        const response = await fetch(url, {
          method: input.method,
          headers,
          body: input.body ? JSON.stringify(input.body) : undefined,
        })

        if (!response.ok) {
          throw await OrbitApiError.fromResponse(response)
        }

        return (await response.json()) as OrbitEnvelope<T>
      },
      { maxRetries: this.options.maxRetries ?? 2 },
    )
  }

  async request<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
    return this.rawRequest(input)
  }
}
```

- [ ] **Step 4: Implement direct transport**

```typescript
// packages/sdk/src/transport/direct-transport.ts
import { createCoreServices, type OrbitEnvelope, type OrbitAuthContext } from '@orbit-ai/core'
import type { OrbitClientOptions } from '../config.js'
import type { OrbitTransport, TransportRequest } from './index.js'
import { OrbitApiError } from '../errors.js'

export class DirectTransport implements OrbitTransport {
  private readonly services: ReturnType<typeof createCoreServices>
  private readonly ctx: OrbitAuthContext

  constructor(private readonly options: OrbitClientOptions) {
    if (!options.adapter || !options.context?.orgId) {
      throw new Error('Direct transport requires adapter and context.orgId')
    }
    this.services = createCoreServices(options.adapter)
    this.ctx = {
      orgId: options.context.orgId,
      userId: options.context.userId,
      // Internal trusted scope set. This is not part of OrbitClientOptions.context.
      scopes: ['*'],
    }
  }

  async rawRequest<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
    return this.request(input)
  }

  async request<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
    try {
      const result = await this.dispatch(input)
      return this.wrapEnvelope(input.path, result) as OrbitEnvelope<T>
    } catch (err: any) {
      if (err.code) {
        throw new OrbitApiError(
          { code: err.code, message: err.message, field: err.field, retryable: err.retryable },
          this.errorCodeToStatus(err.code),
        )
      }
      throw err
    }
  }

  /** Entities whose read results must be sanitized (same as the API route layer). */
  private static readonly SANITIZED_ENTITIES: Record<string, (r: Record<string, unknown>) => unknown> = {
    webhooks: (r) => {
      const { secretEncrypted, ...safe } = r
      return { ...safe, object: 'webhook' }
    },
    webhook_deliveries: (r) => {
      const { payload, signature, idempotencyKey, responseBody, ...safe } = r
      return { ...safe, object: 'webhook_delivery' }
    },
  }

  private sanitizeResult(entity: string, data: unknown): unknown {
    const sanitizer = DirectTransport.SANITIZED_ENTITIES[entity]
    if (!sanitizer || !data) return data
    if (Array.isArray(data)) return data.map((r) => sanitizer(r as Record<string, unknown>))
    return sanitizer(data as Record<string, unknown>)
  }

  private async dispatch(input: TransportRequest): Promise<unknown> {
    // Route dispatch — maps API paths to core service calls
    // This will be expanded as resource routes are added
    const { method, path, body, query } = input

    // Parse path: /v1/<entity>, /v1/<entity>/:id, /v1/<entity>/search, etc.
    const segments = path.split('/').filter(Boolean) // ['v1', 'contacts', ':id']
    if (segments[0] !== 'v1') throw new Error(`Unknown path: ${path}`)

    const entity = segments[1]
    const action = segments[2]

    // Special-case routes that don't follow the /v1/<entity>/<action> pattern
    if (method === 'POST' && entity === 'search') {
      return this.services.search.search(this.ctx, body as any)
    }
    if (method === 'GET' && entity === 'context' && action) {
      return this.services.contactContext.getContactContext(this.ctx, { contactId: action })
    }

    // Resolve service for standard entity routes
    const service = (this.services as any)[entity]
    if (!service) throw new Error(`Unknown entity: ${entity}`)

    let result: unknown
    if (method === 'GET' && !action) {
      result = await service.list(this.ctx, query ?? {})
      // Sanitize paginated data arrays
      if (result && typeof result === 'object' && 'data' in (result as any)) {
        (result as any).data = this.sanitizeResult(entity!, (result as any).data)
      }
      return result
    }
    if (method === 'POST' && !action) {
      result = await service.create(this.ctx, body)
      return this.sanitizeResult(entity!, result)
    }
    if (method === 'GET' && action && action !== 'search') {
      result = await service.get(this.ctx, action)
      return this.sanitizeResult(entity!, result)
    }
    if (method === 'PATCH' && action) {
      result = await service.update(this.ctx, action, body)
      return this.sanitizeResult(entity!, result)
    }
    if (method === 'DELETE' && action) {
      await service.delete(this.ctx, action)
      return { id: action, deleted: true }
    }
    if (method === 'POST' && action === 'search') {
      result = await service.search(this.ctx, body)
      if (result && typeof result === 'object' && 'data' in (result as any)) {
        (result as any).data = this.sanitizeResult(entity!, (result as any).data)
      }
      return result
    }

    throw new Error(`Unhandled dispatch: ${method} ${path}`)
  }

  private wrapEnvelope(path: string, data: unknown): OrbitEnvelope<unknown> {
    // If data has .data/.nextCursor/.hasMore, it's a paginated result
    const paginated = data as any
    if (paginated && typeof paginated === 'object' && 'data' in paginated && 'hasMore' in paginated) {
      return {
        data: paginated.data,
        meta: {
          request_id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`,
          cursor: null,
          next_cursor: paginated.nextCursor ?? null,
          has_more: paginated.hasMore ?? false,
          version: this.options.version ?? '2026-04-01',
        },
        links: { self: path },
      }
    }

    return {
      data: data as any,
      meta: {
        request_id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`,
        cursor: null,
        next_cursor: null,
        has_more: false,
        version: this.options.version ?? '2026-04-01',
      },
      links: { self: path },
    }
  }

  private errorCodeToStatus(code: string): number {
    const map: Record<string, number> = {
      AUTH_INVALID_API_KEY: 401,
      AUTH_INSUFFICIENT_SCOPE: 403,
      VALIDATION_FAILED: 400,
      RESOURCE_NOT_FOUND: 404,
      CONFLICT: 409,
      INTERNAL_ERROR: 500,
    }
    return map[code] ?? 500
  }
}
```

- [ ] **Step 5: Update createTransport to use real implementations**

```typescript
// packages/sdk/src/transport/index.ts — replace createTransport body
import { HttpTransport } from './http-transport.js'
import { DirectTransport } from './direct-transport.js'

export function createTransport(options: OrbitClientOptions): OrbitTransport {
  if (options.apiKey) {
    return new HttpTransport(options)
  }
  if (options.adapter && options.context?.orgId) {
    return new DirectTransport(options)
  }
  throw new Error('OrbitClient requires either apiKey (API mode) or adapter + context (direct mode)')
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @orbit-ai/sdk test
```

Expected: PASS.

- [ ] **Step 7: Run full verification**

```bash
pnpm --filter @orbit-ai/sdk build && pnpm --filter @orbit-ai/sdk typecheck && git diff --check
```

- [ ] **Step 8: Commit**

```bash
git add packages/sdk/src/transport/ packages/sdk/src/__tests__/
git commit -m "feat(sdk): step 5 — HTTP and direct transport implementations"
```

---

## WAVE GATE 2

- [ ] **Step 1: Run full verification for both packages**

```bash
pnpm --filter @orbit-ai/api test && pnpm --filter @orbit-ai/api typecheck && pnpm --filter @orbit-ai/api build && pnpm --filter @orbit-ai/sdk test && pnpm --filter @orbit-ai/sdk typecheck && pnpm --filter @orbit-ai/sdk build
```

- [ ] **Step 2: Dispatch independent code review sub-agent** (both packages)

- [ ] **Step 3: Dispatch independent security review sub-agent**

Focus: route-level scope enforcement, SDK transport authority boundaries, HTTP/direct parity.

- [ ] **Step 4: Dispatch tenant safety review**

Use `orbit-tenant-safety-review` skill. Focus: Wave 1 route tenancy, bootstrap bypass, public/admin separation, and direct-mode tenant-context parity.

- [ ] **Step 5: Dispatch parity review**

Use `orbit-api-sdk-parity` skill. Mandatory parity checklist:
- SDK resource methods for Wave 1 entities map 1:1 to API routes
- HTTP and direct transport produce identical envelope shapes for the same operation
- HTTP and direct transport surface the same typed error codes
- Secret-bearing reads (webhooks) are sanitized in both transports
- `.response()` returns raw server envelope unchanged; `.firstPage()` preserves cursor metadata
- Route naming, envelope metadata, and pagination are consistent across all Wave 1 routes

- [ ] **Step 6: Write review artifact**

Create `docs/review/2026-04-03-api-sdk-wave-gate-2.md` with findings, severity, reviewer identity, decision, and remediation status.

- [ ] **Step 7: Apply remediation and commit gate**

```bash
git commit --allow-empty -m "review: wave gate 2 accepted — API Wave 1 + SDK transport stable"
```

---

## Task 9: SDK Wave 1 Resources — Base Resource And Wave 1 Entity Resources

**Files:**
- Create: `packages/sdk/src/resources/base-resource.ts`
- Create: `packages/sdk/src/resources/contacts.ts`
- Create: `packages/sdk/src/resources/companies.ts`
- Create: `packages/sdk/src/resources/deals.ts`
- Create: `packages/sdk/src/resources/pipelines.ts`
- Create: `packages/sdk/src/resources/stages.ts`
- Create: `packages/sdk/src/resources/users.ts`
- Create: `packages/sdk/src/search.ts`
- Create: `packages/sdk/src/__tests__/resources-wave1.test.ts`
- Modify: `packages/sdk/src/client.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/sdk/src/__tests__/resources-wave1.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OrbitTransport } from '../transport/index.js'
import { ContactResource } from '../resources/contacts.js'
import { CompanyResource } from '../resources/companies.js'
import { DealResource } from '../resources/deals.js'

function mockTransport(): OrbitTransport {
  return {
    rawRequest: vi.fn().mockResolvedValue({
      data: { id: 'test_01' },
      meta: { request_id: 'req_01', cursor: null, next_cursor: null, has_more: false, version: '2026-04-01' },
      links: { self: '/v1/test' },
    }),
    request: vi.fn().mockResolvedValue({
      data: { id: 'test_01' },
      meta: { request_id: 'req_01', cursor: null, next_cursor: null, has_more: false, version: '2026-04-01' },
      links: { self: '/v1/test' },
    }),
  }
}

describe('ContactResource', () => {
  it('create returns a record, not an envelope', async () => {
    const transport = mockTransport()
    const contacts = new ContactResource(transport)
    const result = await contacts.create({ name: 'Jane' })
    expect(result).toEqual({ id: 'test_01' })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/contacts',
      body: { name: 'Jane' },
    })
  })

  it('get returns a record', async () => {
    const transport = mockTransport()
    const contacts = new ContactResource(transport)
    const result = await contacts.get('contact_01')
    expect(result).toEqual({ id: 'test_01' })
  })

  it('.response().get returns the raw envelope', async () => {
    const transport = mockTransport()
    const contacts = new ContactResource(transport)
    const result = await contacts.response().get('contact_01')
    expect(result.meta).toBeDefined()
    expect(result.meta.request_id).toBe('req_01')
    expect(transport.rawRequest).toHaveBeenCalled()
  })

  it('list() returns an AutoPager', () => {
    const transport = mockTransport()
    const contacts = new ContactResource(transport)
    const pager = contacts.list()
    expect(pager.firstPage).toBeTypeOf('function')
    expect(pager.autoPaginate).toBeTypeOf('function')
  })

  it('batch() calls /v1/contacts/batch', async () => {
    const transport = mockTransport()
    const contacts = new ContactResource(transport)
    await contacts.batch({ operations: [{ action: 'create', data: { name: 'Jane' } }] })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/contacts/batch',
      body: { operations: [{ action: 'create', data: { name: 'Jane' } }] },
    })
  })

  it('.context() calls /v1/context/:id', async () => {
    const transport = mockTransport()
    const contacts = new ContactResource(transport)
    await contacts.context('contact_01')
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v1/context/contact_01',
    })
  })
})

describe('DealResource', () => {
  it('.move() calls POST /v1/deals/:id/move', async () => {
    const transport = mockTransport()
    const deals = new DealResource(transport)
    await deals.move('deal_01', { stage_id: 'stage_02' })
    expect(transport.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/deals/deal_01/move',
      body: { stage_id: 'stage_02' },
    })
  })
})
```

- [ ] **Step 2: Implement base-resource.ts**

```typescript
// packages/sdk/src/resources/base-resource.ts
import type { ListQuery } from '@orbit-ai/core'
import type { OrbitTransport } from '../transport/index.js'
import { AutoPager } from '../pagination.js'

export class BaseResource<TRecord, TCreate, TUpdate> {
  constructor(
    protected readonly transport: OrbitTransport,
    protected readonly basePath: string,
  ) {}

  async create(input: TCreate): Promise<TRecord> {
    const response = await this.transport.request<TRecord>({
      method: 'POST',
      path: this.basePath,
      body: input,
    })
    return response.data
  }

  async get(id: string, include?: string[]): Promise<TRecord> {
    const response = await this.transport.request<TRecord>({
      method: 'GET',
      path: `${this.basePath}/${id}`,
      query: include?.length ? { include: include.join(',') } : undefined,
    })
    return response.data
  }

  async update(id: string, input: TUpdate): Promise<TRecord> {
    const response = await this.transport.request<TRecord>({
      method: 'PATCH',
      path: `${this.basePath}/${id}`,
      body: input,
    })
    return response.data
  }

  async delete(id: string): Promise<{ id: string; deleted: true }> {
    const response = await this.transport.request<{ id: string; deleted: true }>({
      method: 'DELETE',
      path: `${this.basePath}/${id}`,
    })
    return response.data
  }

  list(query: ListQuery = {}): AutoPager<TRecord> {
    return new AutoPager<TRecord>(this.transport, this.basePath, query)
  }

  async search(body: Record<string, unknown>): Promise<TRecord[]> {
    const response = await this.transport.request<TRecord[]>({
      method: 'POST',
      path: `${this.basePath}/search`,
      body,
    })
    return response.data
  }

  async batch(body: Record<string, unknown>): Promise<unknown> {
    const response = await this.transport.request<unknown>({
      method: 'POST',
      path: `${this.basePath}/batch`,
      body,
    })
    return response.data
  }

  response() {
    return {
      create: (input: TCreate) =>
        this.transport.rawRequest<TRecord>({ method: 'POST', path: this.basePath, body: input }),
      get: (id: string, include?: string[]) =>
        this.transport.rawRequest<TRecord>({
          method: 'GET',
          path: `${this.basePath}/${id}`,
          query: include?.length ? { include: include.join(',') } : undefined,
        }),
      update: (id: string, input: TUpdate) =>
        this.transport.rawRequest<TRecord>({ method: 'PATCH', path: `${this.basePath}/${id}`, body: input }),
      delete: (id: string) =>
        this.transport.rawRequest<{ id: string; deleted: true }>({ method: 'DELETE', path: `${this.basePath}/${id}` }),
      search: (body: Record<string, unknown>) =>
        this.transport.rawRequest<TRecord[]>({ method: 'POST', path: `${this.basePath}/search`, body }),
      batch: (body: Record<string, unknown>) =>
        this.transport.rawRequest<unknown>({ method: 'POST', path: `${this.basePath}/batch`, body }),
    }
  }
}
```

- [ ] **Step 3: Implement Wave 1 resource files**

```typescript
// packages/sdk/src/resources/contacts.ts
import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface ContactRecord {
  id: string
  object: 'contact'
  organization_id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  source_channel: string | null
  status: string
  company_id: string | null
  assigned_to_user_id: string | null
  lead_score: number
  is_hot: boolean
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateContactInput {
  name: string
  email?: string
  phone?: string
  title?: string
  source_channel?: string
  status?: string
  company_id?: string
  assigned_to_user_id?: string
  lead_score?: number
  is_hot?: boolean
  custom_fields?: Record<string, unknown>
}

export interface UpdateContactInput extends Partial<CreateContactInput> {}

export class ContactResource extends BaseResource<ContactRecord, CreateContactInput, UpdateContactInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/contacts')
  }

  async context(idOrEmail: string) {
    const response = await this.transport.request({ method: 'GET', path: `/v1/context/${idOrEmail}` })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      context: (idOrEmail: string) =>
        this.transport.rawRequest({ method: 'GET', path: `/v1/context/${idOrEmail}` }),
    }
  }
}
```

```typescript
// packages/sdk/src/resources/companies.ts
import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface CompanyRecord {
  id: string
  object: 'company'
  organization_id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  website: string | null
  notes: string | null
  assigned_to_user_id: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateCompanyInput {
  name: string
  domain?: string
  industry?: string
  size?: string
  website?: string
  notes?: string
  assigned_to_user_id?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {}

export class CompanyResource extends BaseResource<CompanyRecord, CreateCompanyInput, UpdateCompanyInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/companies')
  }
}
```

```typescript
// packages/sdk/src/resources/deals.ts
import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface DealRecord {
  id: string
  object: 'deal'
  organization_id: string
  title: string
  value: string | null
  currency: string
  stage_id: string | null
  pipeline_id: string | null
  probability: number
  expected_close_date: string | null
  contact_id: string | null
  company_id: string | null
  assigned_to_user_id: string | null
  status: string
  won_at: string | null
  lost_at: string | null
  lost_reason: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface MoveDealStageInput {
  stage_id: string
  occurred_at?: string
  note?: string
}

export class DealResource extends BaseResource<DealRecord, Record<string, unknown>, Record<string, unknown>> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/deals')
  }

  async move(id: string, input: MoveDealStageInput): Promise<DealRecord> {
    const response = await this.transport.request<DealRecord>({
      method: 'POST',
      path: `/v1/deals/${id}/move`,
      body: input,
    })
    return response.data
  }

  async pipeline(query: Record<string, unknown> = {}) {
    const response = await this.transport.request({ method: 'GET', path: '/v1/deals/pipeline', query })
    return response.data
  }

  async stats(query: Record<string, unknown> = {}) {
    const response = await this.transport.request({ method: 'GET', path: '/v1/deals/stats', query })
    return response.data
  }

  response() {
    return {
      ...super.response(),
      move: (id: string, input: MoveDealStageInput) =>
        this.transport.rawRequest<DealRecord>({ method: 'POST', path: `/v1/deals/${id}/move`, body: input }),
      pipeline: (query: Record<string, unknown> = {}) =>
        this.transport.rawRequest({ method: 'GET', path: '/v1/deals/pipeline', query }),
      stats: (query: Record<string, unknown> = {}) =>
        this.transport.rawRequest({ method: 'GET', path: '/v1/deals/stats', query }),
    }
  }
}
```

```typescript
// packages/sdk/src/resources/pipelines.ts
import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface PipelineRecord {
  id: string
  object: 'pipeline'
  organization_id: string
  name: string
  description: string | null
  is_default: boolean
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export class PipelineResource extends BaseResource<PipelineRecord, Record<string, unknown>, Record<string, unknown>> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/pipelines')
  }
}
```

```typescript
// packages/sdk/src/resources/stages.ts
import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface StageRecord {
  id: string
  object: 'stage'
  organization_id: string
  pipeline_id: string
  name: string
  stage_order: number
  probability: number
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export class StageResource extends BaseResource<StageRecord, Record<string, unknown>, Record<string, unknown>> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/stages')
  }
}
```

```typescript
// packages/sdk/src/resources/users.ts
import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface UserRecord {
  id: string
  object: 'user'
  organization_id: string
  display_name: string
  email: string
  role: string
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export class UserResource extends BaseResource<UserRecord, Record<string, unknown>, Record<string, unknown>> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/users')
  }
}
```

```typescript
// packages/sdk/src/search.ts
import type { OrbitTransport } from './transport/index.js'

export class SearchResource {
  constructor(private readonly transport: OrbitTransport) {}

  async query(input: { query: string; object_types?: string[]; limit?: number; cursor?: string }) {
    const response = await this.transport.request({ method: 'POST', path: '/v1/search', body: input })
    return response.data
  }

  response() {
    return {
      query: (input: { query: string; object_types?: string[]; limit?: number; cursor?: string }) =>
        this.transport.rawRequest({ method: 'POST', path: '/v1/search', body: input }),
    }
  }
}
```

- [ ] **Step 4: Update client.ts to wire Wave 1 resources**

```typescript
// packages/sdk/src/client.ts
import type { OrbitClientOptions } from './config.js'
import { createTransport, type OrbitTransport } from './transport/index.js'
import { ContactResource } from './resources/contacts.js'
import { CompanyResource } from './resources/companies.js'
import { DealResource } from './resources/deals.js'
import { PipelineResource } from './resources/pipelines.js'
import { StageResource } from './resources/stages.js'
import { UserResource } from './resources/users.js'
import { SearchResource } from './search.js'

export class OrbitClient {
  private readonly transport: OrbitTransport

  readonly contacts: ContactResource
  readonly companies: CompanyResource
  readonly deals: DealResource
  readonly pipelines: PipelineResource
  readonly stages: StageResource
  readonly users: UserResource
  readonly search: SearchResource

  constructor(public readonly options: OrbitClientOptions) {
    this.transport = createTransport(options)
    this.contacts = new ContactResource(this.transport)
    this.companies = new CompanyResource(this.transport)
    this.deals = new DealResource(this.transport)
    this.pipelines = new PipelineResource(this.transport)
    this.stages = new StageResource(this.transport)
    this.users = new UserResource(this.transport)
    this.search = new SearchResource(this.transport)
  }
}
```

- [ ] **Step 5: Run tests and verify**

```bash
pnpm --filter @orbit-ai/sdk test && pnpm --filter @orbit-ai/sdk typecheck && pnpm --filter @orbit-ai/sdk build
```

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/resources/ packages/sdk/src/search.ts packages/sdk/src/client.ts packages/sdk/src/__tests__/resources-wave1.test.ts
git commit -m "feat(sdk): step 7b — Wave 1 resources (contacts, companies, deals, pipelines, stages, users, search)"
```

---

## Task 10: API Wave 2 Routes — Remaining Public, Admin, Bootstrap, Schema, Workflow

**Files:**
- Create: `packages/api/src/routes/admin.ts`
- Create: `packages/api/src/routes/bootstrap.ts`
- Create: `packages/api/src/routes/organizations.ts`
- Create: `packages/api/src/routes/workflows.ts`
- Create: `packages/api/src/routes/relationships.ts`
- Create: `packages/api/src/routes/objects.ts`
- Create: `packages/api/src/routes/webhooks.ts`
- Create: `packages/api/src/routes/imports.ts`
- Create: `packages/api/src/__tests__/routes-wave2.test.ts`
- Create: `packages/api/src/__tests__/admin-routes.test.ts`
- Create: `packages/api/src/__tests__/bootstrap-routes.test.ts`
- Modify: `packages/api/src/routes/entities.ts` (expand capabilities map)
- Modify: `packages/api/src/create-api.ts`

- [ ] **Step 1: Write failing tests for admin/bootstrap boundary enforcement**

```typescript
// packages/api/src/__tests__/admin-routes.test.ts
import { describe, it, expect } from 'vitest'

describe('admin routes', () => {
  it('all admin entities live under /v1/admin/*', async () => {
    // ... test that GET /v1/admin/audit_logs returns 200 with admin scope
  })

  it('admin routes require admin:* scope', async () => {
    // ... test that GET /v1/admin/audit_logs returns 403 without admin scope
  })

  it('webhook_deliveries admin reads omit payload/signature/responseBody', async () => {
    // ... test sanitization
  })
})

describe('webhook routes', () => {
  it('GET /v1/webhooks/:id/deliveries is registered', async () => {
    // ... test that webhook deliveries are exposed on the dedicated route
  })

  it('POST /v1/webhooks/:id/redeliver is registered', async () => {
    // ... test that redelivery is exposed on the dedicated route
  })
})

describe('bootstrap routes', () => {
  it('POST /v1/bootstrap/organizations bypasses tenant context', async () => {
    // ... test that withTenantContext is NOT called
  })

  it('bootstrap routes require platform:bootstrap scope', async () => {
    // ... test scope enforcement
  })
})

describe('organization routes', () => {
  it('GET and PATCH /v1/organizations/current stay outside the generic entity registry', async () => {
    // ... test the dedicated current-organization route
  })
})
```

- [ ] **Step 2: Expand PUBLIC_ENTITY_CAPABILITIES for Wave 2**

Add to `packages/api/src/routes/entities.ts`:

```typescript
// Expand the map with Wave 2 entities
const PUBLIC_ENTITY_CAPABILITIES = {
  // Wave 1 (already present)
  contacts: { read: true, write: true, batch: true },
  companies: { read: true, write: true, batch: true },
  deals: { read: true, write: true, batch: true },
  pipelines: { read: true, write: true, batch: false },
  stages: { read: true, write: true, batch: false },
  users: { read: true, write: true, batch: false },
  // Wave 2
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
  imports: { read: true, write: true, batch: false },
} as const
```

- [ ] **Step 3: Implement admin routes**

```typescript
// packages/api/src/routes/admin.ts
import { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requireScope } from '../scopes.js'
import { toEnvelope, toError, sanitizeAdminRead, sanitizeAdminPage } from '../responses.js'
import { z } from 'zod'

const ADMIN_ENTITIES = [
  'organizationMemberships', 'apiKeys', 'customFieldDefinitions',
  'webhookDeliveries', 'auditLogs', 'schemaMigrations',
  'idempotencyKeys', 'entityTags',
] as const

const ADMIN_ROUTE_MAP: Record<string, string> = {
  organization_memberships: 'organizationMemberships',
  api_keys: 'apiKeys',
  custom_field_definitions: 'customFieldDefinitions',
  webhook_deliveries: 'webhookDeliveries',
  audit_logs: 'auditLogs',
  schema_migrations: 'schemaMigrations',
  idempotency_keys: 'idempotencyKeys',
  entity_tags: 'entityTags',
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

export function registerAdminRoutes(app: Hono, services: CoreServices) {
  const admin = new Hono()
  admin.use('*', requireScope('admin:*'))

  for (const [routeName, serviceName] of Object.entries(ADMIN_ROUTE_MAP)) {
    admin.get(`/${routeName}`, async (c) => {
      const query = listQuerySchema.parse(c.req.query())
      const service = (services.system as any)[serviceName]
      const result = await service.list(c.get('orbit'), query)
      return c.json(toEnvelope(c, sanitizeAdminPage(routeName, result.data), result))
    })

    admin.get(`/${routeName}/:id`, async (c) => {
      const service = (services.system as any)[serviceName]
      const record = await service.get(c.get('orbit'), c.req.param('id'))
      if (!record) return c.json(toError(c, 'RESOURCE_NOT_FOUND', `${routeName} not found`), 404)
      return c.json(toEnvelope(c, sanitizeAdminRead(routeName, record)))
    })
  }

  app.route('/v1/admin', admin)
}
```

- [ ] **Step 4: Implement bootstrap routes**

```typescript
// packages/api/src/routes/bootstrap.ts
import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { requireScope } from '../scopes.js'
import { toEnvelope } from '../responses.js'

export function registerBootstrapRoutes(app: Hono, services: CoreServices) {
  app.post('/v1/bootstrap/organizations', requireScope('platform:bootstrap'), async (c) => {
    const body = await c.req.json()
    const created = await (services.system.organizations as any).create(body)
    return c.json(toEnvelope(c, created), 201)
  })

  app.post('/v1/bootstrap/api-keys', requireScope('platform:bootstrap'), async (c) => {
    const body = await c.req.json()
    const created = await (services.system.apiKeys as any).create(body)
    return c.json(toEnvelope(c, created), 201)
  })
}
```

- [ ] **Step 5: Implement organization, workflow, relationship, objects, webhook, and import routes**

Each route file follows the same pattern as the spec in [02-api.md](/docs/specs/02-api.md). Refer to the spec for exact route signatures. The implementation uses `services.<entity>` for resolution and `toEnvelope`/`toError` for responses.

Key workflow routes (in `packages/api/src/routes/workflows.ts`):
- `POST /v1/deals/:id/move` — calls `services.deals.move?.(ctx, id, body)` or equivalent
- `GET /v1/deals/pipeline` — calls `services.deals.pipeline(ctx, query)`
- `GET /v1/deals/stats` — calls `services.deals.stats(ctx, query)`
- `POST /v1/sequences/:id/enroll` — calls `services.sequences.enroll?.(ctx, id, body)`
- `POST /v1/sequence_enrollments/:id/unenroll` — calls `services.sequenceEnrollments.unenroll?.(ctx, id)`
- `POST /v1/tags/:id/attach` — calls `services.tags.attach?.(ctx, id, body)`
- `POST /v1/tags/:id/detach` — calls `services.tags.detach?.(ctx, id, body)`
- `POST /v1/activities/log` — calls `services.activities.log?.(ctx, body)`

Key relationship routes (in `packages/api/src/routes/relationships.ts`):
- `GET /v1/contacts/:id/timeline`
- `GET /v1/contacts/:id/deals`
- `GET /v1/contacts/:id/activities`
- `GET /v1/contacts/:id/tasks`
- `GET /v1/contacts/:id/tags`
- `GET /v1/companies/:id/contacts`
- `GET /v1/companies/:id/deals`
- `GET /v1/deals/:id/timeline`

Key organization routes (in `packages/api/src/routes/organizations.ts`):
- `GET /v1/organizations/current`
- `PATCH /v1/organizations/current`

Key schema routes (in `packages/api/src/routes/objects.ts`):
- `GET /v1/objects` — calls `services.schema.listObjects(ctx)`
- `GET /v1/objects/:type` — calls `services.schema.describeObject(ctx, type)`
- `POST /v1/objects/:type/fields` — calls `services.schema.addField(ctx, type, body)`
- `PATCH /v1/objects/:type/fields/:fieldName` — calls `services.schema.updateField(ctx, type, fieldName, body)`
- `DELETE /v1/objects/:type/fields/:fieldName` — calls `services.schema.deleteField(ctx, type, fieldName)`
- `POST /v1/schema/migrations/preview` — calls `services.schema.preview(ctx, body)`
- `POST /v1/schema/migrations/apply` — requires `schema:apply` scope
- `POST /v1/schema/migrations/:id/rollback` — requires `schema:apply` scope

Key webhook routes (in `packages/api/src/routes/webhooks.ts`):
- `GET /v1/webhooks`
- `POST /v1/webhooks`
- `GET /v1/webhooks/:id`
- `PATCH /v1/webhooks/:id`
- `DELETE /v1/webhooks/:id`
- `GET /v1/webhooks/:id/deliveries`
- `POST /v1/webhooks/:id/redeliver`

- [ ] **Step 6: Wire all routes into create-api.ts**

```typescript
// Add to createApi():
import { registerAdminRoutes } from './routes/admin.js'
import { registerBootstrapRoutes } from './routes/bootstrap.js'
import { registerOrganizationRoutes } from './routes/organizations.js'
import { registerWorkflowRoutes } from './routes/workflows.js'
import { registerRelationshipRoutes } from './routes/relationships.js'
import { registerObjectRoutes } from './routes/objects.js'
import { registerWebhookRoutes } from './routes/webhooks.js'
import { registerImportRoutes } from './routes/imports.js'

registerBootstrapRoutes(app, services)
registerPublicEntityRoutes(app, services)
registerAdminRoutes(app, services)
registerOrganizationRoutes(app, services)
registerWorkflowRoutes(app, services)
registerRelationshipRoutes(app, services)
registerObjectRoutes(app, services)
registerWebhookRoutes(app, services)
registerImportRoutes(app, services)
```

- [ ] **Step 7: Run tests and verify**

```bash
pnpm --filter @orbit-ai/api test && pnpm --filter @orbit-ai/api typecheck && pnpm --filter @orbit-ai/api build
```

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/routes/ packages/api/src/__tests__/ packages/api/src/create-api.ts
git commit -m "feat(api): step 7a — Wave 2 routes, admin, bootstrap, workflows, schema"
```

---

## Task 11: SDK Wave 2 Resources

**Files:**
- Create: `packages/sdk/src/resources/activities.ts`
- Create: `packages/sdk/src/resources/tasks.ts`
- Create: `packages/sdk/src/resources/notes.ts`
- Create: `packages/sdk/src/resources/products.ts`
- Create: `packages/sdk/src/resources/payments.ts`
- Create: `packages/sdk/src/resources/contracts.ts`
- Create: `packages/sdk/src/resources/sequences.ts`
- Create: `packages/sdk/src/resources/sequence-steps.ts`
- Create: `packages/sdk/src/resources/sequence-enrollments.ts`
- Create: `packages/sdk/src/resources/sequence-events.ts`
- Create: `packages/sdk/src/resources/tags.ts`
- Create: `packages/sdk/src/resources/schema.ts`
- Create: `packages/sdk/src/resources/webhooks.ts`
- Create: `packages/sdk/src/resources/imports.ts`
- Create: `packages/sdk/src/__tests__/resources-wave2.test.ts`
- Create: `packages/sdk/src/__tests__/resources-wave2-parity.test.ts`
- Modify: `packages/sdk/src/client.ts`

All Wave 2 resources follow the same `BaseResource` pattern. Resources with workflow methods (sequences, tags, schema) add custom methods following the same pattern as `DealResource.move()`. Batch-capable resources also expose `.batch()` and `.response().batch()` through `BaseResource`. Webhook resources expose both deliveries and redelivery helpers.

- [ ] **Step 1: Write failing tests for Wave 2 resources**

Test that each resource exists, calls the correct API path, returns records (not envelopes), and `.response()` returns raw envelopes. Add explicit parity coverage for `batch`, `deals.pipeline`, `deals.stats`, `sequences.enroll`, `sequence_enrollments.unenroll`, `tags.attach/detach`, `webhooks.deliveries/redeliver`, and `schema` helpers.

- [ ] **Step 2: Implement all Wave 2 resource files**

Each follows the `BaseResource` pattern. Key additions:
- `SequenceResource` adds `.enroll(id, body)` and `.unenroll(enrollmentId)`
- `TagResource` adds `.attach(id, body)` and `.detach(id, body)`
- `SchemaResource` is standalone (not BaseResource) with `.listObjects()`, `.describeObject()`, `.addField()`, `.updateField()`, `.previewMigration()`
- `WebhookResource` adds `.deliveries(id)` as `AutoPager<WebhookDeliveryRead>` and `.redeliver(id)` and must preserve delivery-read sanitization
- `ImportResource` follows the spec-frozen route surface only; no extra helper methods are invented here

- [ ] **Step 3: Update client.ts to wire all resources**

Add all Wave 2 resources to the `OrbitClient` constructor.

- [ ] **Step 4: Run tests and verify**

```bash
pnpm --filter @orbit-ai/sdk test && pnpm --filter @orbit-ai/sdk typecheck && pnpm --filter @orbit-ai/sdk build
```

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/resources/ packages/sdk/src/client.ts packages/sdk/src/__tests__/resources-wave2.test.ts packages/sdk/src/__tests__/resources-wave2-parity.test.ts
git commit -m "feat(sdk): step 8b — Wave 2 resources (activities through imports, schema, workflows)"
```

---

## Task 12: API Contract Hardening — Idempotency, Rate Limiting, OpenAPI

**Files:**
- Create: `packages/api/src/middleware/idempotency.ts`
- Create: `packages/api/src/middleware/rate-limit.ts`
- Create: `packages/api/src/openapi/registry.ts`
- Create: `packages/api/src/openapi/schemas.ts`
- Create: `packages/api/src/openapi/generator.ts`
- Create: `packages/api/src/__tests__/idempotency.test.ts`
- Create: `packages/api/src/__tests__/rate-limit.test.ts`
- Modify: `packages/api/src/create-api.ts`

- [ ] **Step 1: Write failing tests for idempotency**

```typescript
// packages/api/src/__tests__/idempotency.test.ts
import { describe, it, expect } from 'vitest'

describe('idempotency middleware', () => {
  it('same key + same route + same body replays stored response', async () => {
    // ... create two POST requests with identical key, route, body
    // ... second should return the same response without calling the service again
  })

  it('same key + different body returns 409 IDEMPOTENCY_CONFLICT', async () => {
    // ... create two POST requests with same key but different body
    // ... second should return 409
  })

  it('GET requests are not subject to idempotency checks', async () => {
    // ... GET requests pass through without checking idempotency store
  })
})
```

- [ ] **Step 2: Write failing tests for rate limiting**

```typescript
// packages/api/src/__tests__/rate-limit.test.ts
import { describe, it, expect } from 'vitest'

describe('rate limit middleware', () => {
  it('adds X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers', async () => {
    // ... make a request and check response headers
  })

  it('returns 429 with Retry-After when rate limited', async () => {
    // ... exceed rate limit and verify 429 response
  })
})
```

- [ ] **Step 3: Implement idempotency middleware**

Uses `services.system.idempotencyKeys` from core for storage. Accept or generate `Idempotency-Key` on POST, PATCH, and DELETE, persist request hash plus response body, replay same key/same route/same body, and return `409 IDEMPOTENCY_CONFLICT` for same key/different body. GET remains out of scope.

- [ ] **Step 4: Implement rate-limit middleware**

Use Upstash Redis first for hosted deployments, with in-memory token bucket fallback only for self-hosted single-node mode. Emit `X-RateLimit-*` headers and `Retry-After` on 429.

- [ ] **Step 5: Implement OpenAPI generation**

Use `src/openapi/registry.ts` as the source of truth, with shared schemas in `src/openapi/schemas.ts`. `src/openapi/generator.ts` emits `packages/api/openapi/openapi.json` and `packages/api/openapi/openapi.yaml` from that registry. Do not maintain a parallel handwritten OpenAPI source.

- [ ] **Step 6: Wire middleware into create-api.ts**

```typescript
app.use('/v1/*', rateLimitMiddleware())
app.use('/v1/*', idempotencyMiddleware(services))
```

- [ ] **Step 7: Run tests and verify**

```bash
pnpm --filter @orbit-ai/api test && pnpm --filter @orbit-ai/api typecheck && pnpm --filter @orbit-ai/api build
```

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/middleware/idempotency.ts packages/api/src/middleware/rate-limit.ts packages/api/src/openapi/ packages/api/openapi/ packages/api/src/__tests__/
git commit -m "feat(api): step 8a — idempotency, rate limiting, OpenAPI generation"
```

---

## Task 13: SDK Final Parity And Review Artifacts

**Files:**
- Create: `packages/sdk/src/__tests__/parity-matrix.test.ts`
- Modify: `packages/sdk/src/__tests__/transport-parity.test.ts`

- [ ] **Step 1: Write parity matrix tests**

```typescript
// packages/sdk/src/__tests__/parity-matrix.test.ts
import { describe, it, expect } from 'vitest'

describe('SDK parity matrix', () => {
  // For each resource, verify that the same SDK call produces
  // equivalent record shapes and raw envelopes in HTTP and direct mode

  it('contacts.create returns same shape in both modes', async () => {
    // ... create via HTTP transport mock
    // ... create via direct transport with in-memory adapter
    // ... compare record shapes
  })

  it('.response() preserves server-owned meta, links, request_id', async () => {
    // ... verify that .response().get() returns meta.request_id, meta.version, links.self
    // ... verify these are NOT reconstructed client-side
  })

  it('workflow and batch helpers preserve raw envelopes in .response()', async () => {
    // ... verify batch, move, enroll/unenroll, attach/detach, deliveries, and redeliver helper responses
  })

  it('list().firstPage() preserves cursor metadata', async () => {
    // ... verify meta.next_cursor, meta.has_more come from server
  })

  it('list().autoPaginate() yields records across both transports', async () => {
    // ... verify the async generator produces records, not envelopes
  })

  it('OrbitApiError is used consistently for error responses', async () => {
    // ... verify both transports throw OrbitApiError with same error shape
  })
})
```

- [ ] **Step 2: Run and verify**

```bash
pnpm --filter @orbit-ai/sdk test && pnpm --filter @orbit-ai/sdk typecheck && pnpm --filter @orbit-ai/sdk build
```

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/__tests__/parity-matrix.test.ts
git commit -m "feat(sdk): step 9 — final parity matrix and response-helper tests"
```

---

## WAVE GATE 3

- [ ] **Step 1: Run full verification for both packages**

```bash
pnpm --filter @orbit-ai/api test && pnpm --filter @orbit-ai/api typecheck && pnpm --filter @orbit-ai/api build && pnpm --filter @orbit-ai/sdk test && pnpm --filter @orbit-ai/sdk typecheck && pnpm --filter @orbit-ai/sdk build && git diff --check
```

- [ ] **Step 2: Dispatch independent code review sub-agent** (both packages)

- [ ] **Step 3: Dispatch independent security review sub-agent** (full T1-T6)

- [ ] **Step 4: Dispatch tenant safety review**

Use `orbit-tenant-safety-review` skill. Focus: final tenant isolation, bootstrap/admin boundaries, and direct-mode tenant-context parity.

- [ ] **Step 5: Dispatch parity review**

Use `orbit-api-sdk-parity` skill. Mandatory parity checklist:
- SDK resource methods map 1:1 to API routes
- HTTP and direct transport produce identical envelope/error shapes
- Secret-bearing reads sanitized in both modes
- `.response()` and `list().firstPage()` preserve server-owned metadata
- Batch helpers, workflow helpers, and schema helpers preserve canonical paths and envelopes
- Webhook delivery lists/redelivery preserve sanitized DTOs in both transports

- [ ] **Step 6: Dispatch contract review**

Verify generated OpenAPI matches real routes and SDK matches API.

- [ ] **Step 7: Write review artifact**

Create `docs/review/2026-04-03-api-sdk-wave-gate-3.md` with findings, severity, reviewer identity, decision, and remediation status.

- [ ] **Step 8: Apply remediation and commit gate**

```bash
git commit --allow-empty -m "review: wave gate 3 accepted — API and SDK ready for CLI and MCP"
```

---

## Step-to-Task Mapping

The design spec uses Step numbers; this plan uses Task numbers. Wave gates are checkpoints, not implementation steps.

| Design Step | Plan Task(s) | Description |
|---|---|---|
| Step 1 | Task 1 | API package bootstrap |
| Step 2 | Tasks 2-4 | Auth, tenant context, envelope boundary |
| Wave Gate 1 | Wave Gate 1 | Auth/envelope review |
| Step 4 (API Agent A) | Tasks 5-6 | API Wave 1 routes |
| Step 4 (SDK Agent B) | Task 7 | SDK package bootstrap |
| Step 4 (Agent C) | Task 7a (below) | Pre-write SDK transport parity tests |
| Step 5 | Task 8 | SDK HTTP + direct transport |
| Wave Gate 2 | Wave Gate 2 | API Wave 1 + SDK transport review |
| Step 7 (API Agent A) | Task 10 | API Wave 2 routes |
| Step 7 (SDK Agent B) | Task 9 | SDK Wave 1 resources |
| Step 7 (Agent C) | Task 11a (below) | Pre-write idempotency/rate-limit/parity tests |
| Step 8 (API Agent A) | Task 12 | API contract hardening |
| Step 8 (SDK Agent B) | Task 11 | SDK Wave 2 resources |
| Step 9 | Task 13 | SDK final parity |
| Wave Gate 3 | Wave Gate 3 | Final contract + security review |

---

## Appendix A: Review Findings And Required Corrections

This appendix documents findings from the code review, architecture review, and security review conducted after the initial plan was written. All critical and high fixes have been applied inline above. The items below are additional required corrections that must be applied during execution.

### A.1 Test-First Pre-Write Tasks (Design Compliance)

The design spec requires Agent C in Steps 4 and 7 to pre-write failing tests before the next step's implementation begins. These are mandatory:

**Task 7a: Pre-write SDK transport parity tests** (between Task 7 and Task 8)

Create `packages/sdk/src/__tests__/transport-parity.test.ts` with tests that assert:
- HTTP and direct transport produce identical envelope shapes for the same operation
- Direct transport synthesizes same cursor metadata as HTTP mode
- Both transports surface same typed error codes
- Direct transport does not call `runWithMigrationAuthority`

These tests MUST be red before Task 8 starts.

**Task 11a: Pre-write idempotency/rate-limit/parity tests** (between Task 11 and Task 12)

Create `packages/api/src/__tests__/idempotency.test.ts` and `packages/api/src/__tests__/rate-limit.test.ts` with the full test-first contracts from the design spec. Also create `packages/sdk/src/__tests__/resources-wave2-parity.test.ts` for Wave 2 parity.

These tests MUST be red before Task 12 starts.

### A.2 Missing API Routes

The following routes from [02-api.md](/docs/specs/02-api.md) section 5 must be added to Task 10:

- `POST /v1/activities/log` — dedicated workflow endpoint in `routes/workflows.ts`
- `GET /v1/deals/pipeline` — dedicated route in `routes/workflows.ts`
- `GET /v1/deals/stats` — dedicated route in `routes/workflows.ts`
- `GET /v1/organizations/current` and `PATCH /v1/organizations/current` — dedicated route in `routes/organizations.ts`
- `POST /v1/tags/:id/attach` — dedicated route in `routes/workflows.ts`
- `POST /v1/tags/:id/detach` — dedicated route in `routes/workflows.ts`
- `GET /v1/webhooks/:id/deliveries` — dedicated route in `routes/webhooks.ts`
- `POST /v1/webhooks/:id/redeliver` — dedicated route in `routes/webhooks.ts`
- `DELETE /v1/objects/:type/fields/:fieldName` — in `routes/objects.ts`

### A.3 Missing SDK Resource Methods

The following methods from [03-sdk.md](/docs/specs/03-sdk.md) must be added:

- `BaseResource`: add `batch(body)` and `response().batch(body)` for batch-capable entities
- `DealResource`: add `.pipeline(query)` and `.stats(query)`
- `SequenceResource`: `.enroll(id, body)` calls `POST /v1/sequences/:id/enroll`
- `SequenceEnrollmentResource`: `.unenroll(enrollmentId)` calls `POST /v1/sequence_enrollments/:id/unenroll` (NOT on SequenceResource)
- `TagResource`: add `.attach(id, body)` and `.detach(id, body)`
- `SchemaResource`: add `deleteField(type, fieldName)`, `applyMigration(body)`, `rollbackMigration(id)`
- `WebhookResource`: `.deliveries(id)` must return `AutoPager<WebhookDeliveryRead>`, not a bare Promise; add `.redeliver(id, deliveryId)` and `.response().deliveries(...)`

### A.4 Webhook URL Validation (T4 SSRF)

Webhook create and update MUST NOT go through the generic entity route loop. Instead, dedicate `routes/webhooks.ts` with explicit URL validation:

```typescript
function validateWebhookUrl(url: string): void {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') {
    throw new OrbitError({ code: 'VALIDATION_FAILED', message: 'Webhook URL must use HTTPS' })
  }
  // In hosted mode, also reject RFC1918, loopback, and link-local addresses
  // after DNS resolution. This is enforced at the delivery worker level
  // but validated at registration time for immediate feedback.
}
```

Move `webhooks` out of `PUBLIC_ENTITY_CAPABILITIES` and into its own route registration.

### A.5 Webhook One-Time Secret Exposure

`POST /v1/webhooks` must return the plaintext signing secret exactly once in the create response:

```typescript
// In routes/webhooks.ts:
app.post('/v1/webhooks', async (c) => {
  const body = await c.req.json()
  validateWebhookUrl(body.url)
  const created = await services.webhooks.create(c.get('orbit'), body)
  // One-time secret exposure: include secret in create response only
  const sanitized = toWebhookRead(created as Record<string, unknown>)
  return c.json(toEnvelope(c, { ...sanitized, secret: (created as any).signingSecret }), 201)
})
```

All subsequent `GET /v1/webhooks/:id` reads use `toWebhookRead()` which strips the secret.

### A.6 Bootstrap Route Body Validation

Replace the `as any` cast in bootstrap routes with explicit Zod validation:

```typescript
import { z } from 'zod'

const bootstrapOrgSchema = z.object({
  name: z.string().min(1),
  // Only fields that the organization create path accepts
})

app.post('/v1/bootstrap/organizations', requireScope('platform:bootstrap'), async (c) => {
  const body = bootstrapOrgSchema.parse(await c.req.json())
  const created = await services.system.organizations.create(body)
  return c.json(toEnvelope(c, created), 201)
})
```

### A.7 OpenAPI Schema Registration

The plan's Task 12 OpenAPI generation requires route schemas to exist. During Tasks 5-6 and 10, route registrations should use Zod schemas for request/response shapes. Task 12's OpenAPI generator collects these schemas.

Use the standalone schema registry approach: routes register schemas in `src/openapi/registry.ts`, shared schema definitions live in `src/openapi/schemas.ts`, and `src/openapi/generator.ts` emits `packages/api/openapi/openapi.json` and `packages/api/openapi/openapi.yaml`. Do not introduce a parallel handwritten OpenAPI source or a second registry implementation.

### A.8 Sanitization Tests (Required Additions)

Add these tests to `packages/api/src/__tests__/sanitization.test.ts`:

- `toApiKeyRead` strips `keyHash` and `encryptedKey` from admin reads
- `toIdempotencyKeyRead` strips `requestHash` and `responseBody`
- `toAuditLogRead` strips sensitive fields from `before`/`after` snapshots
- Audit log containing a webhook `before` state returns sanitized webhook (no `secretEncrypted`)
- `POST /v1/webhooks` returns `secret` field on 201; `GET /v1/webhooks/:id` does NOT
- Direct transport webhook list does NOT contain `secretEncrypted`

### A.9 Core Prerequisites (Blockers — from Codex review)

The following core methods do not yet exist and MUST be added to `@orbit-ai/core` before the API tasks that call them. These can be implemented as a pre-execution core extension slice on the `api-sdk-execution` branch before Task 10.

**BLOCKER 1: Bootstrap create services**

`AdminEntityService` only exposes `list` and `get`. The bootstrap routes (`POST /v1/bootstrap/organizations`, `POST /v1/bootstrap/api-keys`) need a `create` method. Options:
1. Add a `BootstrapService` interface to core with `create()` for organizations and API keys
2. Extend `AdminEntityService` with optional `create?()` 
3. Expose the underlying entity `create` through a dedicated bootstrap service export

This must be resolved before Task 10 (bootstrap routes).

**BLOCKER 2: Schema engine surface**

Core's `OrbitSchemaEngine` currently only exposes `preview()`. The API plan routes to `listObjects()`, `describeObject()`, `addField()`, `updateField()`, `deleteField()`, `apply()`, `rollback()`. These must exist in core before Task 10 (schema/objects routes).

Options:
1. Implement the full schema engine surface in a core extension slice before API execution
2. Stub the routes with `501 Not Implemented` and defer to a later core milestone
3. Route only to `preview()` for now and defer the rest

**BLOCKER 3: Batch service interface**

The spec says all public entities support `POST /v1/<entity>/batch`. Core's `EntityService` declares a `batch()` method in `BatchCapableEntityService` but no entity actually implements it. Options:
1. Implement batch in core for all entities before API execution
2. Disable batch routes and update the spec to reflect actual capability
3. Implement batch as a generic wrapper that calls create/update/delete in sequence

### A.10 Type Alignment (from Codex review)

**userId on ApiKeyAuthLookup:** The user added `userId` to the auth context wiring, but core's `ApiKeyAuthLookup` type does not include `userId`. Either extend the core type or remove `userId` from the plan's auth middleware context.

**RuntimeApiAdapter structural typing:** `Omit<StorageAdapter, 'migrate' | 'runWithMigrationAuthority'>` is structurally assignable from a full `StorageAdapter`. For stronger enforcement, consider a branded type or a factory function that strips the methods at runtime.

---

## Post-Execution

After Wave Gate 3 passes:

1. Update `docs/KB.md` with API and SDK completion status
2. Update `docs/IMPLEMENTATION-PLAN.md` to reflect Phase 4 and 5 complete
3. The branch `api-sdk-execution` is ready for merge to `main`
