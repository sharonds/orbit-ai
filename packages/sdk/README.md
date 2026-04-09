# @orbit-ai/sdk

> Type-safe TypeScript client for the Orbit AI CRM infrastructure.
> Works over HTTP (against `@orbit-ai/api`) or in-process via DirectTransport.

**Status**: `0.1.0-alpha` — API is stable within the alpha series.

## Installation

```bash
pnpm add @orbit-ai/sdk
# or
npm install @orbit-ai/sdk
```

Requires **Node.js 22+**.

## Quickstart

### 1. Create a client

```typescript
import { OrbitClient } from '@orbit-ai/sdk'

const client = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY!,
  baseUrl: process.env.ORBIT_API_BASE_URL!, // e.g. https://api.yourapp.com
})
```

### 2. CRUD

```typescript
// Create a contact
const contact = await client.contacts.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
})

// Get by ID
const fetched = await client.contacts.get(contact.id)

// Update
const updated = await client.contacts.update(contact.id, {
  name: 'Ada Lovelace-King',
})

// Delete
await client.contacts.delete(contact.id)
```

### 3. Paginated listing

```typescript
// Single page — returns Promise<OrbitEnvelope<Contact[]>>
const page = await client.contacts.list({ limit: 50 })
console.log(page.data)             // Contact[]
console.log(page.meta.next_cursor) // string | null
console.log(page.meta.has_more)    // boolean

// Iterate all pages automatically
for await (const contact of client.contacts.pages({ limit: 50 }).autoPaginate()) {
  console.log(contact.id, contact.name)
}
```

### 4. Handle errors

```typescript
import { OrbitClient, OrbitApiError } from '@orbit-ai/sdk'

try {
  await client.contacts.get('nonexistent-id')
} catch (err) {
  if (err instanceof OrbitApiError) {
    console.error(err.code)       // e.g. 'RESOURCE_NOT_FOUND' (getter on .error.code)
    console.error(err.message)    // human-readable (inherited from Error)
    console.error(err.status)     // HTTP status code (404)
    console.error(err.retryable)  // boolean
    console.error(err.request_id) // correlation ID for server logs
  }
}
```

## Resources

The client exposes one property per entity:

| Property | Entity |
|---|---|
| `client.contacts` | Contact records |
| `client.companies` | Company records |
| `client.deals` | Deal records |
| `client.pipelines` | Pipeline definitions |
| `client.stages` | Pipeline stage definitions |
| `client.users` | User records |
| `client.activities` | Activity log entries |
| `client.tasks` | Task records |
| `client.notes` | Notes |
| `client.products` | Product/service catalog |
| `client.payments` | Payment records |
| `client.contracts` | Contract records |
| `client.sequences` | Sequence definitions |
| `client.sequenceSteps` | Steps within a sequence |
| `client.sequenceEnrollments` | Contact-to-sequence enrollment |
| `client.sequenceEvents` | Events emitted by sequences |
| `client.tags` | Tags |
| `client.webhooks` | Webhook subscriptions |
| `client.imports` | Bulk import jobs |
| `client.search` | Cross-entity search |
| `client.schema` | Schema introspection |

Every resource except `search` and `schema` supports `create`, `get`, `update`,
`delete`, `list`, and `pages`.

## Direct-core transport (server-side / tests)

> **@security** DirectTransport bypasses HTTP, auth middleware, rate limiting,
> and scope enforcement. Only use it in trusted server-side contexts (e.g. tests,
> internal scripts, migration tooling). Never expose it to end-user requests.

```typescript
import { OrbitClient } from '@orbit-ai/sdk'
import {
  createSqliteStorageAdapter,
  createSqliteOrbitDatabase,
  initializeAllSqliteSchemas,
} from '@orbit-ai/core'

const db = createSqliteOrbitDatabase() // :memory:
await initializeAllSqliteSchemas(db)

const adapter = createSqliteStorageAdapter({ database: db })

const client = new OrbitClient({
  adapter,
  context: { orgId: 'org_test' },
})

// All operations go directly to the adapter — no HTTP, no auth
const contact = await client.contacts.create({ name: 'Test User' })
```

## What's NOT in this release

- CLI (`orbit` command) — planned as `@orbit-ai/cli`
- MCP server tools — planned as `@orbit-ai/mcp`
- Gmail / Google Calendar / Stripe integrations — planned as `@orbit-ai/integrations`
- Real-time subscriptions / webhooks push — post-v1
- Batch mutations — the API types exist but the implementation is not complete

The full list of known alpha gaps is in
[`docs/review/2026-04-08-post-stack-audit.md`](../../docs/review/2026-04-08-post-stack-audit.md).

## License

MIT — see [LICENSE](LICENSE).
