# AGENTS.md — Orbit AI

Orbit AI is CRM infrastructure for AI agents and developers: type-safe entities, a REST API, TypeScript SDK, CLI, MCP server, and Gmail/Calendar/Stripe connectors. It is not a hosted product — it is a set of packages you deploy alongside your application.

**Status:** `0.1.0-alpha`. API is stable within the alpha series. Not yet on npm — install from source.

---

## Surface Selection

Choose one surface. They share the same entity model and auth contract.

| Surface | When to use |
|---|---|
| **MCP** (`@orbit-ai/mcp`) | You are running inside Claude, Cursor, Copilot, or another MCP host. Use the 23 built-in tools. |
| **SDK** (`@orbit-ai/sdk`) | You are writing TypeScript server-side code. HTTP mode (against a running API) or DirectTransport (in-process, no network, trusted contexts only). |
| **API** (`@orbit-ai/api`) | You are calling from any language over HTTP. REST, JSON, standard auth header. |
| **CLI** (`@orbit-ai/cli`) | You are automating from a shell script or terminal. `orbit <entity> <verb>`. |

---

## Authentication

**API / SDK (HTTP mode)**

```
Authorization: Bearer <api-key>
Orbit-Version: 2026-04-01
```

API keys are per-organization. Scopes: `*` (all), or specific entity scopes like `contacts:read`.

**MCP (HTTP transport)**

Same Bearer token in the `Authorization` header. Auth is enforced per request.

**MCP (stdio transport)**

Pass `ORBIT_API_KEY` as an environment variable when starting the server. The server holds one identity for the lifetime of the process.

**CLI**

```bash
export ORBIT_API_KEY=orb_...
export ORBIT_BASE_URL=https://api.yourapp.com
```

Or set `apiKey` and `baseUrl` in `~/.config/orbit/config.json`.

**SDK (DirectTransport)**

No API key. Pass `adapter` and `context: { orgId }` directly. Only for trusted server-side code — bypasses auth, rate limiting, and scope enforcement.

---

## Entity Inventory

All entities share the same ID prefix convention (`contact_`, `company_`, etc.) and support CRUD + cursor-based list pagination.

| Entity | ID prefix | What it is |
|---|---|---|
| `contacts` | `contact_` | People — leads, customers, prospects |
| `companies` | `company_` | Organizations that contacts belong to |
| `deals` | `deal_` | Sales opportunities moving through a pipeline |
| `pipelines` | `pipeline_` | Named pipelines containing ordered stages |
| `stages` | `stage_` | Stages within a pipeline (ordered by `position`) |
| `users` | `user_` | Team members with access to the org |
| `activities` | `activity_` | Logged interactions: calls, emails, meetings, notes |
| `tasks` | `task_` | To-do items assigned to users |
| `notes` | `note_` | Free-text notes attached to any record |
| `products` | `product_` | Product or service catalog items |
| `payments` | `payment_` | Payment records (often synced from Stripe) |
| `contracts` | `contract_` | Contract records |
| `sequences` | `sequence_` | Automated contact engagement sequences |
| `tags` | `tag_` | Labels attached to any record |
| `webhooks` | `webhook_` | Outbound webhook subscriptions |
| `imports` | `import_` | Bulk import jobs |

---

## Common Patterns

### Create a contact and log an activity (SDK)

```typescript
const contact = await client.contacts.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
})

await client.activities.create({
  contact_id: contact.id,
  type: 'email',
  subject: 'Introduction',
  body: 'Sent intro email.',
})
```

### Move a deal through pipeline stages (SDK)

```typescript
// 1. Find the target stage
const pipelines = await client.pipelines.list()
const stage = pipelines.data[0].stages.find(s => s.name === 'Proposal Sent')

// 2. Update the deal
await client.deals.update(dealId, { stage_id: stage.id })
```

### Move a deal via MCP

```
Tool: move_deal_stage
Args: { "deal_id": "deal_01JXXXX", "stage_id": "stage_01JXXXX" }
```

### Add a custom field to contacts (SDK)

```typescript
await client.schema.addField('contacts', {
  name: 'linkedin_url',
  label: 'LinkedIn URL',
  type: 'text',
})
```

### Paginate all contacts (SDK)

```typescript
for await (const contact of client.contacts.pages({ limit: 100 }).autoPaginate()) {
  console.log(contact.id, contact.name)
}
```

### Search across entities (CLI)

```bash
orbit search "ada lovelace" --entity contacts --format json
```

---

## Error Codes

All surfaces return structured errors with a `code` field.

| Code | HTTP status | Meaning | Action |
|---|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | Record does not exist or is outside the org scope | Check the ID and org context |
| `VALIDATION_FAILED` | 422 | Request body failed schema validation | Fix the `details` array in the error |
| `AUTH_INVALID_API_KEY` | 401 | API key missing, malformed, revoked, or expired | Check `ORBIT_API_KEY` |
| `AUTH_INSUFFICIENT_SCOPE` | 403 | API key lacks scope for this operation | Use a key with wider scope or `*` |
| `AUTH_CONTEXT_REQUIRED` | 401 | No org context could be resolved | Pass `orgId` or use a key tied to an org |
| `RATE_LIMITED` | 429 | Too many requests from this API key | Back off and retry; rate limit is per-key sliding window |
| `IDEMPOTENCY_CONFLICT` | 409 | Same `Idempotency-Key` used with different payload | Use a new key for a genuinely new request |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeds 1 MB | Split the payload |
| `INTERNAL_ERROR` | 500 | Server-side error | Retry with exponential backoff; report `request_id` |

SDK wraps these as `OrbitApiError`:

```typescript
import { OrbitApiError } from '@orbit-ai/sdk'

try {
  await client.contacts.get('contact_bad')
} catch (err) {
  if (err instanceof OrbitApiError) {
    console.error(err.code)       // 'RESOURCE_NOT_FOUND'
    console.error(err.status)     // 404
    console.error(err.retryable)  // false
    console.error(err.request_id) // 'req_01JXXXX'
  }
}
```

---

## Known Alpha Limitations

- **Idempotency store is in-memory** — single-instance only. For multi-instance deployments, implement `IdempotencyStore` and pass via `CreateApiOptions.idempotencyStore`.
- **Rate limiter is in-memory** — same constraint. A pluggable `RateLimitStore` interface is planned.
- **API keys are SHA-256 hashed** — HMAC-SHA256 + server pepper is planned for v1 GA.
- **SQLite has no RLS** — tenant isolation is application-layer only. Do not use SQLite in multi-tenant production.
- **Packages are not yet on npm** — install from source: `pnpm install && pnpm -r build`.
- **Batch mutations** — route types exist but batch write implementation is not complete.

---

## Key Files

```
README.md                        — quickstart, architecture, dev setup
AGENTS.md                        — this file
llms.txt                         — compact machine-readable index
packages/core/README.md          — schema engine, adapters, migrations
packages/api/README.md           — REST routes, auth, config reference
packages/sdk/README.md           — client usage, DirectTransport, pagination
packages/cli/README.md           — command reference, global flags, config file
packages/mcp/README.md           — tool reference, server setup, transports
packages/integrations/README.md  — Gmail, Calendar, Stripe setup guides
packages/demo-seed/README.md     — deterministic demo data package
e2e/README.md                    — launch-gate journey tests
examples/nodejs-quickstart/      — runnable end-to-end example
```
