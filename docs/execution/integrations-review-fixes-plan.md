# Integrations Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 18 validated issues from GitHub bot reviews on PRs #29–#34, organized into 3 phases mapping to 3 small PRs.

**Architecture:** Each phase targets a distinct risk category (security, data integrity, runtime). Fixes are minimal and test-first. Tasks may span multiple files and packages when the fix is inherently cross-cutting. Every task ends with a commit, package-scoped validation, and sub-agent review.

**Tech Stack:** TypeScript, Vitest, Zod v4, googleapis, stripe, Commander.js

---

## Issue Map

Every validated issue maps to exactly one task. No gaps, no duplicates.

| Issue # | Description | Package | Task | Phase/PR |
|---------|-------------|---------|------|----------|
| 1 | `findOrCreateContactFromEmail` ignores `orgId` in filters | integrations | 1 | 1 |
| 2 | MIME header injection — no CR/LF escaping in `sendMessage` | integrations | 2 | 1 |
| 3 | Polling cursor passed as Gmail `after:` query | integrations | 3 | 2 |
| 4 | `stoppedEarly` returns next page token, not current position | integrations | 3 | 2 |
| 5 | Gmail auth credential userId mismatch (save vs read slot) | integrations | 4 | 2 |
| 6 | `CREATE POLICY` not idempotent (no `DROP IF EXISTS`) | integrations | 5 | 2 |
| 7 | `connection_id` lacks FK to `integration_connections` | integrations | 5 | 2 |
| 8 | Idempotency key hash collision (`parts.join('::')`) | integrations | 6 | 2 |
| 9 | Idempotency filter by key only (should include method+path) | integrations | 6 | 2 |
| 10 | Stripe sync undefined metadata values in spread | integrations | 7 | 2 |
| 11 | MCP activities tool uses `description`/`user_id` (SDK renamed to `body`/`logged_by_user_id`) | mcp | 8 | 2 |
| 12 | `String(false)` → `'false'` breaks boolean CLI defaults | cli + integrations | 9 | 3 |
| 13 | SDK test missing `await` on async `create()` | sdk | 10 | 3 |
| 14 | `maxAttempts` allows 0/negative in retry | integrations | 11 | 3 |
| 15 | `sanitizeIntegrationMetadata` doesn't recurse into arrays | integrations | 12 | 3 |
| 16 | No email validation in `findOrCreateContactFromEmail` | integrations | 1 (Step 5) | 1 |
| 17 | Stripe CLI `--amount` NaN on missing value | integrations | 13 | 3 |
| 18 | `commander` in devDeps but used in public API surface | integrations | 13 | 3 |

---

## Branch Strategy

Each phase is an **independent branch from `main`** (not stacked):
- `fix/integrations-security` — Phase 1 (Tasks 1–2)
- `fix/integrations-data-integrity` — Phase 2 (Tasks 3–8)
- `fix/integrations-runtime` — Phase 3 (Tasks 9–13)

Since fixes touch different files with no cross-phase dependencies, they can be reviewed and merged independently. If a later phase does need a fix from an earlier one (unlikely), rebase before PR.

---

## Execution Protocol (applies to ALL tasks)

### Done definition (every task, before commit)

**Per-task:** validate ALL packages touched by that task:
```bash
# If task only touches packages/integrations:
pnpm --filter @orbit-ai/integrations build && pnpm --filter @orbit-ai/integrations test && pnpm --filter @orbit-ai/integrations typecheck && pnpm --filter @orbit-ai/integrations lint

# If task touches packages/mcp (Task 8):
pnpm --filter @orbit-ai/mcp build && pnpm --filter @orbit-ai/mcp test && pnpm --filter @orbit-ai/mcp typecheck && pnpm --filter @orbit-ai/mcp lint

# If task touches packages/cli (Task 9):
pnpm --filter @orbit-ai/cli build && pnpm --filter @orbit-ai/cli test && pnpm --filter @orbit-ai/cli typecheck

# If task touches packages/sdk (Task 10):
pnpm --filter @orbit-ai/sdk build && pnpm --filter @orbit-ai/sdk test && pnpm --filter @orbit-ai/sdk typecheck
```

**Per-phase (before PR):** full monorepo validation:
```bash
pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint
```

### Sub-agent review (every task, after commit)
Run `superpowers:requesting-code-review` after each commit. Fix ALL findings before starting the next task. This step cannot be deferred, batched, or skipped.

### Orbit skill triggers (task-specific)

| Task | Skill trigger | Reason |
|------|--------------|--------|
| 1 | `orbit-tenant-safety-review` | Org scoping on contact/company lookup |
| 4 | `orbit-tenant-safety-review` | Auth credential slot / trusted lookup path |
| 5 | `orbit-tenant-safety-review` | Tenant table migration policy + FK |
| 12 | `orbit-tenant-safety-review` | Secret redaction behavior |

