# Orbit AI Integrations Implementation Plan

Date: 2026-04-10 (revised v5 — incorporates MCP process learnings: per-slice review discipline, multi-perspective milestones, known failure patterns)
Status: Execution-ready baseline
Package: `@orbit-ai/integrations`
Depends on:
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md) — canonical spec
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)

## 1. Purpose

This document defines how to execute `@orbit-ai/integrations` as Phase 8.

The integrations package provides:
- Reusable connector/runtime boundary for Gmail, Google Calendar, Stripe
- OAuth token lifecycle with credentials stored in tenant-scoped `integration_connections` table
- Connector operations (send email, list events, create payment link)
- Provider ingestion paths (Gmail polling/scan, Calendar polling, Stripe webhooks)
- Extension MCP tools and CLI commands defined per connector (per spec sections 5.3, 6, 7, 10)
- Event architecture for connector reactions to Orbit domain events (per spec section 11)

Per spec section 2, MCP tools and CLI commands are defined inside `@orbit-ai/integrations`. However, consumer wiring (adding extension seams to `@orbit-ai/cli` and `@orbit-ai/mcp`) is a prerequisite that must be completed before the integration tool/command slices can compile.

### Spec notes

- **Gmail CLI commands**: spec section 5 says "expose Gmail-specific CLI and MCP tools" but the example plugin (section 5.1) shows `commands: []`. This plan follows the example: Gmail defines MCP tools only, no CLI commands. Calendar and Stripe define both.
- **`CredentialStore`**: extends the spec. Spec section 3.1 defines the read-side contract; we add a write-side `CredentialStore` interface backed by the `integration_connections` table. The table is created in Phase 1 before any OAuth flow needs it.
- **File layout**: spec shows `handlers.ts` per connector. We consolidate event handlers into `src/events.ts` and keep connector-specific sync logic in `sync.ts` files.

### Extraction guidance

Per spec section 13: extract bounded capabilities from `~/smb-sale-crm-app` (Gmail OAuth lifecycle, Calendar event sync, Stripe payment normalization). Do NOT carry over Next.js route handlers, app-specific UI state, SMB-specific field names, or frontend assumptions.

## 2. Prerequisites

These must be completed BEFORE the integrations branch starts. Each is a separate PR to main.

**Ordering:** Prerequisite A must merge first (it is a hard compile dependency for Slices 10/11/14/15/18 which use `body`, `direction`, `metadata` on activities and `external_id`/`metadata` on payments). Prerequisites B and C are independent of each other and can be completed in parallel. All three must be merged to main before Phase 3 begins.

### Prerequisite A: SDK/API field parity for activities and payments

The current SDK types are missing fields that the sync code needs. These exist in `@orbit-ai/core` schema but aren't exposed in SDK types.

Missing from `CreateActivityInput` / `ActivityRecord`:
- `body?: string` — email body, meeting description
- `direction?: string` — inbound/outbound/internal (core default: `'internal'`)
- `duration_minutes?: number` — meeting duration
- `metadata?: Record<string, unknown>` — provider-specific data (gmail_thread_id, etc.)
- `outcome?: string` — activity outcome (lower priority, but needed for full parity)

Missing from `CreatePaymentInput` / `PaymentRecord`:
- `external_id?: string` — Stripe session/payment intent ID
- `metadata?: Record<string, unknown>` — provider metadata

**Pre-existing naming bug:** SDK uses `payment_method` but core schema column is `method`. The API passes raw body to core, so if SDK sends `{ payment_method: 'stripe' }`, the core Zod schema receives the wrong field name and silently drops it. **Resolution: add `payment_method` as an accepted alias in the core `paymentInsertSchema` Zod schema (non-breaking; preserves the existing SDK spelling and CLI usage which already uses `payment_method`).** Do NOT rename the SDK field — that is a breaking change.

Required changes:
- `packages/sdk/src/resources/activities.ts` — add missing fields to types
- `packages/sdk/src/resources/payments.ts` — add missing fields, fix `payment_method`/`method` naming
- `packages/api/src/routes/entities.ts` — verify API passthrough accepts new fields (likely no change needed)
- Core Zod schemas — verify `activityInsertSchema` and `paymentInsertSchema` accept the fields

Verify: `pnpm -r build && pnpm -r test && pnpm -r typecheck`

