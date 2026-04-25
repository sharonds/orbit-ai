# Plan C Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the test-quality, harness, and small-bug findings from the Plan C post-merge review (PR #48 + #72 + stray commit `6354172`). Make the E2E suite a credible publish gate by removing coverage theater, adding the missing tenant-isolation journey, and fixing the harness defects that overstate Postgres coverage today.

**Architecture:** Single focused PR. No new features. Targeted edits to existing journeys + harness + a few small code-side bugs. **One brand-new journey** (Journey 15: tenant isolation). The real schema-engine migration implementation (replacing the `preview`/`apply` stubs) is **not** in this plan — it's deferred to a separate plan that needs brainstorming first (placeholder: `2026-04-24-plan-c5-migration-engine.md`). Journey 8 in this plan is rewritten to be honest about what it tests today (stub passthrough), and **migration-safety certification is blocked on Plan C.5's executable migration engine**. Until C.5 lands, no release gate or release definition may claim Journey 8 proves destructive-migration safety.

**Tech Stack:** Same as Plan C — vitest, `@orbit-ai/core` + `api` + `sdk` + `cli` + `mcp` + `integrations` + `demo-seed`, `execa`, Node 22 `fetch`.

**Branch:** work continues on the current branch (`claude/recursing-almeida-e96c5d`). Do NOT create a new branch or switch branches.

**Test baseline:**
- `pnpm -r test` baseline = **1796** (per CLAUDE.md). **WILL GROW** by: Task 10 (+2 unit tests), Task 11 (+4 unit tests), Task 9 (±1 if Stripe CLI tests change count), plus any new tests Tasks 5/7/8 add. Expected new baseline: **≥1802**. Task 15 MUST record the actual number and update CLAUDE.md.
- `pnpm -F @orbit-ai/e2e test` baseline today = **16 tests** (14 journeys + 2 harness tests). After this plan: **17** (one new tenant-isolation journey). Task 3 and Task 4 EXTEND existing tests rather than adding new `it()` blocks — no count change from them.
- `scripts/release-workflow.test.mjs` (via `node --test`, not `pnpm -r test`) grows by the regression tests added in Tasks 5, 6, 7, 8. Not part of the `pnpm -r test` count; tracked separately.

**Pre-resolved executor decisions** (do NOT delegate to sub-agents):
- **Task 5**: Use **path A** (make `prepareCliWorkspace` adapter-aware). Rationale: the current helper silently forces SQLite, which makes the Postgres E2E matrix overstate coverage. This plan must prove Postgres-family execution actually uses a Postgres adapter/database for CLI journeys 7 and 8. Do not narrow the matrix as a substitute.
- **Task 9**: Use **path A** (stop persisting the sentinel refreshToken) IFF an audit of `refreshToken` consumers confirms they tolerate `null` — Task 9 includes the audit as a mandatory sub-step. If any consumer fails the audit, fall back to path B explicitly.

**Out of scope (deferred to separate plans):**
- Real schema-engine `preview`/`apply` implementations — see [Plan C.5](./2026-04-24-plan-c5-migration-engine.md). This plan does NOT promise any destructive-gate behavior; it explicitly blocks destructive-migration safety claims until the stub is replaced or rejected as insufficient by an executable migration-engine gate.
- DirectTransport `updateField` / `deleteField` engine methods — also Plan C.5 territory.
- Real-API contract tests for Gmail / Calendar / Stripe connectors — needs a fake/mock framework and possibly a record-and-replay layer; separate plan.
- Migration to npm Trusted Publishing, Dependabot/`pnpm audit` gating — deferred per Plan B follow-ups.

---

## Cloud Execution Context

> This section is for cloud/remote agents executing this plan without access to the original review conversation.

| Item | Value |
|------|-------|
| **Repository** | `https://github.com/sharonds/orbit-ai` |
| **Branch** | Create from `main`: `git worktree add .worktrees/plan-c-followups main -b fix/plan-c-followups` |
| **Node** | 22+ required |
| **Package manager** | pnpm 9.12.3 |
| **Baseline tests** | 1796 passing — run `pnpm -r test` to verify before starting |
| **Pre-execution** | `pnpm -r build && pnpm -r test && pnpm -r lint && pnpm --filter @orbit-ai/e2e test` must all pass first |
| **Post-execution** | `pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm --filter @orbit-ai/e2e test` — all 15 journeys must pass |
| **Key dependency** | Plan C.5 must land before Journey 8 can certify real migration safety |

### Coding conventions (apply to every task)
- `catch (err)` — never bare `catch {}`; log before swallowing with `console.error(...)`
- Defensive cast: `err instanceof Error ? err.message : String(err)`
- Tests ship in the same commit as the feature
- `pnpm -r lint` must pass before each commit
- Duck-type guards for cross-boundary errors: never `instanceof ZodError` or `instanceof OrbitApiError`

---

## Verified current state (as of `main` HEAD)

| Thing | State | Evidence |
|---|---|---|
| `engine.preview` / `engine.apply` | **Stubs** returning `{ operations: [], destructive: false }` and `{ applied: [] }` regardless of input | `packages/core/src/schema-engine/engine.ts:139-155` |
| Journey 8 destructive-gate | **Missing** — only happy path tested; `expect(plan?.destructive ?? false).toBe(false)` is trivially true on the stub | `e2e/src/journeys/08-migration-preview-apply.test.ts:5-41` |
| Tenant isolation journey | **Missing entirely** — `buildStack({ tenant: 'both' })` is supported (`build-stack.ts:130, 193` returns `betaOrgId`) but no journey uses it | grep finds zero `betaOrgId` references in `e2e/src/journeys/` |
| Journey 11 MCP tool calls | **3/8 actually invoked** — `tools/list` returns 8, but only `search_records`, `create_record`, `get_record` are called | `e2e/src/journeys/11-mcp-core-tools.test.ts:13-58` |
| `ORBIT_E2E_ADAPTER` adoption | **7/14 journeys honor it** (3, 4, 5, 6, 9, 10, 11). Journeys 7, 8 use `prepareCliWorkspace` which is hard-coded SQLite. CI's "Postgres matrix" runs `02..11` — journeys 7 + 8 silently re-run SQLite. **Fix required:** make the CLI workspace adapter-aware and add proof that Postgres-family runs actually hit Postgres. | `e2e/src/harness/prepare-cli-workspace.ts:25`; `e2e/src/journeys/07-custom-field.test.ts`; `.github/workflows/ci.yml:182` |
| `engine.listObjects` / `getObject` | **Skip `assertOrgContext`** — `addField` / `preview` / `apply` all call it; reads delegate to repo (defense-in-depth gap) | `engine.ts:77-92` |
| Postgres `api_keys` upsert conflict target | **`ON CONFLICT (key_prefix)`** — technically valid (BOTH `api_keys_hash_idx` AND `api_keys_prefix_idx` are unique at `tables.ts:67`) but semantically wrong: the hash is the row identity, not the prefix. Fix is a refactor for clarity, not a correctness bug. | `e2e/src/harness/build-stack.ts:107`; `packages/core/src/schema/tables.ts:67` |
| `run-mcp.ts` resource leak | **Server not closed if `mcpClient.connect` throws** | `e2e/src/harness/run-mcp.ts:39-40` |
| Stripe CLI sentinel `refreshToken` | **`'__stripe_api_key__'`** — shared `runStatusAction` doesn't branch on the sentinel | `packages/integrations/src/stripe/cli.ts:56-69` |
| Deal `value` validation | **Accepts any number** including `1e21`; coerces to scientific-notation string; `buildDealStats` round-trips through `Number()` | `packages/core/src/entities/deals/validators.ts:21,50`; `service.ts:316-318` |
| CRUD matrix update verification | **Only returns `{id}`** — never re-`get`s to prove the update persisted | `e2e/src/journeys/_crud-matrix.ts:49-50,94-95,148-153,218-225` |
| PR #48 description | **Out of date** — claims "DirectTransport workflow sub-routes" is a follow-up gap, but commit `07d9f1e` in the same PR added that dispatch | PR #48 body |

---

## File Structure

```
e2e/src/journeys/
├── 08-migration-preview-apply.test.ts    # rewrite: assert stub passthrough, document Plan C.5 dependency
├── 11-mcp-core-tools.test.ts             # extend: invoke every registered MCP tool
├── 15-tenant-isolation.test.ts           # NEW — cross-surface cross-org ops return RESOURCE_NOT_FOUND
└── _crud-matrix.ts                       # extend: update-then-get verification per surface

e2e/src/harness/
├── build-stack.ts                        # fix ON CONFLICT target; tighten error path
├── run-mcp.ts                            # fix resource leak on connect failure
└── prepare-cli-workspace.ts              # accept adapter override; CLI journeys 7/8 must run on Postgres when requested

.github/workflows/
└── ci.yml                                # keep Postgres-sensitive journeys and prove they use Postgres

packages/core/src/
├── schema-engine/engine.ts               # add assertOrgContext to listObjects/getObject
└── entities/deals/validators.ts          # tighten value to safe-numeric string regex

packages/integrations/src/stripe/cli.ts   # branch status path on sentinel refreshToken

docs/product/release-definition-v2.md     # update existing launch-gate definition
CHANGELOG.md                              # update PR #48 entry note (workflow dispatch closed)
```

No new packages. One new test file. Every change is localized.

---

## Task 1: Restore Journey 8 to honest passthrough (no destructive-gate claim)

**Why:** Today's Journey 8 asserts `expect(plan?.destructive ?? false).toBe(false)` against an engine that ALWAYS returns `destructive: false`. The journey passes by virtue of the stub, certifying a contract that the engine doesn't actually implement. Either we (a) implement the destructive gate (deferred to Plan C.5) or (b) make this journey HONEST about what it currently tests. We pick (b) for this plan.

**Files:**
- Modify: `e2e/src/journeys/08-migration-preview-apply.test.ts`

- [ ] **Step 1: Read current journey**

Run: `cat e2e/src/journeys/08-migration-preview-apply.test.ts`

- [ ] **Step 2: Replace the journey body with honest passthrough assertions**

The new journey should:
1. Assert that `migrate --preview` returns the documented stub shape: `{ operations: [], destructive: false }` (or whatever the stub actually returns — verify by running it).
2. Assert that `migrate --apply` returns the documented stub shape: `{ applied: [] }`.
3. Add a comment block at the top documenting that real destructive-gate semantics are tracked in Plan C.5 (`docs/superpowers/plans/2026-04-24-plan-c5-migration-engine.md`).
4. Remove the misleading `expect(plan?.destructive ?? false).toBe(false)` — replace with `expect(plan?.destructive).toBe(false)` AND a comment that this is asserting stub behavior, not real destructive detection.
5. Add a comment or test name making clear this journey is **blocked from serving as a migration-safety gate** until Plan C.5 lands. This is required because asserting the stub's `destructive: false` value is not a safety assertion.

Replace the file contents with:

```typescript
import { describe, expect, it } from 'vitest'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'
import { runCli } from '../harness/run-cli.js'

// NOTE: As of alpha.0, OrbitSchemaEngine.preview/apply are stubs that return
// empty operations regardless of input (see packages/core/src/schema-engine/engine.ts).
// This journey only certifies that the CLI surface plumbs through the stub
// correctly — it does NOT prove destructive-migration safety. Real destructive-
// gate semantics are tracked in Plan C.5:
//   docs/superpowers/plans/2026-04-24-plan-c5-migration-engine.md
//
// When C.5 lands, DELETE the `toHaveLength(0)` assertions below and replace
// with (a) trigger a real destructive operation, (b) assert preview reports
// `destructive: true`, (c) assert `migrate --apply` (without --yes) refuses,
// (d) assert `--apply --yes` succeeds.

describe('Journey 8 — migration preview + apply (alpha stub passthrough)', () => {
  it('CLI plumbs preview/apply requests through to the stub engine', async () => {
    const workspace = await prepareCliWorkspace({ tenant: 'acme' })
    try {
      const previewResult = await runCli({
        args: ['--mode', 'direct', '--json', 'migrate', '--preview'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(previewResult.exitCode).toBe(0)
      const preview = previewResult.json as { operations?: unknown[]; destructive?: boolean; status?: string }
      // Stub returns { operations: [], destructive: false, status: 'ok' }.
      // We assert exact shape rather than `toBeTruthy()` so a future engine
      // change must update this journey rather than silently pass.
      expect(Array.isArray(preview.operations)).toBe(true)
      expect(preview.operations).toHaveLength(0)
      expect(preview.destructive).toBe(false)
      expect(preview.status).toBe('ok')

      const applyResult = await runCli({
        args: ['--mode', 'direct', '--json', 'migrate', '--apply', '--yes'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(applyResult.exitCode).toBe(0)
      const apply = applyResult.json as { applied?: unknown[]; status?: string }
      expect(Array.isArray(apply.applied)).toBe(true)
      expect(apply.applied).toHaveLength(0)
      expect(apply.status).toBe('ok')
    } finally {
      await workspace.cleanup()
    }
  })
})
```

