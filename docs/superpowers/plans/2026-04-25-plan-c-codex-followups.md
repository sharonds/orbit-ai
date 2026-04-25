# Plan C Codex Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Plan C follow-up findings with executable evidence that the E2E gate, tenant-isolation coverage, Postgres harness, and small code fixes behave as claimed.

**Architecture:** This replaces the Claude-oriented Plan C follow-up with a Codex-native execution contract. Every coverage claim must be backed by a runtime test or an explicit "not covered yet" release note; source-text checks are allowed only as secondary guardrails. The work lands as one focused PR from `codex/plan-c-followups`, with an execution ledger mapping each requirement to commits, tests, and review sign-off.

**Tech Stack:** pnpm 9.12.3, Node 22, Vitest, Node `node:test`, Hono API app, `@orbit-ai/core`, `@orbit-ai/api`, `@orbit-ai/sdk`, `@orbit-ai/cli`, `@orbit-ai/mcp`, `@orbit-ai/integrations`, `@orbit-ai/demo-seed`, SQLite and local Postgres E2E adapters.

---

## Codex Execution Contract

- Execute from a clean branch created from `origin/main`: `codex/plan-c-followups`.
- Do not use Claude branch names, `.claude/worktrees`, or Claude memory files.
- Preserve unrelated untracked files in the shared workspace.
- Prefer follow-up fix commits over amend/revert. Revert only a commit made during this plan, only after confirming it contains no unrelated changes.
- Keep an execution ledger at `PLAN-C-EXECUTION-LEDGER.md`. Each task has two commits when needed: an implementation commit first, then a ledger-only commit recording the implementation SHA, tests, skipped tests, and reviewer result. Do not amend implementation commits just to add their SHA to the ledger.
- Use subagent-driven development for implementation. After each implementation task's code/tests pass, run a spec-compliance review and code-quality review, record the review result in the ledger, then create the ledger-only commit before moving on.
- Required final reviews: code review, security review, tenant-safety review, API/SDK/CLI/MCP parity review, and database/Postgres harness review.
- A claim is complete only when the task's tests pass and the ledger names the evidence.

## Dependency Order

1. Task 1 sets up branch and ledger.
2. Task 2 makes Journey 8 honest; Task 7 later adds adapter proof to the same journey.
3. Tasks 3 and 4 build the shared-stack tenant-isolation harness before Journey 15 claims CLI coverage.
4. Task 5 tightens MCP coverage.
5. Task 6 tightens CRUD persistence.
6. Task 7 makes CLI workspaces adapter-aware; Task 8 updates CI after Task 7.
7. Tasks 9-13 are code fixes with targeted tests.
8. Tasks 14-16 handle docs, changeset, verification, review, and PR.

## Per-Task Review and Ledger Pattern

For every implementation task after Task 1:

1. Make the code/docs/test changes and run the task's verification commands.
2. Commit only the implementation files listed in that task. Do not stage `PLAN-C-EXECUTION-LEDGER.md` in the implementation commit.
3. Capture the implementation SHA with `git rev-parse --short HEAD`.
4. Dispatch the required spec/code/security/parity reviews listed for the task.
5. Fix any Critical/High/Medium findings with follow-up implementation commits and rerun the affected verification.
6. Update `PLAN-C-EXECUTION-LEDGER.md` with the final implementation SHA(s), test evidence, skipped tests, and reviewer result.
7. Commit only the ledger:

```bash
git add PLAN-C-EXECUTION-LEDGER.md
git commit -m "docs: record Plan C task N evidence"
```

This sequencing is required because the ledger cannot truthfully record an implementation commit SHA from inside that same commit.

## File Structure

```text
docs/superpowers/plans/
└── 2026-04-25-plan-c-codex-followups.md       # this Codex-native plan

PLAN-C-EXECUTION-LEDGER.md                     # requirement-to-evidence ledger

e2e/src/harness/
├── api-server.ts                              # new real HTTP listener for CLI API-mode E2E
├── build-stack.ts                             # shared datastore + safe API key setup
├── mcp-envelope.ts                            # shared MCP response envelope assertions
├── postgres-safety.ts                         # shared safe Postgres URL policy
├── prepare-cli-workspace.ts                   # adapter-aware direct-mode CLI workspace
└── run-mcp.ts                                 # close server on client connect failure

e2e/src/journeys/
├── 08-migration-preview-apply.test.ts         # honest stub passthrough + adapter proof
├── 11-mcp-core-tools.test.ts                  # invoke every listed MCP tool
├── 12-schema-read-parity.test.ts              # API/SDK/MCP schema metadata isolation
├── 15-tenant-isolation.test.ts                # shared-datastore cross-tenant journey
└── _crud-matrix.ts                            # read-after-update checks

packages/core/src/
├── entities/deals/validators.ts               # numeric(18,2)-safe deal value validator
├── entities/deals/validators.test.ts          # validator tests
└── schema-engine/engine.test.ts               # missing-org + two-org metadata tests

packages/core/src/schema-engine/engine.ts      # assert org context on reads
packages/integrations/src/stripe/cli.ts        # namespaced Stripe sentinel
packages/integrations/src/stripe/cli.test.ts   # Stripe status tests
packages/integrations/src/shared/cli-helpers.ts # sentinel-aware status if needed

.github/workflows/ci.yml                       # Postgres matrix + path filters
scripts/release-workflow.test.mjs              # secondary workflow/harness guardrails
docs/product/release-definition-v2.md           # honest release gate definition
e2e/README.md                                  # suite limitations
CHANGELOG.md                                   # Plan C known limitations
.changeset/plan-c-followups.md                 # patch changeset
```

## Non-Negotiable Gates

- Journey 15 must use one shared datastore per adapter for all surfaces under test.
- CLI tenant isolation must be tested against the same seeded stack using a real local HTTP listener and `orbit --mode api`.
- MCP delete tests must pass `confirm: true`; otherwise they test confirmation validation, not tenant isolation.
- Postgres coverage must include a runtime proof. Regex/source checks are not enough.
- Stripe stays on a namespaced sentinel unless the credential storage contract is changed in a separate migration plan.
- Deal value validation must match `numeric(18,2)` range: at most 16 integer digits and at most 2 fractional digits. Negative values remain allowed unless product requirements explicitly disallow them.
- `api_keys` upsert must not reassign `organization_id` on hash conflict.
- Postgres safety URL policy must live in one shared harness module and be used by both `buildStack` and `prepareCliWorkspace`.
- If local Postgres is unavailable, the PR is not complete until GitHub CI's Postgres job passes.