### Coding conventions (include in every sub-agent brief)
- Always bind the error variable: `catch (err)` — never bare `catch {}`
- Always log before swallowing: `console.error(...)` inside every catch
- Defensive cast: `err instanceof Error ? err.message : String(err)`
- Duck-type guards for cross-boundary errors — never `instanceof` for IntegrationError or ZodError
- Exhaustiveness guards (`assertNever`) on every switch over union types
- Zod v4: use `.safeParse()` not `.parse()`

---

## Pre-PR and PR Gate (after each phase)

1. Run full monorepo pre-PR checklist: `pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint`
2. Run `orbit-plan-wrap-up` — update test baseline in CLAUDE.md, CHANGELOG.md, package READMEs
3. Run `pr-review-toolkit:review-pr` — all 6 specialist agents, zero MEDIUM+ stopping criterion
4. Create PR via `gh pr create`
5. After PR is open, run `code-review:code-review` — posts structured GitHub review comment

---

## Phase 1: Security Fixes (PR target: `fix/integrations-security`)

### Task 1: Scope contact lookups by organization_id

**Files:**
- Modify: `packages/integrations/src/shared/contacts.ts`
- Modify: `packages/integrations/src/shared/contacts.test.ts`

Issue #1: `findOrCreateContactFromEmail` takes `orgId` but never passes it to client filters. Cross-org contact bleed is possible.

- [ ] **Step 1: Write failing test — orgId is passed in contact filter**

Add to `packages/integrations/src/shared/contacts.test.ts`:

```typescript
it('passes organization_id in contact lookup filter', async () => {
  const contactClient: ContactLookupClient = {
    list: vi.fn().mockResolvedValue({ data: [{ id: 'c_1', email: 'a@b.com' }] }),
    create: vi.fn(),
  }
  const companyClient: CompanyLookupClient = {
    list: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn(),
  }

  await findOrCreateContactFromEmail(contactClient, companyClient, 'org_abc', 'a@b.com')

  expect(contactClient.list).toHaveBeenCalledWith({
    filter: { email: 'a@b.com', organization_id: 'org_abc' },
  })
})

it('passes organization_id in company lookup filter', async () => {
  const contactClient: ContactLookupClient = {
    list: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue({ id: 'c_new' }),
  }
  const companyClient: CompanyLookupClient = {
    list: vi.fn().mockResolvedValue({ data: [{ id: 'co_1', domain: 'b.com' }] }),
    create: vi.fn(),
  }

  await findOrCreateContactFromEmail(contactClient, companyClient, 'org_abc', 'a@b.com')

  expect(companyClient.list).toHaveBeenCalledWith({
    filter: { domain: 'b.com', organization_id: 'org_abc' },
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @orbit-ai/integrations test -- --reporter=verbose src/shared/contacts.test.ts`
Expected: FAIL — filters don't include `organization_id`

- [ ] **Step 3: Fix contact and company lookup filters**

In `packages/integrations/src/shared/contacts.ts`, change line 33–34:

```typescript
  // Step 1: Exact email match within org
  const existing = await contactClient.list({
    filter: { email: normalizedEmail, organization_id: orgId },
  })
```

And change line 52–53:

```typescript
    const companies = await companyClient.list({
      filter: { domain, organization_id: orgId },
    })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @orbit-ai/integrations test -- --reporter=verbose src/shared/contacts.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Add email validation guard**

Also in `findOrCreateContactFromEmail`, add at the top of the function body (after line 30):

```typescript
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw createIntegrationError(
      'INVALID_INPUT',
      `Invalid email address: '${email}'`,
      { provider: 'integrations' },
    )
  }