Key correctness notes:
- `prepareCliWorkspace` takes `{ tenant }` (NOT a stack). It builds its own SQLite DB and seeds the tenant. No `buildStack` needed.
- `runCli` takes a single `CliInvocation` object: `{ args, cwd, env }`. Positional form does not exist.
- Stub shape verified at `packages/core/src/schema-engine/engine.ts:140-155`: preview → `{ operations: [], destructive: false, status: 'ok' }`; apply → `{ applied: [], status: 'ok' }`.

- [ ] **Step 3: Run the journey**

Run: `pnpm -F @orbit-ai/e2e test src/journeys/08-migration-preview-apply.test.ts`
Expected: passes. If the stub shape differs (e.g. `applied` is missing, returns `null`), update the assertions to match what the engine ACTUALLY returns — do not edit the engine in this plan.

- [ ] **Step 4: Verify no release gate treats Journey 8 as migration safety**

Run: `grep -rn "destructive-migration safety\|migration safety\|Journey 8" docs/product/release-definition-v2.md e2e/README.md CHANGELOG.md`

Expected: every match says Journey 8 is stub passthrough only or blocked on Plan C.5. If any doc says Journey 8 certifies migration safety, fix that doc in Task 12 before opening the PR.

- [ ] **Step 5: Commit**

```bash
git add e2e/src/journeys/08-migration-preview-apply.test.ts
git commit -m "test(e2e): make Journey 8 honest about stub passthrough; defer destructive gate to Plan C.5"
```

---

## Task 2: Add Journey 15 — tenant isolation

**Why:** No existing journey exercises the cross-tenant-read invariant. `buildStack` already supports `tenant: 'both'` and returns `betaOrgId`, but current journeys never use `betaOrgId`. This is the most important multi-tenant invariant per CLAUDE.md and the highest-value test we can add today. The journey must be a real cross-surface negative journey: create/discover org B records, then prove org A credentials/context cannot read, list, update, or delete them through **raw API, SDK HTTP, SDK DirectTransport, CLI, and MCP**.

**Files:**
- Create: `e2e/src/journeys/15-tenant-isolation.test.ts`

- [ ] **Step 1: Confirm pre-resolved surface shapes**

Pre-verified facts (do not re-discover):
- `buildStack({ tenant: 'both' })` seeds both acme + beta and returns `stack.betaOrgId: string | undefined` (`e2e/src/harness/build-stack.ts:25, 130, 193`).
- `OrbitApiError` IS exported from `@orbit-ai/sdk` root (`packages/sdk/src/index.ts:3`). Import from `'@orbit-ai/sdk'`.
- **`StorageAdapter` has NO per-entity accessors** (`packages/core/src/adapters/interface.ts:104-137`). `stack.adapter.contacts.list(...)` does NOT exist. To obtain a beta contact ID, build a SECOND `OrbitClient` bound to beta's orgId in direct mode and use its public API.
- `OrbitApiError` identity detection: duck-type via `(err as any)?.code === 'RESOURCE_NOT_FOUND'` rather than `instanceof`. DirectTransport may re-throw errors not wrapped in `OrbitApiError`; duck-typing matches the repo convention (CLAUDE.md: "Duck-type guards for cross-boundary errors").

- [ ] **Step 2: Create `e2e/src/journeys/15-tenant-isolation.test.ts`**

The journey tests cross-tenant isolation across MULTIPLE verbs (GET, LIST, UPDATE, DELETE), MULTIPLE entities (contacts + deals), and EVERY public surface (API, SDK HTTP, SDK direct, CLI, MCP) to avoid H1-class coverage theater. Every cross-tenant record lookup/mutation assertion uses duck-typed `code === 'RESOURCE_NOT_FOUND'` (or a surface-specific error envelope whose `code` is `RESOURCE_NOT_FOUND`) — if a surface returns `FORBIDDEN` for an existing other-tenant record, the test fails because that leaks tenant existence.

