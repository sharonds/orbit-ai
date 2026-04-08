# Phase 0 + Phase 1 Fix Pass Implementation Plan

> **For agentic workers:** Implement this plan task-by-task using the tools actually available in your environment. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 9 prioritized fixes identified by a multi-agent review of PR 0 (`pr-0-api-sdk-foundation`, #17) and PR 1 (`pr-1-phase-0-1-fixes`, #18) before continuing the 5-PR stacked split of `api-sdk-execution`.

**Architecture:** All fixes land as new commits on existing branches. PR 0 gets 8 fix commits and should fast-forward push normally. PR 1 gets 1 fix commit + a rebase onto the updated PR 0, which rewrites PR 1 commit SHAs and therefore requires a single `--force-with-lease` push for PR 1 only. Each fix is independently committed so reviewers can review them individually. Post-fix, a fresh independent code + security review runs on the fix commits before the stack resumes.

**Tech Stack:** TypeScript (strict) · Hono (API framework) · Vitest · Zod · pnpm + Turborepo · @orbit-ai/core (in-tree workspace package)

**Repo location:** `/Users/sharonsciammas/orbit-ai` · **Package manager:** pnpm (always) · **Test runner:** `pnpm -r test` · **Baseline at start:** 671 passing / 2 skipped on `pr-0-api-sdk-foundation` HEAD `9adfb2a`.

---

## Context you need before starting

This plan targets the Orbit AI monorepo under `~/orbit-ai`. You're applying review findings to a multi-tenant CRM SDK. The affected files are in `packages/api/src/` (Hono-based API) and `packages/sdk/src/` (TypeScript client SDK with two transports — HTTP and Direct). Do NOT touch `packages/core` except where explicitly instructed in Task 11.

**Branches at start:**
- `pr-0-api-sdk-foundation` — HEAD `9adfb2a`, 38 cherry-picked commits, 671 passing tests
- `pr-1-phase-0-1-fixes` — HEAD `b735c46`, stacked on PR 0 + 5 more commits, 700 passing tests

**Review findings driving this plan:** the issue summary below is the source of truth for execution on these stacked branches. Do not assume newer review artifacts from other branches exist here.

| # | Severity | Issue | PR | Task |
|---|---|---|---|---|
| C1 | HIGH | Error handler logs nothing | PR 0 | Task 1 |
| C2 | HIGH | DirectTransport bypasses middleware — **deferred refactor, doc-only @security JSDoc in this pass** | PR 0 | Task 2 (deferred-to-PR4) |
| C3 | HIGH | `objects.ts:75-82` broad catch masks all errors as 501 | PR 0 | Task 3 |
| C4 | MEDIUM | `imports.ts` POST has zero input validation | PR 0 | Task 4 |
| C5 | MEDIUM | Bootstrap org/key responses returned unsanitized | PR 0 | Task 5 |
| C6 | MEDIUM | Idempotency falls back to `'unknown'` on bootstrap paths | PR 0 | Task 6 |
| C7 | MEDIUM | No cross-tenant idempotency replay test | PR 0 | Task 7 |
| C8 | MEDIUM | Transport parity tests use wrong paths (`/contacts` vs `/v1/contacts`) | PR 0 | Task 8 |
| C9 | MEDIUM | `ENTITY_SERVICE_MAP` duplicated in api + sdk, no drift test | PR 1 | Task 11 |

**Deferred (NOT in this plan):** 35 `as any` escapes (cluster refactor), full OpenAPI generator rewrite, DirectTransport error wrapping improvements, sequence-events double cast, admin double-scope, missing Infinity/1e308 tests in pagination-utils, envelope consistency. These roll into PR 4 (cleanups branch).

**Hard rules:**
- NO `git reset --hard`. NO `git rebase -i`. Only new commits on top, except for the explicit PR 1 branch rebase in Task 10.
- NO plain `--force` push anywhere. `--force-with-lease` is allowed exactly once for PR 1 in Tasks 10/12 because the rebase rewrites that branch.
- NO `--no-verify` on git commands.
- Each task ends with a commit. Commit messages follow the existing style (`fix(api): ...`, `fix(sdk): ...`, `test(api): ...`).
- After every code change, run `pnpm --filter @orbit-ai/core build` if you touched core, then `pnpm -r typecheck && pnpm -r lint && pnpm -r test`.
- If any verification step fails, STOP and report. Do NOT "fix and retry" without diagnosing why.

---

## File Structure — what this plan touches

**PR 0 branch (`pr-0-api-sdk-foundation`):**
- Modify: `packages/api/src/middleware/error-handler.ts` (Task 1)
- Modify: `packages/api/src/__tests__/error-handler.test.ts` (Task 1, create if missing)
- Modify: `packages/sdk/src/transport/direct-transport.ts` (Task 2, JSDoc only)
- Modify: `packages/api/src/routes/objects.ts` (Task 3)
- Modify: `packages/api/src/__tests__/routes-wave2.test.ts` (Task 3 test)
- Modify: `packages/api/src/routes/imports.ts` (Task 4)
- Modify: `packages/api/src/__tests__/routes-wave2.test.ts` (Task 4 test)
- Modify: `packages/api/src/responses.ts` (Task 5, add sanitizers)
- Modify: `packages/api/src/routes/bootstrap.ts` (Task 5)
- Modify: `packages/api/src/__tests__/bootstrap-routes.test.ts` (Task 5 test)
- Modify: `packages/api/src/middleware/idempotency.ts` (Task 6)
- Modify: `packages/api/src/__tests__/idempotency.test.ts` (Task 6 + Task 7 tests)
- Modify: `packages/sdk/src/__tests__/transport-parity.test.ts` (Task 8)

**PR 1 branch (`pr-1-phase-0-1-fixes`), after rebase in Task 10:**
- Create: `packages/core/src/public-entity-map.ts` (Task 11)
- Modify: `packages/core/src/index.ts` (Task 11, export)
- Modify: `packages/api/src/routes/entities.ts` (Task 11, import from core)
- Modify: `packages/sdk/src/transport/direct-transport.ts` (Task 11, import from core)
- Create: `packages/core/src/public-entity-map.test.ts` (Task 11 drift test)

---

## Task 0: Environment setup + baseline verification

**Files:** None modified. This is a sanity check.

- [ ] **Step 0.0: Make the working tree intentionally clean**

This plan file may itself be untracked while you are drafting it. Before using `git status` as a branch-health gate, either:
- commit the plan file,
- stash it,
- or otherwise make clear to yourself that the only allowed dirty state is this plan file.

If unrelated files are modified, STOP and report before continuing.

- [ ] **Step 0.1: Confirm you are in the right repo**

Run:
```bash
cd /Users/sharonsciammas/orbit-ai
pwd
ls packages/
```
Expected: `pwd` prints `/Users/sharonsciammas/orbit-ai`. `ls packages/` shows `api`, `core`, `sdk`.

If this fails, STOP — the repo layout is different from what this plan assumes.

- [ ] **Step 0.2: Confirm branches exist and HEADs match**

Run:
```bash
git rev-parse pr-0-api-sdk-foundation
git rev-parse pr-1-phase-0-1-fixes
git status
```
Expected: PR 0 HEAD starts with `9adfb2a`, PR 1 HEAD starts with `b735c46`, working tree clean (or only intentionally dirty because of this plan file as noted in Step 0.0).

If either is different, STOP and report — someone else touched the branches.

- [ ] **Step 0.3: Check out PR 0**

Run:
```bash
git checkout pr-0-api-sdk-foundation
```

- [ ] **Step 0.4: Baseline verification**

Run:
```bash
pnpm install --frozen-lockfile
pnpm --filter @orbit-ai/core build
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```
Expected: typecheck clean, lint clean, tests pass with **core 270 + sdk 171 + api 230 = 671 passing, 2 skipped**.

If baseline doesn't match, STOP and report — something changed under you.

---

## Task 1: Error handler logs unexpected errors to stderr

**Goal:** Fix C1 — any non-`OrbitError`, non-JSON `SyntaxError` currently returns a 500 with `INTERNAL_ERROR` but logs nothing. Operators have no server-side trace to correlate with the client's `request_id`.

**Files:**
- Modify: `packages/api/src/middleware/error-handler.ts`
- Create: `packages/api/src/__tests__/error-handler.test.ts` (if it doesn't exist) — or add to the existing file

- [ ] **Step 1.1: Check if an error-handler test file already exists**

Run:
```bash
ls packages/api/src/__tests__/ | grep -i error
```

If `error-handler.test.ts` exists, you'll append to it. If not, you'll create it.

- [ ] **Step 1.2: Write the failing test**

Create or append to `packages/api/src/__tests__/error-handler.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import { orbitErrorHandler } from '../middleware/error-handler.js'
import { requestIdMiddleware } from '../middleware/request-id.js'
import '../context.js'

describe('orbitErrorHandler logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs unexpected (non-OrbitError) errors to stderr with request context', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.onError(orbitErrorHandler)
    app.get('/boom', () => {
      throw new Error('kaboom')
    })

    const res = await app.request('/boom', { method: 'GET' })
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; request_id?: string } }
    expect(body.error.code).toBe('INTERNAL_ERROR')

    expect(spy).toHaveBeenCalledTimes(1)
    const logged = spy.mock.calls[0]![0] as Record<string, unknown>
    expect(logged).toMatchObject({
      msg: expect.stringContaining('unhandled error'),
      err: expect.objectContaining({
        name: 'Error',
        message: 'kaboom',
      }),
      method: 'GET',
      path: '/boom',
    })
    expect(typeof logged.request_id).toBe('string')
  })

  it('does NOT log when the error is an OrbitError (these are expected, not bugs)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.onError(orbitErrorHandler)
    app.get('/not-found', () => {
      throw new OrbitError({
        code: 'RESOURCE_NOT_FOUND',
        message: 'nope',
      })
    })

    const res = await app.request('/not-found', { method: 'GET' })
    expect(res.status).toBe(404)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does NOT log JSON SyntaxErrors (these are client-caused 400s, not server bugs)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const app = new Hono()
    app.use('*', requestIdMiddleware())
    app.onError(orbitErrorHandler)
    app.post('/echo', async (c) => {
      const body = await c.req.json()
      return c.json(body)
    })

    const res = await app.request('/echo', {
      method: 'POST',
      body: '{not json',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 1.3: Run the test to verify it fails**

Run:
```bash
pnpm --filter @orbit-ai/api test -- error-handler
```
Expected: **FAIL** — the first test fails because `console.error` is never called in the current implementation.

- [ ] **Step 1.4: Implement the fix**

Edit `packages/api/src/middleware/error-handler.ts`. Replace the final `return c.json(...)` block (currently lines 63-73) with a logged version:

```typescript
  // Unexpected error — log it before returning an opaque 500.
  // We log to stderr here because the api package has no opinion on which
  // structured logger to use; whatever log drain the host uses will pick up
  // stderr (Vercel, Cloudflare, Fly, Docker, etc.). Structured shape so log
  // processors can parse.
  console.error({
    msg: 'unhandled error in orbitErrorHandler',
    err: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    request_id: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
  })

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
```

Everything above the comment (the `OrbitError` and `SyntaxError` branches) stays unchanged.

- [ ] **Step 1.5: Run tests to verify they pass**

Run:
```bash
pnpm --filter @orbit-ai/api test -- error-handler
```
Expected: **PASS** — all 3 new tests green. No other api tests should regress.

- [ ] **Step 1.6: Run full api test suite to check for regressions**

Run:
```bash
pnpm --filter @orbit-ai/api test
```
Expected: 230 + 3 = 233 api tests passing. If anything else changed count, investigate before committing.

- [ ] **Step 1.7: Commit**

```bash
git add packages/api/src/middleware/error-handler.ts packages/api/src/__tests__/error-handler.test.ts
git commit -m "$(cat <<'EOF'
fix(api): log unhandled errors in orbitErrorHandler before returning 500

The error handler was returning opaque 500s with no server-side trace,
giving operators nothing to correlate with the client's request_id.
Adds structured console.error logging for the unexpected-error branch
only — OrbitError and JSON SyntaxError paths remain silent because
they're expected client-caused responses, not server bugs.

Identified by silent-failure-hunter review on 2026-04-08.
EOF
)"
```

---

## Task 2: DirectTransport @security JSDoc warning

**Goal:** Fix C2 (doc-only half) — `DirectTransport` reimplements HTTP routing and silently bypasses middleware (SSRF validation, scope checks, idempotency, rate limit). The refactor to a shared validation layer is deferred to PR 4. For now, a loud JSDoc warning so SDK consumers understand the threat model.

**Files:**
- Modify: `packages/sdk/src/transport/direct-transport.ts`

**No test** — this is a documentation-only change. TypeScript will still compile.

- [ ] **Step 2.1: Add the JSDoc warning block above the class declaration**

Edit `packages/sdk/src/transport/direct-transport.ts`. Replace the current `export class DirectTransport implements OrbitTransport {` line (currently line 6) with:

```typescript
/**
 * In-process transport for the Orbit AI SDK.
 *
 * @security **TRUSTED-CALLER ONLY — this transport bypasses API middleware.**
 *
 * DirectTransport dispatches requests straight to core services inside the
 * current process. It does NOT run any of the following middleware that
 * `@orbit-ai/api` applies to HTTP requests:
 *
 * - Webhook URL SSRF validation (`validateWebhookUrl`)
 * - Scope enforcement (`requireScope`)
 * - Idempotency key handling
 * - Rate limiting
 * - Request body size limits
 * - API version pinning
 * - Tenant auth context derivation from API keys
 *
 * This is fine when the SDK caller is a trusted server-side application
 * passing its own trusted inputs (e.g. a Next.js backend using DirectTransport
 * against an embedded SQLite adapter for tests, or a CLI tool).
 *
 * It is NOT fine when ANY of these are true:
 * - You forward user-supplied webhook URLs through this transport
 *   (SSRF: a malicious user could target `http://169.254.169.254/` or
 *    internal services).
 * - You expose DirectTransport to multi-tenant end-users without enforcing
 *   scopes at your application layer (privilege escalation).
 * - You need idempotency guarantees across retries (they will not replay).
 * - You need rate limiting (there is none).
 *
 * If any of the above apply, use {@link HttpTransport} with a real API server
 * instead — it applies the full middleware chain.
 *
 * Tracked for refactor: extract the SSRF validation + scope check functions
 * from `@orbit-ai/api` into a shared layer both transports can call.
 */
export class DirectTransport implements OrbitTransport {
```

Everything else in the file stays unchanged.

- [ ] **Step 2.2: Verify compilation**

Run:
```bash
pnpm --filter @orbit-ai/sdk typecheck
```
Expected: clean.

- [ ] **Step 2.3: Run sdk tests to make sure nothing broke**

Run:
```bash
pnpm --filter @orbit-ai/sdk test
```
Expected: 171 passing (unchanged from baseline).

- [ ] **Step 2.4: Commit**

```bash
git add packages/sdk/src/transport/direct-transport.ts
git commit -m "$(cat <<'EOF'
docs(sdk): add @security JSDoc warning to DirectTransport class

DirectTransport reimplements HTTP routing and silently bypasses the
middleware chain @orbit-ai/api applies to real HTTP requests — SSRF
validation, scope enforcement, idempotency, rate limiting. This is
documented as trusted-caller-only until the shared validation layer
refactor lands (tracked for PR 4).

Identified by pr-review-toolkit:code-reviewer on 2026-04-08.
EOF
)"
```

---

## Task 3: Remove overly broad catch in objects.ts schema-preview route

**Goal:** Fix C3 — the try/catch at `packages/api/src/routes/objects.ts:75-82` maps ALL errors (malformed JSON, validation failures, adapter crashes, genuine bugs) to `notImplemented()` 501. Sibling routes (`apply`, `rollback`) don't have this. The catch is redundant because `typeof schema.preview !== 'function'` is already checked on line 72.

**Files:**
- Modify: `packages/api/src/routes/objects.ts`
- Modify: `packages/api/src/__tests__/routes-wave2.test.ts` (add regression test)

- [ ] **Step 3.1: Write a failing test**

**Verified fixture pattern (2026-04-08):** The file's helpers are `createRouteTestApp(scopes?: string[])` and `mockWave2CoreServices(): CoreServices`. Routes are NOT auto-registered — each test calls `registerObjectRoutes(app, services)` (or similar) after building the app. The `orbit` context is set inline by `createRouteTestApp`, so NO `Authorization` header is needed. Also ensure `orbitErrorHandler` is wired with `app.onError(orbitErrorHandler)` so thrown errors return proper status codes instead of propagating.

Open `packages/api/src/__tests__/routes-wave2.test.ts`. Find the existing `describe('Objects and schema', ...)` section (or similar — search for `registerObjectRoutes`). Add this test INSIDE that describe block (or add a new describe at the bottom of the file, before the final `})`).

```typescript
  it('POST /v1/schema/migrations/preview surfaces JSON parse errors as 400, not 501', async () => {
    const services = mockWave2CoreServices()
    // Make schema.preview exist so the notImplemented guard doesn't short-circuit.
    ;(services as any).schema = {
      preview: vi.fn(async () => ({ ok: true })),
    }
    const app = createRouteTestApp()
    app.onError(orbitErrorHandler)
    registerObjectRoutes(app, services)

    const res = await app.request('/v1/schema/migrations/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })
```

If `orbitErrorHandler` isn't already imported at the top of the test file, add: `import { orbitErrorHandler } from '../middleware/error-handler.js'`.

- [ ] **Step 3.2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @orbit-ai/api test -- routes-wave2
```
Expected: **FAIL** — the test currently gets 501 because the broad catch swallows the JSON parse error.

- [ ] **Step 3.3: Delete the try/catch**

Edit `packages/api/src/routes/objects.ts`. Find the `POST /v1/schema/migrations/preview` route (around line 71-82) and replace:

```typescript
  app.post('/v1/schema/migrations/preview', requireScope('schema:read'), async (c) => {
    if (typeof schema.preview !== 'function') {
      return notImplemented(c, 'Schema migration preview')
    }
    try {
      const body = await c.req.json()
      const result = await schema.preview(c.get('orbit'), body)
      return c.json(toEnvelope(c, result))
    } catch {
      return notImplemented(c, 'Schema migration preview')
    }
  })
```

with:

```typescript
  app.post('/v1/schema/migrations/preview', requireScope('schema:read'), async (c) => {
    if (typeof schema.preview !== 'function') {
      return notImplemented(c, 'Schema migration preview')
    }
    const body = await c.req.json()
    const result = await schema.preview(c.get('orbit'), body)
    return c.json(toEnvelope(c, result))
  })
```

The global `orbitErrorHandler` will handle any thrown error correctly (JSON parse → 400 VALIDATION_FAILED via the `SyntaxError` branch; adapter crashes → 500 INTERNAL_ERROR via the logged branch from Task 1).

- [ ] **Step 3.4: Run the test to verify it passes**

Run:
```bash
pnpm --filter @orbit-ai/api test -- routes-wave2
```
Expected: **PASS**. Full wave-2 suite should also pass with +1 test.

- [ ] **Step 3.5: Commit**

```bash
git add packages/api/src/routes/objects.ts packages/api/src/__tests__/routes-wave2.test.ts
git commit -m "$(cat <<'EOF'
fix(api): remove broad catch in schema-migrations preview route

The try/catch in objects.ts was masking all errors (bad JSON, validation
failures, adapter crashes, genuine bugs) as 501 "not implemented".
Sibling routes (apply, rollback) don't have this pattern. The catch was
also redundant with the schema.preview-function check already above it.
Let the global error handler do its job — JSON parse errors become 400
VALIDATION_FAILED, real crashes become logged 500s.

Identified by silent-failure-hunter review on 2026-04-08.
EOF
)"
```

---

## Task 4: Add Zod validation to imports POST route

**Goal:** Fix C4 — `imports.ts:17-22` passes the raw request body straight to the service with no schema validation. If the core imports service ever accepts a `source_url` field, that becomes a fresh SSRF vector at the service layer. Validate at the HTTP edge, same way bootstrap.ts does.

**Files:**
- Modify: `packages/api/src/routes/imports.ts`
- Modify: `packages/api/src/__tests__/routes-wave2.test.ts` (add regression test)

- [ ] **Step 4.1: Write a failing test**

Same fixture pattern as Task 3 — use `createRouteTestApp()` + `mockWave2CoreServices()` + explicit `registerImportRoutes(app, services)`. The `orbit` context is set by the fixture middleware, NO Bearer header needed. Wire `orbitErrorHandler` so Zod rejections return 400.

Add to `packages/api/src/__tests__/routes-wave2.test.ts` inside a new or existing `describe('Imports', ...)` block:

```typescript
  it('POST /v1/imports rejects a body with no fields at all as VALIDATION_FAILED', async () => {
    const services = mockWave2CoreServices()
    ;(services as any).imports = {
      list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
      get: vi.fn(async () => null),
      create: vi.fn(async (_ctx: any, input: any) => ({ id: 'imp_01', ...input })),
    }
    const app = createRouteTestApp()
    app.onError(orbitErrorHandler)
    registerImportRoutes(app, services)

    const res = await app.request('/v1/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('POST /v1/imports rejects an unknown source type as VALIDATION_FAILED', async () => {
    const services = mockWave2CoreServices()
    ;(services as any).imports = {
      list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
      get: vi.fn(async () => null),
      create: vi.fn(async (_ctx: any, input: any) => ({ id: 'imp_01', ...input })),
    }
    const app = createRouteTestApp()
    app.onError(orbitErrorHandler)
    registerImportRoutes(app, services)

    const res = await app.request('/v1/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'martian-csv', entity: 'contacts', rows: [] }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })
```

If `orbitErrorHandler` isn't already imported at the top of the test file, add the import.

- [ ] **Step 4.2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @orbit-ai/api test -- routes-wave2
```
Expected: **FAIL** — the imports POST currently accepts any body.

- [ ] **Step 4.3: Add the Zod schema and enforcement**

Edit `packages/api/src/routes/imports.ts`. Replace the entire file contents with:

```typescript
import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { z } from 'zod'
import { toEnvelope, toError } from '../responses.js'
import { requireScope } from '../scopes.js'
import { paginationParams } from '../utils/pagination.js'

// Conservative allowlist of import sources the HTTP API accepts.
// The core service may support more, but we only expose vetted ones here.
// Adding a new source requires adding it to this allowlist AND confirming
// that the service-layer handler for it does not introduce an SSRF vector
// (e.g. a 'url' source would need URL validation here before hitting core).
const ImportSourceSchema = z.enum(['csv', 'json', 'inline'])

const CreateImportSchema = z.object({
  source: ImportSourceSchema,
  entity: z.string().min(1).max(64),
  rows: z.array(z.record(z.unknown())).optional(),
  file_id: z.string().min(1).max(128).optional(),
  options: z.record(z.unknown()).optional(),
})

export function registerImportRoutes(app: Hono, services: CoreServices) {
  // GET /v1/imports — list
  app.get('/v1/imports', requireScope('imports:read'), async (c) => {
    const { limit, cursor } = paginationParams(c)
    const service = services.imports as any
    const result = await service.list(c.get('orbit'), { limit, cursor })
    return c.json(toEnvelope(c, result.data, result))
  })

  // POST /v1/imports — create
  app.post('/v1/imports', requireScope('imports:write'), async (c) => {
    const body = await c.req.json()
    const parsed = CreateImportSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Invalid request body', {
        hint: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }), 400)
    }
    const service = services.imports as any
    const created = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, created), 201)
  })

  // GET /v1/imports/:id — get
  app.get('/v1/imports/:id', requireScope('imports:read'), async (c) => {
    const service = services.imports as any
    const record = await service.get(c.get('orbit'), c.req.param('id'))
    if (!record) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Import not found'), 404)
    }
    return c.json(toEnvelope(c, record))
  })
}
```

Note: this also migrates the GET list handler to use `paginationParams` (the shared util from PR 1) instead of inline `Number()` parsing. That was a pre-existing gap.

Wait — `paginationParams` only exists on the PR 1 branch, not PR 0. On PR 0 it's still the inline `Number()` pattern. Since this plan runs the PR 0 fixes first, you must keep the inline pattern for PR 0. **Revised list handler:**

```typescript
  // GET /v1/imports — list
  app.get('/v1/imports', requireScope('imports:read'), async (c) => {
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
    const cursor = c.req.query('cursor') ?? undefined
    const service = services.imports as any
    const result = await service.list(c.get('orbit'), { limit, cursor })
    return c.json(toEnvelope(c, result.data, result))
  })
