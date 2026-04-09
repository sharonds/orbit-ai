# Post-Stack Audit — api-sdk-execution Split

**Date**: 2026-04-08
**Audit target**: `pr-4-cleanups-and-docs` HEAD `3973449` (the state that would merge if all 5 stacked PRs landed today)
**Baseline**: 772 passing tests (2 skipped), typecheck + lint clean across all 3 packages
**Stack**: #17 PR 0 → #18 PR 1 → #19 PR 2 → #20 PR 3 → #21 PR 4
**Auditors**: 9 parallel review sub-agents + 1 integration reality check run locally

## TL;DR verdict

**Readiness: ALPHA. Not ready for public launch. Not ready for npm publish. Not ready for a quickstart.**

The stack is internally coherent — 772 tests pass, the core happy paths work end-to-end (verified by a real consumer script), no critical security vulnerabilities are exploitable today, no silent-failure patterns leak errors. The 9-lens audit found **zero showstoppers** that would require rewriting work already done.

However, there are **15 issues** (5 HIGH, 6 MEDIUM, 4 LOW) that must be resolved before this SDK can responsibly ship to real users who don't work on it. Most of them are not about the code that landed in the stack — they're about **what's missing** around the code: documentation, DX affordances, scale hardening, and open-source polish.

### Readiness matrix

| Audience | Ready? | Why / why not |
|---|---|---|
| **Internal alpha** (the Orbit AI team + direct collaborators) | ✅ YES | Tests pass, happy paths verified, security chain is sound |
| **Closed beta** (a small set of design-partner users, supervised) | 🟡 with known-issues doc | Requires the 5 HIGH DX items fixed + a real quickstart |
| **Public beta** (published npm, open GitHub issues) | ❌ NO | Requires all 5 HIGH + 4 of 6 MEDIUM + all OSS readiness blockers |
| **1.0 GA** | ❌ NO | Requires all above + test coverage deepening + scale hardening + Phase 3 work |

### What to do this week vs later

**Before merging this stack to `main`:**
- Fix the 3 HIGH sanitization/validation gaps (Lens 2 + Lens 3)
- Fix the 5 HIGH DX bugs (Lens 10)
- Land the 6 OSS readiness blockers (Lens 7)

**Before public npm publish:**
- Address the 6 MEDIUM security/scale items
- Add type-level tests
- Deepen route test coverage (Lens 4 top-5 list)

**Phase 3 scope (separate tracking):**
- Registry-driven OpenAPI generator (unchanged from original plan)
- DirectTransport shared-validation refactor (deferred from Fix Pass A)
- Persistent idempotency + rate-limit stores (use the existing unused `idempotency_keys` table)
- Custom fields generic on entity types
- SHA-256 → HMAC-SHA256 with pepper for API keys

---

## Critical blockers, consolidated

### 🔴 HIGH (5) — must fix before any external use

**H-SEC-1 — Sanitization gaps on `organizations.ts`, `workflows.ts`, `objects.ts`** (Lens 2, architecture)
Fix Pass A added allowlist sanitizers for the bootstrap path, but three other route files still return raw service output through `toEnvelope(c, result)` without stripping internal fields. If the repository ever stores a field inside the organization metadata or adds an internal column, it leaks on these routes. The `scrubInternalMetadataKeys()` seam added in `c777dae` is only reachable from bootstrap.
**Fix**: Apply `sanitizeOrganizationRead` in `organizations.ts:15,27`. Audit every `toEnvelope(c, result)` in `workflows.ts` (9 sites) and `objects.ts` (9 sites) and wrap in a typed sanitizer or `sanitizePublicRead`.

**H-SEC-2 — No HTTP request body size limit anywhere** (Lens 3, security)
Hono has no default cap; `create-api.ts` registers no `bodyLimit` middleware. A caller can POST a 1GB JSON body to any `/v1/*` route and the process will buffer and parse it in memory before any Zod validation runs. The idempotency middleware even hashes the entire body before validation. Trivial DoS.
**Fix**: Add `app.use('/v1/*', bodyLimit({ maxSize: 1_024 * 1_024 }))` from `hono/body-limit` before the auth middleware. Make the limit configurable via `CreateApiOptions`.

