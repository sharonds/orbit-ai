# Review Report: Integrations Implementation Plan

**Plan:** [`integrations-implementation-plan.md`](../execution/integrations-implementation-plan.md)
**Date:** 2026-04-10
**Review type:** Architecture + Code Patterns
**Status:** Issues found — address before execution

---

## Critical Issues (Will Cause Problems)

### 1. `sanitizeProviderError` regex will redact legitimate identifiers

**Location:** Slice 4 — `src/redaction.ts`
**Problem:** The proposed regex `/[A-Za-z0-9._-]{24,}/g` matches ANY alphanumeric string ≥24 characters. This will false-positive on:
- Organization ULIDs (`org_` + ~22 chars = 26+ chars)
- Gmail message IDs (16-digit hex strings)
- Thread IDs
- Contact/company ULIDs
- Any `integration_sync_state.cursor` value

**Fix:** Adopt the existing `redactSensitiveText` approach from `packages/mcp/src/errors.ts`, which targets specific secret patterns: `Bearer` tokens, `ya29.` Google tokens, `eyJ.` JWTs, and explicit `key=value` secret patterns.

### 2. `IntegrationError` creates a third parallel error system with no mapping

**Location:** Slice 2 — `src/errors.ts`; Slices 10/14/18/19/20/22
**Problem:** The codebase already has:
- `OrbitErrorCode` — 23 codes in `packages/core/src/types/errors.ts`
- `McpToolErrorCode` — 12 codes in `packages/mcp/src/errors.ts`

The plan introduces `IntegrationError` with codes like `AUTH_EXPIRED`, `AUTH_REVOKED` but defines **no mapping strategy** for how these errors flow through:
- MCP tool execution (must map to `McpToolError`)
- API route responses (must map to `OrbitError`)
- CLI output (must produce human-readable messages)

**Fix:** Define a bidirectional mapping table in `src/errors.ts`. At minimum: `toIntegrationError()` for inbound normalization and `fromIntegrationError()` for outbound conversion to the appropriate downstream error type.

### 3. Stripe replay-window check is redundant and ambiguous

**Location:** Slice 19 — `src/stripe/webhooks.ts`
**Problem:** The plan specifies "Replay-window enforcement: reject events older than configurable window (default 5 min)" AND uses Stripe's `constructEvent(payload, sig, secret)`. Stripe's `constructEvent` already validates the timestamp with a configurable `tolerance` parameter (default 300 seconds = 5 min). Adding a separate window check creates:
- Double validation with potentially different windows
- Ambiguity about which check is authoritative
- Confusion when debugging rejected events

**Fix:** Use Stripe's `constructEvent` tolerance parameter as the sole replay-window enforcement. Document this explicitly. Remove the separate timestamp check.

### 4. Date serialization in DTO mappers will produce `"[object Object]"`

**Location:** Slice 4 — `toIntegrationConnectionRead()`, `toIntegrationSyncStateRead()`
**Problem:** The plan uses `String(record.created_at ?? record.createdAt)`. Core schema columns are `timestamp('created_at', { withTimezone: true })`, which return `Date` objects from most adapters. `String(new Date())` produces a locale-dependent date string, but if the adapter returns a wrapped object, it produces `"[object Object]"`.

**Fix:** Use a dedicated ISO serialization helper (e.g., `record.created_at?.toISOString() ?? null`) consistently across both DTO mappers.

---

## Concerns (Need Clarification Before Execution)

### 5. Prerequisite dependency graph is underspecified

**Location:** Section 2 — Prerequisites A, B, C
**Problem:** The plan says "Each is a separate PR to main" but doesn't state ordering. Prerequisite A (SDK field parity) is a **hard compile dependency** for Slices 10/11/14/15/18 (all connector operations use `body`, `direction`, `metadata`). Prereqs B and C can be parallel.

**Fix:** Add explicit ordering: A must land first. B and C are parallel. All three must land before Phase 3 begins.

### 6. `credentialsEncrypted` column content is undefined

**Location:** Slice 3 — `integration_connections` table
**Problem:** The table has both `credentialsEncrypted` and `refreshTokenEncrypted` as separate columns. The plan maps `StoredCredentials.refreshToken` → `refreshTokenEncrypted` but never specifies what `credentialsEncrypted` contains. Is it a JSON blob of the full OAuth2 credential set? Does it duplicate `refreshTokenEncrypted`?