```

Add test:

```typescript
it('throws INVALID_INPUT for empty email', async () => {
  const contactClient: ContactLookupClient = { list: vi.fn(), create: vi.fn() }
  const companyClient: CompanyLookupClient = { list: vi.fn(), create: vi.fn() }

  await expect(
    findOrCreateContactFromEmail(contactClient, companyClient, 'org_1', ''),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})
```

- [ ] **Step 6: Fix hardcoded provider in error message**

Change line 43 from `{ provider: 'gmail' }` to `{ provider: 'integrations' }` — this is a shared helper, not Gmail-specific.

- [ ] **Step 7: Run full integrations test suite**

Run: `pnpm --filter @orbit-ai/integrations test`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add packages/integrations/src/shared/contacts.ts packages/integrations/src/shared/contacts.test.ts
git commit -m "fix(integrations): scope contact lookups by organization_id and validate email"
```

---

### Task 2: Sanitize MIME headers in Gmail sendMessage

**Files:**
- Modify: `packages/integrations/src/gmail/operations.ts`
- Modify: `packages/integrations/src/gmail/operations.test.ts`

Issue #2: No CR/LF escaping in MIME headers — header injection possible via subject/to fields.

- [ ] **Step 1: Write failing test — MIME header injection blocked**

Add to `packages/integrations/src/gmail/operations.test.ts`:

```typescript
it('strips CR/LF from MIME header fields to prevent injection', async () => {
  mockMessagesSend.mockResolvedValue({ data: { id: 'msg_1', threadId: 'th_1' } })

  await sendMessage(mockConfig, mockCredentialStore, 'org_1', {
    to: 'user@example.com',
    subject: 'Hello\r\nBcc: attacker@evil.com',
    body: 'test body',
  })

  const call = mockMessagesSend.mock.calls[0]![0] as Record<string, unknown>
  const raw = (call['requestBody'] as Record<string, string>)['raw']
  const decoded = Buffer.from(raw, 'base64url').toString('utf-8')

  // The injected Bcc header must NOT appear as a separate header line
  expect(decoded).not.toMatch(/^Bcc:/m)
  // Subject should be on a single line (CR/LF stripped)
  expect(decoded).toMatch(/^Subject: Hello Bcc: attacker@evil\.com$/m)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @orbit-ai/integrations test -- --reporter=verbose src/gmail/operations.test.ts`
Expected: FAIL — injected Bcc header appears

- [ ] **Step 3: Add MIME header sanitization helper**

In `packages/integrations/src/gmail/operations.ts`, add before `sendMessage`:

```typescript
/**
 * Strip CR/LF characters from MIME header values to prevent header injection.
 */
function sanitizeMimeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}
```

Then update the MIME construction in `sendMessage` (lines 128–136):

```typescript
    const mimeLines: string[] = [
      `To: ${sanitizeMimeHeader(input.to)}`,
      `Subject: ${sanitizeMimeHeader(input.subject)}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
    ]
    if (input.cc && input.cc.length > 0) {
      mimeLines.push(`Cc: ${input.cc.map(sanitizeMimeHeader).join(', ')}`)
    }
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `pnpm --filter @orbit-ai/integrations test -- --reporter=verbose src/gmail/operations.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/integrations/src/gmail/operations.ts packages/integrations/src/gmail/operations.test.ts
git commit -m "fix(integrations): sanitize MIME headers to prevent header injection"
```

---

## Phase 2: Data Integrity Fixes (PR target: `fix/integrations-data-integrity`)

### Task 3: Fix Gmail polling cursor semantics

**Files:**
- Modify: `packages/integrations/src/gmail/polling.ts`
- Modify: `packages/integrations/src/gmail/polling.test.ts`

Issues #3 and #4: Cursor passed as `after:` Gmail query (mixing pagination tokens with timestamps), and `stoppedEarly` returns wrong cursor.

- [ ] **Step 1: Write failing test — cursor used only as pageToken, not query**

Add to `packages/integrations/src/gmail/polling.test.ts`:

```typescript
it('uses cursor as pageToken only — not as after: query parameter', async () => {
  mockListMessages.mockResolvedValueOnce({
    data: { messages: [], nextPageToken: undefined },
    provider: 'gmail',
  })

  await pollGmailInbox(mockConfig, mockCredentialStore, 'org_1', mockSyncContext, 'cursor_abc')

  const listCall = mockListMessages.mock.calls[0]![3] as Record<string, unknown>
  expect(listCall['pageToken']).toBe('cursor_abc')
  expect(listCall['query']).toBeUndefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — current code passes `query: 'after:cursor_abc'`

- [ ] **Step 3: Fix polling.ts — remove after: query, use pageToken only**

In `packages/integrations/src/gmail/polling.ts`, replace lines 50–54:

```typescript
      const listOpts: { maxResults: number; pageToken?: string } = {
        maxResults: batchSize,
      }
      if (pageToken !== undefined) listOpts.pageToken = pageToken
```

Remove the line: `if (cursor !== undefined) listOpts.query = \`after:${cursor}\``

- [ ] **Step 4: Fix stoppedEarly cursor — track last processed page token**

Add a `lastCompletedPageToken` variable to track the page we fully processed:

Replace the entire polling loop body with:

```typescript
    let lastCompletedPageToken = cursor

    while (messagesProcessed < maxMessages) {
      if (Date.now() - startTime > maxDurationMs) {
        stoppedEarly = true
        break
      }

      const batchSize = Math.min(20, maxMessages - messagesProcessed)
      const listOpts: { maxResults: number; pageToken?: string } = {
        maxResults: batchSize,
      }
      if (pageToken !== undefined) listOpts.pageToken = pageToken
      const listResult = await listMessages(config, credentialStore, orgId, listOpts)

      if (listResult.data.messages.length === 0) break

      let pageFullyProcessed = true
      for (const msgSummary of listResult.data.messages) {
        if (messagesProcessed >= maxMessages) {
          stoppedEarly = true
          pageFullyProcessed = false
          break
        }
        if (Date.now() - startTime > maxDurationMs) {
          stoppedEarly = true
          pageFullyProcessed = false
          break
        }

        const fullMessage = await getMessage(config, credentialStore, orgId, msgSummary.id)
        const syncResult = await syncGmailMessage(syncContext, fullMessage.data)
        activities.push(syncResult.activity)
        messagesProcessed++
      }

      if (pageFullyProcessed) {
        lastCompletedPageToken = listResult.data.nextPageToken
      }

      pageToken = listResult.data.nextPageToken
      if (!pageToken) break
    }

    const result: PollGmailResult = {
      synced: activities.length,
      activities,
      stoppedEarly,
    }
    if (lastCompletedPageToken !== undefined) result.newCursor = lastCompletedPageToken
    return result
```