```

And remove the `import { paginationParams } from '../utils/pagination.js'` line from the top of the file. The file you write should match the current PR 0 list handler exactly, with ONLY the POST handler changed to add Zod validation + the new imports at the top.

**Correct final file:**

```typescript
import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { z } from 'zod'
import { toEnvelope, toError } from '../responses.js'
import { requireScope } from '../scopes.js'

const ImportSourceSchema = z.enum(['csv', 'json', 'inline'])

const CreateImportSchema = z.object({
  source: ImportSourceSchema,
  entity: z.string().min(1).max(64),
  rows: z.array(z.record(z.unknown())).optional(),
  file_id: z.string().min(1).max(128).optional(),
  options: z.record(z.unknown()).optional(),
})

export function registerImportRoutes(app: Hono, services: CoreServices) {
  // GET /v1/imports — list
  app.get('/v1/imports', requireScope('imports:read'), async (c) => {
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
    const cursor = c.req.query('cursor') ?? undefined
    const service = services.imports as any
    const result = await service.list(c.get('orbit'), { limit, cursor })
    return c.json(toEnvelope(c, result.data, result))
  })

  // POST /v1/imports — create
  app.post('/v1/imports', requireScope('imports:write'), async (c) => {
    const body = await c.req.json()
    const parsed = CreateImportSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(toError(c, 'VALIDATION_FAILED', 'Invalid request body', {
        hint: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      }), 400)
    }
    const service = services.imports as any
    const created = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, created), 201)
  })

  // GET /v1/imports/:id — get
  app.get('/v1/imports/:id', requireScope('imports:read'), async (c) => {
    const service = services.imports as any
    const record = await service.get(c.get('orbit'), c.req.param('id'))
    if (!record) {
      return c.json(toError(c, 'RESOURCE_NOT_FOUND', 'Import not found'), 404)
    }
    return c.json(toEnvelope(c, record))
  })
}
```

- [ ] **Step 4.4: Check that `toError` supports the `hint` option**

The bootstrap.ts file uses `toError(c, 'VALIDATION_FAILED', '...', { hint: '...' })`. Verify the signature is the same — quick grep:

```bash
grep -n "export function toError" packages/api/src/responses.ts
```

If `toError` doesn't take an options object yet, look at how bootstrap.ts currently uses it. If there's a mismatch, fall back to the shape used in bootstrap.ts — that's known to work.

- [ ] **Step 4.5: Check if existing import-POST tests depend on the lax body**

Run:
```bash
grep -n "POST.*imports" packages/api/src/__tests__/*.ts
```

If any existing test sends a body like `{ foo: 'bar' }` that the new schema will reject, you need to either (a) update those tests to send valid bodies, or (b) document which ones are now expected to fail so you can fix them in the same commit.

- [ ] **Step 4.6: Run the tests to verify they pass**

Run:
```bash
pnpm --filter @orbit-ai/api test -- routes-wave2
```
Expected: **PASS**. If pre-existing import tests now fail because their bodies don't match the new schema, update them to use valid bodies.

- [ ] **Step 4.7: Run the full api test suite**

Run:
```bash
pnpm --filter @orbit-ai/api test
```
Expected: all tests pass. Count should be previous + 2 new tests.

- [ ] **Step 4.8: Commit**

```bash
git add packages/api/src/routes/imports.ts packages/api/src/__tests__/routes-wave2.test.ts
git commit -m "$(cat <<'EOF'
fix(api): validate imports POST body with Zod schema at the HTTP edge

imports.ts was passing the raw request body straight to the service
with zero validation. If the core imports service ever accepts a
source_url or other network-fetching field, that becomes an SSRF vector
at the service layer. This adds a conservative Zod allowlist for the
source type and schema-checks the whole body before it reaches core.
New sources must be added to ImportSourceSchema explicitly.

Identified by PR 0 security review on 2026-04-08.
EOF
)"
```

---

## Task 5: Sanitize bootstrap organization + API-key responses

**Goal:** Fix C5 — `bootstrap.ts:41,59` pass raw service results through `toEnvelope` without any `sanitizePublicRead` equivalent. If the core service ever attaches internal fields (billing state, feature flags, raw DB row fields), they leak to the client. Other routes go through `sanitizePublicRead`; bootstrap should too.

**Files:**
- Modify: `packages/api/src/responses.ts` (add sanitizers)
- Modify: `packages/api/src/routes/bootstrap.ts`
- Modify: `packages/api/src/__tests__/bootstrap-routes.test.ts` (add regression test)

- [ ] **Step 5.1: Read the current responses.ts to understand the sanitizer pattern**

Run:
```bash
grep -n "sanitizePublicRead\|export function sanitize" packages/api/src/responses.ts
```

Look at how `sanitizePublicRead` is implemented. You'll copy the shape for the new sanitizers.

- [ ] **Step 5.2: Write the failing test**

**Verified fixture pattern (2026-04-08):** The file's helpers are `createRouteTestApp(scopes?: string[])` and `mockCoreServicesForBootstrap({ orgCreateExists?, apiKeyCreateExists? })`. The mock factory takes BOOLEAN options, not callback overrides — it can't inject arbitrary return shapes. **Workaround**: build the services object inline with custom `create` functions instead of going through `mockCoreServicesForBootstrap`. The `createRouteTestApp` fixture sets `orbit` context inline — NO Bearer header needed.

Open `packages/api/src/__tests__/bootstrap-routes.test.ts` and add a new describe block at the bottom (before the final `})`):

```typescript
describe('Bootstrap routes — response sanitization', () => {
  it('POST /v1/bootstrap/organizations strips internal fields from the response', async () => {
    const services = {
      system: {
        organizations: {
          list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
          get: vi.fn(async () => null),
          create: vi.fn(async () => ({
            id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
            name: 'Acme',
            slug: 'acme',
            created_at: '2026-04-08T00:00:00Z',
            // internal fields that must NOT leak
            _internal_billing_state: 'trial',
            _row_version: 42,
            stripe_customer_id: 'cus_secret',
          })),
        },
        apiKeys: {
          list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
          get: vi.fn(async () => null),
        },
      },
    } as unknown as CoreServices

    const app = createRouteTestApp()
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Acme' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('name', 'Acme')
    expect(body.data).not.toHaveProperty('_internal_billing_state')
    expect(body.data).not.toHaveProperty('_row_version')
    expect(body.data).not.toHaveProperty('stripe_customer_id')
  })

  it('POST /v1/bootstrap/api-keys strips internal fields from the response', async () => {
    const services = {
      system: {
        organizations: {
          list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
          get: vi.fn(async () => null),
        },
        apiKeys: {
          list: vi.fn(async () => ({ data: [], nextCursor: null, hasMore: false })),
          get: vi.fn(async () => null),
          create: vi.fn(async () => ({
            id: 'ak_01ARYZ6S41YYYYYYYYYYYYYYYY',
            name: 'Test Key',
            scopes: ['contacts:read'],
            api_key: 'sk_test_the_raw_key',
            created_at: '2026-04-08T00:00:00Z',
            // internal fields that must NOT leak
            _hashed_key: 'abc123hash',
            _salt: 'saltsalt',
          })),
        },
      },
    } as unknown as CoreServices

    const app = createRouteTestApp()
    registerBootstrapRoutes(app, services)

    const res = await app.request('/v1/bootstrap/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Test Key',
        scopes: ['contacts:read'],
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('api_key') // the raw key IS intentionally returned once on creation
    expect(body.data).not.toHaveProperty('_hashed_key')
    expect(body.data).not.toHaveProperty('_salt')
  })
})
```

Add these imports to the top of the test file if they're missing:
```typescript
import type { CoreServices } from '@orbit-ai/core'
// vi, describe, it, expect should already be imported from vitest
```

- [ ] **Step 5.3: Run the test to verify it fails**

Run:
```bash
pnpm --filter @orbit-ai/api test -- bootstrap
```
Expected: **FAIL** — currently the internal fields pass through unchanged.

- [ ] **Step 5.4: Add the sanitizers to responses.ts**

Edit `packages/api/src/responses.ts`. Find where `sanitizePublicRead` is exported and add these alongside it (near the other sanitizers):

```typescript
const ORGANIZATION_PUBLIC_FIELDS = new Set([
  'id',
  'name',
  'slug',
  'metadata',
  'created_at',
  'updated_at',
])

export function sanitizeOrganizationRead(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (ORGANIZATION_PUBLIC_FIELDS.has(k)) out[k] = v
  }
  return out
}

const API_KEY_PUBLIC_FIELDS = new Set([
  'id',
  'name',
  'scopes',
  'api_key', // raw key is intentionally returned ONCE on creation
  'expires_at',
  'organization_id',
  'created_at',
  'updated_at',
])

export function sanitizeApiKeyRead(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (API_KEY_PUBLIC_FIELDS.has(k)) out[k] = v
  }
  return out
}
```

If the existing `sanitizePublicRead` uses a different shape (e.g. a block-list instead of allowlist), copy that style for consistency. An allowlist is the safer default, so prefer it.

- [ ] **Step 5.5: Wire the sanitizers into bootstrap.ts**

Edit `packages/api/src/routes/bootstrap.ts`. At the top, update the import:

```typescript
import { toEnvelope, toError, sanitizeOrganizationRead, sanitizeApiKeyRead } from '../responses.js'
```

**Both POST handlers contain an identical `const result = await service.create(...) ...` line, so a naive Edit will fail on non-uniqueness.** Make two separate Edits, each with enough surrounding context to be unique.

**Edit 1 — organizations POST (around lines 35-42).** Replace:

```typescript
    const service = services.system.organizations as any
    if (typeof service.create !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Bootstrap organization creation not implemented'), 501)
    }

    const result = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, result), 201)
```

with:

```typescript
    const service = services.system.organizations as any
    if (typeof service.create !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Bootstrap organization creation not implemented'), 501)
    }

    const result = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, sanitizeOrganizationRead(result)), 201)
```

**Edit 2 — api-keys POST (around lines 54-60).** Replace:

```typescript
    const service = services.system.apiKeys as any
    if (typeof service.create !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Bootstrap API key creation not implemented'), 501)
    }

    const result = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, result), 201)
```

with:

```typescript
    const service = services.system.apiKeys as any
    if (typeof service.create !== 'function') {
      return c.json(toError(c, 'INTERNAL_ERROR', 'Bootstrap API key creation not implemented'), 501)
    }

    const result = await service.create(c.get('orbit'), parsed.data)
    return c.json(toEnvelope(c, sanitizeApiKeyRead(result)), 201)
```

- [ ] **Step 5.6: Run tests to verify they pass**

Run:
```bash
pnpm --filter @orbit-ai/api test -- bootstrap
```
Expected: **PASS**. 2 new tests green, no regressions.

- [ ] **Step 5.7: Run full api test suite**

Run:
```bash
pnpm --filter @orbit-ai/api test
```
Expected: all green.

- [ ] **Step 5.8: Commit**

```bash
git add packages/api/src/responses.ts packages/api/src/routes/bootstrap.ts packages/api/src/__tests__/bootstrap-routes.test.ts
git commit -m "$(cat <<'EOF'
fix(api): sanitize bootstrap org + api-key responses with allowlist

bootstrap.ts was passing raw service results through toEnvelope with no
field allowlist, unlike every other route which runs through
sanitizePublicRead. If the system.organizations or system.apiKeys service
ever attaches internal fields (billing state, hashed secrets, row
versions), they would leak to the caller. Adds sanitizeOrganizationRead
and sanitizeApiKeyRead allowlists in responses.ts and wires both POST
handlers through them.

Note on 'metadata' field (organizations): the allowlist includes the
freeform 'metadata' column because public API consumers use it for
application tagging. This means any internal data stored in metadata
WILL be exposed. Future work: either lock metadata to a documented
sub-schema or introduce a separate _internal_metadata column.

Note on 'api_key' field (api_keys): the allowlist intentionally includes
'api_key' because the raw key is generated transiently by the create
service and returned exactly once on creation. There is no plaintext
'api_key' column in the DB schema (only 'keyHash'), so subsequent reads
cannot leak it.

Identified by PR 0 security review on 2026-04-08.
EOF
)"
```

---

## Task 6: Skip idempotency middleware on `/v1/bootstrap/*` paths

**Goal:** Fix C6 — idempotency middleware falls back to `orgId = 'unknown'` when the orbit context isn't set (which happens on bootstrap routes, because they run before tenant-context). Two platform operators calling `/v1/bootstrap/organizations` simultaneously with the same idempotency key would collide on the `'unknown'` bucket. Fix: explicitly skip idempotency on bootstrap paths, same way tenant-context is skipped.

**Files:**
- Modify: `packages/api/src/middleware/idempotency.ts`
- Modify: `packages/api/src/__tests__/idempotency.test.ts` (add regression test)

- [ ] **Step 6.1: Write the failing test**

**IMPORTANT placement note:** `idempotency.test.ts` has ONE top-level `describe` block that closes at line 127 (`})`). Insert the new test INSIDE that describe block — i.e. before line 127 — NOT after it. A bare `it(...)` at EOF will not run.

Insert inside the existing `describe('idempotency middleware', ...)`:

```typescript
  it('bootstrap paths are exempt from idempotency (no cross-operator collision on unknown orgId)', async () => {
    const app = new Hono()
    app.onError(orbitErrorHandler)
    app.use('*', requestIdMiddleware())
    app.use('*', idempotencyMiddleware())

    let callCount = 0
    app.post('/v1/bootstrap/organizations', async (c) => {
      callCount += 1
      const body = await c.req.json()
      return c.json({ id: `org_${callCount}`, name: body.name }, 201)
    })

    // Two calls with the SAME idempotency key but DIFFERENT bodies must both
    // succeed (bootstrap is exempt). Without the exemption the second would
    // 409 IDEMPOTENCY_CONFLICT because they'd share the 'unknown' orgId bucket.
    const headers = {
      'idempotency-key': 'idem_bootstrap_001',
      'content-type': 'application/json',
    }

    const res1 = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'OrgA' }),
      headers,
    })
    expect(res1.status).toBe(201)
    const body1 = (await res1.json()) as { id: string }
    expect(body1.id).toBe('org_1')

    const res2 = await app.request('/v1/bootstrap/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'OrgB' }),
      headers,
    })
    expect(res2.status).toBe(201)
    const body2 = (await res2.json()) as { id: string }
    expect(body2.id).toBe('org_2')

    // Neither response should claim to be a replay.
    expect(res1.headers.get('x-idempotent-replayed')).toBeNull()
    expect(res2.headers.get('x-idempotent-replayed')).toBeNull()
    expect(callCount).toBe(2)
  })
```

- [ ] **Step 6.2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @orbit-ai/api test -- idempotency
```
Expected: **FAIL** — the second request currently 409s with `IDEMPOTENCY_CONFLICT` because it hits the shared `unknown:POST:/v1/bootstrap/organizations:idem_bootstrap_001` bucket.

- [ ] **Step 6.3: Add the bootstrap exemption**

Edit `packages/api/src/middleware/idempotency.ts`. Find the `return async (c, next) => {` block (line 30). Right after the GET/HEAD/OPTIONS bypass, add a path prefix check:

```typescript
export function idempotencyMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // Only apply to mutating requests
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      await next()
      return
    }

    // Bootstrap routes run before tenant-context middleware, so the orbit
    // context is not yet populated. Without an orgId, the idempotency store
    // key falls back to 'unknown', causing cross-operator collisions between
    // independent platform admins. Skip idempotency entirely on these paths;
    // bootstrap endpoints are expected to be idempotent by design at the
    // core service layer (duplicate orgs by slug, etc.).
    if (c.req.path.startsWith('/v1/bootstrap/')) {
      await next()
      return
    }

    const key = c.req.header('idempotency-key')
    // ... rest unchanged
```

The rest of the function stays exactly as-is.

- [ ] **Step 6.4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @orbit-ai/api test -- idempotency
```
Expected: **PASS**. All existing idempotency tests still pass; the new bootstrap-exemption test passes.

- [ ] **Step 6.5: Commit**

```bash
git add packages/api/src/middleware/idempotency.ts packages/api/src/__tests__/idempotency.test.ts
git commit -m "$(cat <<'EOF'
fix(api): skip idempotency middleware on /v1/bootstrap/* paths

The idempotency store key falls back to orgId='unknown' when the orbit
context isn't populated. In normal /v1/* flow, auth middleware runs
before idempotency, so orgId is set — but on edge cases (unauthenticated
or malformed bootstrap requests that still reach idempotency), two
platform admins with the same idempotency-key header could share the
'unknown' bucket. Skip idempotency on bootstrap paths entirely instead
of relying on middleware ordering to be correct.

Safety is preserved at the DB layer: packages/core/src/schema/tables.ts
has uniqueIndex('organizations_slug_idx') on organizations.slug and
uniqueIndex('api_keys_hash_idx') on api_keys.keyHash. Duplicate creation
attempts fail with a CONFLICT error from the DB, not silent duplicates.

Identified by PR 0 security review on 2026-04-08. DB constraint
evidence verified by plan-validation security reviewer.
EOF
)"
```

---

## Task 7: Cross-tenant idempotency replay regression test

**Goal:** Fix C7 — the idempotency store key correctly includes `orgId`, so cross-tenant replay IS prevented, but there is no test asserting this. Add the test so a future refactor of the store-key format can't silently regress.

**Files:**
- Modify: `packages/api/src/__tests__/idempotency.test.ts`

**No implementation change** — the behavior is already correct. This is a regression-lock test only.

- [ ] **Step 7.1: Add the test**

Same placement rule as Task 6 — insert INSIDE the existing `describe('idempotency middleware', ...)` block, before its closing `})` (originally line 127, now a few lines later after Task 6's insertion). Do NOT create a new top-level describe; the test needs to share the `beforeEach` that calls `_resetIdempotencyStore()`.

```typescript
  it('same idempotency key across different orgIds does NOT replay (cross-tenant isolation)', async () => {
    const app = new Hono()
    app.onError(orbitErrorHandler)
    app.use('*', requestIdMiddleware())

    // Fake tenant context middleware — simulates org A on the first call and
    // org B on the second. In production the real middleware derives this
    // from the API key.
    let nextOrgId = 'org_A'
    app.use('*', async (c, next) => {
      c.set('orbit', { orgId: nextOrgId, scopes: ['*'] })
      await next()
    })

    app.use('*', idempotencyMiddleware())

    let callCount = 0
    app.post('/v1/contacts', async (c) => {
      callCount += 1
      const body = await c.req.json()
      return c.json({ id: `ct_${callCount}`, name: body.name, org: nextOrgId }, 201)
    })

    const body = JSON.stringify({ name: 'Alice' })
    const headers = {
      'idempotency-key': 'idem_xtenant_001',
      'content-type': 'application/json',
    }

    // Org A's first call — processes fresh.
    nextOrgId = 'org_A'
    const resA = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(resA.status).toBe(201)
    const bodyA = (await resA.json()) as { id: string; org: string }
    expect(bodyA.id).toBe('ct_1')
    expect(bodyA.org).toBe('org_A')

    // Org B's call — same idempotency key, same body text — MUST process
    // fresh because the store key is scoped to orgId.
    nextOrgId = 'org_B'
    const resB = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(resB.status).toBe(201)
    const bodyB = (await resB.json()) as { id: string; org: string }
    expect(bodyB.id).toBe('ct_2')
    expect(bodyB.org).toBe('org_B')
    expect(resB.headers.get('x-idempotent-replayed')).toBeNull()

    expect(callCount).toBe(2)

    // Sanity: org A replaying its own key still gets a replay.
    nextOrgId = 'org_A'
    const resA2 = await app.request('/v1/contacts', { method: 'POST', body, headers })
    expect(resA2.status).toBe(201)
    const bodyA2 = (await resA2.json()) as { id: string; org: string }
    expect(bodyA2.id).toBe('ct_1') // replayed — still the first id
    expect(bodyA2.org).toBe('org_A')
    expect(resA2.headers.get('x-idempotent-replayed')).toBe('true')
    expect(callCount).toBe(2) // handler NOT re-invoked
  })
```

- [ ] **Step 7.2: Run the test**

Run:
```bash
pnpm --filter @orbit-ai/api test -- idempotency
```
Expected: **PASS** on the first run (the behavior was already correct — this is a regression-lock).

If it fails, that's actually a bug in the existing idempotency implementation — STOP and report, don't try to fix it here.

- [ ] **Step 7.3: Commit**

```bash
git add packages/api/src/__tests__/idempotency.test.ts
git commit -m "$(cat <<'EOF'
test(api): lock cross-tenant idempotency replay isolation

Add regression test asserting that the same idempotency-key header
reused across two different orgIds does NOT replay the first org's
response. The store-key format (orgId:method:path:key) already scopes
this correctly, but there was no test pinning the behavior, so a
future store-key refactor could silently regress it.

Identified by PR 0 security review on 2026-04-08.
EOF
)"
```

---

## Task 8: Fix transport parity test paths (`/contacts` → `/v1/contacts`)

**Goal:** Fix C8 — `packages/sdk/src/__tests__/transport-parity.test.ts` uses fixture paths like `/contacts` and `/contacts/cid_123`, but real SDK resources send `/v1/contacts`. The parity tests only prove envelope shapes match for hand-crafted inputs — they don't prove the two transports actually behave the same way on real SDK-generated paths. The "transport parity verified" claim in docs is currently overstated. Fix the fixtures to use real paths.

**Files:**
- Modify: `packages/sdk/src/__tests__/transport-parity.test.ts`

- [ ] **Step 8.1: Verify the real SDK path is `/v1/contacts`**

Run:
```bash
grep -n "path:" packages/sdk/src/resources/contacts.ts
```
Expected: paths start with `/v1/`.

- [ ] **Step 8.2: Update the fixture constants**

Edit `packages/sdk/src/__tests__/transport-parity.test.ts`. Replace the three constants at the top of the file (around lines 22-37):

```typescript
const LIST_REQUEST: TransportRequest = {
  method: 'GET',
  path: '/contacts',
  query: { limit: 10 },
}

const GET_REQUEST: TransportRequest = {
  method: 'GET',
  path: '/contacts/cid_123',
}

const CREATE_REQUEST: TransportRequest = {
  method: 'POST',
  path: '/contacts',
  body: { name: 'Ada Lovelace', email: 'ada@example.com' },
}
```

with:

```typescript
const LIST_REQUEST: TransportRequest = {
  method: 'GET',
  path: '/v1/contacts',
  query: { limit: 10 },
}

const GET_REQUEST: TransportRequest = {
  method: 'GET',
  path: '/v1/contacts/cid_123',
}

const CREATE_REQUEST: TransportRequest = {
  method: 'POST',
  path: '/v1/contacts',
  body: { name: 'Ada Lovelace', email: 'ada@example.com' },
}
```

- [ ] **Step 8.3: Update the `makeEnvelope` / `makeListEnvelope` path references**

The `makeEnvelope(..., '/contacts/cid_123')` and `makeEnvelope(..., '/contacts')` calls (inside `fetchSpy.mockResolvedValueOnce(...)` blocks) should also use `/v1/` paths so the envelope's `links.self` matches what the SDK would receive from a real server. Do a find-replace inside the test file:

Find: `'/contacts'` → Replace with: `'/v1/contacts'`
Find: `'/contacts/cid_123'` → Replace with: `'/v1/contacts/cid_123'`
Find: `'/contacts/nonexistent_999'` → Replace with: `'/v1/contacts/nonexistent_999'`

**Do NOT** replace paths inside mock error responses or inside comments.

- [ ] **Step 8.4: Find any other `/contacts` references and verify they should be updated**

Run:
```bash
grep -n "'/contacts" packages/sdk/src/__tests__/transport-parity.test.ts
```
Expected: no remaining hits. If there are, decide each one on its own merits (fixture path = update; log assertion = leave).

- [ ] **Step 8.5: Run the sdk tests**

Run:
```bash
pnpm --filter @orbit-ai/sdk test -- transport-parity
```
Expected: **PASS**. DirectTransport's `dispatch()` already supports both `/contacts` and `/v1/contacts` (see `startIdx` logic), so the test should work with the new paths.

- [ ] **Step 8.6: Run the full sdk suite**

Run:
```bash
pnpm --filter @orbit-ai/sdk test
```
Expected: 171 passing, no regressions.

- [ ] **Step 8.7: Commit**

```bash
git add packages/sdk/src/__tests__/transport-parity.test.ts
git commit -m "$(cat <<'EOF'
test(sdk): fix transport parity fixtures to use real /v1/ paths

Parity test fixtures used bare /contacts paths, but real SDK resources
send /v1/contacts. The tests still passed because DirectTransport's
dispatch supports both shapes and the HTTP transport was mocked at
fetch level. Switch all three request fixtures plus the mock envelope
.self links to /v1/-prefixed paths.

LIMITATION: this commit does NOT prove full transport parity. It
proves envelope shape parity for the paths the SDK actually emits in
production, but because the HTTP transport is still mocked at the
fetch layer, real route dispatch through a running API is not
exercised. A true end-to-end parity test (spin up the api package,
hit it with both transports, compare full results) is tracked in PR 4.

Identified by PR 0 code review on 2026-04-08.
EOF
)"
```

---

## Task 9: Full verification + push PR 0

**Goal:** Before touching PR 1, prove the PR 0 branch is fully green with all 8 fix commits stacked on top of the original 38. Then push to `origin/pr-0-api-sdk-foundation`.

- [ ] **Step 9.1: Verify git log shows the fixes**

Run:
```bash
git log --oneline pr-0-api-sdk-foundation ^origin/main | head -15
```
Expected: 8 new commits on top of the original 38. Total 46.

- [ ] **Step 9.2: Full rebuild + typecheck + lint + test**

Run:
```bash
pnpm install --frozen-lockfile
pnpm --filter @orbit-ai/core build
pnpm -r typecheck
pnpm -r lint
pnpm -r test 2>&1 | tail -40
```
Expected: all green. Test count should be **671 + new tests from Tasks 1, 3, 4, 5, 6, 7**. Exact count depends on how many test cases you added in each task — capture it, you'll need it for the next task.

Record the new counts: `core X passed, sdk Y passed, api Z passed, total N`.

- [ ] **Step 9.3: Push**

Run:
```bash
git push origin pr-0-api-sdk-foundation
```
Expected: fast-forward push (no force required — you only added commits). PR #17 on GitHub automatically updates.

- [ ] **Step 9.4: Comment on PR #17 with new test counts**

Run:
```bash
gh pr comment 17 --body "Fix pass A applied (8 commits). New baseline: core X, sdk Y, api Z = total N passing (2 skipped). Typecheck + lint clean. See docs/superpowers/plans/2026-04-08-phase-0-1-fix-pass.md for the plan this implements."
```
Replace X/Y/Z/N with the real numbers from step 9.2.

---

## Task 10: Rebase PR 1 onto updated PR 0

**Goal:** PR 1 (`pr-1-phase-0-1-fixes`) was stacked on the OLD PR 0 HEAD (`9adfb2a`). Now that PR 0 has 8 new commits on top, rebase PR 1 so it stacks on the NEW PR 0 HEAD.

**Files:** None. This is a git operation.

- [ ] **Step 10.0: Verify PR 1 baseline before rebasing**

Run:
```bash
git checkout pr-1-phase-0-1-fixes
pnpm install --frozen-lockfile
pnpm --filter @orbit-ai/core build
pnpm -r typecheck
pnpm -r lint
pnpm -r test 2>&1 | tail -40
```
Expected: PR 1 is green before the rebase. Record the counts you actually see.

If PR 1 is already failing here, STOP and report. Do not treat pre-existing failures as rebase fallout.

- [ ] **Step 10.1: Verify current PR 1 state**

Run:
```bash
git rev-parse pr-1-phase-0-1-fixes
git log --oneline pr-0-api-sdk-foundation..pr-1-phase-0-1-fixes
```
Expected: 5 commits (the original PR 1 fixes).

- [ ] **Step 10.2: Check out PR 1 and rebase**

Run:
```bash
git rebase pr-0-api-sdk-foundation
```

Expected: clean rebase. PR 0 fixes touched: `error-handler.ts`, `direct-transport.ts` (JSDoc only), `objects.ts`, `imports.ts`, `responses.ts`, `bootstrap.ts`, `idempotency.ts`, `transport-parity.test.ts`. PR 1 touches: `entities.ts`, `direct-transport.ts` (added ENTITY_SERVICE_MAP), `sequence-events.ts`, `pagination-utils.ts`, `routes-wave2.test.ts`, etc.

**Potential conflict:** `direct-transport.ts` — PR 0 added a JSDoc block above the class, PR 1 modified lines 11-15 inside the class. These are different parts of the file; Git should auto-merge. If it doesn't, keep BOTH changes (PR 0's JSDoc + PR 1's map).

**Potential conflict:** `routes-wave2.test.ts` — PR 0 added imports POST validation tests, PR 1 added pagination NaN tests. Both append; Git should auto-merge.

**Potential conflict:** `imports.ts` — PR 0 added Zod validation, PR 1 migrates the GET list handler to use `paginationParams`. These are different handlers (POST vs GET); Git should auto-merge. If it gets confused because both edited the import block at the top of the file, keep BOTH imports.

- [ ] **Step 10.3: If conflicts occur**

For each conflict:
1. Run `git status` to see which files are conflicted.
2. Open the file, identify `<<<<<<< HEAD / ======= / >>>>>>>` markers.
3. Apply the merge rule: **keep both changes unless they're logically incompatible**.
4. Run `git add <resolved-file>`.
5. Run `git rebase --continue`.

If at any point you're unsure what to keep, STOP and report. Do NOT `git rebase --abort` without asking — that loses work.

- [ ] **Step 10.4: Verify the rebase landed cleanly**

Run:
```bash
git log --oneline pr-0-api-sdk-foundation..pr-1-phase-0-1-fixes
```
Expected: 5 commits (the original PR 1 fixes, possibly with new SHAs if the rebase reapplied them).

- [ ] **Step 10.5: Full verification**

Run:
```bash
pnpm install --frozen-lockfile
pnpm --filter @orbit-ai/core build
pnpm -r typecheck
pnpm -r lint
pnpm -r test 2>&1 | tail -40
```
Expected: all green. Test count = PR 0 post-fix count + PR 1's original +29 delta (pagination-utils + T3/T8 regression tests).

- [ ] **Step 10.6: Force-push PR 1 (this is the ONLY force-push allowed in the plan)**

Run:
```bash
git push --force-with-lease origin pr-1-phase-0-1-fixes
```

`--force-with-lease` is safer than `--force` — it fails if someone else pushed to the branch in the meantime. The rebase rewrote the 5 PR 1 commit SHAs, so a regular push would be rejected.

Expected: push succeeds. PR #18 on GitHub shows the new SHAs but the same diff against its base.

---

## Task 11: Extract `ENTITY_SERVICE_MAP` to `@orbit-ai/core`

**Goal:** Fix C9 — the `ENTITY_SERVICE_MAP` constant is duplicated in `packages/api/src/routes/entities.ts` and `packages/sdk/src/transport/direct-transport.ts`. They must stay in lockstep as new snake_cased entities land. Extract to `@orbit-ai/core` and import from both. Also add a drift-prevention test.

**Scope note:** This task only removes duplication for the snake_case public-entity-to-service-key mapping. It does **not** solve the broader runtime/OpenAPI route-surface drift problem. That larger cleanup remains separate work.

**Files:**
- Create: `packages/core/src/public-entity-map.ts`
- Modify: `packages/core/src/index.ts` (export)
- Modify: `packages/api/src/routes/entities.ts`
- Modify: `packages/sdk/src/transport/direct-transport.ts`
- Create: `packages/core/src/public-entity-map.test.ts`

**Verify you're on PR 1:** `git branch --show-current` should print `pr-1-phase-0-1-fixes`.

- [ ] **Step 11.1: Inspect the current duplicated maps**

Run:
```bash
grep -n "ENTITY_SERVICE_MAP" packages/api/src/routes/entities.ts packages/sdk/src/transport/direct-transport.ts
```

Both files should have a map like `{ sequence_steps: 'sequenceSteps', sequence_enrollments: 'sequenceEnrollments', sequence_events: 'sequenceEvents' }`.

- [ ] **Step 11.2: Write the failing drift test (for the new shared location)**

**Verified paths (2026-04-08):** `SqliteStorageAdapter` lives at `packages/core/src/adapters/sqlite/adapter.ts` — there is NO `index.ts` in that directory. Core tests are generally co-located next to source rather than in a `__tests__/` subdirectory. Place the test at `packages/core/src/public-entity-map.test.ts` and use that path consistently throughout this task.

**Design note:** The drift test avoids instantiating `createCoreServices(adapter)` at runtime because doing so can trigger repo-factory side effects against the in-memory stub. Instead, use TypeScript's type system to verify that every mapped service key is a valid `keyof CoreServices` — this is a compile-time check that fails the build if the map drifts. The runtime portion only checks map↔array cardinality.

Create `packages/core/src/public-entity-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  PUBLIC_ENTITY_SERVICE_MAP,
  resolvePublicEntityServiceKey,
  PUBLIC_ENTITIES_WITH_UNDERSCORE,
} from './public-entity-map.js'
import type { CoreServices } from './index.js'

describe('PUBLIC_ENTITY_SERVICE_MAP', () => {
  it('every snake_case public entity in the allowlist array has a map entry', () => {
    for (const entity of PUBLIC_ENTITIES_WITH_UNDERSCORE) {
      expect(PUBLIC_ENTITY_SERVICE_MAP).toHaveProperty(entity)
      const resolved = PUBLIC_ENTITY_SERVICE_MAP[entity]
      expect(typeof resolved).toBe('string')
      expect(resolved.length).toBeGreaterThan(0)
    }
  })

  it('every map entry is also in the allowlist array (bidirectional drift check)', () => {
    // Without this, someone could add a new key to the map without adding it
    // to PUBLIC_ENTITIES_WITH_UNDERSCORE, and the drift test above would miss
    // it because it only iterates the array.
    expect(Object.keys(PUBLIC_ENTITY_SERVICE_MAP).length).toBe(PUBLIC_ENTITIES_WITH_UNDERSCORE.length)
    for (const key of Object.keys(PUBLIC_ENTITY_SERVICE_MAP)) {
      expect(PUBLIC_ENTITIES_WITH_UNDERSCORE).toContain(key)
    }
  })

  it('resolvePublicEntityServiceKey returns the entity name itself for non-underscored entities', () => {
    expect(resolvePublicEntityServiceKey('contacts')).toBe('contacts')
    expect(resolvePublicEntityServiceKey('deals')).toBe('deals')
  })

  it('resolvePublicEntityServiceKey returns the camelCase service key for underscored entities', () => {
    expect(resolvePublicEntityServiceKey('sequence_steps')).toBe('sequenceSteps')
    expect(resolvePublicEntityServiceKey('sequence_enrollments')).toBe('sequenceEnrollments')
    expect(resolvePublicEntityServiceKey('sequence_events')).toBe('sequenceEvents')
  })

  it('every mapped service key is a declared key on the CoreServices type (compile-time drift check)', () => {
    // Compile-time assertion: if PUBLIC_ENTITY_SERVICE_MAP points at a value
    // that is NOT a valid `keyof CoreServices`, THIS FILE FAILS TO COMPILE.
    // The runtime assertion is trivially true — the real value is the
    // TypeScript type-check on the assignment itself.
    const _typeCheck: Record<string, keyof CoreServices> = PUBLIC_ENTITY_SERVICE_MAP
    expect(_typeCheck).toBe(PUBLIC_ENTITY_SERVICE_MAP)
  })
})
```

If `CoreServices` is not exported from `packages/core/src/index.ts` as a named type (check with `grep -n "CoreServices" packages/core/src/index.ts`), import it from wherever it IS exported — likely `./services/index.js` — and adjust the import path accordingly.

- [ ] **Step 11.3: Run the test to verify it fails**

Run:
```bash
pnpm --filter @orbit-ai/core test -- public-entity-map
```
Expected: **FAIL** — the module doesn't exist yet.

- [ ] **Step 11.4: Create the shared module**

Create `packages/core/src/public-entity-map.ts`:

```typescript
/**
 * Mapping from snake_case public entity names (as they appear in REST paths
 * and SDK resource names) to the camelCase service keys on `CoreServices`.
 *
 * This is the single source of truth — both `@orbit-ai/api` (HTTP route
 * registration) and `@orbit-ai/sdk` (DirectTransport dispatch) must import
 * from here, not maintain their own copies. See
 * `public-entity-map.test.ts` for the drift-prevention test.
 */
