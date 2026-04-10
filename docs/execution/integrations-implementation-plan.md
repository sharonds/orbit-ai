# Orbit AI Integrations Implementation Plan

Date: 2026-04-10 (revised v2)
Status: Execution-ready baseline
Package: `@orbit-ai/integrations`
Depends on:
- [06-integrations.md](/Users/sharonsciammas/orbit-ai/docs/specs/06-integrations.md) — the canonical spec (this plan must not contradict it)
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)

## 1. Purpose

This document defines how to execute `@orbit-ai/integrations` as Phase 8 — the last package before v1 alpha.

The integrations package provides:
- Reusable connector/runtime boundary
- OAuth token lifecycle and credential storage contract
- Connector operations (send email, list events, create payment link)
- Extension MCP tools and CLI commands per connector (per spec sections 5.3, 6, 7, 10)
- Event architecture for connector reactions to Orbit domain events (per spec section 11)
- Integration-owned tables (`integration_connections`, `integration_sync_state`)

Per the spec (section 2), MCP tools and CLI commands live inside `@orbit-ai/integrations` and are registered dynamically when the plugin is enabled. They are NOT deferred to a separate package.

This plan applies the lessons from the MCP 10-round review loop:
- Every slice includes its own tests — no separate test pass
- `superpowers:requesting-code-review` runs after every commit
- Every implementer brief includes CLAUDE.md Coding Conventions verbatim
- Every slice defines "done" as: build + tests + lint pass
- Slices are ≤100 lines of production code each

### Spec deviations

- **`CredentialStore` interface** — extends the spec. Spec section 3.1 defines the read-side contract but not a write-side credential store. We add `CredentialStore` because the plugin `install` callback needs to persist OAuth tokens.
- **File layout** — spec section 2 shows `handlers.ts` in each connector directory. We consolidate event handler logic into `src/events.ts` (Slice 20) and keep connector-specific handlers inline in sync files. The behavior matches the spec; the file layout is simplified.

### Extraction guidance

Per spec section 13: extract bounded capabilities from `~/smb-sale-crm-app` (Gmail OAuth lifecycle, Calendar event sync, Stripe payment normalization). Do NOT carry over Next.js route handlers, app-specific UI state, SMB-specific field names, or assumptions that the source app owns the frontend. The target is a reusable connector package.

## 2. Current Position

- `@orbit-ai/core`, `@orbit-ai/api`, `@orbit-ai/sdk`, `@orbit-ai/cli`, `@orbit-ai/mcp` — all on `main`, 1,145 tests
- `packages/integrations` does not exist yet
- All stale branches deleted — repo is clean, `main` only

## 3. Technology Decisions

### 3.1 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `googleapis` | ^144 | Gmail + Calendar API client with TypeScript types |
| `google-auth-library` | ^9 | OAuth2 client, token refresh, credential validation |
| `stripe` | ^17 | Stripe API client |

**Why `googleapis` over raw REST:** Typed API methods for Gmail and Calendar. For a CRM SDK, type safety matters more than package size (Node.js, no bundle concern). Both Gmail and Calendar share one dependency.

**Why not `nodemailer`:** Too narrow — only sends email. CRM needs inbox list, thread read, and label management.

### 3.2 Auth Pattern

OAuth2 with stored refresh tokens for Gmail and Calendar. API key for Stripe.

The package defines a `CredentialStore` interface — consumers plug in their own encrypted storage. This extends the spec (spec section 3.1 defines the read-side contract but not a `CredentialStore` interface). The extension is necessary because the spec's plugin `install` callback needs a way to persist tokens.

```typescript
interface CredentialStore {
  getCredentials(organizationId: string, provider: string): Promise<StoredCredentials | null>
  saveCredentials(organizationId: string, provider: string, credentials: StoredCredentials): Promise<void>
  deleteCredentials(organizationId: string, provider: string): Promise<void>
}
```

### 3.3 Connector Order