**H-DX-1 — `SqliteStorageAdapter.migrate()` is a silent no-op** (Lens 10, integration reality check)
`SqliteStorageAdapterConfig.migrate` is optional with a default of `async () => undefined`. First-time consumer calls `adapter.migrate()`, gets no error, then every query fails with `no such table: contacts` returned as 500 INTERNAL_ERROR. Real path requires manually calling `initializeSqliteWave1Schema` + 5 slice init functions in order, which is undocumented outside test files.
**Fix**: Ship a `initializeAllSqliteSchemas(db)` helper in core. Either make `migrate` non-optional or have the default actually run that helper. Document the schema-init requirement in the README and the adapter JSDoc.

**H-DX-2 — `list()` returns `AutoPager` synchronously, not a Promise** (Lens 10 + Lens 5)
`get()`, `create()`, `update()`, `delete()` all return `Promise<TRecord>`. `list()` returns `AutoPager<TRecord>` — an async iterator builder that hasn't made any HTTP call yet. A consumer writing `await client.contacts.list({ limit: 5 })` gets an AutoPager (not a Promise; `await` passes through), then reads `.data` and gets `undefined`. TypeScript can't catch this — `AutoPager<TRecord>` is a valid return type, it just has no `.data` property.
**Fix**: Either (a) rename `list()` to `paginate()` or `pages()` so consumers aren't surprised, or (b) make `list()` return `Promise<OrbitEnvelope<TRecord[]>>` for the first page by default and expose `.autoPaginate()` on the envelope. Option (b) is the more consumer-friendly default and matches how Stripe/Resend SDKs work.

**H-DX-3 — POST with invalid body returns 500 `INTERNAL_ERROR` instead of 400 `VALIDATION_FAILED`** (Lens 10)
The error handler has branches for `OrbitError` and `SyntaxError` (JSON parse failure) but NOT for `ZodError`. Route Zod schemas throw `ZodError` when validation fails, which falls through to the generic 500 path. Every first-time consumer POSTing an empty body `{}` to try the API gets a 500 server error instead of a helpful 400 with field-level hints.
**Fix**: Add a `ZodError` branch to `orbitErrorHandler` in `packages/api/src/middleware/error-handler.ts` that maps to 400 `VALIDATION_FAILED` with `hint` populated from `err.issues`. This is a ~20-line fix and unblocks the quickstart experience.

### 🟠 MEDIUM (6) — should fix before public launch

**M-SEC-1 — Schema migration preview/apply accepts raw body without Zod** (Lens 3)
`objects.ts:76,86` pass `await c.req.json()` straight to `schema.preview` / `schema.apply`. No `MigrationDescriptorSchema`. Deep defense missing.
**Fix**: Define Zod schemas for migration operations and validate before passing to the service.

**M-SEC-2 — Cursor payload has no orgId binding** (Lens 3)
Cursors encode `{version, id, sort, values}` with no tenant identifier. Protection is implicit via the repository's `orgId` pre-filter. If any future repository skips `listScopedRows` and uses cursor IDs directly, cross-tenant leakage is silent.
**Fix**: Embed `orgId` in the cursor payload and verify on decode. Defense-in-depth.

**M-SEC-3 — Rate limiter O(n) eviction scan** (Lens 3 + Lens 9)
`rate-limit.ts:41-49` iterates all 10k buckets to find the oldest when a new key arrives at capacity. Attacker rotating through 10,001+ unique API key IDs triggers a full scan on every request.
**Fix**: Use insertion-order eviction (same pattern as `idempotency.ts` does correctly).