```typescript
import { describe, expect, it } from 'vitest'
import { OrbitClient, OrbitApiError } from '@orbit-ai/sdk'
import { buildStack } from '../harness/build-stack.js'

function isNotFound(err: unknown): boolean {
  if (err instanceof OrbitApiError) return err.code === 'RESOURCE_NOT_FOUND'
  // Duck-type fallback for direct-transport errors that may not be wrapped
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'RESOURCE_NOT_FOUND'
}

describe('Journey 15 — tenant isolation (cross-org ops refused)', () => {
  it('acme credentials cannot read, list, update, or delete beta records across entities', async () => {
    const stack = await buildStack({
      tenant: 'both',
      adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres',
    })
    try {
      const betaOrgId = stack.betaOrgId
      expect(betaOrgId, 'beta org must exist when tenant=both').toBeTruthy()

      // Build a beta-bound direct client to obtain known beta record IDs.
      // We use direct transport (no API key) so we don't need a second API key
      // provisioned for beta. This is harness-only — not a surface under test.
      const betaClient = new OrbitClient({
        adapter: stack.adapter,
        context: { orgId: betaOrgId! },
      })
      const betaContactsPage = await betaClient.contacts.list({ limit: 1 })
      const betaDealsPage = await betaClient.deals.list({ limit: 1 })
      expect(betaContactsPage.data.length, 'beta seed should include ≥1 contact').toBeGreaterThan(0)
      expect(betaDealsPage.data.length, 'beta seed should include ≥1 deal').toBeGreaterThan(0)
      const betaContactId = betaContactsPage.data[0]!.id
      const betaDealId = betaDealsPage.data[0]!.id

      // Helper: run an op, capture any thrown error.
      const capture = async (fn: () => Promise<unknown>): Promise<unknown> => {
        try {
          await fn()
          return undefined
        } catch (err) {
          return err
        }
      }

      // Test every mutation/read verb across two entity types, on both SDK transports.
      for (const [label, client] of [
        ['sdkHttp', stack.sdkHttp] as const,
        ['sdkDirect', stack.sdkDirect] as const,
      ]) {
        // Contacts: GET, UPDATE, DELETE
        const contactGetErr = await capture(() => client.contacts.get(betaContactId))
        expect(isNotFound(contactGetErr), `${label} contacts.get must throw RESOURCE_NOT_FOUND, got: ${String(contactGetErr)}`).toBe(true)

        const contactUpdateErr = await capture(() => client.contacts.update(betaContactId, { last_name: 'CrossOrg' }))
        expect(isNotFound(contactUpdateErr), `${label} contacts.update must throw RESOURCE_NOT_FOUND, got: ${String(contactUpdateErr)}`).toBe(true)

        const contactDeleteErr = await capture(() => client.contacts.delete(betaContactId))
        expect(isNotFound(contactDeleteErr), `${label} contacts.delete must throw RESOURCE_NOT_FOUND, got: ${String(contactDeleteErr)}`).toBe(true)

        // Deals: GET, UPDATE
        const dealGetErr = await capture(() => client.deals.get(betaDealId))
        expect(isNotFound(dealGetErr), `${label} deals.get must throw RESOURCE_NOT_FOUND, got: ${String(dealGetErr)}`).toBe(true)

        const dealUpdateErr = await capture(() => client.deals.update(betaDealId, { name: 'CrossOrg' }))
        expect(isNotFound(dealUpdateErr), `${label} deals.update must throw RESOURCE_NOT_FOUND, got: ${String(dealUpdateErr)}`).toBe(true)

        // LIST must not leak beta records into acme's page.
        const contactsList = await client.contacts.list({ limit: 100 })
        expect(
          contactsList.data.every(c => c.id !== betaContactId),
          `${label} contacts.list must NOT include beta records`,
        ).toBe(true)

        const dealsList = await client.deals.list({ limit: 100 })
        expect(
          dealsList.data.every(d => d.id !== betaDealId),
          `${label} deals.list must NOT include beta records`,
        ).toBe(true)
      }

      // ── Raw API surface ──────────────────────────────────────────────────────
      // The fetch interceptor registered by buildStack routes http://test.local
      // to the in-process Hono API, so raw fetch() here exercises the real API
      // handler without a network socket.
      const apiHeaders = {
        'Authorization': `Bearer ${stack.rawApiKey}`,
        'Orbit-Version': '2026-04-01',
        'Content-Type': 'application/json',
      }
      const BASE = 'http://test.local'

      // Helper: expect a 404 JSON envelope with RESOURCE_NOT_FOUND
      const assertApiNotFound = async (resp: Response, label: string) => {
        expect(resp.status, `${label} must return HTTP 404`).toBe(404)
        const body = await resp.json() as { error?: { code?: string } }
        expect(body.error?.code, `${label} error.code must be RESOURCE_NOT_FOUND`).toBe('RESOURCE_NOT_FOUND')
      }

      // contacts — GET, PATCH, DELETE
      await assertApiNotFound(
        await fetch(`${BASE}/v1/contacts/${betaContactId}`, { headers: apiHeaders }),
        'raw API GET /contacts/betaContactId',
      )
      await assertApiNotFound(
        await fetch(`${BASE}/v1/contacts/${betaContactId}`, {
          method: 'PATCH',
          headers: apiHeaders,
          body: JSON.stringify({ last_name: 'CrossOrg' }),
        }),
        'raw API PATCH /contacts/betaContactId',
      )
      await assertApiNotFound(
        await fetch(`${BASE}/v1/contacts/${betaContactId}`, { method: 'DELETE', headers: apiHeaders }),
        'raw API DELETE /contacts/betaContactId',
      )

      // deals — GET, PATCH, DELETE
      await assertApiNotFound(
        await fetch(`${BASE}/v1/deals/${betaDealId}`, { headers: apiHeaders }),
        'raw API GET /deals/betaDealId',
      )
      await assertApiNotFound(
        await fetch(`${BASE}/v1/deals/${betaDealId}`, {
          method: 'PATCH',
          headers: apiHeaders,
          body: JSON.stringify({ name: 'CrossOrg' }),
        }),
        'raw API PATCH /deals/betaDealId',
      )
      await assertApiNotFound(
        await fetch(`${BASE}/v1/deals/${betaDealId}`, { method: 'DELETE', headers: apiHeaders }),
        'raw API DELETE /deals/betaDealId',
      )

      // LIST — beta IDs must not appear in acme pages
      const contactsListResp = await fetch(`${BASE}/v1/contacts?limit=100`, { headers: apiHeaders })
      expect(contactsListResp.status).toBe(200)
      const contactsListBody = await contactsListResp.json() as { data?: Array<{ id: string }> }
      expect(
        (contactsListBody.data ?? []).every(c => c.id !== betaContactId),
        'raw API contacts.list must NOT include beta records',
      ).toBe(true)

      const dealsListResp = await fetch(`${BASE}/v1/deals?limit=100`, { headers: apiHeaders })
      expect(dealsListResp.status).toBe(200)
      const dealsListBody = await dealsListResp.json() as { data?: Array<{ id: string }> }
      expect(
        (dealsListBody.data ?? []).every(d => d.id !== betaDealId),
        'raw API deals.list must NOT include beta records',
      ).toBe(true)

      // ── CLI surface ───────────────────────────────────────────────────────────
      // The CLI runs in --mode api against http://test.local. The fetch
      // interceptor is already active (registered above by buildStack), so the
      // child process resolves http://test.local requests through the same
      // in-process Hono API when NODE_OPTIONS is used to share the interceptor.
      // NOTE: the fetch interceptor patches globalThis.fetch of the CURRENT
      // process. Because runCli spawns a separate Node child process, the
      // interceptor is NOT inherited. The child process would need a real HTTP
      // listener. Until buildStack exposes a real listen() helper or the E2E
      // harness adds one, CLI API-mode cross-tenant tests against http://test.local
      // cannot be exercised here.
      // TODO(Plan C.5): Add a real HTTP listener to buildStack (or a
      // startServer() helper) so CLI --mode api tests can share the fetch
      // interceptor. Until then, the CLI surface is covered by direct-mode
      // workspace tests in Journey 7/8 only. This gap must be closed before
      // the CLI surface row in the coverage table can be checked off.
      //
      // As a partial guard: verify the CLI reports RESOURCE_NOT_FOUND in
      // --mode direct when the record belongs to a different org. We create a
      // second CLI workspace bound to acme's orgId and attempt to fetch a
      // beta record ID through it.
      {
        const { runCli } = await import('../harness/run-cli.js')
        const { prepareCliWorkspace } = await import('../harness/prepare-cli-workspace.js')
        const acmeWorkspace = await prepareCliWorkspace({ tenant: 'acme' })
        try {
          // contacts get <betaContactId> — direct mode, acme workspace
          const cliContactGet = await runCli({
            args: ['--mode', 'direct', '--json', 'contacts', 'get', betaContactId],
            cwd: acmeWorkspace.cwd,
            env: acmeWorkspace.env,
          })
          expect(cliContactGet.exitCode, 'CLI contacts get beta ID must exit non-zero').not.toBe(0)
          const cliContactGetErr = cliContactGet.json as { error?: { code?: string } } | null
          expect(
            cliContactGetErr?.error?.code,
            'CLI contacts get beta ID must report RESOURCE_NOT_FOUND',
          ).toBe('RESOURCE_NOT_FOUND')

          // deals get <betaDealId> — direct mode, acme workspace
          const cliDealGet = await runCli({
            args: ['--mode', 'direct', '--json', 'deals', 'get', betaDealId],
            cwd: acmeWorkspace.cwd,
            env: acmeWorkspace.env,
          })
          expect(cliDealGet.exitCode, 'CLI deals get beta ID must exit non-zero').not.toBe(0)
          const cliDealGetErr = cliDealGet.json as { error?: { code?: string } } | null
          expect(
            cliDealGetErr?.error?.code,
            'CLI deals get beta ID must report RESOURCE_NOT_FOUND',
          ).toBe('RESOURCE_NOT_FOUND')

          // contacts list — beta contact ID must be absent
          const cliContactsList = await runCli({
            args: ['--mode', 'direct', '--json', 'contacts', 'list'],
            cwd: acmeWorkspace.cwd,
            env: acmeWorkspace.env,
          })
          expect(cliContactsList.exitCode, 'CLI contacts list must succeed').toBe(0)
          const cliContactsListData = cliContactsList.json as { data?: Array<{ id: string }> } | null
          expect(
            (cliContactsListData?.data ?? []).every(c => c.id !== betaContactId),
            'CLI contacts list must NOT include beta records',
          ).toBe(true)

          // deals list — beta deal ID must be absent
          const cliDealsList = await runCli({
            args: ['--mode', 'direct', '--json', 'deals', 'list'],
            cwd: acmeWorkspace.cwd,
            env: acmeWorkspace.env,
          })
          expect(cliDealsList.exitCode, 'CLI deals list must succeed').toBe(0)
          const cliDealsListData = cliDealsList.json as { data?: Array<{ id: string }> } | null
          expect(
            (cliDealsListData?.data ?? []).every(d => d.id !== betaDealId),
            'CLI deals list must NOT include beta records',
          ).toBe(true)
        } finally {
          await acmeWorkspace.cleanup()
        }
      }

      // ── MCP surface ───────────────────────────────────────────────────────────
      // spawnMcp creates an OrbitClient bound to acmeOrgId via direct transport.
      // Cross-tenant record lookups must return isError: true with
      // RESOURCE_NOT_FOUND in the parsed text payload.
      {
        const { spawnMcp } = await import('../harness/run-mcp.js')
        const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })
        try {
          // get_record — contacts
          const mcpContactGet = await mcp.request('tools/call', {
            name: 'get_record',
            arguments: { object_type: 'contacts', record_id: betaContactId },
          })
          expect(mcpContactGet.isError, 'MCP get_record contacts beta must be isError').toBe(true)
          const mcpContactGetPayload = JSON.parse(mcpContactGet.content?.[0]?.text ?? '{}') as { code?: string; error?: { code?: string } }
          expect(
            mcpContactGetPayload.code ?? mcpContactGetPayload.error?.code,
            'MCP get_record contacts beta must report RESOURCE_NOT_FOUND',
          ).toBe('RESOURCE_NOT_FOUND')

          // get_record — deals
          const mcpDealGet = await mcp.request('tools/call', {
            name: 'get_record',
            arguments: { object_type: 'deals', record_id: betaDealId },
          })
          expect(mcpDealGet.isError, 'MCP get_record deals beta must be isError').toBe(true)
          const mcpDealGetPayload = JSON.parse(mcpDealGet.content?.[0]?.text ?? '{}') as { code?: string; error?: { code?: string } }
          expect(
            mcpDealGetPayload.code ?? mcpDealGetPayload.error?.code,
            'MCP get_record deals beta must report RESOURCE_NOT_FOUND',
          ).toBe('RESOURCE_NOT_FOUND')

          // update_record — contacts
          const mcpContactUpdate = await mcp.request('tools/call', {
            name: 'update_record',
            arguments: { object_type: 'contacts', record_id: betaContactId, record: { last_name: 'CrossOrg' } },
          })
          expect(mcpContactUpdate.isError, 'MCP update_record contacts beta must be isError').toBe(true)
          const mcpContactUpdatePayload = JSON.parse(mcpContactUpdate.content?.[0]?.text ?? '{}') as { code?: string; error?: { code?: string } }
          expect(
            mcpContactUpdatePayload.code ?? mcpContactUpdatePayload.error?.code,
            'MCP update_record contacts beta must report RESOURCE_NOT_FOUND',
          ).toBe('RESOURCE_NOT_FOUND')

          // update_record — deals
          const mcpDealUpdate = await mcp.request('tools/call', {
            name: 'update_record',
            arguments: { object_type: 'deals', record_id: betaDealId, record: { name: 'CrossOrg' } },
          })
          expect(mcpDealUpdate.isError, 'MCP update_record deals beta must be isError').toBe(true)
          const mcpDealUpdatePayload = JSON.parse(mcpDealUpdate.content?.[0]?.text ?? '{}') as { code?: string; error?: { code?: string } }
          expect(
            mcpDealUpdatePayload.code ?? mcpDealUpdatePayload.error?.code,
            'MCP update_record deals beta must report RESOURCE_NOT_FOUND',
          ).toBe('RESOURCE_NOT_FOUND')

          // delete_record — contacts
          const mcpContactDelete = await mcp.request('tools/call', {
            name: 'delete_record',
            arguments: { object_type: 'contacts', record_id: betaContactId },
          })
          expect(mcpContactDelete.isError, 'MCP delete_record contacts beta must be isError').toBe(true)
          const mcpContactDeletePayload = JSON.parse(mcpContactDelete.content?.[0]?.text ?? '{}') as { code?: string; error?: { code?: string } }
          expect(
            mcpContactDeletePayload.code ?? mcpContactDeletePayload.error?.code,
            'MCP delete_record contacts beta must report RESOURCE_NOT_FOUND',
          ).toBe('RESOURCE_NOT_FOUND')

          // delete_record — deals
          const mcpDealDelete = await mcp.request('tools/call', {
            name: 'delete_record',
            arguments: { object_type: 'deals', record_id: betaDealId },
          })
          expect(mcpDealDelete.isError, 'MCP delete_record deals beta must be isError').toBe(true)
          const mcpDealDeletePayload = JSON.parse(mcpDealDelete.content?.[0]?.text ?? '{}') as { code?: string; error?: { code?: string } }
          expect(
            mcpDealDeletePayload.code ?? mcpDealDeletePayload.error?.code,
            'MCP delete_record deals beta must report RESOURCE_NOT_FOUND',
          ).toBe('RESOURCE_NOT_FOUND')

          // search_records — beta IDs must not appear in acme's results
          const mcpContactSearch = await mcp.request('tools/call', {
            name: 'search_records',
            arguments: { object_type: 'contacts', limit: 100 },
          })
          expect(mcpContactSearch.isError).toBeFalsy()
          const mcpContactSearchData = JSON.parse(mcpContactSearch.content?.[0]?.text ?? '{}') as { data?: Array<{ id: string }> }
          expect(
            (mcpContactSearchData.data ?? []).every(c => c.id !== betaContactId),
            'MCP search_records contacts must NOT include beta records',
          ).toBe(true)

          const mcpDealSearch = await mcp.request('tools/call', {
            name: 'search_records',
            arguments: { object_type: 'deals', limit: 100 },
          })
          expect(mcpDealSearch.isError).toBeFalsy()
          const mcpDealSearchData = JSON.parse(mcpDealSearch.content?.[0]?.text ?? '{}') as { data?: Array<{ id: string }> }
          expect(
            (mcpDealSearchData.data ?? []).every(d => d.id !== betaDealId),
            'MCP search_records deals must NOT include beta records',
          ).toBe(true)
        } finally {
          await mcp.close()
        }
      }
    } finally {
      await stack.teardown()
    }
  })
})
```

(If `client.contacts.list` returns an envelope shape different from `{ data: [...] }`, adapt — but per `packages/core/src/types/pagination.ts` and Journey 9 evidence, this is the shape.)

**Required surface coverage table before commit:**

| Surface | Required assertions |
|---|---|
| SDK HTTP | contacts/deals GET, UPDATE, DELETE return `RESOURCE_NOT_FOUND`; LIST excludes org B IDs |
| SDK DirectTransport | contacts/deals GET, UPDATE, DELETE return `RESOURCE_NOT_FOUND`; LIST excludes org B IDs |
| Raw API | contacts/deals GET, PATCH, DELETE return HTTP 404 with `error.code === 'RESOURCE_NOT_FOUND'`; LIST excludes org B IDs |
| CLI | contacts/deals get, update, delete fail with `RESOURCE_NOT_FOUND`; list excludes org B IDs |
| MCP | `get_record`, `update_record`, `delete_record` fail with `RESOURCE_NOT_FOUND`; search/list results exclude org B IDs |

Do not mark the journey complete if any surface is missing. If a surface cannot currently express one of the verbs, document that as a failing gap in the test and block the PR until the surface is fixed or the product contract explicitly excludes that verb.

- [ ] **Step 3: Run the journey**

Run: `pnpm -F @orbit-ai/e2e test src/journeys/15-tenant-isolation.test.ts`
Expected: passes on SQLite.

**If any assertion fails with `FORBIDDEN` or any code OTHER than `RESOURCE_NOT_FOUND`:** STOP. This indicates the surface leaks tenant existence (differentiates "doesn't exist anywhere" from "exists but you can't see it"). Do NOT loosen the assertion. File a GitHub issue for the leak and block the PR on a fix. Tenant-existence disclosure is a real privacy concern for a multi-tenant CRM.

- [ ] **Step 4: Add Journey 15 to CI's `journeys` matrix**

The SQLite `journeys` job runs `pnpm -F @orbit-ai/e2e test` (auto-discovery) — no edit needed. The `journeys-postgres` job runs an explicit list; Journey 15 will be added there in Task 6. Do not edit `ci.yml` in this task.

- [ ] **Step 5: Commit**

```bash
git add e2e/src/journeys/15-tenant-isolation.test.ts
git commit -m "test(e2e): Journey 15 — tenant isolation across API SDK CLI MCP"
```

---

## Task 3: Extend Journey 11 to actually invoke all 8 listed MCP tools

**Why:** Today Journey 11 asserts 8 tools are registered but only CALLS 3. If `get_pipelines`, `move_deal_stage`, `get_schema`, `update_record`, or `delete_record` regressed to throw on invocation, the test still passes. The fix is not just "call five more known tools"; the journey must fail whenever a tool is registered by `tools/list` but not invoked at least once in the journey.