1. **Gmail first** — Most common CRM integration. Proves the hardest auth (OAuth2 refresh). If this works, Calendar is trivial.
2. **Google Calendar second** — Same `googleapis`, same OAuth2. Incremental.
3. **Stripe third** — Simpler auth (API key), different shape (webhooks). Proves the pattern generalizes.

## 4. Implementation Slices

Each slice is one commit. Each commit includes production code + tests. Each commit is followed by `superpowers:requesting-code-review`. Each implementer brief includes CLAUDE.md Coding Conventions verbatim.

**"Done" for every slice:** `pnpm --filter @orbit-ai/integrations build && pnpm --filter @orbit-ai/integrations test && pnpm --filter @orbit-ai/integrations typecheck` all pass.

---

### Phase 1: Foundation (3 slices)

#### Slice 1: Package scaffold

Create `packages/integrations/`:
- `package.json` (deps: `googleapis`, `google-auth-library`, `stripe`)
- `tsconfig.json` (strict, extends root)
- `vitest.config.ts`
- `src/index.ts` (empty barrel)
- `README.md`, `LICENSE`

Tests: smoke test that the package imports without error.

Commit: `feat(integrations): scaffold package runtime`

Review: `superpowers:requesting-code-review`

#### Slice 2: Plugin contract types + error model

Create `src/types.ts` and `src/errors.ts`. Implement the spec's plugin contract (spec section 3):
- `OrbitIntegrationPlugin` — slug, title, version, commands, tools, outboundEventHandlers, install, uninstall, healthcheck
- `IntegrationCommand`, `IntegrationTool`, `IntegrationWebhookHandler` — per spec
- `IntegrationRuntime` — adapter, client, config, eventBus
- `OrbitIntegrationEventBus` — publish, subscribe (per spec section 3)
- `IntegrationError` — typed error with code, message, hint, recovery (mirrors MCP pattern)
- `IntegrationErrorCode` union — `AUTH_EXPIRED`, `AUTH_REVOKED`, `RATE_LIMITED`, `PROVIDER_ERROR`, `VALIDATION_FAILED`, `CREDENTIAL_MISSING`, `UNSUPPORTED_CAPABILITY`
- `toIntegrationError()` — normalizer

Tests: error construction, normalization of unknown errors, plugin contract shape validation.

Commit: `feat(integrations): add plugin contract and error model`

Review: `superpowers:requesting-code-review`

#### Slice 3: Credential boundary + redaction

Create `src/credentials.ts` and `src/redaction.ts`:
- `CredentialStore` interface (get, save, delete — all org-scoped)
- `StoredCredentials` type (accessToken, refreshToken, expiresAt, scopes, providerAccountId)
- `InMemoryCredentialStore` — test-only implementation
- `redactProviderError()` — strip tokens/secrets from provider error messages
- `sanitizeIntegrationMetadata()` — per spec section 3.1
- `toIntegrationConnectionRead()` — sanitized DTO (per spec)
- `toIntegrationSyncStateRead()` — sanitized DTO (per spec)

Tests: credential store CRUD, redaction of Bearer tokens / OAuth secrets / long strings, DTO mapping strips sensitive fields.

Commit: `feat(integrations): add credential boundary and redaction`

Review: `superpowers:requesting-code-review`

Skill trigger: `orbit-tenant-safety-review` (credential handling + tenant scoping)

---

### Phase 2: Runtime primitives (3 slices)

#### Slice 4: Retry + idempotency helpers

Create `src/retry.ts` and `src/idempotency.ts`:
- `withBoundedRetry(fn, options)` — retries with exponential backoff, max attempts (default 3), jitter
- `isRetryableError(error)` — checks HTTP status (429, 500, 502, 503) and provider codes
- `IdempotencyHelper` — generates + checks idempotency keys for write operations
- Retry is bounded — no unbounded loops.

Tests: retry exhaustion, backoff timing (mocked), idempotency key generation, non-retryable errors not retried.

Commit: `feat(integrations): add bounded retry and idempotency helpers`

Review: `superpowers:requesting-code-review`

#### Slice 5: Registry + config loader