Skill trigger: `orbit-api-sdk-parity`

### Prerequisite B: MCP extension tool seam

The current MCP server (`packages/mcp/src/server.ts`) registers a fixed 23-tool set. There is no seam for dynamically adding extension tools.

Required change:
- Add `registerExtensionTools(server, tools: IntegrationTool[])` function to `@orbit-ai/mcp`
- Extension tools must be namespaced (prefix check) and must not shadow core tools
- Export from `packages/mcp/src/index.ts`

### Prerequisite C: CLI integration command seam

The current CLI (`packages/cli/src/commands/integrations.ts`) throws `CliNotImplementedError`. There is no seam for dynamically registering integration subcommands.

Required change:
- Replace the stub with a dynamic loader: `registerIntegrationSubcommands(program, plugins)` that accepts `IntegrationCommand[]` and registers each as a subcommand under `orbit integrations`
- Register `orbit calendar` as a top-level alias for `orbit integrations google-calendar` (Calendar connector only — no conflict with any existing core command)
- Do NOT register `orbit payments` as an alias — that namespace is already owned by the core `payments` command tree

## 3. Technology Decisions

### 3.1 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `googleapis` | ^144 | Gmail + Calendar API client with TypeScript types |
| `google-auth-library` | ^9 | OAuth2 client, token refresh |
| `stripe` | ^17 | Stripe API client |

### 3.2 Credential Storage Model

Credentials are stored in the `integration_connections` table (spec section 8), not in a separate pluggable store. The `CredentialStore` interface is a thin adapter over this table:

```typescript
interface CredentialStore {
  getCredentials(organizationId: string, provider: string, userId?: string): Promise<StoredCredentials | null>
  saveCredentials(organizationId: string, provider: string, userId: string, credentials: StoredCredentials): Promise<void>
  deleteCredentials(organizationId: string, provider: string, userId?: string): Promise<void>
}

interface EncryptionProvider {
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
}
```

- `TableBackedCredentialStore` — production implementation backed by `integration_connections`. Requires an `EncryptionProvider` for encrypting refresh tokens and credentials before writing to `_encrypted` columns.
- `InMemoryCredentialStore` — test-only implementation (no encryption)
- The table is created in Phase 1 (Slice 3) BEFORE OAuth slices that need it
- `userId` parameter is required on `saveCredentials` and optional on `getCredentials`/`deleteCredentials` (when omitted, returns the org-level default connection). This prevents ambiguity when multiple users in the same org connect the same provider.

**`StoredCredentials` type:**
```typescript
interface StoredCredentials {
  accessToken: string
  refreshToken: string
  expiresAt?: number      // epoch millis
  scopes?: string[]
  providerAccountId?: string
}
```

Fields mapping:
- `StoredCredentials.refreshToken` → encrypted via `EncryptionProvider` → `integration_connections.refresh_token_encrypted`
- `StoredCredentials.accessToken` → not persisted (ephemeral, refreshed on demand)
- `credentials_encrypted` — stores the full `StoredCredentials` object (minus `refreshToken`) as encrypted JSON: `{ accessToken, expiresAt, scopes, providerAccountId }`. Used as a recovery fallback if ephemeral access token is unavailable. If a simpler design is preferred, this column may be omitted and only `refresh_token_encrypted` kept — but the column must be decided in Slice 3 and held consistent across all slices.
- Encryption key sourced from `ORBIT_CREDENTIAL_KEY` env var. Expected format: 64-character hex string (32 bytes = 256 bits for AES-256). Startup must validate: if the key is absent or not 64 hex characters, throw immediately rather than failing silently at first encrypt/decrypt call. Default implementation: AES-256-GCM with random IV prepended to ciphertext.

### 3.3 Connector Order

1. **Gmail** — OAuth2 token refresh (hardest auth pattern)
2. **Google Calendar** — same OAuth2, incremental
3. **Stripe** — API key auth, webhook-heavy

## 4. Implementation Slices

Each slice: one commit, production code + tests, followed by `superpowers:requesting-code-review`. Every implementer brief includes CLAUDE.md Coding Conventions verbatim.

**"Done" per slice:** All four commands must pass:
```bash
pnpm --filter @orbit-ai/integrations build
pnpm --filter @orbit-ai/integrations test
pnpm --filter @orbit-ai/integrations typecheck
pnpm --filter @orbit-ai/integrations lint
```