- [ ] **Step 5: Add test for stoppedEarly cursor behavior**

```typescript
it('returns last fully-processed page cursor when stopped early', async () => {
  // First page: 2 messages, has next page
  mockListMessages.mockResolvedValueOnce({
    data: { messages: [{ id: 'm1', threadId: 't1' }, { id: 'm2', threadId: 't2' }], nextPageToken: 'page2' },
    provider: 'gmail',
  })
  // getMessage mocks
  mockGetMessage.mockResolvedValue({ data: makeMockGmailMessage(), provider: 'gmail' })
  mockSyncGmailMessage.mockResolvedValue({ activity: { type: 'email' }, contactId: 'c_1', created: false })

  const result = await pollGmailInbox(mockConfig, mockCredentialStore, 'org_1', mockSyncContext, undefined, { maxMessages: 2 })

  // Stopped because we hit maxMessages after processing page 1 fully
  // newCursor should be 'page2' (the cursor for the NEXT unprocessed page)
  expect(result.newCursor).toBe('page2')
})
```

- [ ] **Step 6: Add stronger test — mid-page interruption returns CURRENT page cursor, not next**

```typescript
it('returns current page cursor when maxMessages interrupts mid-page', async () => {
  // Page has 3 messages but maxMessages=1 — we stop after first message
  mockListMessages.mockResolvedValueOnce({
    data: {
      messages: [
        { id: 'm1', threadId: 't1' },
        { id: 'm2', threadId: 't2' },
        { id: 'm3', threadId: 't3' },
      ],
      nextPageToken: 'page2',
    },
    provider: 'gmail',
  })
  mockGetMessage.mockResolvedValue({ data: makeMockGmailMessage(), provider: 'gmail' })
  mockSyncGmailMessage.mockResolvedValue({ activity: { type: 'email' }, contactId: 'c_1', created: false })

  const result = await pollGmailInbox(
    mockConfig, mockCredentialStore, 'org_1', mockSyncContext, 'page1', { maxMessages: 1 },
  )

  expect(result.stoppedEarly).toBe(true)
  expect(result.synced).toBe(1)
  // Page was NOT fully processed — cursor should be 'page1' (where we started),
  // not 'page2' (which would skip unprocessed messages m2/m3)
  expect(result.newCursor).toBe('page1')
})
```

- [ ] **Step 7: Run tests, commit**

Run: `pnpm --filter @orbit-ai/integrations test`

```bash
git add packages/integrations/src/gmail/polling.ts packages/integrations/src/gmail/polling.test.ts
git commit -m "fix(integrations): fix Gmail polling cursor semantics and stoppedEarly tracking"
```

---

### Task 4: Fix shared OAuth credential userId mismatch (Gmail + Calendar)

**Files:**
- Modify: `packages/integrations/src/oauth.ts`
- Modify: `packages/integrations/src/gmail/auth.ts`
- Modify: `packages/integrations/src/gmail/auth.test.ts`
- Modify: `packages/integrations/src/google-calendar/auth.ts`
- Modify: `packages/integrations/src/google-calendar/auth.test.ts`

Issue #5: `completeGmailAuth`/`completeCalendarAuth` save credentials under a specific `userId`, but `getGmailClient`/`getCalendarClient` read from the default slot (no userId). This is a shared design bug — both connectors use `GoogleOAuthHelper.getValidAccessToken()` which doesn't thread `userId`.

**Design decision:** Credentials are **user-scoped**. The `userId` parameter must be threaded consistently through all connector entrypoints that read credentials.

- [ ] **Step 1: Write failing tests for BOTH connectors**

In `packages/integrations/src/gmail/auth.test.ts`:

```typescript
it('retrieves user-scoped credentials when userId is provided', async () => {
  const store = new InMemoryCredentialStore()
  await store.saveCredentials('org_1', 'gmail', 'user_alice', {
    accessToken: 'alice-token',
    refreshToken: 'alice-refresh',
    expiresAt: Date.now() + 3600000,
  })

  const result = await getGmailClient(mockConfig, store, 'org_1', 'user_alice')
  expect(result.accessToken).toBe('alice-token')
})
```