**M-SCALE-1 — Idempotency + rate limit are in-memory module-scope** (Lens 9)
The `idempotency_keys` DB table exists (`packages/core/src/schema/tables.ts:454`) with a unique index, fully ready to be wired up, but the middleware uses a module-scope `Map`. On Vercel/CF/multi-pod, every instance has its own store → rate limiting and idempotency silently disabled. Zero docs warn about this. The `cloudflare.ts` export makes the problem worse because Workers isolates have zero shared memory.
**Fix**: Wire `idempotency_keys` through the adapter as a persistent store with a fallback Map for single-instance dev. Document the multi-instance deployment constraint explicitly. This was already in Phase 3 as T12 — it needs to land before public beta, not after.

**M-SCALE-2 — Merged search can pull 30,000 rows into memory** (Lens 9)
`search-service.ts:165` does `Promise.all([fetchAllPages × 6])` when `object_types` is unset, fanning out to 6 entity types at up to `MAX_SEARCH_ROWS_PER_TYPE = 5000` rows each. The code comment itself flags this as "OOM-prone pending registry-driven rewrite." The response is capped but the upstream fetch fan-out is not.
**Fix**: Either require `object_types` for merged search (breaking change, safer) or land the registry-driven rewrite from Phase 3 T10 before public launch.

**M-SCALE-3 — Contact context does 100-way parallel tag lookup** (Lens 9)
`contact-context.ts:114` does `Promise.all(entityTagResults.data.map(et => deps.tags.get(ctx, et.tagId)))`. Max 100 parallel DB queries per `/v1/context` call. Under load this is a connection storm, especially against the default `pg` pool of 10.
**Fix**: Add `tags.listByIds(ctx, ids)` batch method and replace the fan-out.

### 🟡 LOW (4) — nice to have, track as issues

- **L-ARCH-1**: DirectTransport `wrapEnvelope` omits `links.next` (divergence from `responses.ts`) — consumers using cursor pagination via `response.links.next` silently fail under DirectTransport
- **L-DX-1**: `OrbitApiError` wraps code under `.error.code` not `.code` — `err.code === 'RATE_LIMITED'` silently compiles and always returns false
- **L-DX-2**: `OrbitErrorCode` is defined in core but NOT re-exported from the sdk barrel — consumers need imports from two packages to narrow errors
- **L-TYPE-1**: 41 `as any` casts total (plan said ~35; +6 drift). Zero consumer-facing. All concentrated in workflows.ts (8), webhooks.ts (7), relationships.ts (10) — type-unsafe service dispatch that won't catch refactors

### 🔵 Open-source blockers (Lens 7)

These are not code bugs — they're missing files and metadata that prevent publishing:

- **OSS-1**: All 3 packages marked `private: true` → cannot `pnpm publish`
- **OSS-2**: README references `packages/mcp/`, `packages/cli/`, `apps/docs/`, `examples/nextjs-crm/`, `examples/agent-workflow/` — **none of these exist**. A first-time contributor cloning the repo will hit broken paths within 30 seconds.
- **OSS-3**: README install command says `npm install @orbit-ai/sdk` and `orbit init --db supabase` — SDK is unpublished, CLI doesn't exist
- **OSS-4**: No `.env.example`, no environment variable documentation
- **OSS-5**: No `CONTRIBUTING.md` (README explicitly promises it "when public alpha")
- **OSS-6**: No `.github/workflows/` — no CI, no automated checks
- **OSS-7**: Sparse `package.json` metadata across all 3 packages (missing `description`, `keywords`, `author`, `repository`, `homepage`, `bugs`, `engines`)
- **OSS-8**: No `files` field in any package — `pnpm pack` would ship `src/`, tests, everything
- **OSS-9**: No `SECURITY.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`
- **OSS-10**: `zod` version mismatch: core uses `^4.1.11`, api uses `^3.23.0`

---

## Per-lens findings summary

### Lens 1 — Fix Pass A follow-ups (code review) → **CLEAN**

