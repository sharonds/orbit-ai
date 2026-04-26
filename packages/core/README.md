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
- **Migration engine** — checksum-bound preview/apply/rollback with a schema
  snapshot registry, ledgered reverse operations, and explicit non-rollbackable
  decisions when reverse data is not available

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

## Schema migrations

Core exposes the alpha schema migration engine used by the API, SDK, and CLI:

- `schema.preview(ctx, { operations })` returns the normalized operations, checksum,
  destructive flag, warnings, adapter/scope binding, and confirmation instructions.
- `schema.apply(ctx, { operations, checksum, confirmation?, idempotencyKey? })`
  validates the checksum against the current adapter, trusted org scope, and
  operations before executing.
- `schema.rollback(ctx, { migrationId, checksum?, confirmation? })` rolls back a
  previously rollbackable migration by replaying stored reverse operations.

The alpha executable operation set is intentionally narrow: `custom_field.add`,
`custom_field.delete`, and `custom_field.rename`. Preview schemas also accept
future semantic operation payloads such as field update/promote and column/index
changes, but apply fails closed for operation types that do not yet have an
executor. Destructive operations require
`confirmation: { destructive: true, checksum, confirmedAt }` with the checksum
from preview; production-like environments additionally require safeguard
evidence in `confirmation.safeguards` before elevated execution.
`custom_field.delete` apply is executable but non-rollbackable unless future
value snapshots exist; `custom_field.rename` is rollbackable.

Migration execution requires an explicit `SchemaMigrationAuthority` when services
are created. Request/runtime adapters expose normal data access; elevated DDL
access is only entered through that authority and only for apply/rollback paths.
Preview and ordinary reads do not enter migration authority.

## License

MIT — see [LICENSE](LICENSE).