---

### Phase 1: Foundation (4 slices)

#### Slice 1: Package scaffold

Create `packages/integrations/`:
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `README.md`, `LICENSE`

Tests: smoke import test.

Commit: `feat(integrations): scaffold package runtime`

#### Slice 2: Plugin contract types + error model

Create `src/types.ts` and `src/errors.ts`:
- `OrbitIntegrationPlugin` — per spec section 3 (slug, title, version, commands, tools, outboundEventHandlers, install, uninstall, healthcheck)
- `IntegrationCommand`, `IntegrationTool`, `IntegrationWebhookHandler` — per spec
- `IntegrationRuntime` — adapter, client, config, eventBus
- `OrbitIntegrationEventBus` — publish, subscribe (per spec). Pattern matching for MVP: exact string match only (e.g. `"contact.created"`). Wildcard support is not in scope for v0.1.
- `IntegrationResult<T>`:
  ```typescript
  interface IntegrationResult<T> {
    data: T
    provider: string
    rawResponse?: unknown
  }
  ```
- `IntegrationError`, `IntegrationErrorCode` union
- `toIntegrationError(err)` — normalize any thrown error to `IntegrationError` (inbound)
- `fromIntegrationError(err, target: 'mcp' | 'api' | 'cli')` — convert `IntegrationError` to the appropriate downstream error type: `McpToolError` for MCP consumers, `OrbitError` for API route responses, human-readable message string for CLI output

Tests: error construction, normalization, plugin contract shape.

Commit: `feat(integrations): add plugin contract and error model`

#### Slice 3: Integration tables + schema extension

Create `src/schema.ts` and `src/schema-extension.ts`:
- `integrationConnections` table — per spec section 8 (id, organizationId, provider, connectionType, userId, status, credentialsEncrypted, refreshTokenEncrypted, accessTokenExpiresAt, providerAccountId, providerWebhookId, scopes, failureCount, lastSuccessAt, lastFailureAt, metadata)
- `integrationSyncState` table — per spec section 8, plus a `processedEventIds` column (`jsonb`/`text[]`) for Stripe webhook dedup (stores processed Stripe event IDs for idempotency; capped at 1000 most-recent event IDs per connection using FIFO eviction — drop the oldest entry when inserting past the cap; at ~27 chars per Stripe event ID this is ~27KB max per connection row)
- `integrationSchemaExtension` — registers both in core plugin system
- Both tables include `organizationId`, are tenant-scoped

**Database indexes** (must be included in the migration for query performance):
- `integration_connections`: unique index on `(organization_id, provider, user_id)` for connection lookup; index on `(organization_id, provider)` for list-by-provider; index on `(organization_id, status)` for list-by-status
- `integration_sync_state`: index on `(connection_id, stream)` for sync state lookup

**RLS confirmation**: `PluginSchemaExtension` does not auto-generate RLS policies — the migration SQL for `integration_connections` and `integration_sync_state` must explicitly include `CREATE POLICY` statements scoped to `organization_id` for Postgres adapters (consistent with all other tenant-scoped tables in the project).

Tests: schema extension registration, column completeness vs spec, tenant scoping assertion, index existence.

Commit: `feat(integrations): add integration connection and sync state tables`

Skill trigger: `orbit-schema-change`, `orbit-tenant-safety-review`

#### Slice 4: Credential store + encryption + redaction