Both new commits from Fix Pass A (`c777dae` scrub seam, `3973449` combined integration test) are clean. One minor nit: `scrubInternalMetadataKeys`'s return type `Record<string, unknown> | unknown` degenerates to `unknown` (since `unknown` is the top type). Harmless cosmetic issue. Test is well-placed inside the correct describe block, middleware ordering matches production, assertions are meaningful.

### Lens 2 — Architecture holistic → **MINOR-ISSUES**

**Strengths:**
- Zero cross-imports between `@orbit-ai/api` and `@orbit-ai/sdk` (verified by grep). Clean layering.
- Middleware chain order is correct: `requestId → version → auth → tenantContext → rateLimit → idempotency`.
- `StorageAdapter` interface is genuinely swappable. `createCoreServices` only takes the interface.
- `TransactionScope.run(ctx, fn)` is a real architectural guardrail, not just convention.

**Concerns:**
- **HIGH**: Sanitization gaps (see H-SEC-1 above)
- **MEDIUM**: DirectTransport reinvents HTTP routing + envelope wrapping. `wrapEnvelope` doesn't populate `links.next`. Doesn't support workflow/relationship/webhook/import/bootstrap/admin routes — only generic CRUD + `/search` + `/context/:id` + `/batch`.
- **MEDIUM**: core/dist is the typecheck surface. No explicit turbo `dependsOn: ["^build"]` for typecheck; stale-dist drift risk.
- **LOW**: 36 `as any` concentrated in workflow/webhook/relationship routes.

**DirectTransport parity story (honest):** DirectTransport is NOT at parity with HttpTransport. It should be marked `@internal` or test-only in the SDK's public exports until the route coverage and envelope drift are fixed. HttpTransport is the only safe path for real external consumers today. The README should say this.

### Lens 3 — Security threat model → **SECURE-FOR-PUBLIC-ALPHA**

**Zero critical findings.** Multi-tenant isolation, auth chain ordering, scope enforcement (100% coverage on registered routes), secret handling, and webhook SSRF static checks are all sound.

**High findings (2):** body size limit missing (H-SEC-2), migration preview body not Zod-validated (M-SEC-1 above).

**Medium findings (4):** cursor orgId binding (M-SEC-2), DNS rebinding mitigation (acknowledged in code but delivery worker unimplemented), rate limiter O(n) eviction (M-SEC-3), in-memory stores on multi-instance (M-SCALE-1).

**Positive observations:** SHA-256 hashing of bearer tokens, plaintext key never persisted (schema confirms only `keyHash` column), webhook SSRF deny-list covers 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, `::1`, link-local IPv6, unique-local `fc00::/7`, IPv4-mapped IPv6 both dotted and hex, GCP metadata. `api_keys` correctly absent from `PUBLIC_ENTITY_CAPABILITIES`. Cursor cross-tenant tampering is safe via repository pre-filter (defensive but implicit).