In `packages/integrations/src/google-calendar/auth.test.ts`:

```typescript
it('retrieves user-scoped credentials when userId is provided', async () => {
  const store = new InMemoryCredentialStore()
  await store.saveCredentials('org_1', 'google-calendar', 'user_bob', {
    accessToken: 'bob-token',
    refreshToken: 'bob-refresh',
    expiresAt: Date.now() + 3600000,
  })

  const result = await getCalendarClient(mockConfig, store, 'org_1', 'user_bob')
  expect(result.accessToken).toBe('bob-token')
})
```

- [ ] **Step 2: Update shared `GoogleOAuthHelper.getValidAccessToken` in `oauth.ts`**

Add `userId` parameter, thread it to both `getCredentials` and `saveCredentials`:

```typescript
  async getValidAccessToken(
    orgId: string,
    provider: string,
    credentialStore: CredentialStore,
    connectionTracker?: ConnectionStatusTracker,
    userId?: string,
  ): Promise<string> {
    const creds = await credentialStore.getCredentials(orgId, provider, userId)
    // ... existing refresh logic ...
    await credentialStore.saveCredentials(orgId, provider, userId ?? '__default__', updated)
```

- [ ] **Step 3: Update Gmail `getGmailClient` in `gmail/auth.ts`**

```typescript
export async function getGmailClient(
  config: GmailConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  userId?: string,
): Promise<{ accessToken: string }> {
  const helper = createGmailOAuthHelper(config)
  const accessToken = await helper.getValidAccessToken(orgId, GMAIL_SLUG, credentialStore, undefined, userId)
  return { accessToken }
}
```

- [ ] **Step 4: Update Calendar `getCalendarClient` in `google-calendar/auth.ts`**

```typescript
export async function getCalendarClient(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  userId?: string,
): Promise<{ accessToken: string }> {
  const helper = createCalendarOAuthHelper(config)
  const accessToken = await helper.getValidAccessToken(orgId, CALENDAR_SLUG, credentialStore, undefined, userId)
  return { accessToken }
}
```

- [ ] **Step 5: Run tests for both connectors, fix any compilation issues, commit**

Run: `pnpm --filter @orbit-ai/integrations test`

```bash
git add packages/integrations/src/gmail/auth.ts packages/integrations/src/gmail/auth.test.ts packages/integrations/src/oauth.ts
git commit -m "fix(integrations): thread userId through OAuth credential read/write path"
```

---

### Task 5: Make schema migration policies idempotent + add FK

**Files:**
- Modify: `packages/integrations/src/schema-extension.ts`
- Modify: `packages/integrations/src/schema-extension.test.ts`

Issues #6 and #7: `CREATE POLICY` fails on re-apply; `connection_id` lacks FK constraint.

- [ ] **Step 1: Write test — migrations include DROP POLICY IF EXISTS**

```typescript
it('migration 001 drops policy before creating (idempotent)', () => {
  const migration = integrationSchemaExtension.migrations[0]!
  const dropIdx = migration.up.findIndex(sql => sql.includes('DROP POLICY IF EXISTS ic_tenant_isolation'))
  const createIdx = migration.up.findIndex(sql => sql.includes('CREATE POLICY ic_tenant_isolation'))
  expect(dropIdx).toBeGreaterThanOrEqual(0)
  expect(createIdx).toBeGreaterThan(dropIdx)
})

it('migration 002 includes FK constraint on connection_id', () => {
  const migration = integrationSchemaExtension.migrations[1]!
  const createSql = migration.up.find(sql => sql.includes('CREATE TABLE'))
  expect(createSql).toContain('REFERENCES integration_connections(id)')
})
```

- [ ] **Step 2: Fix schema-extension.ts**

In migration 001, insert before the `CREATE POLICY` line:

```typescript
        `DROP POLICY IF EXISTS ic_tenant_isolation ON integration_connections`,
```

In migration 002, change `connection_id TEXT NOT NULL` to:

```typescript
          connection_id TEXT NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
```

And insert before the `CREATE POLICY` line:

```typescript
        `DROP POLICY IF EXISTS iss_tenant_isolation ON integration_sync_state`,
```

- [ ] **Step 3: Run tests, commit**

```bash
git add packages/integrations/src/schema-extension.ts packages/integrations/src/schema-extension.test.ts
git commit -m "fix(integrations): make migration policies idempotent and add FK constraint"
```

---

### Task 6: Fix idempotency key hash collision + filter precision

**Files:**
- Modify: `packages/integrations/src/idempotency.ts`
- Modify: `packages/integrations/src/idempotency.test.ts`

Issues #8 and #9: `join('::')` creates ambiguous keys; filter by key only is too broad.

- [ ] **Step 1: Write failing test — different inputs with :: in values produce different keys**