Create `src/credentials.ts`, `src/encryption.ts`, and `src/redaction.ts`:
- `EncryptionProvider` interface (`encrypt`, `decrypt`)
- `AesGcmEncryptionProvider` — default implementation (AES-256-GCM, random IV, key from `ORBIT_CREDENTIAL_KEY` env)
- `NoopEncryptionProvider` — test-only (plaintext passthrough, clearly named)
- `CredentialStore` interface (get, save, delete — org+provider+userId scoped per section 3.2)
- `StoredCredentials` type
- `TableBackedCredentialStore` — wraps `integration_connections` table, encrypts via `EncryptionProvider` before writing to `_encrypted` columns, decrypts on read
- `InMemoryCredentialStore` — test-only (uses `NoopEncryptionProvider`)
- `redactProviderError()` — strip tokens/secrets. Follow `packages/mcp/src/errors.ts` approach: target specific known patterns (`Bearer` tokens, `ya29.` Google tokens, `eyJ.` JWTs, `key=value` secret pairs). Do NOT use a length-based regex like `/[A-Za-z0-9._-]{24,}/g` — it will match ULIDs, Gmail message IDs, and sync cursors.
- `sanitizeIntegrationMetadata()` — per spec section 3.1. Key filter must use exact boundary matching, not substring: `/^(token|secret|signature|credential|password|private_key|refresh_token|access_token)$/i`. Keys like `authorized_at`, `auth_provider`, `authorization_type` must NOT be redacted.
- `toIntegrationConnectionRead()` / `toIntegrationSyncStateRead()` — use `.toISOString()` for all timestamp fields, not `String(...)` (which produces locale-dependent output or `"[object Object]"` on wrapped Date types).
- `toIntegrationConnectionRead()` — sanitized DTO
- `toIntegrationSyncStateRead()` — sanitized DTO

Tests: credential store CRUD (both impls), redaction, DTO mapping strips sensitive fields.

Commit: `feat(integrations): add credential store and redaction`

Skill trigger: `orbit-tenant-safety-review`

---

### Phase 2: Runtime primitives (3 slices)

#### Slice 5: Retry + idempotency helpers

Create `src/retry.ts` and `src/idempotency.ts`:
- `withBoundedRetry(fn, options)` — max 3, exponential backoff, jitter
- `isRetryableError(error)` — HTTP 429/500/502/503 plus network-level errors: `ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND` (these are common during OAuth token refresh against provider APIs)
- `IdempotencyHelper` — key generation + dedup check. Uses the core `idempotency_keys` table (already implemented in Wave 2) as the backing store — do not create a new table or in-memory mechanism. Stripe event-level dedup uses `integration_sync_state.processedEventIds` instead (see Slice 3).

Tests: retry exhaustion, backoff (mocked), non-retryable pass-through.

Commit: `feat(integrations): add bounded retry and idempotency helpers`

#### Slice 6: Registry + config loader

Create `src/registry.ts` and `src/config.ts`:
- `IntegrationRegistry` — register/lookup by slug
- `loadIntegrationConfig(configPath)` — `.orbit/integrations.json` (per spec section 4)
- `validateConnectorConfig(slug, config)` — per-connector validation
- `loadEnabledIntegrations(registry, config, context)` — per spec section 9

Tests: registry CRUD, config loading, enabled/disabled filtering, unknown slug rejection.

Commit: `feat(integrations): add registry and config loader`

#### Slice 7: OAuth2 token lifecycle

Create `src/oauth.ts`:
- `GoogleOAuthHelper` — wraps `google-auth-library` OAuth2Client
- `createAuthUrl(scopes, redirectUri)` — consent URL
- `exchangeCode(code)` — code → tokens, persists via `CredentialStore`
- `getValidAccessToken(orgId, provider, credentialStore)` — auto-refresh (5-min margin)
- `revokeToken(orgId, provider, credentialStore)` — revoke + delete
- Errors map to `IntegrationError` (`AUTH_EXPIRED`, `AUTH_REVOKED`)
- **Auth failure tracking**: on each auth failure, increment `integration_connections.failureCount` and record timestamp in `lastFailureAt`. On success, reset `failureCount` to 0 and update `lastSuccessAt`. At `failureCount >= 5` consecutive failures, set `status = 'disabled'` and stop refresh attempts (requires manual re-auth). Status progression: `active → error` (first failure) → `disabled` (5th failure).

Tests: refresh when expired (mocked), revocation, exchange, invalid grant mapping.

Commit: `feat(integrations): add OAuth2 token lifecycle`

Skill trigger: `orbit-tenant-safety-review`

Phase 2 milestone: `orbit-core-slice-review`

---

### Phase 3: Gmail connector (5 slices)

#### Slice 8: Gmail connector scaffold + config

Create `src/gmail/connector.ts`, `src/gmail/types.ts`:
- `gmailPlugin: OrbitIntegrationPlugin` — per spec section 5.1
- `GmailConnectorConfig` — Zod (clientId, clientSecretEnv, redirectUri, scopes)
- Register in registry

Tests: config validation, registration.