**Fix:** Explicitly define: `credentialsEncrypted` = encrypted JSON of `{ accessToken, refreshToken, expiresAt, providerAccountId, scopes }` OR remove this column and store each field in its own column (with `refreshTokenEncrypted` as the only encrypted column, since `accessToken` is ephemeral).

### 7. `StoredCredentials` type is underspecified

**Location:** Slice 4 — `src/credentials.ts`
**Problem:** The type is referenced throughout the plan but never fully defined. Implementers will guess at the shape.

**Fix:** Define explicitly:
```typescript
interface StoredCredentials {
  accessToken: string
  refreshToken: string
  expiresAt?: number  // epoch millis
  scopes?: string[]
  providerAccountId?: string
}
```

### 8. `IntegrationResult<T>` is undefined

**Location:** Slices 10, 14, 18 — connector operations
**Problem:** Referenced as the return type for all connector operations but never defined in `src/types.ts` (Slice 2).

**Fix:** Define in Slice 2:
```typescript
interface IntegrationResult<T> {
  data: T
  provider: string
  rawResponse?: unknown
}
```

### 9. `IdempotencyHelper` storage backend unspecified

**Location:** Slice 5 — `src/idempotency.ts`
**Problem:** The plan says "key generation + dedup check" but doesn't specify where dedup state lives. Core already has an `idempotency_keys` table (Wave 2). Building a separate dedup mechanism creates duplication.

**Fix:** Either reuse the core `idempotency_keys` table explicitly, or define a new table/collection and justify the duplication.

### 10. Stripe webhook dedup has no storage field

**Location:** Slice 19 — dedup enforcement
**Problem:** `integration_sync_state` has `stream` and `cursor` but no `processedEventIds` or equivalent field. There is nowhere to store the set of already-processed event IDs.

**Fix:** Add a `processedEventIds` column (`jsonb` or `text[]`) to `integration_sync_state` in Slice 3, OR use the core `idempotency_keys` table, OR create a dedicated `integration_processed_events` table.

### 11. Encryption key format not specified

**Location:** Slice 4 — `AesGcmEncryptionProvider`
**Problem:** `ORBIT_CREDENTIAL_KEY` env var — the plan doesn't specify:
- Expected format (hex, base64, raw UTF-8?)
- Required length (must be 256 bits / 32 bytes for AES-256)
- Validation behavior (should fail fast at startup if missing/invalid)

**Fix:** Document the expected format (recommend: 64-char hex string or 44-char base64). Add startup validation that throws if the key is absent or wrong length.

### 12. No key rotation strategy

**Location:** Slice 4 — encryption design
**Problem:** If `ORBIT_CREDENTIAL_KEY` is rotated, all existing encrypted credentials become permanently unreadable. The threat model (section 8.2) flags key rotation as "not yet frozen."

**Fix:** For MVP, document as a known limitation. Before production, adopt envelope encryption with a key version identifier prepended to the ciphertext so multiple keys can coexist.

### 13. Auth failure threshold and connection status downgrade undefined

**Location:** Slice 7 — `getValidAccessToken()`
**Problem:** The `integration_connections` table has a `failureCount` column and `status` field, but the plan never specifies:
- When `failureCount` is incremented
- What threshold triggers a status change
- What the status progression is (`active → error → disabled`?)
- Whether `failureCount` resets on success

**Fix:** Define in Slice 7: increment on each auth failure, reset to 0 on success, disable connection at N consecutive failures (recommend 5). Map to the threat model's requirement for "failure thresholds" and "controlled disablement on repeated auth failure."

### 14. Event bus pattern syntax unspecified

**Location:** Slice 21 — `OrbitIntegrationEventBus.subscribe(pattern, handler)`
**Problem:** The `pattern` parameter is a `string` but the plan doesn't define the matching semantics: exact match (`"contact.created"`), glob (`"contact.*"`), regex?

**Fix:** Define the pattern syntax explicitly. For MVP, exact string match is simplest. If wildcard support is needed, document the glob syntax.