```typescript
it('generates different keys for inputs that would collide with :: separator', () => {
  const key1 = generateIdempotencyKey(['a', 'b::c'])
  const key2 = generateIdempotencyKey(['a::b', 'c'])
  expect(key1).not.toBe(key2)
})
```

- [ ] **Step 2: Fix separator — use length-prefixed encoding**

In `packages/integrations/src/idempotency.ts`, replace line 14–15:

```typescript
export function generateIdempotencyKey(parts: string[]): string {
  // Length-prefix each part to prevent ambiguity: "3:abc5:hello" not "abc::hello"
  const encoded = parts.map(p => `${p.length}:${p}`).join('')
  return createHash('sha256').update(encoded).digest('hex').slice(0, 32)
}
```

- [ ] **Step 3: Fix filter to include method and path**

In the `check` method, update line 55–57:

```typescript
      const result = await this.repository.list(ctx, {
        filter: { key, method: 'INTEGRATION', path: '/integration/dedup' },
        limit: 1,
      })
```

- [ ] **Step 4: Run tests, commit**

```bash
git add packages/integrations/src/idempotency.ts packages/integrations/src/idempotency.test.ts
git commit -m "fix(integrations): use length-prefixed encoding for idempotency keys and narrow filter"
```

---

### Task 7: Fix Stripe sync undefined metadata values

**Files:**
- Modify: `packages/integrations/src/stripe/sync.ts`
- Modify: `packages/integrations/src/stripe/sync.test.ts`

Issue #10: `metadata` object has `undefined` props that get dropped on serialization.

- [ ] **Step 1: Write test — metadata has no undefined values**

```typescript
it('does not include undefined values in payment metadata', async () => {
  // Session with no payment_intent and no customer_details
  mockRetrieve.mockResolvedValue({
    id: 'cs_1',
    payment_status: 'paid',
    amount_total: 1000,
    currency: 'usd',
    payment_intent: null,
    customer_details: null,
    metadata: null,
  })

  const result = await syncStripeCheckoutSession(mockConfig, 'cs_1')
  const values = Object.values(result.data.payment.metadata ?? {})
  expect(values.every(v => v !== undefined)).toBe(true)
})
```

- [ ] **Step 2: Fix — use conditional spreads for metadata**

In `packages/integrations/src/stripe/sync.ts`, replace lines 49–53:

```typescript
      metadata: {
        stripe_session_id: session.id,
        ...(checkoutSync.paymentIntentId != null ? { stripe_payment_intent: checkoutSync.paymentIntentId } : {}),
        ...(checkoutSync.customerEmail != null ? { stripe_customer_email: checkoutSync.customerEmail } : {}),
      },
```

- [ ] **Step 3: Run tests, commit**

```bash
git add packages/integrations/src/stripe/sync.ts packages/integrations/src/stripe/sync.test.ts
git commit -m "fix(integrations): use conditional spreads for Stripe payment metadata"
```

---

### Task 8: Fix MCP activities tool description→body field mismatch + .safeParse()

**Files:**
- Modify: `packages/mcp/src/tools/activities.ts`
- Create: `packages/mcp/src/__tests__/activities.test.ts`

**Done definition for this task:** `pnpm --filter @orbit-ai/mcp build && pnpm --filter @orbit-ai/mcp test && pnpm --filter @orbit-ai/mcp typecheck && pnpm --filter @orbit-ai/mcp lint`

Issue #11: MCP tool passes `description`/`user_id` to SDK but SDK fields were renamed to `body`/`logged_by_user_id`. Also: file uses `.parse()` which violates the `.safeParse()` convention — fix while editing.

- [ ] **Step 1: Create test file `packages/mcp/src/__tests__/activities.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { handleLogActivity } from '../tools/activities.js'

describe('handleLogActivity', () => {
  it('passes body field (not description) to SDK', async () => {
    const mockLog = vi.fn().mockResolvedValue({ id: 'act_1', type: 'call', body: 'notes' })
    const client = { activities: { log: mockLog } } as unknown

    await handleLogActivity(client as never, {
      type: 'call',
      body: 'notes from the call',
      occurred_at: '2026-04-10T10:00:00Z',
    })

    const callArg = mockLog.mock.calls[0]![0]
    expect(callArg).toHaveProperty('body')
    expect(callArg).not.toHaveProperty('description')
  })

  it('passes logged_by_user_id field (not user_id) to SDK', async () => {
    const mockLog = vi.fn().mockResolvedValue({ id: 'act_2', type: 'call' })
    const client = { activities: { log: mockLog } } as unknown

    await handleLogActivity(client as never, {
      type: 'call',
      logged_by_user_id: 'usr_abc',
      occurred_at: '2026-04-10T10:00:00Z',
    })

    const callArg = mockLog.mock.calls[0]![0]
    expect(callArg).toHaveProperty('logged_by_user_id')
    expect(callArg).not.toHaveProperty('user_id')
  })
})
```

- [ ] **Step 2: Update LogActivityInput schema and handler**