Commit: `feat(integrations): scaffold Gmail connector`

#### Slice 9: Gmail OAuth flow

Create `src/gmail/auth.ts`:
- `getGmailAuthUrl(connector)`, `completeGmailAuth(connector, code)`, `getGmailClient(connector)`
- Scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`

Tests: auth URL scopes, code exchange persists credentials, client auto-refresh.

Commit: `feat(integrations): add Gmail OAuth flow`

#### Slice 10: Gmail send + list operations

**Requires Prerequisite A merged** — `CreateActivityInput` must have `body`, `direction`, `metadata` before this slice compiles correctly.

Create `src/gmail/operations.ts`:
- `listMessages`, `getMessage`, `sendMessage`
- All return `IntegrationResult<T>`, errors via `toIntegrationError()`
- `sendMessage` requires constructing a raw RFC 2822 MIME message, then base64url-encoding it per Gmail API spec (`message.raw = Buffer.from(mimeString).toString('base64url')`). This is not a simple JSON body POST.

Tests: list/send with mocked Gmail API, error mapping (auth failure, rate limit, not found).

Commit: `feat(integrations): add Gmail send and list operations`

#### Slice 11: Gmail sync + contact dedupe

**Requires Prerequisite A merged** — `CreateActivityInput.body`, `.direction`, `.metadata` must exist.

Create `src/gmail/sync.ts` and `src/shared/contacts.ts`:
- `syncGmailMessage(runtime, input)` — per spec section 5.2
- `findOrCreateContactFromEmail(client, orgId, email)` — **orgId is required** (tenant-bound lookup)
- Full dedupe policy per spec section 5:
  1. Exact normalized email match (within org)
  2. Company match by domain (within org)
  3. Create only when connector config `auto_create_contacts: true`
- `withTenantContext` wrapper on all contact/company lookups
- Direction detection: inbound vs outbound

Tests:
- Inbound/outbound direction
- Contact lookup by email within org
- Company-by-domain matching within org
- **Negative test: same email in different orgs does NOT collide** (cross-tenant isolation)
- Auto-create disabled → no creation
- Activity creation shape matches SDK `CreateActivityInput`

Commit: `feat(integrations): add Gmail sync with tenant-safe contact dedupe`

Skill trigger: `orbit-tenant-safety-review`

#### Slice 12: Gmail MCP extension tools + polling

Create `src/gmail/mcp-tools.ts` and `src/gmail/polling.ts`:
- `integrations.gmail.send_email` — MCP tool (per spec section 5.3)
- `integrations.gmail.sync_thread` — MCP tool
- `pollGmailInbox(runtime, connector, options)` — per spec section 5 ("Gmail scan / polling job")
  - Queries Gmail API for new messages since last sync cursor
  - For each new message: calls `syncGmailMessage`
  - Updates `integration_sync_state.cursor` after successful batch
  - Bounded: max messages per poll, max poll duration
- Note: no Gmail CLI commands (spec section 5.1 shows `commands: []`)

Tests: tool registration/execution, polling with mocked API, cursor advancement, bounded poll limits.

Commit: `feat(integrations): add Gmail MCP tools and inbox polling`

Phase 3 milestone: `orbit-core-slice-review`

---

### Phase 4: Google Calendar connector (4 slices)

#### Slice 13: Calendar connector scaffold + auth

Create `src/google-calendar/connector.ts`, `src/google-calendar/auth.ts`:
- `calendarPlugin: OrbitIntegrationPlugin`
- Shares OAuth from Slice 7, different scopes (`calendar.events`, `calendar.readonly`)

Tests: config validation, client creation, scope verification.

Commit: `feat(integrations): scaffold Google Calendar connector`

#### Slice 14: Calendar event operations

**Requires Prerequisite A merged** — operations return shapes that feed into `CreateActivityInput`.

Create `src/google-calendar/operations.ts`:
- `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`, `checkAvailability`

Tests: list/create mocked, error mapping, freebusy parsing.

Commit: `feat(integrations): add Calendar event operations`

#### Slice 15: Calendar sync + polling

**Requires Prerequisite A merged** — `CreateActivityInput.duration_minutes`, `.metadata` must exist. Also requires `src/shared/contacts.ts` from Slice 11.

Create `src/google-calendar/sync.ts` and `src/google-calendar/polling.ts`:
- `syncCalendarEvent(runtime, input)` — per spec section 6
- `findOrCreateContactByAttendees(client, orgId, emails)` — **MUST use the shared helper from `src/shared/contacts.ts` (Slice 11) which includes `withTenantContext`; do NOT write a standalone query**
- `pollCalendarEvents(runtime, connector, options)` — per spec section 11.3
  - Queries Calendar API for updated events since last sync token
  - Provider webhook support where available, polling fallback
  - Updates sync state cursor
- Duration calculation, attendee mapping, metadata

Tests: event-to-activity shape, attendee resolution, duration edges, polling cursor, **cross-org negative test** (same attendee email in different orgs does NOT collide).

Commit: `feat(integrations): add Calendar sync and event polling`

Skill trigger: `orbit-tenant-safety-review`

#### Slice 16: Calendar MCP tools + CLI commands

**Requires Prerequisite C merged** — `orbit calendar` top-level alias and `registerIntegrationSubcommands` loader must exist before these commands have a registration path.

Create `src/google-calendar/mcp-tools.ts`:
- `integrations.google_calendar.list_events`, `integrations.google_calendar.create_event` — MCP tools
- CLI: `orbit calendar list`, `orbit calendar create`, `orbit calendar sync`

Tests: tool/command registration, execution with mocked operations.

Commit: `feat(integrations): add Calendar MCP tools and CLI commands`

Phase 4 milestone: `orbit-core-slice-review`

---

### Phase 5: Stripe connector (4 slices)

#### Slice 17: Stripe connector scaffold + config

Create `src/stripe/connector.ts` and `src/stripe/types.ts`:
- `src/stripe/types.ts` — webhook event envelope types, payment link input/output types, checkout session sync types (parallel to `src/gmail/types.ts`)
- `stripePlugin: OrbitIntegrationPlugin`
- `StripeConnectorConfig` — Zod (secretKeyEnv, webhookSecretEnv)
- Secret key from env — never in config file

Tests: config validation, env resolution, missing env rejection.

Commit: `feat(integrations): scaffold Stripe connector`

Skill trigger: `orbit-tenant-safety-review`

#### Slice 18: Stripe payment operations + sync

**Requires Prerequisite A merged** — `CreatePaymentInput.external_id` and `.metadata` must exist.

Create `src/stripe/operations.ts`, `src/stripe/sync.ts`:
- `createPaymentLink`, `getPaymentStatus`
- `syncStripeCheckoutSession(runtime, stripeClient, sessionId)` — per spec section 7

Tests: payment link, session retrieval, sync mapping.

Commit: `feat(integrations): add Stripe payment operations and sync`

#### Slice 19: Stripe webhook handler + security

Create `src/stripe/webhooks.ts`:
- `verifyStripeWebhook(payload, signature, secret)` — signature verification via Stripe's `constructEvent(payload, sig, secret, tolerance)`. The `tolerance` parameter (default: 300 seconds = 5 min) is the sole replay-window enforcement mechanism. Do NOT add a separate timestamp check — it creates double validation with potentially different windows and ambiguity about which is authoritative.
- `handleStripeEvent(runtime, event)` — route by type
- **Receipt persistence**: store processed Stripe event ID in `integration_sync_state.processedEventIds` (see Slice 3)
- Idempotency: same event ID processed at most once
- **Provider events must NOT route through outbound customer webhook delivery** (per spec section 11.3)

Tests:
- Signature valid/invalid
- Event routing
- **Replay: event with timestamp outside window is rejected**
- **Dedup: same event ID processed twice → second is no-op**
- **Negative: provider event does NOT trigger outbound customer webhook delivery**
- Unknown event type rejection

Commit: `feat(integrations): add Stripe webhook handler with replay and dedup`

#### Slice 20: Stripe MCP tools + CLI commands

**Requires Prerequisite C merged** — `registerIntegrationSubcommands` loader must exist before `orbit integrations stripe ...` commands have a registration path.

Create `src/stripe/mcp-tools.ts`:
- `integrations.stripe.create_payment_link`, `integrations.stripe.get_payment_status` — MCP tools
- CLI: `orbit integrations stripe link-create`, `orbit integrations stripe sync` — kept under the `integrations` namespace to avoid collision with the existing core `orbit payments` command tree (`packages/cli/src/commands/payments.ts` already owns `orbit payments`). Do NOT register top-level `orbit payments` aliases from this package.

Tests: tool/command registration, execution.

Commit: `feat(integrations): add Stripe MCP tools and CLI commands`

Phase 5 milestone: `orbit-core-slice-review`

---

### Phase 6: Event architecture + registration + closeout (3 slices)

#### Slice 21: Event bus + routing enforcement

Create `src/events.ts`:
- `OrbitIntegrationEventBus` implementation (per spec section 3)
- Internal domain events: `contact.created`, `deal.stage_moved`, `payment.created` (per spec section 11.1)
- Event subscription by connector handlers (per spec section 12)
- **Enforcing seam**: provider inbound events and internal domain events flow through the event bus; outbound customer webhooks use the API webhook delivery worker. These paths must NOT be conflated.

Tests:
- Event publish/subscribe
- Handler invocation
- **Negative: inbound provider event does NOT reach outbound webhook delivery path**
- **Negative: internal domain event handler cannot accidentally emit to customer webhook channel**

Commit: `feat(integrations): add event bus with routing enforcement`

Skill trigger: `orbit-tenant-safety-review`

#### Slice 22: CLI + MCP dynamic registration

Create `src/cli.ts` and update `src/index.ts`:
- `registerIntegrationCommands(program, runtime, config)` — per spec section 10
- `getIntegrationTools(runtime, config)` — per spec section 10
- Dynamic registration: only enabled plugins
- Namespacing: `integrations.*` prefix, must not shadow core tools
- Note: actual wiring into `@orbit-ai/cli` program.ts and `@orbit-ai/mcp` server.ts requires Prerequisites B and C

Tests: dynamic registration enabled/disabled, namespacing, no-shadow assertion.

Commit: `feat(integrations): add CLI and MCP dynamic registration`

#### Slice 23: Docs + review closeout

- `packages/integrations/README.md`, `docs/KB.md`, `CHANGELOG.md`, `CLAUDE.md` baseline
- Review artifacts under `docs/review/`

Commit: `docs(integrations): record execution and review closeout`

---

## 5. Execution Rules

### 5.1 Sub-Agent Briefing (MANDATORY)

Every implementer brief MUST include:
1. CLAUDE.md **Coding Conventions** section verbatim
2. Slice description from this plan
3. "Done" definition: build + tests + typecheck + lint pass (all four commands)
4. Specific orbit skill trigger (if any)
5. Relevant canonical spec section references

### 5.2 Review After Every Commit (non-negotiable)

Run `superpowers:requesting-code-review` after each slice. Fix ALL findings before starting the next slice. This step cannot be deferred, batched, or skipped.

**Why this is mandatory:** The MCP package (`feat/mcp-closeout`) skipped per-slice review. All issues accumulated until the final PR gate, where 6 agents found a backlog. Each fix round introduced new code that generated new findings, creating a compounding loop — 10 rounds, ~4 hours to reach zero issues. The `pr-review-toolkit` at PR time should confirm quality, not discover it for the first time.

### 5.3 Multi-Perspective Review at Phase Milestones

At the end of each phase (Phases 2–5), in addition to `orbit-core-slice-review`, run a second deeper review using a different agent or model to catch what a single reviewer misses. The MCP plan benefited from having both a structural reviewer (Copilot-style) and a deep implementation reviewer (Codex-style) — they caught different classes of issues.

Recommended at each phase milestone:
1. `orbit-core-slice-review` — orbit-specific patterns, spec coverage
2. `superpowers:requesting-code-review` with `subagent_type: feature-dev:code-reviewer` — implementation-level issues (types, edge cases, redaction, error mapping)

### 5.4 No Deferrals

Any issue found is fixed immediately. No "non-blocking" items. "Pre-existing" is not a reason to skip — if the review finds it, fix it.

### 5.5 Lint Before Commit

`pnpm --filter @orbit-ai/integrations lint` before every commit.

### 5.6 Known Patterns to Watch (from MCP lessons)

These are the specific failure modes that caused the most review rounds in MCP. Sub-agent briefs should call these out explicitly:

- **Bare catch blocks**: every catch must log before swallowing — `catch (err) { writeStderrWarning(...) }`, never bare `catch {}` or silent `catch { /* best-effort */ }`
- **Duck-type guards**: use type predicates (`isXxx(e): e is T`) not `instanceof` for cross-boundary error classes (`IntegrationError`, `ZodError`, `OrbitApiError`)
- **Redaction is recursive**: `sanitizeObjectDeep` on all output that may contain user records — top-level-only sanitization leaks nested secrets
- **camelCase sensitive keys**: `isSensitiveKey` must cover both snake_case (`api_key`, `refresh_token`) and camelCase (`accessToken`, `clientSecret`, `apiKey`)
- **Semantic error codes**: do not collapse `AUTH_EXPIRED`, `RATE_LIMITED`, `CONFLICT` into `INTERNAL_ERROR` — AI agents need the signal to react correctly (backoff vs. re-auth vs. fetch-and-update)
- **Exhaustiveness guards**: every switch/if-chain over a union type must end with `assertNever(x)` so future union members cause a compile error, not a silent no-op

## 6. Final Review Gate

After all 23 slices + individual reviews:
1. `pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint`
2. `pr-review-toolkit:review-pr all` — all 6 agents
3. **Stopping rule: zero MEDIUM/HIGH/CRITICAL across all 6 agents.** "Nothing above HIGH" is not the bar — MEDIUM issues are real issues. Stop only when everything remaining is LOW or cosmetic suggestions.
4. Cosmetic suggestions → file as issues, don't block the PR
5. If a fix round introduces new code: re-run the affected agents only, not all 6

## 7. Orbit Skill Triggers

| Slice | Trigger | Skill |
|-------|---------|-------|
| 3 | New tables, tenant scoping | `orbit-schema-change`, `orbit-tenant-safety-review` |
| 4 | Credential handling | `orbit-tenant-safety-review` |
| 7 | Token storage, refresh | `orbit-tenant-safety-review` |
| 11 | Cross-tenant contact lookup | `orbit-tenant-safety-review` |
| 15 | Cross-tenant contact lookup | `orbit-tenant-safety-review` |
| 17 | API key from env | `orbit-tenant-safety-review` |
| 21 | Event bus, routing isolation | `orbit-tenant-safety-review` |
| End of Phase 2 | Runtime complete | `orbit-core-slice-review` |
| End of Phase 3 | Gmail complete | `orbit-core-slice-review` |
| End of Phase 4 | Calendar complete | `orbit-core-slice-review` |
| End of Phase 5 | Stripe complete | `orbit-core-slice-review` |

## 8. Spec Acceptance Criteria Mapping

| # | Criterion | Covered by |
|---|-----------|-----------|
| 1 | Enable Gmail, Calendar, Stripe via config | 6, 8, 13, 17 |
| 2 | Each connector: install, commands, tools, sync | 8-12, 13-16, 17-20 |
| 3 | State in tenant-scoped tables | 3 |
| 4 | Tables via core plugin schema extension | 3 |
| 5 | Commands/tools registered dynamically when enabled | 22 |
| 6 | Distinguish internal/outbound/inbound events | 19, 21 |
| 7 | Reads return sanitized DTOs | 4 |
| 8 | Commands/tools use shared serializer helpers | 12, 16, 20, 22 |

## 9. Definition of Done

- `packages/integrations` builds
- All 3 connectors end-to-end: OAuth, operations, sync, MCP tools, CLI commands (Calendar/Stripe)
- Provider ingestion: Gmail polling, Calendar polling, Stripe webhooks
- `OrbitIntegrationPlugin` contract from spec section 3 implemented
- Event bus with routing enforcement (provider ≠ customer events)
- Webhook security: replay-window, receipt persistence, dedup
- Tenant-safe contact lookup: org-bound, `withTenantContext`, negative cross-org tests
- CredentialStore backed by integration_connections table
- All reads use sanitized DTOs
- Every slice reviewed individually
- Final review: zero MEDIUM+ across all 6 agents
- All 8 spec acceptance criteria proven
- KB, CHANGELOG, review artifacts updated

## 10. What Comes After

1. Complete Prerequisites A, B, C (separate PRs to main)
2. Execute this plan on a feature branch
3. Merge `@orbit-ai/integrations` to main
4. Publish all 6 packages as `0.1.0-alpha.1` (alpha.0 already tagged)