## Task 1: Create Codex Branch and Execution Ledger

**Files:**
- Create: `docs/superpowers/plans/2026-04-25-plan-c-codex-followups.md` if not already committed
- Create: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Create the branch**

Run:

```bash
git fetch origin
if git show-ref --verify --quiet refs/heads/codex/plan-c-followups; then
  echo "Branch codex/plan-c-followups already exists; inspect it instead of resetting it."
  exit 1
fi
git switch -c codex/plan-c-followups origin/main
git status --short --branch
git diff --name-only
git diff --cached --name-only
```

Expected: branch is `codex/plan-c-followups`; no tracked changes. Unrelated untracked files may exist in the shared workspace, but they must not be staged or included in any commit.

- [ ] **Step 2: Create the ledger**

Create `PLAN-C-EXECUTION-LEDGER.md`:

```markdown
# Plan C Execution Ledger

Plan: `docs/superpowers/plans/2026-04-25-plan-c-codex-followups.md`
Branch: `codex/plan-c-followups`

## Scope Rules

- No Claude branch names, `.claude/worktrees`, or Claude memory files.
- No out-of-scope dependency upgrades.
- No release-gate claim without runtime evidence.

## Task Evidence

| Task | Status | Commit | Runtime Evidence | Review Evidence | Notes |
|---|---|---|---|---|---|
| 1 Branch + ledger | Pending |  |  |  |  |
| 2 Journey 8 honesty | Pending |  |  |  |  |
| 3 API listener harness | Pending |  |  |  |  |
| 4 Journey 15 tenant isolation | Pending |  |  |  |  |
| 5 Journey 11 MCP tools | Pending |  |  |  |  |
| 6 CRUD update persistence | Pending |  |  |  |  |
| 7 Adapter-aware CLI workspace | Pending |  |  |  |  |
| 8 CI Postgres matrix | Pending |  |  |  |  |
| 9 api_keys upsert safety | Pending |  |  |  |  |
| 10 run-mcp leak fix | Pending |  |  |  |  |
| 11 Stripe sentinel | Pending |  |  |  |  |
| 12 Schema-engine org context | Pending |  |  |  |  |
| 13 Deal value validation | Pending |  |  |  |  |
| 14 Docs + changeset | Pending |  |  |  |  |
| 15 Verification + reviews | Pending |  |  |  |  |
| 16 PR | Pending |  |  |  |  |

## Deferred Items

- Real schema migration preview/apply engine: Plan C.5.
- DirectTransport custom-field update/delete engine methods: Plan C.5.
- Real Gmail/Calendar/Stripe provider contract tests: separate connector test plan.
- MCP stdio wire E2E: separate MCP transport plan.
- Restricted-role Postgres RLS proof: separate Postgres RLS regression plan.
- Tenant-isolation coverage beyond contacts and deals: separate broader entity-isolation plan.
- npm Trusted Publishing, Dependabot, and `pnpm audit` gating: deferred per Plan B follow-ups and tracked outside Plan C.
```

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-04-25-plan-c-codex-followups.md PLAN-C-EXECUTION-LEDGER.md
git commit -m "docs: start Plan C execution ledger"
```

## Task 2: Make Journey 8 Honest About Stub Migration Semantics

**Files:**
- Modify: `e2e/src/journeys/08-migration-preview-apply.test.ts`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Read the current engine and journey**

Run:

```bash
sed -n '130,170p' packages/core/src/schema-engine/engine.ts
sed -n '1,160p' e2e/src/journeys/08-migration-preview-apply.test.ts
```

Expected engine stub shape:

```typescript
{ operations: [], destructive: false, status: 'ok' }
{ applied: [], status: 'ok' }
```

- [ ] **Step 2: Rewrite the test name and assertions**

Replace the journey with a test named:

```typescript
describe('Journey 8 - migration preview/apply alpha stub passthrough', () => {
  it('CLI returns the current stub response without claiming migration safety', async () => {
```

The assertions must check exact stub shape:

```typescript
expect(preview.operations).toEqual([])
expect(preview.destructive).toBe(false)
expect(preview.status).toBe('ok')
expect(apply.applied).toEqual([])
expect(apply.status).toBe('ok')
```

Add this comment at the top of the file:

```typescript
// This journey is not a destructive-migration safety gate. The alpha migration
// engine is a passthrough stub until Plan C.5 implements executable diff/apply
// behavior. Release documentation must not claim Journey 8 proves destructive
// migration detection.
```

- [ ] **Step 3: Run the journey**

Run:

```bash
pnpm -F @orbit-ai/e2e test src/journeys/08-migration-preview-apply.test.ts
```

Expected: passes.

- [ ] **Step 4: Update ledger and commit**

Run:

```bash
git add e2e/src/journeys/08-migration-preview-apply.test.ts
git commit -m "test(e2e): make migration journey honest about alpha stub"
```

Required review: spec-compliance review that confirms no migration-safety claim remains in the journey.

## Task 3: Add a Real API Listener Harness for CLI API-Mode E2E

**Files:**
- Create: `e2e/src/harness/api-server.ts`
- Modify: `e2e/src/harness/build-stack.ts`
- Modify: `scripts/release-workflow.test.mjs`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Add the listener helper**

Create `e2e/src/harness/api-server.ts`:

```typescript
import { createServer, type Server } from 'node:http'

export interface StartedApiServer {
  readonly baseUrl: string
  close(): Promise<void>
}

export async function startApiServer(api: { fetch(request: Request): Promise<Response> | Response }): Promise<StartedApiServer> {
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? '127.0.0.1'
      const url = `http://${host}${req.url ?? '/'}`
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      const body = chunks.length === 0 ? undefined : Buffer.concat(chunks)
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, item)
        } else if (value !== undefined) {
          headers.set(key, value)
        }
      }
      const response = await api.fetch(new Request(url, { method: req.method, headers, body }))
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      const arrayBuffer = await response.arrayBuffer()
      res.end(Buffer.from(arrayBuffer))
    } catch (err) {
      console.error('E2E API server request failed:', err instanceof Error ? err.message : String(err))
      res.statusCode = 500
      res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    await closeServer(server)
    throw new Error('E2E API server did not bind to a TCP port')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}
```

- [ ] **Step 2: Add a secondary guardrail test**

Append to `scripts/release-workflow.test.mjs`:

```javascript
test('E2E API listener exists for CLI API-mode journeys', () => {
  const src = readFileSync(new URL('../e2e/src/harness/api-server.ts', import.meta.url), 'utf8')
  assert.match(src, /createServer/, 'api-server must use a real Node HTTP listener')
  assert.match(src, /api\.fetch\(new Request/, 'api-server must route requests through the Hono API fetch handler')
  assert.match(src, /127\.0\.0\.1/, 'api-server must bind locally for CLI child processes')
})
```

Use existing imports if `readFileSync` and `assert` are already present; otherwise add `import { readFileSync } from 'node:fs'` and `import assert from 'node:assert/strict'`.

- [ ] **Step 3: Run guardrail**

Run:

```bash
node --test scripts/release-workflow.test.mjs
```

Expected: passes.

- [ ] **Step 4: Commit**

Run:

```bash
git add e2e/src/harness/api-server.ts scripts/release-workflow.test.mjs
git commit -m "test(e2e): add local API server harness for CLI journeys"
```

Required review: code-quality review focused on request body handling and server cleanup.

## Task 4: Add Journey 15 Tenant Isolation Using One Shared Datastore

**Files:**
- Create: `e2e/src/journeys/15-tenant-isolation.test.ts`
- Modify: `e2e/src/harness/build-stack.ts` only if stack metadata needs a typed helper
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Write the failing Journey 15 test**

Use one `buildStack({ tenant: 'both', adapter })` call. Use a beta-bound direct `OrbitClient` only to discover beta IDs. All tested surfaces must use acme credentials/context against those same beta IDs.

Required helper functions inside the test:

```typescript
function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null) {
    const record = err as { code?: string; error?: { code?: string } }
    return record.code ?? record.error?.code
  }
  return undefined
}