In `packages/mcp/src/tools/activities.ts`:

Rename fields in `LogActivityInput` schema:
- `description` → `body`
- `user_id` → `logged_by_user_id`

Replace `.parse()` with `.safeParse()` in both handlers:

```typescript
export async function handleLogActivity(client: OrbitClient, rawArgs: unknown) {
  const parsed = LogActivityInput.safeParse(rawArgs)
  if (!parsed.success) {
    return toToolSuccess({ error: 'Invalid input', details: parsed.error.message })
  }
  const args = parsed.data
  return toToolSuccess(
    sanitizeObjectDeep(
      await client.activities.log({
        type: args.type,
        occurred_at: args.occurred_at,
        ...(args.subject ? { subject: sanitizeStringInput(args.subject) } : {}),
        ...(args.body ? { body: sanitizeStringInput(args.body) } : {}),
        ...(args.contact_id ? { contact_id: args.contact_id } : {}),
        ...(args.company_id ? { company_id: args.company_id } : {}),
        ...(args.deal_id ? { deal_id: args.deal_id } : {}),
        ...(args.logged_by_user_id ? { logged_by_user_id: args.logged_by_user_id } : {}),
        ...(args.custom_fields ? { custom_fields: args.custom_fields } : {}),
      }),
    ),
  )
}
```

Similarly update `ListActivitiesInput`: rename `user_id` → `logged_by_user_id`, replace `.parse()` with `.safeParse()`, update `handleListActivities`.

- [ ] **Step 3: Run MCP tests and fix any failures**

