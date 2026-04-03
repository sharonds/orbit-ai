# Wave Gate 1 Review — Auth/Envelope Contract

**Date:** 2026-04-03
**Branch:** `api-sdk-execution`
**Scope:** Tasks 1-4 (packages/api/src/)
**Decision:** ACCEPTED (after remediation)

## Reviewers

| Reviewer | Focus | Agent |
|----------|-------|-------|
| Code + Security Review | Middleware ordering, export hygiene, auth security | superpowers:code-reviewer |
| Tenant Safety Review | Tenant isolation, bootstrap bypass, orgId flow | Explore (very thorough) |

## Findings

### Critical (1 — remediated)

1. **Client-supplied X-Request-Id not validated** — Arbitrary strings could inject into logs, response headers, and JSON envelopes. **Fix:** Added `VALID_REQUEST_ID = /^[\w-]{1,128}$/` validation; invalid IDs are replaced with generated ones.

### Important (1 — remediated)

2. **Error handler omitted `doc_url`** — `orbitErrorHandler` did not include `doc_url` in error envelopes, causing inconsistency with `toError()` helper. **Fix:** Added `doc_url` field to error handler output.

### Tenant Safety

All 6 focus areas passed:
- Tenant-context middleware correctly wraps all non-bootstrap paths
- Bootstrap bypass limited to `/v1/bootstrap/` prefix only
- Auth context correctly flows `orgId` from `lookupApiKeyForAuth`
- No tenant isolation bypass paths found
- Error handler does not leak tenant information
- Fail-closed behavior correct (rejects missing orgId on non-bootstrap paths)

## Verification

- 82/82 tests pass
- Typecheck clean
- Build clean

## Remediation Commits

- Request ID validation + doc_url fix applied in remediation commit