Create `src/registry.ts` and `src/config.ts`:
- `IntegrationRegistry` — register/lookup connectors by slug
- `loadIntegrationConfig(configPath)` — reads `.orbit/integrations.json` (per spec section 4)
- `validateConnectorConfig(slug, config)` — validates per-connector required fields
- `loadEnabledIntegrations(registry, config, context)` — loads only enabled connectors (per spec section 9)

Tests: registry add/lookup, config loading valid/invalid JSON, enabled/disabled filtering, unknown slug rejection.

Commit: `feat(integrations): add registry and config loader`

Review: `superpowers:requesting-code-review`

#### Slice 6: OAuth2 token lifecycle

Create `src/oauth.ts`:
- `GoogleOAuthHelper` — wraps `google-auth-library` OAuth2Client
- `createAuthUrl(scopes, redirectUri)` — consent URL
- `exchangeCode(code)` — authorization code → tokens
- `getValidAccessToken(orgId, provider, credentialStore)` — returns valid token, auto-refreshes (5-min margin)
- `revokeToken(orgId, provider, credentialStore)` — revokes and deletes stored credentials
- Token refresh errors map to `IntegrationError` (`AUTH_EXPIRED` / `AUTH_REVOKED`)

Tests: token refresh when expired (mocked OAuth2Client), revocation, exchange, invalid grant error mapping.

Commit: `feat(integrations): add OAuth2 token lifecycle`

Review: `superpowers:requesting-code-review`

Skill trigger: `orbit-tenant-safety-review` (token storage, refresh token handling)

Phase 2 milestone: `orbit-core-slice-review` (runtime primitives complete)

---

### Phase 3: Gmail connector (5 slices)

#### Slice 7: Gmail connector scaffold + config

Create `src/gmail/connector.ts` and `src/gmail/types.ts`:
- `gmailPlugin: OrbitIntegrationPlugin` — per spec section 5.1
- `GmailConnectorConfig` — Zod schema (clientId, clientSecretEnv, redirectUri, scopes)
- Register in registry

Tests: config validation (missing fields, invalid scopes), registration.

Commit: `feat(integrations): scaffold Gmail connector`

Review: `superpowers:requesting-code-review`

#### Slice 8: Gmail OAuth flow