### 15. `sanitizeIntegrationMetadata` key filter regex is too broad

**Location:** Slice 4 — `src/redaction.ts`
**Problem:** The regex `/(token|secret|signature|cursor|credential|auth|webhook)/i` will match keys that are not secrets:
- `authorized_at` (not a secret)
- `authorization_type` (not a secret)
- `auth_provider` (not a secret)

**Fix:** Match on exact key boundaries or known secret patterns only. Example: `/^(token|secret|signature|credential|password|private_key)$/i`.

### 16. Shared `contacts.ts` creates cross-slice dependency

**Location:** Slice 11 creates `src/shared/contacts.ts`; Slice 15 consumes it
**Problem:** If Slice 11 is delayed or needs rework, Slice 15 (Calendar) is blocked. The shared helper is needed by both Gmail and Calendar.

**Fix:** Extract `src/shared/contacts.ts` as its own slice between Phase 2 and Phase 3, or include it in Phase 2 as a runtime primitive.

### 17. Missing `src/stripe/types.ts` file

**Location:** Slice 17 — Stripe scaffold
**Problem:** Gmail gets a `src/gmail/types.ts` (Slice 8). Stripe gets no types file. Stripe needs: webhook event envelope types, payment link input/output types, checkout session sync types.

**Fix:** Add `src/stripe/types.ts` to Slice 17.

### 18. Gmail `sendMessage` MIME encoding not documented

**Location:** Slice 10 — `src/gmail/operations.ts`
**Problem:** The Gmail API's `sendMessage` requires a base64url-encoded raw MIME message, not a simple JSON body. This is a significant implementation detail that the plan omits.

**Fix:** Document in Slice 10 brief: "Gmail `sendMessage` requires constructing a raw RFC 2822 MIME message, then base64url-encoding it per Gmail API spec."

### 19. RLS policy generation for integration tables not confirmed

**Location:** Slice 3 — schema extension
**Problem:** The plan creates `integration_connections` and `integration_sync_state` as tenant-scoped tables but doesn't confirm that `PluginSchemaExtension` triggers auto-generated RLS policies. The project's convention requires RLS on all tenant-scoped Postgres tables.

**Fix:** Explicitly confirm that RLS policies are generated, or include them in the migration SQL for Slice 3.

### 20. `isRetryableError` missing network-level errors

**Location:** Slice 5 — `src/retry.ts`
**Problem:** The plan lists HTTP 429/500/502/503 but omits network-level errors that provider APIs frequently produce during OAuth token refresh: `ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND`.

**Fix:** Add network error codes to `isRetryableError` check.

### 21. Missing database indexes on integration tables

**Location:** Slice 3 — table definitions
**Problem:** No indexes are specified. The following queries will be slow without indexes:
- Lookup by `(organization_id, provider, user_id)` — needs unique index
- List connections by provider — needs index on `(organization_id, provider)`
- List connections by status — needs index on `(organization_id, status)`
- Sync state lookup by connection — needs index on `(connection_id, stream)`

**Fix:** Add index definitions to Slice 3 schema.

### 22. Top-level CLI aliases may collide with future core commands

**Location:** Slice 16/20 — `orbit calendar`, `orbit payments`
**Problem:** Registering `orbit calendar` and `orbit payments` as top-level commands creates potential naming collisions with future core CLI commands.

**Fix:** Document these as reserved names in the CLI conventions, or use a prefix convention (`orbit integration:calendar`).

### 23. Connector operations lack compile-time dependency on Prerequisite A

**Location:** Slices 10, 11, 14, 15
**Problem:** The plan identifies Prerequisite A as needed but the slice briefs don't state it as a **hard compile dependency**. Slice 10/11 will not compile until `CreateActivityInput` has `body`, `direction`, `metadata`, `duration_minutes`.

**Fix:** Add explicit "Requires Prerequisite A merged" callout to Slices 10, 11, 14, 15, 18.

---

## Summary

| Category | Count |
|----------|-------|
| Critical Issues | 4 |
| Concerns | 19 |

The plan is structurally sound — phase ordering, slice granularity, and spec coverage are all correct. The 4 critical issues must be resolved before execution. The 19 concerns are mostly underspecified details that will cause ambiguity during implementation if not clarified.