async function capture(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn()
    return undefined
  } catch (err) {
    return err
  }
}
```

Required SDK assertions:

```typescript
for (const [label, client] of [['sdk-http', stack.sdkHttp], ['sdk-direct', stack.sdkDirect]] as const) {
  expect(errorCode(await capture(() => client.contacts.get(betaContactId))), `${label} contacts.get`).toBe('RESOURCE_NOT_FOUND')
  expect(errorCode(await capture(() => client.contacts.update(betaContactId, { last_name: 'CrossOrg' }))), `${label} contacts.update`).toBe('RESOURCE_NOT_FOUND')
  expect(errorCode(await capture(() => client.contacts.delete(betaContactId))), `${label} contacts.delete`).toBe('RESOURCE_NOT_FOUND')
  expect(errorCode(await capture(() => client.deals.get(betaDealId))), `${label} deals.get`).toBe('RESOURCE_NOT_FOUND')
  expect(errorCode(await capture(() => client.deals.update(betaDealId, { name: 'CrossOrg' }))), `${label} deals.update`).toBe('RESOURCE_NOT_FOUND')
  expect(errorCode(await capture(() => client.deals.delete(betaDealId))), `${label} deals.delete`).toBe('RESOURCE_NOT_FOUND')
  expect((await client.contacts.list({ limit: 100 })).data.some((r) => r.id === betaContactId), `${label} contacts.list leak`).toBe(false)
  expect((await client.deals.list({ limit: 100 })).data.some((r) => r.id === betaDealId), `${label} deals.list leak`).toBe(false)
}
```

Required raw API assertions:

```typescript
const headers = {
  Authorization: `Bearer ${stack.rawApiKey}`,
  'Orbit-Version': '2026-04-01',
  'content-type': 'application/json',
}

async function expectApiNotFound(path: string, init: RequestInit, label: string): Promise<void> {
  const response = await stack.api.fetch(new Request(`http://test.local${path}`, { ...init, headers }))
  expect(response.status, label).toBe(404)
  const body = await response.json() as { error?: { code?: string } }
  expect(body.error?.code, label).toBe('RESOURCE_NOT_FOUND')
}
```

Call `expectApiNotFound` for `GET`, `PATCH`, and `DELETE` on contacts and deals. Also assert `GET /v1/contacts?limit=100` and `GET /v1/deals?limit=100` do not include beta IDs.

- [ ] **Step 2: Add CLI API-mode assertions against the same stack**

Start the API server from Task 3:

```typescript
const server = await startApiServer(stack.api)
try {
  const cliEnv = {
    ORBIT_API_KEY: stack.rawApiKey,
    ORBIT_BASE_URL: server.baseUrl,
  }
  const cliContactGet = await runCli({
    args: ['--mode', 'api', '--json', 'contacts', 'get', betaContactId],
    cwd: process.cwd(),
    env: cliEnv,
  })
  expect(cliContactGet.exitCode).not.toBe(0)
  expect((cliContactGet.json as { error?: { code?: string } } | null)?.error?.code).toBe('RESOURCE_NOT_FOUND')
} finally {
  await server.close()
}
```

Repeat for:

- contacts `get`, `update`, `delete`, `list`
- deals `get`, `update`, `delete`, `list`

The list assertions must parse CLI JSON and confirm beta IDs are absent. If the CLI command syntax differs, read `packages/cli/src` and adapt the argument order; do not reduce coverage.

Do not pass `...process.env` into the CLI child process for this journey. Pass only the variables needed by `runCli` plus `ORBIT_API_KEY` and `ORBIT_BASE_URL`, so unrelated local `ORBIT_*` settings cannot mask the API-mode contract.

- [ ] **Step 3: Add MCP assertions**

Use `spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })`.

Required calls:

```typescript
await mcp.request('tools/call', { name: 'get_record', arguments: { object_type: 'contacts', record_id: betaContactId } })
await mcp.request('tools/call', { name: 'update_record', arguments: { object_type: 'contacts', record_id: betaContactId, record: { last_name: 'CrossOrg' } } })
await mcp.request('tools/call', { name: 'delete_record', arguments: { object_type: 'contacts', record_id: betaContactId, confirm: true } })
```

Repeat for deals. Every mutation/read must return `isError: true` with `RESOURCE_NOT_FOUND`. Search/list results for contacts and deals must exclude beta IDs.

- [ ] **Step 4: Run SQLite journey**

Run:

```bash
pnpm -F @orbit-ai/e2e test src/journeys/15-tenant-isolation.test.ts
```

Expected: passes. If any surface returns `FORBIDDEN`, do not loosen the assertion; that leaks tenant existence and must be fixed.

- [ ] **Step 5: Run Postgres journey when available**

Run:

```bash
ORBIT_E2E_ADAPTER=postgres DATABASE_URL=postgres://localhost:5432/orbit_e2e pnpm -F @orbit-ai/e2e test src/journeys/15-tenant-isolation.test.ts
```

Expected: passes. If local Postgres is unavailable, record "local Postgres skipped" in the ledger and mark final completion blocked on GitHub CI Postgres success.

- [ ] **Step 6: Commit**

Run:

```bash
git add e2e/src/journeys/15-tenant-isolation.test.ts e2e/src/harness/build-stack.ts
git commit -m "test(e2e): add shared-datastore tenant isolation journey"
```

Required reviews: tenant-safety review and API/SDK/CLI/MCP parity review.

## Task 5: Invoke Every Registered MCP Core Tool in Journey 11

**Files:**
- Create: `e2e/src/harness/mcp-envelope.ts`
- Modify: `e2e/src/journeys/11-mcp-core-tools.test.ts`
- Modify: `e2e/src/journeys/15-tenant-isolation.test.ts` if Task 4 already exists
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Confirm tool payloads**

Run:

```bash
sed -n '1,240p' packages/mcp/src/tools/core-records.ts
sed -n '1,220p' packages/mcp/src/tools/deals.ts
```

Expected:
- `create_record` and `update_record` use `record`.
- `get_record`, `update_record`, and `delete_record` use `record_id`.
- `delete_record` requires `confirm: true`.

- [ ] **Step 2: Track registered and invoked tools**

Create `e2e/src/harness/mcp-envelope.ts` with shared assertions:

```typescript
import { expect } from 'vitest'