**Files:**
- Modify: `e2e/src/journeys/11-mcp-core-tools.test.ts`

- [ ] **Step 1: Read the current journey**

Run: `cat e2e/src/journeys/11-mcp-core-tools.test.ts`

- [ ] **Step 2: Track registered tools and require every one to be invoked**

Immediately after the existing `tools/list` assertion, derive the registered tool names and create a local invocation wrapper:

```typescript
const registeredToolNames = new Set(tools.map(t => t.name))
const invokedToolNames = new Set<string>()
const callTool = async (name: string, args: Record<string, unknown>) => {
  invokedToolNames.add(name)
  return mcp.request('tools/call', { name, arguments: args })
}
```

Replace every existing direct `mcp.request('tools/call', ...)` call in the journey with `callTool(...)`. At the end of the successful path, before cleanup, assert:

```typescript
expect([...invokedToolNames].sort()).toEqual([...registeredToolNames].sort())
```

This assertion is required so future registered tools cannot be silently omitted from the journey. If a registered tool is intentionally out of scope for this journey, remove it from the Journey 11 registration expectation or create a separate journey for it — do not leave it registered-but-uninvoked here.

- [ ] **Step 3: Add invocation + behavior assertions for the 5 currently untested tools**

Pre-verified call shape (confirmed against existing Journey 11 at `e2e/src/journeys/11-mcp-core-tools.test.ts:20-55` and `e2e/src/harness/run-mcp.ts:9-19`):
- `mcp.request('tools/call', { name, arguments })` returns `{ content?: Array<{ type, text }>; isError?: boolean }`.
- `create_record` args key is `record: {...}` (NOT `data`).
- `get_record`, `update_record`, `delete_record` args key is `record_id: string`.
- `update_record` args key for the patch payload: verify by reading `packages/mcp/src/tools/core-records.ts` before writing — likely `record: {...}` or `patch: {...}`.

Append these tool calls inside the existing `it()` block (after the existing `get_record` assertion, before the final `invokedToolNames` equality assertion and before the `finally` block). The variable `createdId` already exists from the happy path — reuse it.

```typescript
      // get_schema — must return schema listing core entity types
      const schemaResp = await callTool('get_schema', {})
      expect(schemaResp.isError).toBeFalsy()
      const schemaText = schemaResp.content?.[0]?.text
      expect(schemaText).toBeTruthy()
      const schema = JSON.parse(schemaText!) as { objects?: Array<{ type: string }>; data?: Array<{ type: string }> }
      const objects = schema.objects ?? schema.data ?? []
      expect(objects.some(o => o.type === 'contacts'), 'schema must list contacts').toBe(true)

      // get_pipelines — seed includes at least one pipeline with ≥2 stages
      const pipelinesResp = await callTool('get_pipelines', {})
      expect(pipelinesResp.isError).toBeFalsy()
      const pipelinesText = pipelinesResp.content?.[0]?.text
      expect(pipelinesText).toBeTruthy()
      const pipelinesEnvelope = JSON.parse(pipelinesText!) as {
        data?: Array<{ id: string; stages?: Array<{ id: string }> }>
        records?: Array<{ id: string; stages?: Array<{ id: string }> }>
      }
      const pipelines = pipelinesEnvelope.data ?? pipelinesEnvelope.records ?? []
      expect(pipelines.length, 'at least one pipeline').toBeGreaterThan(0)
      const firstPipeline = pipelines[0]!
      const stages = firstPipeline.stages ?? []
      expect(stages.length, 'pipeline must have ≥2 stages for move_deal_stage test').toBeGreaterThanOrEqual(2)

      // move_deal_stage — create a deal in stage[0], move to stage[1], assert via get_record
      const dealCreateResp = await callTool('create_record', {
          object_type: 'deals',
          record: { name: 'mcp-journey-deal', pipeline_id: firstPipeline.id, stage_id: stages[0]!.id, value: '1000' },
      })
      expect(dealCreateResp.isError).toBeFalsy()
      const dealCreateData = JSON.parse(dealCreateResp.content![0]!.text) as { id?: string; data?: { id: string } }
      const dealId = dealCreateData.id ?? dealCreateData.data?.id ?? ''
      expect(dealId).toMatch(/^deal_/)

      const moveResp = await callTool('move_deal_stage', { deal_id: dealId, stage_id: stages[1]!.id })
      expect(moveResp.isError).toBeFalsy()

      const verifyMoveResp = await callTool('get_record', { object_type: 'deals', record_id: dealId })
      expect(verifyMoveResp.isError).toBeFalsy()
      const movedEnvelope = JSON.parse(verifyMoveResp.content![0]!.text) as { stage_id?: string; data?: { stage_id: string } }
      const movedStageId = movedEnvelope.stage_id ?? movedEnvelope.data?.stage_id
      expect(movedStageId, 'move_deal_stage must persist').toBe(stages[1]!.id)

      // update_record — round-trip an update on createdId (contact from happy path)
      // NOTE: verify the update payload key ('record' vs 'patch' vs 'data') against
      // packages/mcp/src/tools/core-records.ts before writing. 'record' matches create_record.
      const updateResp = await callTool('update_record', { object_type: 'contacts', record_id: createdId, record: { last_name: 'Updated-by-MCP' } })
      expect(updateResp.isError).toBeFalsy()

      const verifyUpdateResp = await callTool('get_record', { object_type: 'contacts', record_id: createdId })
      const updatedEnvelope = JSON.parse(verifyUpdateResp.content![0]!.text) as { last_name?: string; data?: { last_name: string } }
      expect(updatedEnvelope.last_name ?? updatedEnvelope.data?.last_name).toBe('Updated-by-MCP')

      // delete_record — finally remove createdId and verify get_record errors
      const deleteResp = await callTool('delete_record', { object_type: 'contacts', record_id: createdId })
      expect(deleteResp.isError).toBeFalsy()

      const verifyDeleteResp = await callTool('get_record', { object_type: 'contacts', record_id: createdId })
      expect(verifyDeleteResp.isError, 'get_record after delete must return isError').toBe(true)

      // Negative case: invalid object_type should produce isError=true (not throw)
      const invalidResp = await callTool('search_records', { object_type: 'nonexistent_entity', limit: 1 })
      expect(invalidResp.isError, 'search_records on invalid object_type must return isError').toBe(true)

      expect([...invokedToolNames].sort()).toEqual([...registeredToolNames].sort())
```

**Before writing:** read `packages/mcp/src/tools/core-records.ts` to confirm the `update_record` payload key. If it's `patch` or `data` instead of `record`, change the snippet.

- [ ] **Step 4: Run the journey**

Run: `pnpm -F @orbit-ai/e2e test src/journeys/11-mcp-core-tools.test.ts`
Expected: passes. If `move_deal_stage` errors because the seed pipeline has only one stage, adjust the seed assumption or pick a different pipeline.

- [ ] **Step 5: Commit**

```bash
git add e2e/src/journeys/11-mcp-core-tools.test.ts
git commit -m "test(e2e): Journey 11 — invoke all 8 declared MCP tools, not just register them"
```

---

## Task 4: Add update-persistence assertions to the CRUD matrix

**Why:** `_crud-matrix.ts` calls update for every surface but never re-`get`s to prove the change persisted. A regression where `update` returns 200 without writing anything would pass all 15 CRUD tests across journeys 3/4/5.

**Files:**
- Modify: `e2e/src/journeys/_crud-matrix.ts`

- [ ] **Step 1: Read `_crud-matrix.ts` end-to-end (mandatory first step)**

Run: `cat e2e/src/journeys/_crud-matrix.ts`

Identify:
- The current type signature of the parameterization (entity config passed to `runSdkCrud` / `runRawApiCrud` / `runCliCrud` / `runMcpCrud`).
- Where each surface currently calls `update` and what value it passes.
- Each surface's existing GET path (some use `client.contacts.get(id)`, CLI uses `contacts get <id>`, MCP uses `get_record` tool).

**Write down the discovered signature** as a comment in the commit message so the next reviewer can audit.

- [ ] **Step 2: Pin per-entity update field + value**

Per the repo's current public schema (verified: `packages/core/src/entities/deals/validators.ts:9-36`):

| Entity | Update field | Update value | Response field to assert |
|---|---|---|---|
| contacts | `last_name` | `'Updated'` | `last_name` |
| companies | `name` | `'Updated Co'` | `name` |
| deals | `name` (alias for `title`) | `'Updated Deal'` | `title` (response returns `title`, not `name` — the alias is input-only per `validators.ts:22-24`) |

Extend the `CrudConfig` type (or equivalent in `_crud-matrix.ts`) with:
```typescript
  readonly updateField: 'last_name' | 'name'      // input key
  readonly updateValue: string                     // new value
  readonly assertField: 'last_name' | 'name' | 'title'  // response key to read back
```

- [ ] **Step 3: For each surface, add a re-`get` after `update` and assert `assertField`**

Surface `runSdkCrud` (HTTP + direct):
```typescript
      // Existing update call — keep as-is but use config.updateField / config.updateValue
      const updated = await client[config.entity].update(created.id, { [config.updateField]: config.updateValue })
      expect(updated.id).toBe(created.id)
      // NEW: verify update persisted
      const refetched = await client[config.entity].get(created.id)
      const actual = (refetched as Record<string, unknown>)[config.assertField]
      expect(actual, `sdk ${label} update must persist`).toBe(config.updateValue)
```

Surface `runRawApiCrud` (existing uses `api.fetch`):
```typescript
      // After PATCH ...
      const refetched = await api.fetch(`/v1/${config.entity}/${id}`, {
        headers: { authorization: `Bearer ${apiKey}` },
      })
      const refetchedBody = (await refetched.json()) as { data: Record<string, unknown> }
      expect(refetchedBody.data[config.assertField], `raw api ${config.entity} update must persist`).toBe(config.updateValue)
```

Surface `runCliCrud` — note `runCli` signature is `runCli({ args, cwd, env })`, NOT positional:
```typescript
      // After `update` CLI invocation ...
      const getResult = await runCli({
        args: ['--mode', 'direct', '--json', config.entity, 'get', id],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      const refetched = getResult.json as Record<string, unknown>
      expect(refetched[config.assertField], `cli ${config.entity} update must persist`).toBe(config.updateValue)
```

Surface `runMcpCrud` — use `mcp.request('tools/call', ...)`:
```typescript
      // After update_record tool call ...
      const verifyResp = await mcp.request('tools/call', {
        name: 'get_record',
        arguments: { object_type: config.entity, record_id: id },
      })
      const verifyEnvelope = JSON.parse(verifyResp.content![0]!.text) as Record<string, unknown> & { data?: Record<string, unknown> }
      const verifyValue = (verifyEnvelope[config.assertField] ?? verifyEnvelope.data?.[config.assertField])
      expect(verifyValue, `mcp ${config.entity} update must persist`).toBe(config.updateValue)
```

Update call sites in `03-crud-contacts.test.ts`, `04-crud-companies.test.ts`, `05-crud-deals.test.ts` to pass the new `updateField` / `updateValue` / `assertField` fields in their config objects.

- [ ] **Step 4: Run all three CRUD journeys**

```bash
pnpm -F @orbit-ai/e2e test src/journeys/03-crud-contacts.test.ts src/journeys/04-crud-companies.test.ts src/journeys/05-crud-deals.test.ts
```
Expected: all pass on SQLite. If any surface's update doesn't persist (a real bug), fix it inline only if obvious; otherwise file a follow-up issue and skip THAT surface's assertion with a `// TODO(issue-N): update-persistence regression` comment.

- [ ] **Step 4: Commit**

```bash
git add e2e/src/journeys/_crud-matrix.ts
git commit -m "test(e2e): assert update persistence via re-get on every CRUD surface"
```

---

## Task 5: Make `prepareCliWorkspace` adapter-aware (path A — pre-resolved)

