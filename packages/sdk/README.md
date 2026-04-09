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
console.log(page.data)      // Contact[]
console.log(page.meta)      // { total, limit, nextCursor, ... }

// Iterate all pages automatically
for await (const contact of client.contacts.pages({ limit: 50 }).autoPaginate()) {
  console.log(contact.id, contact.name)
}
```

### 4. Handle errors

```typescript
import { OrbitApiError } from '@orbit-ai/sdk'

try {
  await client.contacts.get('nonexistent-id')
} catch (err) {
  if (err instanceof OrbitApiError) {
    console.error(err.error.code)    // e.g. 'NOT_FOUND'
    console.error(err.error.message) // human-readable
    console.error(err.status)        // HTTP status code (404)
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
import { createSQLiteAdapter } from '@orbit-ai/core'

const adapter = await createSQLiteAdapter({ path: ':memory:' })

const client = new OrbitClient({
  adapter,
  context: { orgId: 'org_test', userId: 'user_test' },
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