Run: `pnpm --filter @orbit-ai/mcp build && pnpm --filter @orbit-ai/mcp test && pnpm --filter @orbit-ai/mcp typecheck && pnpm --filter @orbit-ai/mcp lint`
Fix any test referencing `description` or `user_id` in the activities tool context.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/tools/activities.ts
git commit -m "fix(mcp): align activities tool fields with SDK (description→body, user_id→logged_by_user_id)"
```

---

## Phase 3: Runtime & Edge Case Fixes (PR target: `fix/integrations-runtime`)

### Task 9: Fix boolean option stringification in CLI

**Files:**
- Modify: `packages/cli/src/commands/integrations.ts`
- Modify: `packages/integrations/src/cli.ts`
- Add test: `packages/cli/src/__tests__/integrations.test.ts`
- Add test: `packages/integrations/src/cli.test.ts`

**Done definition for this task:** validate BOTH packages:
- `pnpm --filter @orbit-ai/cli build && pnpm --filter @orbit-ai/cli test && pnpm --filter @orbit-ai/cli typecheck`
- `pnpm --filter @orbit-ai/integrations build && pnpm --filter @orbit-ai/integrations test && pnpm --filter @orbit-ai/integrations typecheck && pnpm --filter @orbit-ai/integrations lint`

Issue #12: `String(false)` converts boolean to `'false'` which is truthy.

- [ ] **Step 1: Fix both files — check type before converting**

In `packages/cli/src/commands/integrations.ts` line 34–35, replace:

```typescript
        if (opt.defaultValue !== undefined) {
          sub.option(opt.flags, opt.description, String(opt.defaultValue))
```

With:

```typescript
        if (opt.defaultValue !== undefined) {
          sub.option(
            opt.flags,
            opt.description,
            typeof opt.defaultValue === 'boolean' ? opt.defaultValue : String(opt.defaultValue),
          )
```

Apply the same fix in `packages/integrations/src/cli.ts` line 81.

- [ ] **Step 2: Run tests, commit**

```bash
git add packages/cli/src/commands/integrations.ts packages/integrations/src/cli.ts
git commit -m "fix(cli): preserve boolean option defaults instead of stringifying"
```

---

### Task 10: Add await to async test in SDK

**Files:**
- Modify: `packages/sdk/src/__tests__/resources-wave2.test.ts`

**Done definition for this task:** `pnpm --filter @orbit-ai/sdk build && pnpm --filter @orbit-ai/sdk test && pnpm --filter @orbit-ai/sdk typecheck`

Issue #13: `activities.create(input)` called without `await`.

- [ ] **Step 1: Add await**

In `packages/sdk/src/__tests__/resources-wave2.test.ts` line 133, change:

```typescript
    activities.create(input)
```

to:

```typescript
    await activities.create(input)
```

- [ ] **Step 2: Run SDK tests, commit**

```bash
git add packages/sdk/src/__tests__/resources-wave2.test.ts
git commit -m "fix(sdk): add missing await in wave2 activity test"
```

---

### Task 11: Validate maxAttempts in retry

**Files:**
- Modify: `packages/integrations/src/retry.ts`
- Modify: `packages/integrations/src/retry.test.ts`

Issue #14: `maxAttempts` allows 0 or negative, causing `lastError` to be `undefined`.

- [ ] **Step 1: Write failing test**

```typescript
it('throws immediately when maxAttempts is 0', async () => {
  await expect(
    withBoundedRetry(() => Promise.resolve('ok'), { maxAttempts: 0 }),
  ).rejects.toThrow('maxAttempts must be >= 1')
})
```

- [ ] **Step 2: Add validation**

In `packages/integrations/src/retry.ts`, after line 16:

```typescript
  if (maxAttempts < 1) {
    throw new Error('maxAttempts must be >= 1')
  }
```

- [ ] **Step 3: Run tests, commit**

```bash
git add packages/integrations/src/retry.ts packages/integrations/src/retry.test.ts
git commit -m "fix(integrations): validate maxAttempts >= 1 in retry"
```

---

### Task 12: Add array recursion to sanitizeIntegrationMetadata

**Files:**
- Modify: `packages/integrations/src/redaction.ts`
- Modify: `packages/integrations/src/redaction.test.ts`

Issue #15: Arrays are not recursed — nested secrets in arrays leak.

- [ ] **Step 1: Write failing test**

```typescript
it('sanitizes sensitive keys inside array elements', () => {
  const obj = {
    connections: [
      { name: 'gmail', accessToken: 'ya29.secret', status: 'active' },
      { name: 'stripe', apiKey: 'sk_live_abc', status: 'active' },
    ],
  }
  const result = sanitizeIntegrationMetadata(obj)
  const connections = result['connections'] as Array<Record<string, unknown>>
  expect(connections[0]!['accessToken']).toBe('[REDACTED]')
  expect(connections[1]!['apiKey']).toBe('[REDACTED]')
  expect(connections[0]!['name']).toBe('gmail')
})
```

- [ ] **Step 2: Fix — add array handling**

In `packages/integrations/src/redaction.ts`, replace lines 52–54:

```typescript
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? sanitizeIntegrationMetadata(item as Record<string, unknown>, depth + 1)
          : item,
      )
    } else if (value !== null && typeof value === 'object') {
```

- [ ] **Step 3: Run tests, commit**

```bash
git add packages/integrations/src/redaction.ts packages/integrations/src/redaction.test.ts
git commit -m "fix(integrations): recurse into arrays in sanitizeIntegrationMetadata"
```

---

### Task 13: Fix Stripe CLI amount validation + move commander to dependencies

**Files:**
- Modify: `packages/integrations/src/stripe/mcp-tools.ts`
- Modify: `packages/integrations/src/stripe/mcp-tools.test.ts`
- Modify: `packages/integrations/package.json`

Issues #17 and #18: CLI `--amount` produces NaN; commander is devDep but used in public API.

- [ ] **Step 1: Write failing test for invalid amount**

Add to `packages/integrations/src/stripe/mcp-tools.test.ts`:

```typescript
it('link-create prints error and returns when amount is missing/NaN', async () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const commands = buildStripeCommands(mockContext)
  const linkCreate = commands.find(c => c.name === 'link-create')!

  // Simulate Commander passing opts with missing amount
  await linkCreate.action({ currency: 'usd' })

  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('--amount must be a positive number'),
  )
  consoleSpy.mockRestore()
})
```

- [ ] **Step 2: Add amount validation in Stripe CLI link-create command**

In `packages/integrations/src/stripe/mcp-tools.ts`, in the `link-create` action, add before the `createPaymentLink` call:

```typescript
        const amount = Number(opts['amount'])
        if (!Number.isFinite(amount) || amount <= 0) {
          console.error('Error: --amount must be a positive number (in cents)')
          return
        }
```

- [ ] **Step 3: Move commander from devDependencies to dependencies**

In `packages/integrations/package.json`, move `"commander": "^12.0.0"` from `devDependencies` to `dependencies`.

- [ ] **Step 4: Run pnpm install, tests, commit**

```bash
pnpm install
pnpm --filter @orbit-ai/integrations build
pnpm --filter @orbit-ai/integrations test
pnpm --filter @orbit-ai/integrations typecheck
pnpm --filter @orbit-ai/integrations lint
git add packages/integrations/src/stripe/mcp-tools.ts packages/integrations/src/stripe/mcp-tools.test.ts packages/integrations/package.json pnpm-lock.yaml
git commit -m "fix(integrations): validate Stripe CLI amount and move commander to dependencies"
```

## PR Summary

| Phase | PR branch | Tasks | Issues fixed |
|-------|-----------|-------|--------------|
| 1 — Security | `fix/integrations-security` | 1–2 | #1, #2, #16 |
| 2 — Data Integrity | `fix/integrations-data-integrity` | 3–8 | #3, #4, #5, #6, #7, #8, #9, #10, #11 |
| 3 — Runtime | `fix/integrations-runtime` | 9–13 | #12, #13, #14, #15, #17, #18 |

**Total: 13 tasks, 18 issues, 3 PRs.**