type McpToolResponse = { content?: Array<{ type?: string; text?: string }>; isError?: boolean }

export function parseMcpTextPayload(response: McpToolResponse, label: string): Record<string, unknown> {
  expect(response.content?.[0]?.type, `${label}: first content block type`).toBe('text')
  const text = response.content?.[0]?.text
  expect(text, `${label}: text payload`).toBeTruthy()
  return JSON.parse(text!) as Record<string, unknown>
}

export function expectMcpSuccess(response: McpToolResponse, label: string): Record<string, unknown> {
  expect(response.isError, `${label}: isError`).toBeFalsy()
  const payload = parseMcpTextPayload(response, label)
  expect(payload.ok ?? true, `${label}: ok flag`).not.toBe(false)
  return payload
}

export function expectMcpError(response: McpToolResponse, code: string, label: string): Record<string, unknown> {
  expect(response.isError, `${label}: isError`).toBe(true)
  const payload = parseMcpTextPayload(response, label)
  const error = (payload.error ?? payload) as { code?: unknown; message?: unknown; hint?: unknown; recovery?: unknown }
  expect(error.code, `${label}: error.code`).toBe(code)
  expect(typeof error.message, `${label}: error.message`).toBe('string')
  if ('hint' in error) expect(typeof error.hint, `${label}: error.hint`).toBe('string')
  if ('recovery' in error) expect(typeof error.recovery, `${label}: error.recovery`).toBe('string')
  return payload
}
```

Use these helpers for Journey 11 success and negative assertions. Also use `expectMcpError` in Journey 15's MCP tenant-isolation negative assertions and in the deal-value MCP validation smoke from Task 13.

Journey 11 is the core-tools journey, not the complete MCP-server journey. It must assert the expected core tool set exactly so a newly registered non-core tool does not force unrelated payload work into this task:

```typescript
const expectedCoreToolNames = new Set([
  'search_records',
  'get_record',
  'create_record',
  'update_record',
  'delete_record',
  'get_schema',
  'get_pipelines',
  'move_deal_stage',
])
const registeredCoreToolNames = new Set(tools.filter((tool) => expectedCoreToolNames.has(tool.name)).map((tool) => tool.name))
expect([...registeredCoreToolNames].sort()).toEqual([...expectedCoreToolNames].sort())
const invokedToolNames = new Set<string>()
const callTool = async (name: string, args: Record<string, unknown>) => {
  invokedToolNames.add(name)
  return mcp.request('tools/call', { name, arguments: args })
}
```

Replace every direct `mcp.request('tools/call', ...)` call with `callTool(...)`.

- [ ] **Step 3: Add behavior assertions**

Add calls for:
- `get_schema`: assert response lists `contacts`.
- `get_pipelines`: assert at least one pipeline has at least two stages.
- `move_deal_stage`: create a deal in stage 0, move to stage 1, re-`get_record`, and assert `stage_id` persisted.
- `update_record`: update the contact created earlier, re-`get_record`, and assert the updated field persisted.
- `delete_record`: call with `confirm: true`, then assert `get_record` returns `isError: true`.
- Invalid object negative case: call `search_records` with an invalid object type and assert `isError: true`.

At the end of the successful path, assert:

```typescript
expect([...invokedToolNames].filter((name) => expectedCoreToolNames.has(name)).sort()).toEqual([...expectedCoreToolNames].sort())
```

- [ ] **Step 4: Run journey**

Run:

```bash
pnpm -F @orbit-ai/e2e test src/journeys/11-mcp-core-tools.test.ts
```

Expected: passes.

- [ ] **Step 5: Commit**

Run:

```bash
git add e2e/src/harness/mcp-envelope.ts e2e/src/journeys/11-mcp-core-tools.test.ts e2e/src/journeys/15-tenant-isolation.test.ts
git commit -m "test(e2e): invoke every registered MCP core tool"
```

Required review: MCP tool-envelope review.

## Task 6: Add Read-After-Update Checks to CRUD Matrix

**Files:**
- Modify: `e2e/src/journeys/_crud-matrix.ts`
- Modify: `e2e/src/journeys/03-crud-contacts.test.ts`
- Modify: `e2e/src/journeys/04-crud-companies.test.ts`
- Modify: `e2e/src/journeys/05-crud-deals.test.ts`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Extend config**

Extend `CrudMatrixInput`:

```typescript
readonly updateField: 'last_name' | 'name'
readonly updateValue: string
readonly assertField: 'last_name' | 'name' | 'title'
```

Use:

| Entity | updateField | updateValue | assertField |
|---|---|---|---|
| contacts | `last_name` | `Updated` | `last_name` |
| companies | `name` | `Updated Co` | `name` |
| deals | `name` | `Updated Deal` | `title` |

- [ ] **Step 2: Assert persistence per surface**

After each update call, re-get the record and assert:

```typescript
const actual = (refetched as Record<string, unknown>)[input.assertField]
expect(actual, `${label}: update persisted`).toBe(input.updateValue)
```

For raw API, read `data[input.assertField]`. For CLI, parse the `get` output. For MCP, call `get_record` and read either top-level or `data`.

- [ ] **Step 3: Run CRUD journeys**

Run:

```bash
pnpm -F @orbit-ai/e2e test src/journeys/03-crud-contacts.test.ts src/journeys/04-crud-companies.test.ts src/journeys/05-crud-deals.test.ts
```

Expected: passes.

- [ ] **Step 4: Commit**

Run:

```bash
git add e2e/src/journeys/_crud-matrix.ts e2e/src/journeys/03-crud-contacts.test.ts e2e/src/journeys/04-crud-companies.test.ts e2e/src/journeys/05-crud-deals.test.ts
git commit -m "test(e2e): assert CRUD updates persist across surfaces"
```

## Task 7: Make CLI Workspace Adapter-Aware With Runtime Proof

**Files:**
- Create: `e2e/src/harness/postgres-safety.ts`
- Modify: `e2e/src/harness/build-stack.ts`
- Modify: `e2e/src/harness/prepare-cli-workspace.ts`
- Modify: `e2e/src/journeys/07-custom-field.test.ts`
- Modify: `e2e/src/journeys/08-migration-preview-apply.test.ts`
- Modify: `scripts/release-workflow.test.mjs`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Extract shared Postgres safety policy**

Move the safe local Postgres URL check out of `build-stack.ts` into `e2e/src/harness/postgres-safety.ts`:

```typescript
const POSTGRES_TEST_DATABASE_NAMES = new Set(['orbit_e2e', 'orbit_e2e_test', 'orbit_ai_test'])