export const PUBLIC_ENTITY_SERVICE_MAP: Readonly<Record<string, string>> = Object.freeze({
  sequence_steps: 'sequenceSteps',
  sequence_enrollments: 'sequenceEnrollments',
  sequence_events: 'sequenceEvents',
})

/**
 * The list of public entities whose REST path contains an underscore and
 * therefore needs a map entry to resolve to the camelCase service key.
 * Non-underscored entities (contacts, deals, companies, etc.) resolve 1:1
 * to the same name on `CoreServices`.
 *
 * Keep this list in sync with `PUBLIC_ENTITY_SERVICE_MAP`. The drift test in
 * `public-entity-map.test.ts` enforces that every entry in this array has
 * a corresponding value in the map.
 */
export const PUBLIC_ENTITIES_WITH_UNDERSCORE = [
  'sequence_steps',
  'sequence_enrollments',
  'sequence_events',
] as const

export type PublicEntityWithUnderscore = (typeof PUBLIC_ENTITIES_WITH_UNDERSCORE)[number]

/**
 * Resolve a public entity name (snake_case, as in REST paths) to the key on
 * `CoreServices` where that service is registered. Handles both underscored
 * and non-underscored entities.
 */
export function resolvePublicEntityServiceKey(entity: string): string {
  return PUBLIC_ENTITY_SERVICE_MAP[entity] ?? entity
}
```

- [ ] **Step 11.5: Export from core's barrel**

Edit `packages/core/src/index.ts`. Add:

```typescript
export {
  PUBLIC_ENTITY_SERVICE_MAP,
  PUBLIC_ENTITIES_WITH_UNDERSCORE,
  resolvePublicEntityServiceKey,
  type PublicEntityWithUnderscore,
} from './public-entity-map.js'
```

If the file uses `export * from './...'` barrel style, add a matching export line. Do NOT replace existing exports.

- [ ] **Step 11.6: Rebuild core**

Run:
```bash
pnpm --filter @orbit-ai/core build
```
Expected: clean build. The new file should be emitted to `packages/core/dist/`.

- [ ] **Step 11.7: Run the core drift test**

Run:
```bash
pnpm --filter @orbit-ai/core test -- public-entity-map
```
Expected: **PASS** — all 4 new tests green.

- [ ] **Step 11.8: Update `packages/api/src/routes/entities.ts` to import from core**

Edit the top of the file. Replace:

```typescript
import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { toEnvelope, toError, sanitizePublicRead, sanitizePublicPage } from '../responses.js'
import { requireScope } from '../scopes.js'
```

with:

```typescript
import type { Hono } from 'hono'
import type { CoreServices } from '@orbit-ai/core'
import { resolvePublicEntityServiceKey } from '@orbit-ai/core'
import { toEnvelope, toError, sanitizePublicRead, sanitizePublicPage } from '../responses.js'
import { requireScope } from '../scopes.js'
```

Then find the local `ENTITY_SERVICE_MAP` declaration and the `resolveService` function (around lines 30-39). Replace:

```typescript
const ENTITY_SERVICE_MAP: Record<string, string> = {
  sequence_steps: 'sequenceSteps',
  sequence_enrollments: 'sequenceEnrollments',
  sequence_events: 'sequenceEvents',
}

