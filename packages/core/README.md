# @orbit-ai/core

> Schema engine, storage adapters, entity services, tenant isolation, and migration
> primitives for the Orbit AI CRM infrastructure.
>
> This package has no network or HTTP dependencies — it is the foundation that
> `@orbit-ai/api` and `@orbit-ai/sdk` build on top of.

**Status**: `0.1.0-alpha`.

## What this package provides

- **Schema definitions** — Drizzle ORM table definitions for all 12 base CRM entities
  (contacts, companies, deals, pipelines, stages, activities, tasks, notes, products,
  payments, contracts, sequences, tags, and more)
- **Storage adapters** — plug-in adapters for SQLite (`node:sqlite`), Postgres (raw `pg`),
  Supabase, and Neon; share a common `StorageAdapter` interface
- **Entity services** — type-safe CRUD + list services for every entity, with tenant-scoped
  queries and cursor-based pagination
- **Tenant context** — every write and read is scoped to `{ orgId, userId }` at the
  application layer; Postgres-family adapters also ship RLS policies
- **Migration engine** — transaction-wrapped, reversible migrations with a schema snapshot
  registry

## Installation

```bash
pnpm add @orbit-ai/core
# or
npm install @orbit-ai/core
```

Requires **Node.js 22+** (the SQLite adapter uses `node:sqlite`).

## Quick usage

### Local development with SQLite

```typescript
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  ContactService,
} from '@orbit-ai/core'

// 1. Create an in-memory database (pass { filename: './dev.db' } for a file)
const db = createSqliteOrbitDatabase()

// 2. Create the storage adapter
const adapter = createSqliteStorageAdapter({
  connect: () => db.connect(),
  disconnect: () => db.disconnect(),
  migrate: () => db.migrate(),
  getSchemaSnapshot: () => db.getSchemaSnapshot(),
})

await adapter.connect()

// 3. Use an entity service
const ctx = { orgId: 'org_demo', userId: 'user_demo' }
const contacts = new ContactService(adapter, ctx)

const contact = await contacts.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
})

const page = await contacts.list({ limit: 20 })
console.log(page.data) // Contact[]
console.log(page.meta) // { total, limit, nextCursor }
```

### Postgres (production)

```typescript
import { createPostgresOrbitDatabase, createPostgresStorageAdapter } from '@orbit-ai/core'

const db = createPostgresOrbitDatabase({ connectionString: process.env.DATABASE_URL! })
const adapter = createPostgresStorageAdapter({ db })
await adapter.connect()
```

## Tenant isolation

Every entity service method requires a tenant context (`orgId` + `userId`). All
queries include an `orgId` filter at the application layer. For Postgres-family adapters,
RLS policies provide a second enforcement layer.

SQLite has no RLS — application-layer filtering is the only mechanism. Do not use SQLite
in multi-tenant production deployments.

## License

MIT — see [LICENSE](LICENSE).
