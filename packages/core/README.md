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

```typescript
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  createCoreServices,
  initializeAllSqliteSchemas,
} from '@orbit-ai/core'

// 1. Create an in-memory database (pass { filename: './dev.db' } for a file)
const db = createSqliteOrbitDatabase()
await initializeAllSqliteSchemas(db)

// 2. Create the storage adapter
const adapter = createSqliteStorageAdapter({ database: db })

// 3. Create services and use them
const services = createCoreServices(adapter)
const ctx = { orgId: 'org_demo', scopes: ['*'] as const }

const contact = await services.contacts.create(ctx, {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
})

const page = await services.contacts.list(ctx, { limit: 20 })
console.log(page.data)       // Contact[]
console.log(page.hasMore)    // boolean
console.log(page.nextCursor) // string | null
```

Most consumers will use `@orbit-ai/api` (REST server) or `@orbit-ai/sdk` (client)
rather than importing core directly. Core is the foundation package that both depend on.

## Tenant isolation

Every entity service method requires a tenant context (`orgId`). All queries include an
`orgId` filter at the application layer. For Postgres-family adapters, RLS policies
provide a second enforcement layer.

SQLite has no RLS — application-layer filtering is the only mechanism. Do not use SQLite
in multi-tenant production deployments.

## License

MIT — see [LICENSE](LICENSE).