**Unknown unknowns:** DNS rebinding at delivery time (static analysis can't verify), Postgres RLS policy correctness (policies not in repo), SHA-256 collision resistance under GPU preimage attack (recommend HMAC-SHA256 with server-side pepper for 1.0), idempotency race window under sub-microtask concurrency, `unsafeRawDatabase` exposure (named `unsafe` but publicly accessible — a DirectTransport consumer could bypass tenant context entirely).

### Lens 4 — Test coverage quality → **SHALLOW**

**Breadth is OK (routes, middleware, idempotency, rate-limit all touched). Depth is thin.**

**Vacuous tests** (assertion that can't fail):
- `transport-parity.test.ts:404` — asserts hardcoded value exists
- `direct-transport.test.ts:124,131,138` — `toBeDefined()` on typed envelope
- `resources-wave1.test.ts:180` — `toBeDefined()` on synchronous constructor return
- `create-api.test.ts:43-45` — tests the stub, not the behavior under test
- `routes-wave2.test.ts:189-201` — looped tests with no body/arg assertions

**Mock-the-thing-under-test:** Every route test in the api package uses `mockWave2CoreServices()` which replaces every service method with `vi.fn()`. **Not one route test calls `toHaveBeenCalledWith`** to verify arguments. You could swap service calls for no-ops and many tests still pass.

**Critical coverage gaps** (zero tests):
- `POST /v1/sequence_enrollments/:id/unenroll`
- `POST /v1/tags/:id/detach`
- `PATCH/DELETE /v1/objects/:type/fields/:fieldName` (non-stub paths)
- `POST /v1/schema/migrations/:id/rollback`
- `PATCH /v1/organizations/current` (non-stub path)
- `createApi` end-to-end with any real request flow

**Failure-path coverage:** No route test triggers "service throws unhandled Error" to verify the 500 envelope. No test covers `withTenantContext` throwing mid-request.

**Integration test assessment:** There is ONE partial integration test (`routes-wave1.test.ts:112`, auth 401 path). No test boots `createApi()` with a real adapter, sends a valid authed request, and verifies the full envelope shape.

**Transport parity honest verdict:** Not proven. HTTP transport tests mock `fetch`; the "parity" compares a handcrafted `makeEnvelope()` against DirectTransport's real output. You're comparing "the mock I wrote" against "the real DirectTransport" and concluding they match — they match because you made the mock match the type.

**Zero type-level tests** (no `tsd`, no `expect-type`, no `@ts-expect-error`). Type regressions land silently.

### Lens 5 — SDK consumer DX simulation → **ROUGH-BUT-SHIPPABLE**

**What works:**
- Resource shape is consistent: every entity has `create/get/update/delete/list/search/batch`
- Entity types are exported (`ContactRecord`, `CreateContactInput`, `UpdateContactInput` × all resources)
- `OrbitErrorCode` is a tight discriminated union (21 literal codes); narrowing works
- `OrbitClient` constructor validates mutually exclusive modes with a clear error message

**What hurts:**
- **Footgun**: error access is `err.error.code`, not `err.code`. `err.code === 'RATE_LIMITED'` silently compiles (because `Error` has no `.code`), returns `false` at runtime. Biggest DX hazard.
- `OrbitErrorCode` is NOT exported from the sdk — consumers need imports from two packages
- Resource classes (`ContactResource`, `BaseResource`, etc.) are exported unnecessarily — noise in autocomplete
- No default headers / interceptor API — can't attach trace IDs
- `search()` / `batch()` take `Record<string, unknown>` — zero IDE help composing queries
- No `AbortSignal` support on `TransportRequest` — can't cancel in-flight requests
- `context()` returns `Record<string, unknown>` — the most valuable AI-agent endpoint has no type
- No `packages/sdk/README.md` — zero usage docs shipped with the package

**Pre-1.0 DX gaps ranked:**
1. Fix the `.error.code` footgun
2. Re-export `OrbitErrorCode` from sdk index
3. Write `packages/sdk/README.md` with real 30-line quickstart
4. Remove resource class exports
5. Add `signal?: AbortSignal` to transport request
6. Default headers / interceptor API
7. Type `search()` input per resource
8. Type `context()` return

### Lens 6 — Silent failure sweep → **CLEAN**

**No new findings in PR 2/3/4 code.** Every PR 3 service catch (`pipelines`, `payments`, `sequences`, `sequence-steps`, `sequence-enrollments`, `tags`) uses a typed `coerceXConflict(error, ...): never` helper that always throws a typed `OrbitError` or rethrows the original. Correct pattern, consistent across the board.

**Two pre-existing MEDIUM/LOW items** (not new, not blockers):
- `fromPostgresJson` / `fromSqliteJson` silent-fallback on JSON parse failure (low impact, could be traced by logging)
- Transaction rollback can mask original error if the rollback itself throws (theoretical, rare)

Neither is a regression introduced by this stack. Safe to merge from this lens.

### Lens 7 — Open source readiness → **NOT-READY-MANY-GAPS**

See blockers list above (OSS-1 through OSS-10). Summary:
- 6 must-fix blockers (private packages, lying README, missing CONTRIBUTING, no CI, no .env.example)
- 5 should-fix items (metadata, files field, SECURITY.md, CHANGELOG, version mismatch)
- 4 nice-to-have items (templates, Dependabot, governance, examples)

**Positives:** LICENSE present and valid MIT, `.gitignore` correct, no committed secrets, README narrative is crisp ("Resend for CRM" positioning), turbo + pnpm-workspace tooling solid, `AGENTS.MD` thoughtful for LLM contributors, `exports` maps correctly shaped for pure ESM.

### Lens 8 — Type design → **ADEQUATE**

**41 total `as any` / `as unknown as` casts** (plan said ~35 — drift of +6):
- `@orbit-ai/sdk`: **2** (internal, not consumer-facing)
- `@orbit-ai/api`: **34** (workflows 8, webhooks 7, relationships 10, imports 3, others)
- `@orbit-ai/core`: **5** (JSON widening, sqlite bound-param spread)

**Consumer-facing casts: 0.** The SDK public surface is correctly typed. The 34 api-route casts are all internal service dispatch.

**Error type quality:** `OrbitErrorCode` is a discriminated literal union. Narrowing works. NOT re-exported from sdk → consumers reach into `@orbit-ai/core` for it. Small fix.

**Result type quality:** Strong at the entity level (`Promise<ContactRecord>`) but:
- Entity types are **hand-written** (no codegen from Drizzle schema) → drift risk as schema evolves
- `custom_fields: Record<string, unknown>` with no generic — the SDK's most important differentiator (flexible schemas) has no type story
- `search()` / `batch()` take untyped bags

**Zero type-level tests.** A resource method changing its return type from `Contact` to `Contact | null` would land silently.

**Top type recommendations for 1.0:**
1. Re-export `OrbitErrorCode` / `ORBIT_ERROR_CODES` from sdk
2. Encode `OrbitClientOptions` as discriminated union (no illegal states representable)
3. Add `expect-type` type-level tests on key SDK surfaces
4. Introduce `TCustomFields` generic on records
5. Generate entity types from Drizzle via `InferSelectModel<typeof contactsTable>` (or similar) to kill drift risk

### Lens 9 — Performance + scale red flags → **OK-FOR-SMALL-SCALE / WILL-BREAK-UNDER-LOAD**

**Critical red flags:**
1. **Idempotency + rate limit are in-memory module-scope** — the `idempotency_keys` DB table EXISTS but is unused! Multi-instance deployments silently have zero protection.
2. **Merged search pulls up to 30,000 rows into memory** per request when `object_types` is unset
3. **`POST /v1/<entity>/search` has no Zod body validation** — filter complexity unbounded
4. **Contact context fires 100-way parallel Promise.all** per `/v1/context` call against an unconfigured 10-connection Postgres pool

**Medium concerns:**
- SDK retry logic has no jitter and ignores `Retry-After` header
- `Postgres Pool` constructed with zero config (default max 10, no timeouts)
- No request body size limit (covered above)
- `pipelines/service.ts:58` hard-codes `limit: 100` on stage listing (orgs with >100 stages silently truncate)

**Documented limits (positive):**

| Limit | Value |
|---|---|
| `MAX_SEARCH_ROWS_PER_TYPE` | 5,000 |
| `MAX_LIST_LIMIT` | 100 |
| `DEFAULT_LIST_LIMIT` | 50 |
| `MAX_STORE_SIZE` (idempotency) | 10,000 |
| `TTL_MS` (idempotency) | 24h |
| `MAX_BUCKETS` (rate limit) | 10,000 |
| Rate limit default | 100 req/min |

**Deployment model assumption:** The codebase was built with a **single-process Node.js server** in mind. Evidence: module-scope Maps, unused DB tables for persistent state, `cloudflare.ts` export that silently malfunctions on Workers (no shared memory across isolates). The stack is not production-ready for multi-instance deployment today.

### Lens 10 — Integration reality check (run locally) → **MIXED**

**What works end-to-end** (verified by real consumer script against a fresh SQLite adapter):
- All 3 packages build clean
- `/health` 200
- GET /v1/contacts paginated list → POST create (returns real id) → GET list with the new row
- Pagination validation: `limit=abc` → 400 VALIDATION_FAILED; `limit=99999` → 400 VALIDATION_FAILED
- GET nonexistent contact → 404 RESOURCE_NOT_FOUND
- Task 1 (error-handler logging) confirmed firing with full structured context
- SDK HTTP `get()`, `create()` happy paths
- SDK HTTP `get(nonexistent)` throws `OrbitApiError` with discriminated `code`
- SDK `autoPaginate()` async iterator
- DirectTransport `firstPage()` and `create()` happy paths

**Consumer DX bugs (H-DX-1 through H-DX-5 in blockers above):**
1. `adapter.migrate()` silent no-op — requires manual wave init functions
2. `list()` returns AutoPager not Promise
3. POST `{}` returns 500 INTERNAL_ERROR (ZodError uncaught)
4. `ApiKeyAuthLookup` field names non-obvious (`revokedAt: Date | null`, not `revoked: boolean`)
5. No quickstart anywhere

---

## Lessons learned from the split process

The stack took two attempts to land because **memory's original 5-PR split had two dependency bugs**:

1. **First discovery** (mid PR 2 cherry-pick): `f3decb6` modifies `tx-bound-adapter.ts`, which is created by `75fe264` (T4a). The original plan put `f3decb6` in PR 2 and `75fe264` in PR 3, causing a modify/delete conflict. Fix: moved `f3decb6` from PR 2 to PR 3.

2. **Second discovery** (mid PR 3 cherry-pick): `f7f75fe` modifies `demoteOtherDefaults`, which is created by `7c34ef1` (L8). The original plan put L8 in PR 4 and `f7f75fe` in PR 3. Same modify/delete pattern. Fix: moved the entire L-batch from PR 4 to PR 3.

**Generalization**: when splitting a linear branch into stacked PRs, **thematic grouping breaks whenever later fixes depend on earlier cleanups in the opposite PR.** The safer rule is **"cherry-pick continuous chronological ranges, each PR is a time window on the source branch."** This is what the corrected PR 3 did (22 commits, T4a through the last Phase 2 gate, zero conflicts) and what PR 4 did (7 commits, post-gate through top). Once the boundaries were time-based instead of theme-based, both PRs applied cleanly.

**Future recommendation**: before writing a multi-PR split plan, do a per-commit dependency scan on the source branch. For each commit, check which files it modifies, then for each of those files find the creation commit. Any cross-PR dependency (e.g. modifier in PR N depends on creator in PR N+1) is a plan bug that must be fixed before cherry-picking starts. The plan should document chronological boundaries and validate that dependencies never flow backwards.

---

## What this audit did NOT cover

In the interest of honesty, here's what 10 static/local-integration lenses cannot verify:

1. **Real load testing** — no concurrent 1000-RPS hit to verify the idempotency/rate limit claims hold, or to catch race conditions
2. **Fuzz testing** — no AFL / libfuzzer / property-based testing on the Zod schemas, cursor codec, or Drizzle queries
3. **Live Postgres RLS policy correctness** — the RLS policies for tenant tables are not in this repo; I read the code that sets `app.current_org_id` but cannot verify the policies themselves work
4. **DNS rebinding at webhook delivery time** — acknowledged in code, delivery worker doesn't exist yet
5. **Supply chain publish-time trust** — `npm audit`, Sigstore verification, and recent-publish scan not run
6. **Production traffic patterns** — what breaks under real customer data (skewed distributions, large orgs, weird edge cases in search)
7. **Cross-browser / Edge runtime compatibility** — `cloudflare.ts` is exported but not tested against a real Workers environment
8. **Long-running process memory behavior** — the 24h TTL + 10k cap eviction works in a unit test but might not under weeks of real traffic
9. **Migration behavior on existing Postgres databases** — only in-memory SQLite was exercised
10. **Security scanning by external tools** — no Snyk/CodeQL/Trivy/Semgrep run

Any 1.0 launch should include at minimum items 1, 2, 3, and 10 before going public.

---

## Phase 3 priorities reordered based on audit

Original Phase 3 items (T10-T15 from memory), with audit-informed urgency:

| Item | Original priority | New urgency | Why |
|---|---|---|---|
| **T12** shared-store idempotency + rate limiting | Medium | **CRITICAL — before public beta** | The `idempotency_keys` table already exists; it's a ~1 day wire-up job that closes M-SCALE-1. Multi-instance deployment is a non-starter without this. |
| **T11** DirectTransport full parity with registered API routes | Medium | **HIGH — before public beta** | Current DirectTransport has silent holes (no workflow routes, no relationships, diverged envelope). Either fix or mark `@internal`. |
| **T10** Registry-driven OpenAPI rebuild | Low | **HIGH — before public 1.0** | Current OpenAPI is drifted from routes; consumers relying on it for code generation get wrong output. Also required for M-SCALE-2 fix. |
| **T13** SSRF hardening (delivery-time DNS rebinding) | Medium | **HIGH — before production webhooks** | The code itself documents this as a known gap in the delivery worker |
| **T14** Cross-transport black-box parity tests | Low | **MEDIUM — before public 1.0** | The Lens 4 audit flagged parity as currently unproven; the claim in docs is overstated |
| **T15** Resolution document finalization | Low | **LOW — housekeeping** | Can land alongside 1.0 release notes |

**New Phase 3 items surfaced by this audit:**
- **T16** (new): Custom fields `TCustomFields` generic on SDK record types
- **T17** (new): Entity type codegen from Drizzle schema to eliminate hand-written drift
- **T18** (new): Type-level tests (`expect-type` or `tsd`) on SDK public surface
- **T19** (new): Replace SHA-256 API key hashing with HMAC-SHA256 + server-side pepper
- **T20** (new): Introduce OSS readiness items (CI, CONTRIBUTING, SECURITY.md, examples dir, working quickstart)

---

## Final recommendation

**Merge the stack as-is** (after fixing the 5 HIGH blockers listed above). The stack is internally coherent, the 5-agent Fix Pass A review + this 9-agent post-stack audit converge on the same conclusion: **the code that landed is good quality for its scope**. The blockers are mostly about **what's missing around the code** (docs, DX affordances, type story completeness, scale hardening) rather than the code itself.

**Do not publish to npm yet.** The 10 OSS blockers + 5 HIGH DX issues mean a first-time consumer will have a bad experience. Fix them before ANY public announcement.

**Do not advertise this as production-ready.** The multi-instance scale gap + untested paths + shallow test coverage + unverified DNS rebinding all mean 1.0 is further out than the `0.0.0` version numbers suggest.

**The stack is ready for internal alpha testing today.** The happy paths work end-to-end. A team using this for their own product while the 20 items in this audit get addressed would be a reasonable use case.

---

**Audit signed off by:**
- 9 independent review sub-agents (code, architecture, security, test quality, SDK DX, silent-failure, OSS readiness, type design, performance)
- 1 local integration reality check with a real consumer script exercising both transports

**Stack HEADs at audit time:**
- `#17` pr-0-api-sdk-foundation `0b0833c`
- `#18` pr-1-phase-0-1-fixes `e8b4e85`
- `#19` pr-2-tx-scope-hinge `302f029`
- `#20` pr-3-tx-service-layer `39396d4`
- `#21` pr-4-cleanups-and-docs `3973449`

**Test baseline at audit time:** 772 passing, 2 skipped across core (317) + sdk (183) + api (272).