Create `src/gmail/auth.ts`:
- `getGmailAuthUrl(connector)` — consent URL for Gmail scopes
- `completeGmailAuth(connector, code)` — exchanges code, stores credentials
- `getGmailClient(connector)` — authenticated `gmail_v1.Gmail` with auto-refresh
- Scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`

Tests: auth URL correct scopes, code exchange stores credentials, client creation with valid/expired tokens.

Commit: `feat(integrations): add Gmail OAuth flow`

Review: `superpowers:requesting-code-review`

#### Slice 9: Gmail send + list operations

Create `src/gmail/operations.ts`:
- `listMessages(client, options)` — list inbox with pagination
- `getMessage(client, messageId)` — single message with parsed headers
- `sendMessage(client, to, subject, body)` — RFC 2822 base64 encoding
- All return `IntegrationResult<T>`, provider errors mapped through `toIntegrationError()`

Tests: list/send with mocked Gmail API, error mapping for auth failure / rate limit / not found.

Commit: `feat(integrations): add Gmail send and list operations`

Review: `superpowers:requesting-code-review`

#### Slice 10: Gmail sync — email-to-activity mapping

Create `src/gmail/sync.ts` and `src/shared/contacts.ts`:
- `syncGmailMessage(runtime, input)` — maps email to Orbit activity (per spec section 5.2)
- `findOrCreateContactFromEmail(client, email)` — dedupe by email (per spec section 5)
- Direction detection: inbound vs outbound
- Metadata: `gmail_message_id`, `gmail_thread_id`, `to`, `cc`

Tests: inbound/outbound direction, contact lookup, activity creation shape.

Commit: `feat(integrations): add Gmail sync and email-to-activity mapping`

Review: `superpowers:requesting-code-review`

Skill trigger: `orbit-tenant-safety-review` (cross-tenant contact lookup)

#### Slice 11: Gmail MCP extension tools

Create `src/gmail/mcp-tools.ts`:
- `integrations.gmail.send_email` — MCP extension tool (per spec section 5.3)
- `integrations.gmail.sync_thread` — MCP extension tool
- Register tools on `gmailPlugin.tools`
- Note: spec section 5.1 shows `commands: []` for Gmail — no CLI commands defined for Gmail

Tests: tool registration, tool execution with mocked operations, error handling.

Commit: `feat(integrations): add Gmail MCP extension tools`

Review: `superpowers:requesting-code-review`

Phase 3 milestone: `orbit-core-slice-review` (Gmail connector complete)

---

### Phase 4: Google Calendar connector (4 slices)

#### Slice 12: Calendar connector scaffold + auth

Create `src/google-calendar/connector.ts` and `src/google-calendar/auth.ts`:
- `calendarPlugin: OrbitIntegrationPlugin`
- `CalendarConnectorConfig` — Zod schema (reuses Google OAuth, different scopes)
- `getCalendarClient(connector)` — authenticated `calendar_v3.Calendar`
- Shares OAuth helper from Slice 6 — different scopes (`calendar.events`, `calendar.readonly`)

Tests: config validation, client creation, scope verification.

Commit: `feat(integrations): scaffold Google Calendar connector`

Review: `superpowers:requesting-code-review`

#### Slice 13: Calendar event operations

Create `src/google-calendar/operations.ts`:
- `listEvents(client, calendarId, options)` — time range + pagination
- `createEvent(client, calendarId, event)` — with attendees, time, description
- `updateEvent(client, calendarId, eventId, event)` — update existing
- `deleteEvent(client, calendarId, eventId)` — delete
- `checkAvailability(client, calendarId, timeMin, timeMax)` — freebusy query

Tests: list/create with mocked API, error mapping, freebusy response parsing.

Commit: `feat(integrations): add Calendar event operations`

Review: `superpowers:requesting-code-review`

#### Slice 14: Calendar sync — event-to-activity mapping

Create `src/google-calendar/sync.ts`:
- `syncCalendarEvent(runtime, input)` — maps event to Orbit activity (per spec section 6)
- `findOrCreateContactByAttendees(client, emails)` — in `src/shared/contacts.ts`
- Duration calculation, attendee mapping, metadata

Tests: event-to-activity shape, attendee resolution, duration edge cases.

Commit: `feat(integrations): add Calendar sync and event-to-activity mapping`

Review: `superpowers:requesting-code-review`

#### Slice 15: Calendar MCP tools + CLI commands

Create `src/google-calendar/mcp-tools.ts`:
- `integrations.google_calendar.list_events` — MCP extension tool (per spec section 6)
- `integrations.google_calendar.create_event` — MCP extension tool
- CLI commands: `orbit calendar list`, `orbit calendar create`, `orbit calendar sync` (per spec section 6)

Tests: tool registration, command registration, execution with mocked operations.

Commit: `feat(integrations): add Calendar MCP tools and CLI commands`

Review: `superpowers:requesting-code-review`

Phase 4 milestone: `orbit-core-slice-review` (Calendar connector complete)

---

### Phase 5: Stripe connector (3 slices)

#### Slice 16: Stripe connector scaffold + config

Create `src/stripe/connector.ts`:
- `stripePlugin: OrbitIntegrationPlugin`
- `StripeConnectorConfig` — Zod schema (secretKeyEnv, webhookSecretEnv)
- Secret key resolved from env var — never stored in config file

Tests: config validation, env var resolution, missing env rejection.

Commit: `feat(integrations): scaffold Stripe connector`

Review: `superpowers:requesting-code-review`

Skill trigger: `orbit-tenant-safety-review` (API key handling from env)

#### Slice 17: Stripe payment operations + sync

Create `src/stripe/operations.ts` and `src/stripe/sync.ts`:
- `createPaymentLink(client, options)` — create Stripe payment link
- `getPaymentStatus(client, sessionId)` — retrieve checkout session
- `syncStripeCheckoutSession(runtime, stripeClient, sessionId)` — per spec section 7

Tests: payment link creation, session retrieval, sync mapping shape.

Commit: `feat(integrations): add Stripe payment operations and sync`

Review: `superpowers:requesting-code-review`

#### Slice 18: Stripe MCP tools + CLI commands

Create `src/stripe/mcp-tools.ts`:
- `integrations.stripe.create_payment_link` — MCP extension tool (per spec section 7)
- `integrations.stripe.get_payment_status` — MCP extension tool
- CLI: `orbit payments link create`, `orbit payments sync stripe` (per spec section 7)
- Register on `stripePlugin.tools` and `stripePlugin.commands`

Tests: MCP tool execution with mocked operations, CLI command registration, error handling.

Commit: `feat(integrations): add Stripe MCP tools and CLI commands`

Review: `superpowers:requesting-code-review`

#### Slice 19: Stripe webhook handler

Create `src/stripe/webhooks.ts`:
- `verifyStripeWebhook(payload, signature, secret)` — signature verification
- `handleStripeEvent(runtime, event)` — route by type (checkout.session.completed, payment_intent.succeeded)
- Map Stripe events to Orbit payment records
- Replay protection via idempotency helper

Tests: signature verification (valid/invalid), event routing, idempotent handling, unknown event rejection.

Commit: `feat(integrations): add Stripe webhook handler`

Review: `superpowers:requesting-code-review`

Phase 5 milestone: `orbit-core-slice-review` (Stripe connector complete)

---

### Phase 6: Event architecture + schema + closeout (3 slices)

#### Slice 20: Event bus + integration tables

Create `src/events.ts`, `src/schema.ts`, `src/schema-extension.ts`:
- `OrbitIntegrationEventBus` implementation (per spec section 3, lines 106-109)
- Internal domain events: `contact.created`, `deal.stage_moved`, `payment.created` (per spec section 11.1)
- Event subscription by connector handlers (per spec section 12)
- `integrationConnections` table (per spec section 8)
- `integrationSyncState` table (per spec section 8)
- `integrationSchemaExtension` — registers in core plugin system
- Both tables include `organizationId`, tenant-scoped

Tests: event publish/subscribe, handler invocation, schema extension registration, table definitions match spec.

Commit: `feat(integrations): add event bus, integration tables, and schema extension`

Review: `superpowers:requesting-code-review`

Skill trigger: `orbit-schema-change` (new tables), `orbit-tenant-safety-review` (tenant-scoped tables + event bus)

#### Slice 21: CLI + MCP dynamic registration

Create `src/cli.ts` and update `src/index.ts`:
- `registerIntegrationCommands(program, runtime, config)` — per spec section 10
- `getIntegrationTools(runtime, config)` — per spec section 10
- Dynamic registration: only enabled plugins register their commands/tools
- Extension tools namespaced (`integrations.gmail.*`) and must not shadow core tools

Tests: dynamic registration with enabled/disabled plugins, namespacing, no-shadow assertion.

Commit: `feat(integrations): add CLI and MCP dynamic registration`

Review: `superpowers:requesting-code-review`

#### Slice 22: Docs + review closeout

- Update `packages/integrations/README.md` with usage examples
- Update `docs/KB.md` with integration execution status
- Update `CHANGELOG.md`
- Update `CLAUDE.md` test baseline
- Add review artifacts under `docs/review/`

Commit: `docs(integrations): record execution and review closeout`

Review: `superpowers:requesting-code-review`

---

## 5. Execution Rules

### 5.1 Sub-Agent Briefing (MANDATORY)

Every implementer sub-agent brief MUST include:

1. The full CLAUDE.md **Coding Conventions** section (error handling, tests, no deferrals, lint gates, sensitive data rules)
2. The slice description from this plan
3. The "done" definition: `build + tests + lint pass`
4. The specific orbit skill to run after the slice (if any)
5. Reference to the canonical spec sections relevant to the slice

### 5.2 Review After Every Commit

After each slice commit, run `superpowers:requesting-code-review`. Fix all findings before proceeding to the next slice. This is not optional.

### 5.3 No Deferrals

Any issue found on this branch is fixed on this branch. No "pre-existing" exemptions. No "non-blocking" items.

### 5.4 Lint Before Commit

`pnpm --filter @orbit-ai/integrations lint` must pass before every commit.

## 6. Final Review Gate

After all 22 slices are committed and their individual reviews are clean:

1. Run `pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint` — all must pass
2. Run `pr-review-toolkit:review-pr all` — all 6 specialist agents
3. Stop when all 6 agents report zero MEDIUM, HIGH, or CRITICAL issues
4. Only cosmetic suggestions may remain — file as issues, don't block the PR
5. This final review should confirm quality, not discover it (because every commit was already reviewed)

## 7. Verification Matrix

Per slice:
```bash
pnpm --filter @orbit-ai/integrations build
pnpm --filter @orbit-ai/integrations test
pnpm --filter @orbit-ai/integrations typecheck
```

Cross-package (if seams change):
```bash
pnpm -r build && pnpm -r test
```

## 8. Orbit Skill Triggers

| Slice | Trigger | Skill |
|-------|---------|-------|
| 3 | Credential handling + tenant scoping | `orbit-tenant-safety-review` |
| 6 | Token storage, refresh token handling | `orbit-tenant-safety-review` |
| 10 | Cross-tenant contact lookup | `orbit-tenant-safety-review` |
| 16 | API key handling from env | `orbit-tenant-safety-review` |
| 20 | New tables + tenant-scoped events | `orbit-schema-change`, `orbit-tenant-safety-review` |
| End of Phase 2 | Runtime primitives complete | `orbit-core-slice-review` |
| End of Phase 3 | Gmail connector complete | `orbit-core-slice-review` |
| End of Phase 4 | Calendar connector complete | `orbit-core-slice-review` |
| End of Phase 5 | Stripe connector complete | `orbit-core-slice-review` |

## 9. Spec Acceptance Criteria Mapping

Per spec section 14, all 8 criteria must be proven:

| # | Criterion | Covered by slice(s) |
|---|-----------|-------------------|
| 1 | Enable Gmail, Calendar, Stripe via `.orbit/integrations.json` | 5, 7, 12, 16 |
| 2 | Each connector exposes install, commands, tools, sync handlers | 7-11, 12-15, 16-19 |
| 3 | Connector state in Orbit-owned tenant-scoped tables | 20 |
| 4 | Tables registered through core plugin schema extension | 20 |
| 5 | Commands/tools registered dynamically when plugin enabled | 21 |
| 6 | Distinguish internal events, outbound webhooks, inbound provider webhooks | 19, 20 |
| 7 | Reads return sanitized DTOs; credentials stay server-only | 3 |
| 8 | Commands/tools use shared serializer helpers | 11, 15, 18, 21 |

## 10. Definition of Done

The integrations package is complete when:

- `packages/integrations` exists and builds
- Gmail, Google Calendar, and Stripe connectors are implemented end-to-end
- `OrbitIntegrationPlugin` contract from spec section 3 is implemented
- MCP extension tools registered per connector (6 tools total)
- CLI commands registered per connector (5 commands total)
- Event bus implements `OrbitIntegrationEventBus` from spec
- OAuth2 token lifecycle proven (refresh, revoke, exchange)
- `CredentialStore` interface defined and testable
- All connector reads use sanitized DTOs
- Unit and integration test coverage in place
- Every slice passed `superpowers:requesting-code-review`
- Final `pr-review-toolkit:review-pr` shows zero MEDIUM+ issues
- All 8 spec acceptance criteria are proven
- KB, CHANGELOG, and review artifacts updated

## 11. What Comes After

1. Merge `@orbit-ai/integrations` to main
2. Publish all 6 packages together as `0.1.0-alpha.1` to npm (0.1.0-alpha.0 is already tagged)