function resolveService(services: CoreServices, entity: PublicEntityName) {
  const serviceKey = ENTITY_SERVICE_MAP[entity] ?? entity
  return services[serviceKey as keyof CoreServices] as any
}
```

with:

```typescript
function resolveService(services: CoreServices, entity: PublicEntityName) {
  const serviceKey = resolvePublicEntityServiceKey(entity)
  return services[serviceKey as keyof CoreServices] as any
}
```

- [ ] **Step 11.9: Update `packages/sdk/src/transport/direct-transport.ts` to import from core**

Open the file and find the local `ENTITY_SERVICE_MAP` constant (added in PR 1, around lines 11-15). Delete the local map.

Update the import at the top to pull `resolvePublicEntityServiceKey` from core:

```typescript
import { createCoreServices, resolvePublicEntityServiceKey, type OrbitEnvelope, type OrbitAuthContext } from '@orbit-ai/core'
```

In the `dispatch()` method, find the place where the map is used to resolve entity → service key (grep for `ENTITY_SERVICE_MAP` or `serviceKey`). Replace the lookup with `resolvePublicEntityServiceKey(entity)`.

If you can't find the use site because PR 1's implementation differs from what this plan assumes, run:

```bash
grep -n "ENTITY_SERVICE_MAP\|resolveServiceKey" packages/sdk/src/transport/direct-transport.ts
```

and read the lines around the hits to understand the structure, then apply the equivalent change.

- [ ] **Step 11.10: Rebuild core and run everything**

Run:
```bash
pnpm --filter @orbit-ai/core build
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```
Expected: all green. No test count regression; new core drift test adds +4. Expected total: PR 0 post-fix count + PR 1 delta + 4 (new core tests).

- [ ] **Step 11.11: Commit**

```bash
git add packages/core/src/public-entity-map.ts packages/core/src/public-entity-map.test.ts packages/core/src/index.ts packages/api/src/routes/entities.ts packages/sdk/src/transport/direct-transport.ts
git commit -m "$(cat <<'EOF'
refactor(core,api,sdk): extract ENTITY_SERVICE_MAP to @orbit-ai/core