export function assertSafePostgresE2eUrl(databaseUrl: string): void {
  const url = new URL(databaseUrl)
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
  const databaseName = url.pathname.replace(/^\//, '')

  if (!isLocalhost || !POSTGRES_TEST_DATABASE_NAMES.has(databaseName)) {
    throw new Error(
      `Refusing to run Postgres e2e tests against ${url.hostname}/${databaseName}. ` +
      `Use localhost with one of: ${[...POSTGRES_TEST_DATABASE_NAMES].join(', ')}.`,
    )
  }
}
```

`build-stack.ts` and `prepare-cli-workspace.ts` must both import this helper. Do not duplicate the allowed database list.

- [ ] **Step 2: Extend return metadata**

Update `PreparedWorkspace`:

```typescript
readonly adapter: 'sqlite' | 'postgres'
readonly databaseUrl: string
readonly proof: {
  readonly adapter: 'sqlite' | 'postgres'
  readonly source: 'runtime'
  readonly verifiedBy: 'metadata' | 'fresh-adapter-read'
}
```

- [ ] **Step 3: Implement adapter selection**

`prepareCliWorkspace` must accept:

```typescript
adapter?: 'sqlite' | 'postgres'
```

Selection:

```typescript
const adapterType = opts.adapter ?? ((process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres')
```

SQLite path keeps the current temp file behavior.

Postgres path must:
- require `DATABASE_URL`
- call `assertSafePostgresE2eUrl(DATABASE_URL)` from `postgres-safety.ts`
- migrate the Postgres adapter
- seed the requested tenant into the same Postgres database using `{ mode: 'reset', allowResetOfExistingOrg: true }`
- before seeding Journey 7 data, delete or namespace any custom-field/schema metadata that the CLI journey will create, so repeated local and CI runs do not conflict on deterministic field names such as `lifetime_value`
- set `ORBIT_ADAPTER=postgres`
- set `DATABASE_URL` to the Postgres URL
- return `adapter: 'postgres'`
- avoid creating an unused SQLite DB
- `cleanup()` must close the adapter/pool and remove the temp cwd. It must not silently drop or wipe the shared database unless the safe URL policy has already passed and the cleanup is explicitly scoped to data created by this workspace.

- [ ] **Step 4: Add fail-fast runtime assertions in Journeys 7 and 8**

After preparing the workspace:

```typescript
if (process.env.ORBIT_E2E_ADAPTER === 'postgres') {
  expect(workspace.adapter).toBe('postgres')
  expect(workspace.databaseUrl).toMatch(/^postgres/)
}
```

Journey 7 must also prove the CLI subprocess wrote to Postgres. After the CLI adds the custom field, create a fresh Postgres-backed adapter using `workspace.databaseUrl`, read schema metadata for `workspace.orgId`, and assert the expected custom field exists. Set `workspace.proof.verifiedBy` or equivalent test evidence to `fresh-adapter-read`.

Journey 8 is a migration-stub passthrough. Its Postgres assertion proves adapter routing only; the test name/comment must keep saying it is not migration-safety proof.

- [ ] **Step 5: Add source guardrail**

Add a `scripts/release-workflow.test.mjs` test that checks the helper reads `ORBIT_E2E_ADAPTER`, contains a Postgres branch, and returns `adapter`. This test is secondary only; runtime E2E remains required.

- [ ] **Step 6: Add serial Postgres guardrail**

Add a guardrail asserting `e2e/vitest.config.ts` keeps shared Postgres DB journeys serial, for example `fileParallelism: false`. The plan relies on serial execution so one journey's deterministic reset cannot wipe another active journey.

- [ ] **Step 7: Run SQLite targeted journeys**

Run:

```bash
pnpm -F @orbit-ai/e2e test src/journeys/07-custom-field.test.ts src/journeys/08-migration-preview-apply.test.ts
node --test scripts/release-workflow.test.mjs
```

Expected: passes.

- [ ] **Step 8: Run Postgres targeted journeys**

Run:

```bash
ORBIT_E2E_ADAPTER=postgres DATABASE_URL=postgres://localhost:5432/orbit_e2e pnpm -F @orbit-ai/e2e test src/journeys/07-custom-field.test.ts src/journeys/08-migration-preview-apply.test.ts
```

Expected: passes with runtime proof. If local Postgres is unavailable, record the skip and mark final completion blocked on GitHub CI Postgres success.

- [ ] **Step 9: Commit**

Run:

```bash
git add e2e/src/harness/postgres-safety.ts e2e/src/harness/build-stack.ts e2e/src/harness/prepare-cli-workspace.ts e2e/src/journeys/07-custom-field.test.ts e2e/src/journeys/08-migration-preview-apply.test.ts scripts/release-workflow.test.mjs
git commit -m "test(e2e): make CLI workspace honor selected adapter"
```

Required review: database/Postgres harness review.

## Task 8: Fix CI Postgres Matrix and Release-Sensitive Triggers

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/release-workflow.test.mjs`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Update matrix command**

The Postgres job must run:

```bash
pnpm -F @orbit-ai/e2e test src/journeys/02 src/journeys/03 src/journeys/04 src/journeys/05 src/journeys/06 src/journeys/07 src/journeys/08 src/journeys/09 src/journeys/10 src/journeys/11 src/journeys/12 src/journeys/15
pnpm -F @orbit-ai/e2e test src/harness/build-stack.test.ts
```

- [ ] **Step 2: Update path filters**

E2E must trigger for:

```yaml
- '.github/workflows/ci.yml'
- '.github/workflows/release.yml'
- 'scripts/release*'
- 'scripts/release*/**'
- 'package.json'
- 'pnpm-lock.yaml'
- 'pnpm-workspace.yaml'
- 'packages/*/package.json'
- 'packages/cli/src/**'
- 'packages/mcp/src/**'
- 'packages/demo-seed/src/**'
- 'packages/core/src/**'
- 'packages/api/src/**'
- 'packages/sdk/src/**'
- '.changeset/**'
- 'e2e/**'
- 'e2e/src/harness/**'
- 'docs/product/release-definition-v2.md'
```

- [ ] **Step 3: Add guardrail tests**

Add `node:test` assertions that the Postgres command includes `07`, `08`, `12`, and `15`, that the Postgres job runs `src/harness/build-stack.test.ts`, and that the path filters include the release workflow, release scripts, package metadata, CLI/MCP/demo-seed/core/API/SDK source paths, changesets, and harness paths.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
node --test scripts/release-workflow.test.mjs
git add .github/workflows/ci.yml scripts/release-workflow.test.mjs
git commit -m "ci(e2e): include tenant isolation and adapter-aware CLI journeys"
```

## Task 9: Make Postgres api_keys Upsert Safe

**Files:**
- Modify: `e2e/src/harness/build-stack.ts`
- Create or modify: `e2e/src/harness/build-stack.test.ts`
- Modify: `scripts/release-workflow.test.mjs`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Replace reparenting upsert**

Change the Postgres API key insert to use `key_hash` as identity without changing `organization_id` on conflict:

```sql
ON CONFLICT (key_hash) DO NOTHING
```

After the insert, select the row for `key_hash`. If it exists and `organization_id !== acme.organization.id`, throw:

```typescript
throw new Error('Postgres e2e API key hash collision belongs to a different organization')
```

- [ ] **Step 2: Add runtime collision tests**

Add a runtime harness test, using the safe local Postgres E2E database when `DATABASE_URL` is set. The test must:

- create or seed two orgs in the safe Postgres E2E database
- insert an `api_keys` row for beta with a known `key_hash` and `key_prefix`
- invoke the build-stack API-key insert path for acme with the same `key_hash`
- expect an error
- re-select the beta row and assert `organization_id`, `key_hash`, `key_prefix`, `scopes`, `revoked_at`, and `expires_at` are unchanged
- separately verify a `key_prefix` conflict with a different hash does not update `organization_id`

If this requires extracting the API-key insert into a small helper, do that in `build-stack.ts` and keep it unexported from the package surface. The test may be skipped only when no local Postgres URL is available; final PR completion is still blocked on CI Postgres success.

- [ ] **Step 3: Add guardrail test**

In `scripts/release-workflow.test.mjs`, assert:

```javascript
assert.match(src, /ON CONFLICT \(key_hash\) DO NOTHING/)
assert.doesNotMatch(src, /ON CONFLICT \(key_hash\) DO UPDATE SET organization_id/)
assert.doesNotMatch(src, /ON CONFLICT \(key_prefix\)/)
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
node --test scripts/release-workflow.test.mjs
pnpm -F @orbit-ai/e2e test src/harness/build-stack.test.ts
git add e2e/src/harness/build-stack.ts e2e/src/harness/build-stack.test.ts scripts/release-workflow.test.mjs
git commit -m "test(e2e): avoid reassigning API keys on Postgres hash conflict"
```

Required review: security review.

## Task 10: Close MCP Server on Client Connect Failure

**Files:**
- Modify: `e2e/src/harness/run-mcp.ts`
- Modify: `scripts/release-workflow.test.mjs`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Wrap client connect**

After `await server.connect(serverTransport)`, wrap `await mcpClient.connect(clientTransport)`:

```typescript
try {
  await mcpClient.connect(clientTransport)
} catch (err) {
  try {
    if (typeof (server as { close?: () => Promise<void> }).close === 'function') {
      await (server as { close: () => Promise<void> }).close()
    }
  } catch (closeErr) {
    console.error(
      'Failed to close MCP server after client connect failure:',
      closeErr instanceof Error ? closeErr.message : String(closeErr),
    )
    if (err instanceof Error && (err as Error & { cause?: unknown }).cause === undefined) {
      ;(err as Error & { cause?: unknown }).cause = closeErr
    }
  }
  throw err
}
```

- [ ] **Step 2: Add guardrail and run MCP journey**

Run:

```bash
node --test scripts/release-workflow.test.mjs
pnpm -F @orbit-ai/e2e test src/journeys/11-mcp-core-tools.test.ts
```

Expected: passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add e2e/src/harness/run-mcp.ts scripts/release-workflow.test.mjs
git commit -m "fix(e2e): close MCP server on client connect failure"
```

## Task 11: Use a Namespaced Stripe API-Key Sentinel

**Files:**
- Modify: `packages/integrations/src/stripe/cli.ts`
- Modify: `packages/integrations/src/stripe/cli.test.ts`
- Modify: `packages/integrations/src/shared/cli-helpers.ts` if status output needs sentinel-specific wording
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Add the sentinel**

In `packages/integrations/src/stripe/cli.ts`:

```typescript
const STRIPE_API_KEY_SENTINEL = '__orbit_sentinel__:stripe:api_key'
```

Save credentials with:

```typescript
{ accessToken: apiKey, refreshToken: STRIPE_API_KEY_SENTINEL }
```

- [ ] **Step 2: Ensure status treats Stripe as API-key configured**

If `runStatusAction` exposes refresh-token-specific status fields, add provider-specific handling:

```typescript
const usesApiKeySentinel = input.provider === 'stripe' && creds.refreshToken === '__orbit_sentinel__:stripe:api_key'
```

Status must report configured without implying OAuth refresh capability.

- [ ] **Step 3: Update tests**

Tests must assert:
- configure persists the namespaced sentinel
- status reports configured for Stripe sentinel credentials
- old sentinel string `__stripe_api_key__` no longer appears

Run:

```bash
pnpm -F @orbit-ai/integrations test
pnpm -F @orbit-ai/e2e test src/journeys/14-integrations-stripe.test.ts
```

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/integrations/src/stripe/cli.ts packages/integrations/src/stripe/cli.test.ts packages/integrations/src/shared/cli-helpers.ts
git commit -m "fix(integrations): namespace Stripe API-key credential sentinel"
```

Required review: security review.

## Task 12: Add Schema-Engine Org Context and Cross-Org Metadata Tests

**Files:**
- Modify: `packages/core/src/schema-engine/engine.ts`
- Modify: `packages/core/src/schema-engine/engine.test.ts`
- Create: `e2e/src/journeys/12-schema-read-parity.test.ts`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Add missing org assertions**

At the start of both methods:

```typescript
async listObjects(ctx: OrbitAuthContext): Promise<SchemaObjectSummary[]> {
  assertOrgContext(ctx)
```

```typescript
async getObject(ctx: OrbitAuthContext, type: string): Promise<SchemaObjectSummary | null> {
  assertOrgContext(ctx)
```

- [ ] **Step 2: Add tests**

Tests must cover:
- `listObjects({ orgId: undefined } as any)` rejects before repository access
- `getObject({ orgId: undefined } as any, 'contacts')` rejects before repository access
- beta custom field created through the engine is absent from acme `listObjects`
- beta custom field is absent from acme `getObject('contacts')`

The missing-org tests must use a fake or spy custom-field repository whose list method would otherwise succeed and records calls. Assert both:

```typescript
await expect(engine.listObjects({ orgId: undefined } as any)).rejects.toMatchObject({ code: 'AUTH_CONTEXT_REQUIRED' })
expect(fakeRepo.listCalls).toBe(0)
```

Adapt the constructor shape to the existing test utilities, but do not rely on the real repository's own `assertOrgContext` to make this pass.

- [ ] **Step 3: Add schema-read parity tests**

Create `e2e/src/journeys/12-schema-read-parity.test.ts` with targeted API + SDK HTTP + SDK Direct + MCP assertions:

- beta creates `contacts.linkedin_url`
- acme `/v1/objects` omits `linkedin_url`
- acme `/v1/objects/contacts` omits `linkedin_url`
- `client.schema.listObjects()` and `client.schema.getObject('contacts')` in HTTP and Direct modes also omit `linkedin_url`
- MCP `get_schema` omits beta's `linkedin_url`; if the MCP server exposes an `orbit://schema` resource, assert that resource also omits it. If no schema resource exists, assert `get_schema` coverage and document the absent resource in the ledger.

Use one `buildStack({ tenant: 'both', adapter })` call. Use a beta-bound direct client or schema engine only to create/discover beta schema metadata; all tested surfaces must be acme-bound against the same stack.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
pnpm --filter @orbit-ai/core test -- schema-engine
pnpm -F @orbit-ai/e2e test src/journeys/11-mcp-core-tools.test.ts
pnpm -F @orbit-ai/e2e test src/journeys/12-schema-read-parity.test.ts
git add packages/core/src/schema-engine/engine.ts packages/core/src/schema-engine/engine.test.ts e2e/src/journeys/11-mcp-core-tools.test.ts e2e/src/journeys/12-schema-read-parity.test.ts
git commit -m "fix(core): require org context for schema-engine reads"
```

Required reviews: tenant-safety review and API/SDK parity review.

## Task 13: Tighten Deal Value Validation to numeric(18,2)

**Files:**
- Modify: `packages/core/src/entities/deals/validators.ts`
- Create or modify: `packages/core/src/entities/deals/validators.test.ts`
- Modify: `e2e/src/journeys/05-crud-deals.test.ts` if value fixtures need adjustment
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Add bounded validator**

Add:

```typescript
const DECIMAL_18_2 = /^-?\d{1,16}(\.\d{1,2})?$/

const dealValueSchema = z.union([
  z.number(),
  z.string(),
]).transform((value, ctx) => {
  const normalized = typeof value === 'number' ? normalizeNumberValue(value, ctx) : value
  if (normalized === z.NEVER) return z.NEVER
  if (!DECIMAL_18_2.test(normalized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'value must fit numeric(18,2): at most 16 integer digits and 2 fractional digits',
    })
    return z.NEVER
  }
  return normalized
}).optional().nullable()

function normalizeNumberValue(value: number, ctx: z.RefinementCtx): string | typeof z.NEVER {
  if (!Number.isFinite(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'value must be finite' })
    return z.NEVER
  }
  if (!Number.isSafeInteger(Math.trunc(value))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'value magnitude exceeds safe integer range; pass a decimal string' })
    return z.NEVER
  }
  return value.toFixed(2)
}
```

Use `dealValueSchema` in both create and update schemas.

- [ ] **Step 2: Add tests**

Cover:
- rejects `'1e21'`
- rejects `1e21`
- rejects `Infinity`
- rejects `'12345678901234567.00'`
- rejects `'1.234'`
- accepts `'1234567890123456.78'`
- accepts `1234` as `'1234.00'`
- accepts negative string `'-50.00'`
- update accepts `null`
- update accepts absence

- [ ] **Step 3: Add cross-surface validation smoke**

Extend Journey 5 or add focused tests so API, SDK HTTP, SDK Direct, CLI JSON, and MCP all return `VALIDATION_FAILED` for `value: '1e21'`. The assertions must check the code, not only that the command failed.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
pnpm --filter @orbit-ai/core test -- deals
pnpm -F @orbit-ai/e2e test src/journeys/05-crud-deals.test.ts
git add packages/core/src/entities/deals/validators.ts packages/core/src/entities/deals/validators.test.ts e2e/src/journeys/05-crud-deals.test.ts
git commit -m "fix(core): validate deal values against numeric precision"
```

Required review: type/design review and parity review.

## Task 14: Update Release Docs and Changeset

**Files:**
- Modify: `docs/product/release-definition-v2.md`
- Modify: `e2e/README.md`
- Modify: `CHANGELOG.md`
- Create: `.changeset/plan-c-followups.md`
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Update docs**

Docs must state:
- Journey 8 is stub passthrough only, not migration safety.
- Tenant isolation gate is Journey 15 across SDK HTTP, SDK Direct, raw API, CLI API mode, and MCP.
- Postgres gate is valid only after runtime adapter proof and CI Postgres success.
- CRUD parity includes read-after-update.
- MCP gate requires every listed core tool to be invoked.
- DirectTransport `PATCH/DELETE` of custom fields remains a known limitation until Plan C.5 implements `engine.updateField` and `engine.deleteField`.
- Connector journeys persist and redact credentials only; they do not prove live provider dispatch.
- MCP stdio wire is not covered by Journey 11.
- Restricted-role Postgres RLS is not proved by Plan C; tenant isolation remains application-layer E2E coverage.
- Journey 15 explicitly covers contacts and deals only; broader entity isolation is deferred.
- npm Trusted Publishing, Dependabot, and `pnpm audit` gating remain deferred per Plan B follow-ups.

- [ ] **Step 2: Create changeset**

Create `.changeset/plan-c-followups.md`:

```markdown
---
"@orbit-ai/core": patch
"@orbit-ai/integrations": patch
---

Internal Plan C hardening:

- `@orbit-ai/core`: require org context for schema-engine reads and reject deal values that do not fit numeric(18,2).
- `@orbit-ai/integrations`: replace Stripe's unscoped API-key sentinel with a namespaced sentinel and status handling.

The E2E launch gate was hardened with tenant-isolation, MCP tool invocation, CRUD update-persistence, and Postgres adapter-proof coverage.
```

- [ ] **Step 3: Verify docs and changeset**

Run:

```bash
pnpm changeset status
rg -n "Journey 8|migration safety|tenant isolation|Postgres|stdio|connector|DirectTransport|custom fields|RLS|contacts and deals|Trusted Publishing|Dependabot|pnpm audit" docs/product/release-definition-v2.md e2e/README.md CHANGELOG.md

set +e
matches="$(rg -n "DirectTransport missing.*workflow|workflow sub-routes.*follow-up|workflow sub-routes.*filed" . --glob '*.md' --glob '*.MD')"
rc=$?
set -e
if [ "$rc" -gt 1 ]; then
  echo "rg failed (rc=$rc)"
  exit 1
fi
if [ -n "$matches" ]; then
  echo "STALE WORKFLOW SUB-ROUTE CLAIMS:"
  echo "$matches"
  exit 1
fi
```

Expected: changeset lists only `@orbit-ai/core` and `@orbit-ai/integrations`; docs contain honest limitations; no stale workflow-sub-route follow-up claim remains in repo docs.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/product/release-definition-v2.md e2e/README.md CHANGELOG.md .changeset/plan-c-followups.md
git commit -m "docs: define Plan C launch-gate evidence and limitations"
```

## Task 15: Full Verification and Review

**Files:**
- Modify: `PLAN-C-EXECUTION-LEDGER.md`

- [ ] **Step 1: Run local verification**

Run:

```bash
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
pnpm -F @orbit-ai/e2e test
node --test scripts/release-workflow.test.mjs
pnpm changeset status
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Run Postgres verification**

Run when local Postgres is available:

```bash
ORBIT_E2E_ADAPTER=postgres DATABASE_URL=postgres://localhost:5432/orbit_e2e pnpm -F @orbit-ai/e2e test \
  src/journeys/02 src/journeys/03 src/journeys/04 src/journeys/05 src/journeys/06 \
  src/journeys/07 src/journeys/08 src/journeys/09 src/journeys/10 src/journeys/11 src/journeys/12 src/journeys/15
ORBIT_E2E_ADAPTER=postgres DATABASE_URL=postgres://localhost:5432/orbit_e2e pnpm -F @orbit-ai/e2e test src/harness/build-stack.test.ts
```

If skipped locally, the ledger must say final completion is blocked until GitHub CI Postgres passes.

- [ ] **Step 3: Run required reviews**

Dispatch focused reviews over the full branch diff:
- Code review: correctness, missed requirements, test quality.
- Security review: API key upsert, Stripe sentinel, CLI API server, tenant-existence disclosure.
- Tenant-safety review: Journey 15 and schema-engine reads.
- Database review: Postgres adapter proof, migrations, API key insert behavior.
- API/SDK/CLI/MCP parity review: tenant isolation, validation errors, schema reads, MCP envelopes.

Fix Critical/High/Medium findings before PR. Critical and High findings are non-deferrable unless the plan scope is explicitly amended and every affected release/coverage claim is removed from docs. Medium findings may be deferred only with a concrete follow-up, ledger entry, and docs update when user-facing claims are affected.

- [ ] **Step 4: Commit ledger**

Run:

```bash
git add PLAN-C-EXECUTION-LEDGER.md
git commit -m "docs: record Plan C verification and review evidence"
```

## Task 16: Open PR

**Files:**
- No source files required unless PR feedback finds gaps.

- [ ] **Step 1: Push branch**

Run:

```bash
git push -u origin codex/plan-c-followups
```

- [ ] **Step 2: Create PR**

Title:

```text
fix: close Plan C launch-gate follow-up findings
```

Body must include:
- Link to this plan.
- Link to `PLAN-C-EXECUTION-LEDGER.md`.
- Summary of each task.
- Local verification results.
- Postgres verification status.
- Review results.
- Explicit deferred items: Plan C.5 migration engine, DirectTransport custom-field update/delete, connector real-provider tests, MCP stdio wire.

- [ ] **Step 3: Wait for GitHub checks**

Do not merge until:
- CI passes.
- Postgres matrix passes.
- CodeQL/security checks pass.
- PR comments are resolved.
- Ledger is updated if PR comments require additional fixes.

## Self-Review Checklist

- [ ] Branch/worktree instructions are Codex-native.
- [ ] No Claude branch names, `.claude` memory writes, or Claude-only review tools remain.
- [ ] Journey 15 uses one shared datastore for every tested surface.
- [ ] CLI tenant isolation uses a real local HTTP listener and `--mode api`.
- [ ] MCP delete tests pass `confirm: true`.
- [ ] Postgres proof is runtime-based, not source-regex-only.
- [ ] Stripe uses a namespaced sentinel; no credential nullability change is hidden in this plan.
- [ ] Deal value validation matches numeric(18,2).
- [ ] Schema-engine tests include both missing-org and cross-org metadata isolation.
- [ ] API key hash conflict does not reassign organizations.
- [ ] Required reviews happen before PR is considered ready.
- [ ] Ledger maps every requirement to commits, tests, and reviews.
