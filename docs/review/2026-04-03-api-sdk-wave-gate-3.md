# Wave Gate 3 Review — Final Contract + Security

**Date:** 2026-04-03
**Branch:** `api-sdk-execution`
**Scope:** Full implementation (Tasks 1-13) + 10 remediation commits
**Decision:** ACCEPTED after 7 review rounds (including 6-agent end-to-end review)

## Verification (fresh, final)

- API: 207 tests pass, typecheck exit 0, build exit 0 (commit d0daab2)
- SDK: 164 tests pass, typecheck exit 0, build exit 0
- **Total: 371 tests, 0 failures**

## Review Rounds

| Round | Reviewers | Critical Findings | Status |
|-------|-----------|-------------------|--------|
| WG1 | Code+Security, Tenant Safety | 1 (request-id injection) | Fixed |
| WG2 | Code+Parity | 3 (error map, scope, sanitization) | Fixed |
| WG3 | Code+Security | 3 (idempotency body, SSRF, scope) | Fixed |
| Remediation #1 | Code+Security | 2 (IPv6 SSRF bypass, webhook scope) | Fixed |
| Remediation #2 | Code+Security | 1 (three-group ::ffff: bypass) | Fixed |
| **Final** | **Code+Security, Tenant Safety, Parity** | **Scope gaps in 7 route files, duplicate import routes** | **Fixed** |

## Final Review Findings (3 parallel agents)

### Code + Security Review: APPROVE
- No critical findings in remediation code
- SSRF validation correct (ipv4MappedToIPv4 bit arithmetic verified)
- Conservative ::ffff: deny fallback blocks unknown forms
- Scope enforcement on entities + webhooks verified correct
- Error code map 20/20 parity confirmed
- I-2 (scope gaps in other routes) — **fixed in 452f50d**
- I-3 (duplicate import routes) — **fixed in 8b2f0f4**

### Tenant Safety Review: PASS (all 4 checks)
1. **No caller-controlled org context**: PASS — all orgId from `c.get('orbit')` via API key lookup
2. **Runtime credentials only**: PASS — `RuntimeApiAdapter` type strips migrate/runWithMigrationAuthority
3. **Defense-in-depth on tables**: N/A — no new tables
4. **Secrets stay redacted**: PASS — webhook secrets (one-time), API keys, audit logs all sanitized

### Parity Review: PASS
- Error code map: 20/20 exact match between API and SDK
- SDK→API route mapping: all 19 resources map to valid routes
- Scope enforcement: all routes now covered (fixed)
- Import deduplication: fixed

## Scope Enforcement Coverage (final state)

| Route File | Scope | Status |
|-----------|-------|--------|
| entities.ts | `entity:read` / `entity:write` | Enforced |
| webhooks.ts | `webhooks:read` / `webhooks:write` | Enforced |
| admin.ts | `admin:*` | Enforced |
| bootstrap.ts | `platform:bootstrap` | Enforced |
| search.ts | `search:read` | Enforced |
| context.ts | `contacts:read` | Enforced |
| workflows.ts | `deals/sequences/tags/activities:read/write` | Enforced |
| relationships.ts | `contacts/companies/deals:read` | Enforced |
| organizations.ts | `organizations:read/write` | Enforced |
| objects.ts | `schema:read/write/apply` | Enforced |
| imports.ts | `imports:read/write` | Enforced |

## SSRF Protection Layers

1. HTTPS-only protocol check
2. Hostname deny-list (localhost, cloud metadata)
3. IPv4 dotted-decimal deny (RFC1918, loopback, link-local)
4. IPv4-mapped IPv6 hex conversion + re-check
5. Conservative deny-on-unknown `::ffff:` forms
6. IPv6 deny (::1, fe80:: link-local, fc00::/7 unique-local)
7. Documented: production delivery workers need DNS-resolution-based IP validation

## Known Limitations

1. Batch: not implemented in core (501)
2. Schema engine: stub only (501)
3. Bootstrap create: admin services lack create() (501)
4. Idempotency/rate-limit: in-memory only
5. DirectTransport: CRUD-only dispatch (workflow/relationship/schema paths throw)
6. DirectTransport: no webhook sanitization (medium — same-process SDK only)
7. SSRF: regex+conversion first layer; DNS-resolution needed for production
8. Wave 2 SDK resources: `any` generics (typed interfaces needed before GA)

## End-to-End Review (6 parallel agents)

| Agent | Focus | Critical | Important | Result |
|-------|-------|----------|-----------|--------|
| 1. Middleware | Auth, tenant, error handler, idempotency, rate-limit | 1 (body stream) | 3 (memory, HEAD/OPTIONS) | Fixed |
| 2. Route scopes | All 12 route files, every handler | 0 | 2 (status no scope, admin wildcard) | Fixed |
| 3. SSRF + sanitization | Deny-list, bit arithmetic, secret stripping | 0 | 3 (localhost variants, audit snake_case, apiKey spread) | Fixed |
| 4. SDK transports | Http/Direct transport, error parity | 2 (fromResponse crash, batch missing) | 2 (Bearer undefined, error msg) | Fixed |
| 5. SDK resources | All 21 resources, paths, types, AutoPager | 0 | 2 (any generics, meta guard) | Fixed |
| 6. Test coverage | All 19 test files, gap analysis | 0 | 4 (negative scope, auth edge, autoPaginate, rate reset) | Tracked |

### Deferred items (pre-alpha acceptable, documented):
- Idempotency body stream: Hono caches in Node.js; document Cloudflare/Edge risk
- Idempotency/rate-limit memory: in-memory MVP; production needs Redis
- Relationship routes check parent scope only (design decision)
- `/v1/status` has no scope (intentional — benign status endpoint)
- Test coverage gaps: negative scope tests, autoPaginate, network errors
- `toApiKeyRead` rest-spread pattern

## Commits (27)

Implementation (16):
1-16. See original commit list

Remediation (11):
17. `5867d45` — WG1: request-id validation + doc_url
18. `8285099` — WG2: error code map + withTenantContext
19. `33355f3` — WG3: scope enforcement (entities), SSRF, idempotency body
20. `ef56eef` — Remediation #1: webhook scopes, IPv6 SSRF patterns, SSRF tests
21. `07cfc95` — Remediation #2: ipv4MappedToIPv4 hex conversion, IPv6 deny patterns
22. `3549b28` — Remediation #3: conservative ::ffff: fallback, fc00::/7 consolidation
23. `452f50d` — Scope enforcement on ALL 7 remaining route files
24. `8b2f0f4` — Remove duplicate import routes from generic entity loop
25. `a1d87ed` — Updated review artifact
26. `d0daab2` — 6-agent review fixes: fromResponse, batch dispatch, localhost, audit snake_case, HEAD/OPTIONS, admin per-route scope, AutoPager guard