PR 1 introduced a duplicated ENTITY_SERVICE_MAP in api/routes/entities.ts
and sdk/transport/direct-transport.ts. Both must stay in lockstep when
new snake_case entities land — a drift hazard. Extract the map and
resolvePublicEntityServiceKey helper to @orbit-ai/core and import from
both packages. Adds a drift-prevention test in core so a new
underscored entity (or a service rename) fails the core test suite
instead of failing at runtime with "Unknown entity: X".

Identified by PR 1 code review on 2026-04-08.
EOF
)"
```

---

## Task 12: Full verification + force-push PR 1

**Goal:** Prove PR 1 is green after the rebase + extraction, then push.

- [ ] **Step 12.1: Full verification**

Run:
```bash
pnpm install --frozen-lockfile
pnpm --filter @orbit-ai/core build
pnpm -r typecheck
pnpm -r lint
pnpm -r test 2>&1 | tail -40
```
Expected: all green. Record exact counts.

- [ ] **Step 12.2: Check git state**

Run:
```bash
git log --oneline pr-0-api-sdk-foundation..pr-1-phase-0-1-fixes
```
Expected: 6 commits — the 5 original PR 1 commits (rebased, new SHAs) + the 1 new refactor commit.

- [ ] **Step 12.3: Push**

Run:
```bash
git push --force-with-lease origin pr-1-phase-0-1-fixes
```
Expected: succeeds.

- [ ] **Step 12.4: Comment on PR #18 with new counts**

Run:
```bash
gh pr comment 18 --body "Fix pass A applied (rebase + 1 new commit). New baseline: core X, sdk Y, api Z = total N passing (2 skipped). Typecheck + lint clean. See docs/superpowers/plans/2026-04-08-phase-0-1-fix-pass.md."
```

---

## Done — next steps are orchestration, not implementation

After Task 12 completes, the main session (Opus) handles:

1. Fresh independent code review agent on the fix commits (use `pr-review-toolkit:code-reviewer`, NOT `feature-dev:code-reviewer`).
2. Fresh independent security review agent on the fix commits.
3. If post-fix reviews come back clean → dispatch PR 2 of the stack (`pr-2-tx-scope-hinge`).
4. If post-fix reviews find new issues → loop back to a new fix plan.

Do NOT proceed to PR 2 without the post-fix reviews.

## Self-review checklist

- [x] Every task has explicit file paths
- [x] Every code step shows the actual code
- [x] Every failing test is shown before the fix
- [x] Expected command output documented at each step
- [x] Commit messages provided for every commit
- [x] No placeholders (`TBD`, "similar to above", "add error handling")
- [x] Type names consistent across tasks (`resolvePublicEntityServiceKey`, `PUBLIC_ENTITY_SERVICE_MAP`)
- [x] Rebase conflict resolution strategy documented (Task 10)
- [x] No force-push except the single `--force-with-lease` on PR 1 after rebase (Task 10, 12)
- [x] Covers all 9 review findings tagged for Pass A