**Why:** `prepareCliWorkspace` is hard-coded to `createSqliteOrbitDatabase` (see `e2e/src/harness/prepare-cli-workspace.ts:23-29`). CI's "Postgres matrix" runs journeys 7 and 8 — both use this helper — so they silently re-run SQLite even though the matrix label says Postgres. This is coverage theater. The helper must honor `ORBIT_E2E_ADAPTER=postgres` and produce machine-checkable evidence that CLI journeys are actually backed by Postgres-family storage.

**Files:**
- Modify: `e2e/src/harness/prepare-cli-workspace.ts`
- Modify: `e2e/src/journeys/07-custom-field.test.ts` (only if needed to pass adapter through explicitly)
- Modify: `e2e/src/journeys/08-migration-preview-apply.test.ts` (only if needed to pass adapter through explicitly)
- Modify: `scripts/release-workflow.test.mjs`

- [ ] **Step 1: Read the helper and CLI config contract**

Run:

```bash
cat e2e/src/harness/prepare-cli-workspace.ts
grep -rn "ORBIT_ADAPTER\|DATABASE_URL\|sqlite" packages/cli/src e2e/src/harness --include='*.ts'
```

Identify exactly how direct-mode CLI selects SQLite vs Postgres. Do not guess config keys.

- [ ] **Step 2: Extend `prepareCliWorkspace` to accept an adapter option**

Add an option equivalent to:

```typescript
type CliWorkspaceAdapter = 'sqlite' | 'postgres'

export async function prepareCliWorkspace(options: {
  tenant: 'acme' | 'beta'
  adapter?: CliWorkspaceAdapter
}): Promise<CliWorkspace> {
  const adapter = options.adapter ?? ((process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as CliWorkspaceAdapter)
  // ...
}
```

Implementation requirements:
- SQLite remains the default for local runs with no env override.
- Postgres mode must create/use a migrated Postgres test database, seed the requested tenant, and write CLI config/env so `orbit --mode direct ...` uses Postgres, not SQLite.
- Postgres mode must not create an unused SQLite DB as a side effect.
- Returned workspace metadata must include a proof field such as `adapter: 'postgres'` and a Postgres `databaseUrl`/connection marker that tests can assert without exposing credentials in logs.
- Cleanup must close/drop only resources this helper created.

If the existing harness already has Postgres setup in `buildStack`, reuse its adapter/migration/seeding path rather than creating a second migration mechanism.

- [ ] **Step 3: Add direct proof that CLI workspace Postgres mode hits Postgres**

Add a regression test to `scripts/release-workflow.test.mjs` that prevents the helper from regressing to SQLite-only behavior. This test may be source-level if no Postgres service is available to `node --test`, but it must check for all of these:

```javascript
import { readFileSync as _readFileSyncCliWorkspace } from 'node:fs'

test('prepareCliWorkspace honors ORBIT_E2E_ADAPTER for Postgres CLI journeys', () => {
  const src = _readFileSyncCliWorkspace(new URL('../e2e/src/harness/prepare-cli-workspace.ts', import.meta.url), 'utf8')
  assert.match(src, /ORBIT_E2E_ADAPTER/, 'helper must read ORBIT_E2E_ADAPTER')
  assert.match(src, /postgres/i, 'helper must contain a Postgres branch')
  assert.match(src, /ORBIT_ADAPTER['"]?\s*[:=]\s*['"]postgres['"]|ORBIT_ADAPTER.*postgres/s, 'workspace env/config must force ORBIT_ADAPTER=postgres')
  assert.doesNotMatch(src, /adapter\s*=\s*['"]sqlite['"][\s\S]*ORBIT_E2E_ADAPTER/, 'helper must not force sqlite before reading the adapter override')
})
```

Also add a runtime assertion inside journeys 7 and 8 (or inside the helper result validation) that fails fast when `process.env.ORBIT_E2E_ADAPTER === 'postgres'` but `workspace.adapter !== 'postgres'`.

- [ ] **Step 4: Run SQLite and Postgres targeted journeys**

SQLite must still pass:

```bash
pnpm -F @orbit-ai/e2e test src/journeys/07-custom-field.test.ts src/journeys/08-migration-preview-apply.test.ts
```

Postgres must be run when a local Postgres URL is available:

```bash
ORBIT_E2E_ADAPTER=postgres DATABASE_URL=postgres://localhost:5432/orbit_test pnpm -F @orbit-ai/e2e test src/journeys/07-custom-field.test.ts src/journeys/08-migration-preview-apply.test.ts
```

Expected: both journeys pass and their workspace assertions prove `workspace.adapter === 'postgres'`. If Postgres is unavailable locally, do not claim this is verified; leave the CI matrix plus source-level regression test as the gate and call out the local skip in the PR.

- [ ] **Step 5: Commit**

```bash
git add e2e/src/harness/prepare-cli-workspace.ts e2e/src/journeys/07-custom-field.test.ts e2e/src/journeys/08-migration-preview-apply.test.ts scripts/release-workflow.test.mjs
git commit -m "test(e2e): make CLI workspace honor Postgres adapter"
```

---

## Task 6: Fix Postgres matrix accuracy and release-sensitive triggers

**Why:** CI's `journeys-postgres` job runs `02 03 04 05 06 07 08 09 10 11`. After Task 5, journeys 7 and 8 must remain in the Postgres matrix because the CLI workspace helper is adapter-aware. Add Journey 15 and add regression tests proving the matrix includes the Postgres-sensitive CLI journeys. Also fix CI path filters: release-sensitive changes must trigger E2E, otherwise release workflow and packaging changes can bypass the launch gate.

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/release-workflow.test.mjs`

- [ ] **Step 1: Read the `journeys-postgres` job and path filters**

Run:

```bash
sed -n '/journeys-postgres:/,/^  [a-z]/p' .github/workflows/ci.yml
sed -n '/paths:/,/jobs:/p' .github/workflows/ci.yml
```

- [ ] **Step 2: Update the Postgres journey list**

Keep journeys 07 and 08 in the Postgres matrix and append 15. The command must include:

```
pnpm -F @orbit-ai/e2e test src/journeys/02 src/journeys/03 src/journeys/04 src/journeys/05 src/journeys/06 src/journeys/07 src/journeys/08 src/journeys/09 src/journeys/10 src/journeys/11 src/journeys/15
```

Verify the change landed cleanly:

```bash
grep -A2 "journeys-postgres" .github/workflows/ci.yml | head
```

- [ ] **Step 3: Expand CI E2E path filters**

The E2E/launch-gate workflows must trigger for release-sensitive paths, not only package source paths. Add or verify these path filters, using the workflow's existing syntax:

```yaml
- '.github/workflows/ci.yml'
- '.github/workflows/release.yml'
- 'scripts/release*'
- 'scripts/release*/**'
- 'package.json'
- 'pnpm-lock.yaml'
- 'pnpm-workspace.yaml'
- 'packages/*/package.json'
- '.changeset/**'
- 'e2e/**'
- 'e2e/src/harness/**'
- 'docs/product/release-definition-v2.md'
```

Do not remove existing package/source filters.

- [ ] **Step 4: Add regression tests for matrix membership and path filters**

`scripts/release-workflow.test.mjs` uses `node --test`. Append (ensure the `assert` import at the top of the file exists — it does in the current file from Plan B follow-ups, but verify):

```javascript
import { readFileSync as _readFileSyncCi6 } from 'node:fs'

test('Postgres E2E matrix includes CLI journeys that now honor ORBIT_E2E_ADAPTER', () => {
  const ci = _readFileSyncCi6(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const postgresLine = ci.split(/\r?\n/).find(l => l.includes('pnpm -F @orbit-ai/e2e test') && l.includes('src/journeys/02'))
  assert.ok(postgresLine, 'expected to find the Postgres matrix command on a single line')

  for (const required of ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '15']) {
    assert.match(
      postgresLine,
      new RegExp(`src/journeys/${required}\\b`),
      `journey ${required} must run on Postgres matrix`,
    )
  }
})

test('CI path filters include release-sensitive and e2e harness paths', () => {
  const ci = _readFileSyncCi6(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  for (const requiredPath of [
    '.github/workflows/release.yml',
    'scripts/release',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'packages/*/package.json',
    '.changeset/**',
    'e2e/**',
    'e2e/src/harness/**',
    'docs/product/release-definition-v2.md',
  ]) {
    assert.match(ci, new RegExp(requiredPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')), `CI path filters must include ${requiredPath}`)
  }
})
```

If `assert` is not already imported at the top of `scripts/release-workflow.test.mjs`, add: `import assert from 'node:assert/strict'`.

- [ ] **Step 5: Run tests**

Run: `node --test scripts/release-workflow.test.mjs`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml scripts/release-workflow.test.mjs
git commit -m "ci(e2e): prove Postgres matrix and release-sensitive triggers"
```

---

## Task 7: Refactor Postgres `api_keys` upsert conflict target for semantic clarity

**Why:** `e2e/src/harness/build-stack.ts:107` uses `ON CONFLICT (key_prefix)`. Per `packages/core/src/schema/tables.ts:67`, BOTH `api_keys_hash_idx` (on `key_hash`) AND `api_keys_prefix_idx` (on `key_prefix`) are unique — so the original statement is technically valid. But the hash is the row's cryptographic identity and the semantic conflict target: if the same raw API key is re-inserted, `key_hash` is what correctly identifies "this is the same key." Keying the upsert on `key_prefix` is brittle — if the prefix invariant is ever relaxed (e.g. prefix shortened to improve search), the clause breaks silently. This is a refactor for clarity + defense against future schema drift, not a correctness fix against a current bug.

**Files:**
- Modify: `e2e/src/harness/build-stack.ts`
- Modify: `scripts/release-workflow.test.mjs` (add SQL-literal regression test)

- [ ] **Step 1: Confirm both unique indexes exist**

Run: `grep -n "api_keys_hash_idx\|api_keys_prefix_idx" packages/core/src/schema/tables.ts`
Expected: shows BOTH `uniqueIndex('api_keys_hash_idx').on(table.keyHash)` and `uniqueIndex('api_keys_prefix_idx').on(table.keyPrefix)` on the same line.

- [ ] **Step 2: Change the conflict target to `(key_hash)`**

Edit `e2e/src/harness/build-stack.ts`. Locate the `INSERT INTO api_keys ...` block. Change:

```sql
ON CONFLICT (key_prefix) DO UPDATE SET organization_id = excluded.organization_id, key_hash = excluded.key_hash, updated_at = excluded.updated_at
```

To:

```sql
ON CONFLICT (key_hash) DO UPDATE SET organization_id = excluded.organization_id, key_prefix = excluded.key_prefix, updated_at = excluded.updated_at
```

Rationale: `key_hash` is unique by index. The harness generates a fresh random key on every `buildStack` call (see line ~32 `createRawApiKey()`), so collisions are infinitesimally rare in normal CI use; when they do happen (e.g. a prior test run leaked a row), the `DO UPDATE` reassigns the row to the current org safely.

- [ ] **Step 3: Add a regression test that locks the conflict target**

Append to `scripts/release-workflow.test.mjs`:

```javascript
import { readFileSync as _readFileSyncBuildStack } from 'node:fs'

test('Postgres api_keys upsert conflicts on key_hash (row identity)', () => {
  const src = _readFileSyncBuildStack(new URL('../e2e/src/harness/build-stack.ts', import.meta.url), 'utf8')
  // Find the api_keys INSERT block and verify the ON CONFLICT target.
  assert.match(src, /INSERT INTO api_keys/, 'build-stack must include an api_keys INSERT')
  assert.match(src, /ON CONFLICT \(key_hash\)/, 'conflict target must be key_hash (semantic identity)')
  assert.doesNotMatch(src, /ON CONFLICT \(key_prefix\)/, 'must not use key_prefix as conflict target')
})
```

Run: `node --test scripts/release-workflow.test.mjs`
Expected: passes.

- [ ] **Step 4: Run a Postgres E2E pass to confirm (optional if no local Postgres)**

Run: `ORBIT_E2E_ADAPTER=postgres DATABASE_URL=postgres://localhost:5432/orbit_test pnpm -F @orbit-ai/e2e test src/journeys/03-crud-contacts.test.ts` (skip if no local Postgres).
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add e2e/src/harness/build-stack.ts scripts/release-workflow.test.mjs
git commit -m "test(e2e): use key_hash as conflict target on Postgres api_keys upsert"
```

---

## Task 8: Fix `run-mcp.ts` resource leak

**Why:** If `mcpClient.connect(clientTransport)` throws after `server.connect(serverTransport)` succeeded, the server is never closed.

**Files:**
- Modify: `e2e/src/harness/run-mcp.ts`

- [ ] **Step 1: Read the helper**

Run: `cat e2e/src/harness/run-mcp.ts`

- [ ] **Step 2: Wrap `mcpClient.connect` so the server closes on connect failure**

Verified against `e2e/src/harness/run-mcp.ts` (function `spawnMcp`). Current code at lines ~38-40:
```typescript
  await server.connect(serverTransport)
  await mcpClient.connect(clientTransport)
```

Change to:
```typescript
  await server.connect(serverTransport)
  try {
    await mcpClient.connect(clientTransport)
  } catch (err) {
    // Close the server to avoid leaking the transport pair. Use the same duck-type
    // check the happy-path close() uses (see McpHandle.close below).
    try {
      if (typeof (server as { close?: () => Promise<void> }).close === 'function') {
        await (server as { close: () => Promise<void> }).close()
      }
    } catch (closeErr) {
      console.error(
        'Failed to close MCP server after mcpClient.connect failure:',
        closeErr instanceof Error ? closeErr.message : String(closeErr),
      )
      // Attach closeErr as cause if possible so callers can see the chained failure.
      if (err instanceof Error && (err as Error & { cause?: unknown }).cause === undefined) {
        (err as Error & { cause?: unknown }).cause = closeErr
      }
    }
    throw err
  }
```

- [ ] **Step 3: Add a regression test for the leak path**

Append to `scripts/release-workflow.test.mjs`:

```javascript
import { readFileSync as _readFileSyncRunMcp } from 'node:fs'

test('spawnMcp closes server when mcpClient.connect fails', () => {
  const src = _readFileSyncRunMcp(new URL('../e2e/src/harness/run-mcp.ts', import.meta.url), 'utf8')
  assert.match(src, /await server\.connect\(serverTransport\)/, 'server.connect must run first')
  // The mcpClient.connect call must be guarded by a try/catch that closes the server.
  assert.match(src, /try\s*\{\s*await mcpClient\.connect\(clientTransport\)/s, 'mcpClient.connect must be inside a try block')
  assert.match(src, /await \(server as \{ close: \(\) => Promise<void> \}\)\.close\(\)/, 'catch must call server.close()')
})
```

Run: `node --test scripts/release-workflow.test.mjs`
Expected: passes.

- [ ] **Step 4: Verify the happy path still works**

Run: `pnpm -F @orbit-ai/e2e test src/journeys/11-mcp-core-tools.test.ts`
Expected: passes (no behavior change on the happy path).

- [ ] **Step 5: Commit**

```bash
git add e2e/src/harness/run-mcp.ts scripts/release-workflow.test.mjs
git commit -m "fix(e2e): close MCP server when mcpClient.connect fails; lock in via regression test"
```

---

## Task 9: Fix Stripe sentinel `refreshToken` behavior

**Why:** `packages/integrations/src/stripe/cli.ts:56-69` saves `refreshToken: '__stripe_api_key__'` as a sentinel. The status path uses shared `runStatusAction` that doesn't branch on this sentinel — Stripe will appear "configured" while any refresh probe fails opaquely.

**Files:**
- Modify: `packages/integrations/src/stripe/cli.ts`
- Modify: `packages/integrations/src/stripe/cli.test.ts` (if existing unit tests assert the old behavior)

- [ ] **Step 1: Read both files**

Run: `cat packages/integrations/src/stripe/cli.ts && echo --- && cat packages/integrations/src/stripe/cli.test.ts`

- [ ] **Step 2: Audit `refreshToken` consumers before changing the call site**

**Pre-condition for path A:** every consumer of `refreshToken` must tolerate `null | undefined`. Audit:

```bash
grep -rn "refreshToken" packages/integrations/src packages/core/src packages/cli/src 2>&1 | grep -v "test\|\.test\." | head -30
```

For each consumer, classify:
- **Safe**: reads `refreshToken` via optional chaining (`?.`) or defaults (`?? null`).
- **Unsafe**: calls `.split()`, `.length`, or passes to a function expecting `string` — would NPE on null.

If ANY consumer is unsafe, fall back to **path B**: keep the sentinel but teach the status path to detect it. Record the audit result as a comment in the commit message.

- [ ] **Step 3: Decide path A vs B based on audit outcome**

Default: path A (stop persisting). If audit flagged an unsafe consumer, document it and use path B.

**Path A (preferred):**

- [ ] **Step 4: Implement the chosen path**

**Path A:** in `packages/integrations/src/stripe/cli.ts`, find the `saveCredentials({...})` call. Remove the `refreshToken: '__stripe_api_key__'` field. Add a comment:

```typescript
  // Stripe authenticates with a long-lived API key, not OAuth — refreshToken
  // remains null. Consumers must tolerate null (audited 2026-04-24).
```

**Path B:** keep the sentinel. Edit the shared status action (likely `packages/integrations/src/cli.ts` or wherever `runStatusAction` lives) to namespace-detect the sentinel. Use a namespaced sentinel to avoid collisions with future connectors:

```typescript
const STRIPE_API_KEY_SENTINEL = '__orbit_sentinel__:stripe:api_key' as const

// In saveCredentials call site:
refreshToken: STRIPE_API_KEY_SENTINEL,

// In runStatusAction:
if (creds.refreshToken === STRIPE_API_KEY_SENTINEL) {
  // Stripe uses a long-lived API key; skip refresh-related status fields.
}
```

Run: `pnpm -F @orbit-ai/integrations build && pnpm -F @orbit-ai/integrations test`
Expected: passes.

- [ ] **Step 5: Update Stripe CLI unit tests**

Find the test by grepping: `grep -n "__stripe_api_key__\|refreshToken" packages/integrations/src/stripe/cli.test.ts`.

Path A: assertions expecting `refreshToken: '__stripe_api_key__'` must expect `refreshToken: null` or the field's absence.
Path B: assertions expecting `refreshToken: '__stripe_api_key__'` must expect the new namespaced sentinel.

Add a new test for `runStatusAction` on Stripe credentials (path A: null refreshToken produces a "configured" status; path B: sentinel is detected and refresh fields are skipped).

- [ ] **Step 6: Run integration journey 14 to confirm end-to-end**

Run: `pnpm -F @orbit-ai/e2e test src/journeys/14-integrations-stripe.test.ts`
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add packages/integrations/src/stripe/cli.ts packages/integrations/src/stripe/cli.test.ts
git commit -m "fix(integrations): stop persisting sentinel refresh token for Stripe API key"
```

---

## Task 10: Add `assertOrgContext` to `engine.listObjects` / `getObject`

**Why:** `addField`, `preview`, `apply` all call `assertOrgContext(ctx)`. `listObjects` and `getObject` don't. Defense-in-depth gap; convention violation. One-line fix per method.

**Files:**
- Modify: `packages/core/src/schema-engine/engine.ts`
- Modify: `packages/core/src/schema-engine/engine.test.ts` (add a test for the new assertion)

- [ ] **Step 1: Audit existing callers of `listObjects` / `getObject`**

Run:
```bash
grep -rn "\.listObjects(\|\.getObject(" packages/ --include='*.ts' 2>&1 | grep -v "\.test\." | head -30
```

For each caller, confirm a populated `OrbitAuthContext` is passed. If ANY caller legitimately needs a read without org context (e.g. internal admin tooling), **stop** — adding `assertOrgContext` will regress that path. File an issue and design an explicit escape hatch first. (Expected result: no such caller exists.)

- [ ] **Step 2: Read the engine methods**

Run: `sed -n '70,100p' packages/core/src/schema-engine/engine.ts`

Verified: `listObjects(ctx: OrbitAuthContext): Promise<...>` and `getObject(ctx: OrbitAuthContext, type: string): Promise<...>` are BOTH `async`. Test assertions MUST use `.rejects.toThrow`, not `.toThrow`.

- [ ] **Step 3: Add the assertion to both methods**

Edit `packages/core/src/schema-engine/engine.ts`. Add as the first line of each method body (matching the pattern used in `addField` at line ~99):

```typescript
async listObjects(ctx: OrbitAuthContext): Promise<SchemaObjectSummary[]> {
  assertOrgContext(ctx)
  const allFields = await this.listAllCustomFields(ctx)
  // ...existing body...
}

async getObject(ctx: OrbitAuthContext, type: string): Promise<SchemaObjectSummary | null> {
  assertOrgContext(ctx)
  if (!PUBLIC_CRM_ENTITY_TYPES.includes(type as PublicCrmEntityType)) {
    return null
  }
  // ...existing body...
}
```

(Discarding the return value of `assertOrgContext` matches `addField`'s usage pattern — reads don't need the narrowed `orgId`.)

- [ ] **Step 4: Read existing tests to copy the engine constructor shape**

Run: `grep -n "createOrbitSchemaEngine\|new OrbitSchemaEngine" packages/core/src/schema-engine/engine.test.ts | head -5`

Copy the exact constructor call from an existing passing test — do not guess the shape.

- [ ] **Step 5: Add failing tests first (TDD)**

Append to `packages/core/src/schema-engine/engine.test.ts`, using the constructor shape from Step 4:

```typescript
test('listObjects rejects when org context lacks orgId', async () => {
  // Use the same constructor shape as existing tests (Step 4)
  const engine = /* <paste constructor call here> */
  await expect(engine.listObjects({ orgId: undefined } as any)).rejects.toThrow(/organization/i)
})

test('getObject rejects when org context lacks orgId', async () => {
  const engine = /* <paste constructor call here> */
  await expect(engine.getObject({ orgId: undefined } as any, 'contacts')).rejects.toThrow(/organization/i)
})
```

(Adapt the error-matcher regex if `assertOrgContext` throws with a different message — read its source first.)

- [ ] **Step 6: Run tests, observe the new tests fail BEFORE Step 3 is saved**

If Steps 3 and 5 were done in order, save Step 3 last. Verify the failing-test pass-after-implementation ordering:

```bash
# Before Step 3 edit: tests from Step 5 should FAIL (engine doesn't throw yet).
# After Step 3 edit: tests pass.
pnpm --filter @orbit-ai/core test -- engine
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/schema-engine/engine.ts packages/core/src/schema-engine/engine.test.ts
git commit -m "fix(core): assertOrgContext on schema-engine read methods (defense-in-depth)"
```

---

## Task 11: Tighten deal `value` validation

**Why:** `value` accepts any number including `1e21`, stringifies to scientific notation, then `buildDealStats` round-trips through `Number()` losing precision above 2^53 cents. Reject scientific notation and non-finite values; require a decimal-string-friendly format.

**Files:**
- Modify: `packages/core/src/entities/deals/validators.ts`

- [ ] **Step 1: Read the validator**

Run: `cat packages/core/src/entities/deals/validators.ts`

- [ ] **Step 2: Replace the loose `value` schema on BOTH `dealCreateInputSchema` and `dealUpdateInputSchema`**

Verified: the loose validator `value: z.union([z.number(), z.string()]).transform((v) => String(v)).optional().nullable()` appears on BOTH schemas (`validators.ts:21` create, `validators.ts:50` update). Both must be replaced.

Extract a shared refinement and apply it to both. Use `ctx.addIssue({ code: 'custom', ... }) + z.NEVER` inside the transform — throwing an `Error` inside Zod's `.transform` produces a non-standard issue code that downstream error-handlers may not recognize.

Add at the top of `validators.ts` (after imports):

```typescript
// Accepts number (finite, safe-integer magnitude) or decimal string with ≤2
// fractional digits. Coerces to a `"<int>.<2digit>"` string shape the numeric(18,2)
// column accepts without truncation. Rejects scientific notation and magnitudes
// that would lose precision round-tripping through JS number.
const dealValueSchema = z.union([
  z.number(),
  z.string().regex(/^-?\d+(\.\d{1,2})?$/, { message: 'value must be a decimal string with ≤2 fractional digits; scientific notation not supported' }),
]).transform((v, ctx) => {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      ctx.addIssue({ code: 'custom', message: 'value must be a finite number' })
      return z.NEVER
    }
    // Magnitudes above Number.MAX_SAFE_INTEGER lose precision when restringified.
    if (!Number.isSafeInteger(Math.trunc(v))) {
      ctx.addIssue({ code: 'custom', message: 'value magnitude exceeds safe integer range; pass as decimal string instead' })
      return z.NEVER
    }
    return v.toFixed(2)
  }
  return v
}).optional().nullable()
```

Then replace BOTH call sites:

In `dealCreateInputSchema`:
```typescript
    value: dealValueSchema,
```

In `dealUpdateInputSchema`:
```typescript
    value: dealValueSchema,
```

The `.optional().nullable()` chain is preserved on the schema itself (applied via `dealValueSchema`), so update paths omitting `value` continue to work.

- [ ] **Step 3: Add unit tests**

Find the test file: `grep -rln "dealCreateInputSchema\|dealUpdateInputSchema" packages/core/src/entities/deals/ --include='*.test.ts'`. If none exists yet, create `packages/core/src/entities/deals/validators.test.ts`.

Keep test inputs minimal — `dealCreateInputSchema` requires only `name` (or `title`); `pipeline_id` / `stage_id` are not required at input level. Omitting extra fields avoids noise from unrelated validators.

```typescript
import { describe, expect, test } from 'vitest'
import { dealCreateInputSchema, dealUpdateInputSchema } from './validators.js'

describe('deal value validator', () => {
  test('rejects scientific-notation strings', () => {
    const result = dealCreateInputSchema.safeParse({ name: 'x', value: '1e21' })
    expect(result.success).toBe(false)
  })

  test('rejects unsafe-integer positive numbers', () => {
    const result = dealCreateInputSchema.safeParse({ name: 'x', value: 1e21 })
    expect(result.success).toBe(false)
  })

  test('rejects unsafe-integer negative numbers', () => {
    const result = dealCreateInputSchema.safeParse({ name: 'x', value: -1e21 })
    expect(result.success).toBe(false)
  })

  test('rejects non-finite numbers', () => {
    const result = dealCreateInputSchema.safeParse({ name: 'x', value: Number.POSITIVE_INFINITY })
    expect(result.success).toBe(false)
  })

  test('rejects strings with more than 2 decimal places', () => {
    const result = dealCreateInputSchema.safeParse({ name: 'x', value: '1.234' })
    expect(result.success).toBe(false)
  })

  test('accepts decimal strings with up to 2 fractional digits', () => {
    const result = dealCreateInputSchema.parse({ name: 'x', value: '1234.56' })
    expect(result.value).toBe('1234.56')
  })

  test('accepts safe integer numbers and coerces to 2-digit decimal string', () => {
    const result = dealCreateInputSchema.parse({ name: 'x', value: 1234 })
    expect(result.value).toBe('1234.00')
  })

  test('accepts null via update schema optional/nullable chain', () => {
    const result = dealUpdateInputSchema.parse({ name: 'x', value: null })
    expect(result.value).toBeNull()
  })

  test('accepts absence via update schema optional chain', () => {
    const result = dealUpdateInputSchema.parse({ name: 'x' })
    expect(result.value).toBeUndefined()
  })
})
```

Also **verify that no seed data uses unsafe values**:
```bash
grep -rn "value:" packages/demo-seed/ --include='*.ts' | grep -v ".test." | head -20
```
If seed data uses values like `value: 1e21` or `value: '1.234'`, they will fail the tightened validator — update them to safe values (e.g. `'1000.00'`).

- [ ] **Step 4: Run tests + journeys**

```bash
pnpm --filter @orbit-ai/core test
pnpm -F @orbit-ai/e2e test src/journeys/05-crud-deals.test.ts
```
Expected: all pass. If journey 5 used a problematic value (e.g. `value: 1e21`), update the journey to use a sane value.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/entities/deals/validators.ts packages/core/src/entities/deals/*.test.ts
git commit -m "fix(core): reject scientific-notation and unsafe-integer values on deals"
```

---

## Task 12: Update release definition + document alpha.1 known limitations

**Why:** DirectTransport has dispatch wired for `PATCH /v1/objects/:type/fields/:fieldName` and `DELETE` of same, but `engine.updateField` / `deleteField` don't exist — calls return `OrbitApiError(INTERNAL_ERROR, 501)`. This is real user-visible behavior alpha consumers should know about. Also: PR #48's body claimed workflow sub-route dispatch was "punted as a follow-up" but commit `07d9f1e` in the same PR closed that gap. The CHANGELOG is out of date.

Note: `docs/product/release-definition-v2.md` **does exist** in this repo. Earlier drafts incorrectly said it was missing. Update the existing release definition in place; do not create a replacement doc or move the release-definition content elsewhere.

**Files:**
- Modify: `docs/product/release-definition-v2.md` (existing file)
- Modify: `CHANGELOG.md` (correct the Plan C entry + add "known limitations" bullet)
- Modify: `e2e/README.md` (add a "What this suite does NOT yet cover" section)

- [ ] **Step 1: Update the existing release definition**

Run: `test -f docs/product/release-definition-v2.md && sed -n '1,220p' docs/product/release-definition-v2.md`

Update the existing release definition so the launch gate is explicit and honest:

- Journey 8 is **not** a destructive-migration safety gate until Plan C.5 replaces the stub migration engine or adds a gate that rejects the stub as insufficient.
- Postgres E2E coverage is valid only when adapter-aware harness proof shows Postgres-family tests actually used `ORBIT_ADAPTER=postgres` / a Postgres connection.
- Tenant isolation launch gate requires the Journey 15 API/SDK/CLI/MCP cross-tenant negative assertions.
- CRUD parity gate requires read-after-update persistence checks across SDK, raw API, CLI, and MCP.
- MCP core-tools gate requires every tool returned by `tools/list` in Journey 11 to be invoked at least once with success/error assertions.
- Release-sensitive CI path filters must include `.github/workflows/release.yml`, `scripts/release*`, package metadata, changesets, and e2e harness paths.

Do not duplicate this file under another path.

- [ ] **Step 2: Correct CHANGELOG.md Plan C entry**

Run: `grep -n "Plan C\|DirectTransport\|workflow sub-route" CHANGELOG.md`

Find the Plan C / E2E entry. Remove any line claiming "DirectTransport missing dispatch for workflow sub-routes — filed as follow-up" (the gap is closed by commit `07d9f1e` inside PR #48). Replace with:

```markdown
### Known limitations for `0.1.0-alpha.1`

- **Schema migration engine** — `OrbitSchemaEngine.preview` and `apply` return empty operation sets regardless of input. The `orbit migrate --preview` / `--apply` CLI commands plumb through correctly but do not perform real schema diffs or mutations. Real implementation tracked in Plan C.5 (`docs/superpowers/plans/2026-04-24-plan-c5-migration-engine.md`).
- **DirectTransport `PATCH/DELETE` of custom fields** — `client.schema.updateField()` / `deleteField()` in direct mode return `OrbitApiError(INTERNAL_ERROR, 501 'not implemented')`. Tracked in Plan C.5.
- **Integration connectors (Gmail, Calendar, Stripe)** — Journeys 12–14 use `--skip-validation`, asserting credential persistence + redaction only. They do NOT prove the connectors can dispatch outbound requests with persisted credentials. Real-API contract tests are tracked separately.
- **MCP stdio wire** — Journey 11 uses in-process `InMemoryTransport`. The stdio serialization path that real MCP clients use is not exercised E2E.
- **Schema migration safety** — Journey 8 must not be described as a destructive-migration safety proof until Plan C.5 replaces the stub engine. In this plan, Postgres matrix coverage for Journey 8 proves only that the adapter-aware CLI workspace uses Postgres-family storage.
```

- [ ] **Step 3: Add coverage notes to `e2e/README.md`**

Read `e2e/README.md`. Add a new section after the journey list:

```markdown
## What this suite does NOT yet cover

- **Real schema-migration semantics** — Journey 8 tests stub passthrough only (see Plan C.5).
- **Real connector dispatch** for Gmail / Calendar / Stripe — Journeys 12–14 test credential persistence + redaction only.
- **Stdio MCP wire** — Journey 11 uses in-process `InMemoryTransport`; the stdio transport is not exercised.
- **Cross-Postgres-tenant RLS regression** — Plan C verifies application-layer tenant isolation across API/SDK/CLI/MCP and proves Postgres-family adapter execution, but it does not separately connect as a restricted runtime role to prove RLS policy enforcement. Tracked as a separate Postgres-RLS-regression plan.
- **Tenant-isolation beyond contacts + deals** — Journey 15 covers contacts + deals; companies, tags, sequences, and other entities rely on the same `organization_id` filter but are not explicitly tested cross-tenant.
```

- [ ] **Step 4: Verify no other docs claim the workflow-sub-routes gap is open (explicit rc handling)**

```bash
set +e
matches="$(grep -rn "DirectTransport missing.*workflow\|workflow sub-routes.*follow-up\|workflow sub-routes.*filed" . --include='*.md' --include='*.MD' | grep -v node_modules | grep -v CHANGELOG)"
rc=$?
set -e

if [ "$rc" -gt 1 ]; then
  echo "grep failed (rc=$rc) — investigate"
  exit 1
fi
if [ -z "$matches" ]; then
  echo "CLEAN"
else
  echo "STALE WORKFLOW CLAIMS:"
  echo "$matches"
  echo "Update each of these to reflect the fix in commit 07d9f1e."
  exit 1
fi
```

`rc=1` means grep found no matches (desired). `rc=0` means stale references found. Any other rc is a real grep error. This explicit pattern matches Plan B follow-ups' approach (no `|| true` silent swallow).

- [ ] **Step 5: Commit**

```bash
git add docs/product/release-definition-v2.md CHANGELOG.md e2e/README.md
git commit -m "docs: update release definition and alpha.1 limitations"
```

---

## Task 13: Generate the changeset

**Why:** Tasks 9, 10, 11 modify publishable `package.json` and source files. Add a changeset.

**Files:**
- Create: `.changeset/plan-c-followups.md`

- [ ] **Step 1: Confirm pre-release mode**

Run: `cat .changeset/pre.json | head -5`
Expected: `"mode": "pre"`, `"tag": "alpha"`.

- [ ] **Step 2: Write `.changeset/plan-c-followups.md`**

```markdown
---
"@orbit-ai/core": patch
"@orbit-ai/integrations": patch
---

Internal hardening — closes Plan C post-merge review findings:

- `@orbit-ai/core`: assertOrgContext on schema-engine read methods (listObjects, getObject); deal value validation rejects scientific notation and unsafe-integer magnitudes.
- `@orbit-ai/integrations`: stop persisting sentinel refreshToken for Stripe API key; status path no longer relies on opaque sentinel.

No public API changes. E2E test suite hardened (no package-level effect).
```

- [ ] **Step 3: Verify**

Run: `pnpm changeset status`
Expected: shows 2 packages bumping patch.

- [ ] **Step 4: Commit**

```bash
git add .changeset/plan-c-followups.md
git commit -m "chore(release): add changeset for Plan C follow-ups"
```

---

## Task 14: Pre-PR verification

- [ ] **Step 1: Full build + test + lint**

```bash
pnpm --filter @orbit-ai/core build
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
pnpm -F @orbit-ai/e2e test
```
Expected: all pass.
- `pnpm -r test` should report **≥1802** (1796 baseline + ~6 from Tasks 10/11; actual number depends on exact Task 9/11 test counts). **Record the actual number** — it goes into CLAUDE.md in Task 15.
- `pnpm -F @orbit-ai/e2e test` should report **17 tests** (14 journeys + 2 harness + 1 new Journey 15).

**Recovery note:** if any command fails, do NOT proceed. Identify the breaking task via `git log --oneline` and revert / amend.

- [ ] **Step 2: Run release-workflow tests**

Run: `node --test scripts/release-workflow.test.mjs`
Expected: passes (the new Postgres-matrix membership test from Task 6 is included).

- [ ] **Step 3: Run targeted Postgres pass (if Postgres available locally)**

```bash
ORBIT_E2E_ADAPTER=postgres DATABASE_URL=postgres://localhost:5432/orbit_test pnpm -F @orbit-ai/e2e test \
  src/journeys/02 src/journeys/03 src/journeys/04 src/journeys/05 src/journeys/06 \
  src/journeys/07 src/journeys/08 src/journeys/09 src/journeys/10 src/journeys/11 src/journeys/15
```
Expected: all pass, and journeys 07/08 fail fast if their CLI workspace reports anything other than `adapter === 'postgres'` under `ORBIT_E2E_ADAPTER=postgres`.

- [ ] **Step 4: Confirm no stale doc references (explicit rc handling)**

```bash
set +e
matches="$(grep -rn "DirectTransport missing dispatch for workflow sub-routes" . --include='*.md' --include='*.MD' | grep -v node_modules)"
rc=$?
set -e

if [ "$rc" -gt 1 ]; then
  echo "grep failed (rc=$rc) — investigate"
  exit 1
fi
if [ -z "$matches" ]; then
  echo "CLEAN"
else
  echo "STALE REFERENCES (workflow gap is closed by commit 07d9f1e):"
  echo "$matches"
  exit 1
fi
```

`rc=1` means no matches (desired). `rc=0` means stale references. Other rc = real grep error. This pattern matches Plan B follow-ups' explicit handling. Acceptable matches: GitHub PR descriptions on remote (historical, not in repo).

- [ ] **Step 5: Confirm changeset status**

Run: `pnpm changeset status`
Expected: shows the new changeset cleanly.

- [ ] **Step 6: Run Orbit trigger skills**

- `orbit-schema-change` — N/A (no schema migration here)
- `orbit-api-sdk-parity` — N/A (no new routes)
- `orbit-tenant-safety-review` — **Required** — Task 2 (cross-tenant journey) and Task 10 (assertOrgContext on engine reads) are tenant-safety-relevant.
- `orbit-core-slice-review` — N/A (no new core slice)

- [ ] **Step 7: Run `superpowers:requesting-code-review`**

Targeted at the diff. Confirm zero MEDIUM+ findings.

- [ ] **Step 8: Run `pr-review-toolkit:review-pr`**

Focus agents: `silent-failure-hunter` (run-mcp leak fix, dry-run signal handling already done in Plan B), `pr-test-analyzer` (Journey 11/15 + CRUD update-persistence assertions), `type-design-analyzer` (deal `value` validator).

---

## Task 15: Wrap-up

- [ ] **Step 1: Run `orbit-plan-wrap-up` skill**

Updates:
- `CLAUDE.md` Pre-PR Checklist: `pnpm -r test` baseline grows. **Required**: take the actual number from Task 14 Step 1 and update CLAUDE.md (current 1796 → new ≥1802 depending on exact added test counts in Tasks 9/10/11). Do NOT leave at 1796.
- `CLAUDE.md`: also update e2e suite line: `pnpm -F @orbit-ai/e2e test`: 16 → **17 tests**.
- `scripts/release-workflow.test.mjs`: count grows by Tasks 5 + 6 + 7 + 8's regression tests. Record new count if CLAUDE.md tracks it.
- `CHANGELOG.md` is auto-generated by Changesets via Task 13 — no direct edit here. The Task 12 corrections to existing CHANGELOG content are user-visible release notes; Changesets won't regenerate those.

- [ ] **Step 2: Update auto-memory**

Create `/Users/sharonsciammas/.claude/projects/-Users-sharonsciammas-orbit-ai/memory/project_plan_c_followups.md`:

```markdown
---
name: Plan C Follow-ups
description: 2026-04-24 single-PR cleanup after Plan C review — restores test integrity, adds tenant-isolation journey, fixes harness Postgres bugs, tightens deal value validation
type: project
---

Plan: `docs/superpowers/plans/2026-04-24-plan-c-followups.md`.
Closes test-quality + harness + small-bug findings from the Plan C audit (PR #48 + #72 + stray commit 6354172).

Key changes:
- Journey 8 rewritten as honest stub passthrough (no destructive-gate claim).
- Journey 11 actually invokes all 8 declared MCP tools.
- Journey 15 (NEW) — cross-tenant read isolation.
- CRUD matrix asserts update persistence on every surface.
- Postgres `api_keys` upsert uses `(key_hash)` conflict target.
- `prepareCliWorkspace` adapter parameter — Postgres matrix now proves CLI journeys 07/08 actually use Postgres-family storage.
- Stripe CLI no longer persists sentinel refreshToken.
- `engine.listObjects/getObject` assert org context.
- Deal `value` rejects scientific notation and unsafe integers.

Deferred to separate plans:
- Real schema-engine `preview`/`apply` implementations + DirectTransport `updateField`/`deleteField` engine methods → [Plan C.5](docs/superpowers/plans/2026-04-24-plan-c5-migration-engine.md).
- Real-API contract tests for connectors (Gmail/Calendar/Stripe) → separate plan, needs mocking framework first.
- Stdio MCP wire E2E coverage → low-priority follow-up.
```

Update `MEMORY.md` index — add a line:

```markdown
- [Plan C Follow-ups](project_plan_c_followups.md) — 2026-04-24 single-PR cleanup closing E2E test-quality + harness findings; defers real migration engine to Plan C.5
```

- [ ] **Step 3: Open the PR**

Use `superpowers:finishing-a-development-branch`. Title: `fix: close Plan C post-merge review findings`. Body links this plan + enumerates the 12 fixes with severity.

- [ ] **Step 4: Run `code-review:code-review` after PR is open**

---

## Plan-Doc Validation Commands

Run these after editing this plan document to verify the validation-findings fixes stayed in the plan:

```bash
PLAN=.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-c-followups.md

test -f docs/product/release-definition-v2.md

rg -n 'API/SDK/CLI/MCP|Raw API|SDK HTTP|SDK DirectTransport|CLI \| contacts/deals|MCP \|' "$PLAN"
rg -n "RESOURCE_NOT_FOUND|betaOrgId|tenant: 'both'" "$PLAN"
rg -n 'path A|adapter-aware|ORBIT_E2E_ADAPTER|ORBIT_ADAPTER=postgres|src/journeys/07 src/journeys/08' "$PLAN"
rg -n 'tools/list|invokedToolNames|registeredToolNames|every registered MCP tool' "$PLAN"
rg -n 'read-after-update|re-`get`|raw API .* update must persist|cli .* update must persist|mcp .* update must persist' "$PLAN"
rg -n '.github/workflows/release.yml|scripts/release|packages/\*/package.json|.changeset/\*\*|e2e/src/harness' "$PLAN"
rg -n 'migration-safety certification is blocked|not a destructive-migration safety gate|stub passthrough only' "$PLAN"

! (rg -n 'docs/product/release-definition-v2.md.*does not exist|NOT non-existent|Task 5 is pre-resolved to \*\*path B\*\*|07/08 stay SQLite-only|narrow the Postgres matrix|Postgres coverage for journeys 7/8 is deferred' "$PLAN" | rg -v '^\d+:! \(')
```

Expected: every positive `rg` finds at least one match, `test -f` succeeds, and the final negative `rg` returns no matches.

---

## Self-Review Checklist

- [ ] Every HIGH finding from the audit has a task (H1 stubs → Task 1 honesty + Plan C.5 deferral; H2 value precision → Task 11; H3 MCP tools → Task 3; H4 tenant isolation → Task 2; H5 Postgres matrix → Tasks 5+6)
- [ ] Every MEDIUM finding has a task (M1 → Task 10; M2 → Task 7; M3 → Task 8; M4 → Task 9; M5 update persistence → Task 4; M6 connectors → deferred + documented in Task 12; M7 stdio → deferred + documented; M8 PATCH/DELETE → documented in Task 12 + Plan C.5)
- [ ] Each task commits independently — reverting any single task doesn't break the others
- [ ] Task 1 uses the verified stub shape (`operations`, `destructive`, `applied`, `status: 'ok'`) — no `runCli(positional)`, no `buildStack` (helper builds its own DB)
- [ ] Task 2 uses a beta-bound `OrbitClient(direct)` to discover beta IDs (NOT the non-existent `stack.adapter.contacts.list`); tests GET + LIST + UPDATE + DELETE across contacts AND deals through SDK HTTP, SDK DirectTransport, raw API, CLI, and MCP; uses duck-typed/envelope `code === 'RESOURCE_NOT_FOUND'` (not strict `instanceof`)
- [ ] Task 3 uses `mcp.request('tools/call', { name, arguments })` (NOT `mcp.client.callTool`); `record:` payload key (NOT `data:`); `record_id:` for get/update/delete
- [ ] Task 4 reads `_crud-matrix.ts` first; pins per-entity `updateField` / `assertField` table (deals response uses `title` not `name`)
- [ ] Task 5 is pre-resolved to **path A** in the preamble — `prepareCliWorkspace` must become adapter-aware and prove Postgres usage
- [ ] Task 6 ships regression tests with explicit `assert` import; Postgres matrix includes 07/08/15; release-sensitive path filters include release workflow, release scripts, package metadata, changesets, and e2e harness paths
- [ ] Task 7 has correct rationale (BOTH indexes are unique; refactor for semantic clarity); ships SQL regression test
- [ ] Task 8 includes regression test for the leak path; attaches `err.cause` for diagnostic chaining
- [ ] Task 9 has explicit consumer audit before path A is taken; namespaced sentinel for path B
- [ ] Task 10 uses `.rejects.toThrow` (async); audits callers before adding the assertion; copies constructor shape from existing test (TDD)
- [ ] Task 11 uses `ctx.addIssue` + `z.NEVER` (not throw); regex bounds decimal places to ≤2; preserves `.optional().nullable()`; tests cover negative magnitudes + 3-decimal rejection + nullable update path; verifies seed data
- [ ] Task 12 updates the existing `docs/product/release-definition-v2.md` plus `CHANGELOG.md` + `e2e/README.md`; corrects PR #48's outdated workflow-sub-routes claim
- [ ] Branch instruction in preamble; pre-resolved decisions (Tasks 5 path, Task 9 default) in preamble
- [ ] Test baseline resolution is explicit: `pnpm -r test` ≥1802 (NOT 1796); e2e 16→17; release-workflow.test.mjs grows by Task 5+6+7+8 regression tests
- [ ] All grep verifications use explicit rc handling (`set +e`/`rc=$?`/`set -e`) — NO `|| true` silent-failure patterns
- [ ] Memory update + plan wrap-up are in Task 15
- [ ] No silent failures introduced — every new error path logs before exit/throw
- [ ] Deferred items (Plan C.5 real migration semantics/destructive-gate proof, real connector tests, stdio MCP, restricted-role Postgres RLS regression) are linked + tracked, not left as TODO comments

## Known Unknowns Surfaced to Executor

(Many earlier unknowns were pre-resolved by reading the codebase before plan finalization. The remaining unknowns are genuinely runtime-dependent.)

1. **Stub return shape** (Task 1) — verified to be `{ operations: [], destructive: false, status: 'ok' }` for preview and `{ applied: [], status: 'ok' }` for apply. If the actual response shape differs at execution time (engine evolved), match what's there.
2. **MCP `update_record` payload key** (Task 3) — verified `record:` for `create_record`. The `update_record` key is likely `record:` too but read `packages/mcp/src/tools/core-records.ts` once before writing the snippet to confirm. Adjust if it's `patch:` or `data:`.
3. **MCP get_pipelines stage count** (Task 3) — the seed pipeline must have ≥2 stages for the move test. Verify by inspecting `@orbit-ai/demo-seed` profile data once before writing.
4. **Cross-org error code** (Task 2) — assertion expects `RESOURCE_NOT_FOUND`. If the API returns `FORBIDDEN` or any other code, **STOP** — that's a tenant-existence leak. File an issue and block the PR on a fix; do NOT loosen the assertion.
5. **`refreshToken` consumer audit outcome** (Task 9) — depends on the runtime audit. If any consumer is unsafe, fall back to path B.
6. **Existing engine.test.ts constructor shape** (Task 10) — copy from a passing test once before writing the new tests.
7. **Seed data `value` magnitudes** (Task 11) — if the demo-seed uses values that fail the tightened validator, update them inline.
