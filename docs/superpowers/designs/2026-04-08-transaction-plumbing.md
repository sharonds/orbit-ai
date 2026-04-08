# Design: Transaction + Auth-Context Plumbing for Orbit AI Core Services

**Date:** 2026-04-08
**Status:** Proposal
**Author:** Code Architect Agent

---

## Problem Statement

The current `StorageAdapter.transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>)` method accepts no auth context. Services like `createDealService()` receive only repository dependencies, not an adapter or transaction accessor. This creates two problems:

1. **Uniqueness race conditions** — Services like `sequences.create()` and `tags.create()` perform a read-then-write (check uniqueness, then insert) without holding a transaction lock. Two concurrent requests can both pass the uniqueness check and both insert, violating the unique constraint at the application level before the DB catches it.

2. **Lost tenant context inside transactions** — When a service method needs to span multiple repository calls atomically, there is no mechanism to carry `OrbitAuthContext` into the transaction callback. The current `withTenantContext` on Postgres sets `app.current_org_id` via `set_config`, but services have no way to invoke it.

---

## Decision: Explicit `TransactionScope` Parameter via ServiceDeps

### Choice: Explicit `TransactionScope` over AsyncLocalStorage

After analyzing both approaches, this design uses an **explicit `TransactionScope` object** passed through the service dependency graph, rather than AsyncLocalStorage.

### Tradeoff Analysis

| Criterion | AsyncLocalStorage | Explicit `TransactionScope` |
|---|---|---|
| **Testability** | Poor — tests must wrap everything in `AsyncLocalStorage.run()`. In-memory repos have no natural hook to read from ALS. Mocking requires global state manipulation. | Excellent — `TransactionScope` is a plain object. Tests pass a no-op scope or a recording spy. No global state. |
| **Type safety** | Implicit — the store contents are `any`-typed until you cast. Easy to forget to read from it. | Explicit — the type signature declares `transaction<T>(fn): Promise<T>`. The compiler enforces the contract. |
| **Debuggability** | Hard to trace — stack traces don't show where context was set. DevTools cannot step into async context boundaries. | Easy — every call site that uses the scope is visible in the function signature and call graph. |
| **Cross-runtime portability** | Risky — Node.js `AsyncLocalStorage` works, but Deno/Edge/Bun have varying support levels. Drizzle's Edge runtime may not propagate it. | Universal — plain objects work identically everywhere. |
| **Leakage risk** | Real — if a promise chain escapes the ALS zone, context bleeds into unrelated operations. | None — scope is thread-safe by construction (it is an explicit parameter). |
| **Migration cost** | Low — no signature changes needed. | Medium — service factory signatures change, call sites update. |

**Verdict:** Explicit `TransactionScope` wins on every axis except migration cost, which is a one-time refactoring cost. Orbit AI values correctness, testability, and portability over convenience.

---

## 1. Interface Changes

### 1.1 `packages/core/src/adapters/interface.ts`

Add a `TransactionScope` interface and extend `StorageAdapter`:

```typescript
/**
 * A capability object that lets service code run a callback inside
 * a real database transaction while preserving tenant context.
 *
 * Implementors must:
 *  1. Open a real transaction boundary (BEGIN/COMMIT or equivalent)
 *  2. Ensure all repository calls inside `fn` use the transactional database handle
 *  3. Roll back on any thrown error
 */
export interface TransactionScope {
  /**
   * Execute `fn` inside a transaction. The `txDb` parameter is a
   * transaction-scoped OrbitDatabase — repositories that accept it
   * will run their queries inside the same transaction.
   *
   * The `ctx` parameter carries the auth context into the transaction.
   * Postgres-family adapters must issue `set_config('app.current_org_id', …)`
   * before executing `fn`.
   */
  run<T>(ctx: OrbitAuthContext, fn: (txDb: OrbitDatabase) => Promise<T>): Promise<T>
}

export interface StorageAdapter {
  // ... existing members ...

  /**
   * Return a TransactionScope that service code can use to run
   * atomic operations with preserved tenant context.
   *
   * This is the preferred entry point for services — do NOT call
   * `adapter.transaction()` directly from service code.
   */
  beginTransaction(): TransactionScope
}
```

Remove or deprecate the old bare `transaction()` method on `StorageAdapter`:

```typescript
/**
 * @deprecated Use `adapter.beginTransaction().run(ctx, fn)` instead.
 * This method does not carry auth context and will be removed.
 */
transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>): Promise<T>
```

### 1.2 Why `TransactionScope` as a separate object, not a method on `OrbitDatabase`?

The `OrbitDatabase` interface is the low-level database abstraction. Services should not depend on it directly — they depend on repositories. `TransactionScope` is a **service-layer concern** that bridges the gap between:

- The adapter (which knows how to open transactions and set tenant context)
- The service (which knows which operations must be atomic and what the auth context is)

This keeps `OrbitDatabase` clean and prevents services from reaching for `db.execute()` directly.

---

## 2. Adapter Implementations

### 2.1 SQLite Adapter (`packages/core/src/adapters/sqlite/adapter.ts`)

```typescript
export class SqliteStorageAdapter implements StorageAdapter {
  // ... existing members ...

  beginTransaction(): TransactionScope {
    const self = this
    return {
      async run<T>(ctx: OrbitAuthContext, fn: (txDb: OrbitDatabase) => Promise<T>): Promise<T> {
        // SQLite does not have set_config. Tenant filtering is enforced
        // at the repository layer by appending organization_id to every query.
        // The ctx.orgId is available to the service layer for constructing
        // repository calls. No DB-level setup is needed.
        return self.unsafeRawDatabase.transaction(fn)
      },
    }
  }
}
```

### 2.2 Postgres Adapter (`packages/core/src/adapters/postgres/adapter.ts`)

```typescript
export class PostgresStorageAdapter implements StorageAdapter {
  // ... existing members ...

  beginTransaction(): TransactionScope {
    const self = this
    return {
      async run<T>(ctx: OrbitAuthContext, fn: (txDb: OrbitDatabase) => Promise<T>): Promise<T> {
        assertOrbitId(ctx.orgId, 'organization')

        return self.unsafeRawDatabase.transaction(async (txDb) => {
          // Set RLS context for the duration of the transaction
          await txDb.execute(buildSetTenantContextStatement(ctx.orgId))
          return fn(txDb)
        })
      },
    }
  }
}
```

### 2.3 In-memory repositories (tests)

In-memory repositories do not use a `StorageAdapter` at all. They run against plain arrays. For tests, we provide a **no-op `TransactionScope`** that executes the callback synchronously:

```typescript
// packages/core/src/test-helpers/noop-transaction-scope.ts
import type { TransactionScope, OrbitAuthContext, OrbitDatabase } from '../adapters/interface.js'

export function createNoopTransactionScope(): TransactionScope {
  return {
    async run<T>(_ctx: OrbitAuthContext, fn: (txDb: OrbitDatabase) => Promise<T>): Promise<T> {
      // In-memory: no real transaction. Execute the callback directly.
      // The txDb parameter is a mock — tests that need assertions about
      // transactional behavior should use a real SQLite adapter in the test.
      return fn({} as OrbitDatabase)
    },
  }
}
```

---

## 3. Service Dependency Pattern

### 3.1 New `ServiceDeps` interface

Services that need transactional safety receive a `TransactionScope` in their deps:

```typescript
export interface ServiceDeps {
  /**
   * Transaction scope for atomic operations.
   * Provided by the adapter via createCoreServices.
   */
  tx: TransactionScope
}
```

### 3.2 Which service factories need `TransactionScope`?

The following services perform **read-then-write uniqueness checks** or **multi-step operations that must be atomic**:

| Service | Reason | Needs `tx` |
|---|---|---|
| `createSequenceService` | `assertUniqueSequenceName()` read-then-write on create/update | **Yes** |
| `createTagService` | `assertUniqueTagName()` read-then-write on create/update | **Yes** |
| `createDealService` | `resolveDealGraph()` validates relations, then creates/updates. Stage+pipeline changes must be atomic. | **Yes** |
| `createSequenceEnrollmentService` | Checks for duplicate enrollment, then creates. Must be atomic. | **Yes** |
| `createSequenceStepService` | Validates step ordering within a sequence | **Yes** |
| `createContactService` | May need atomic email uniqueness check (future) | **Yes (forward-compatible)** |
| `createCompanyService` | Simple CRUD — no uniqueness check | No |
| `createPipelineService` | Simple CRUD | No |
| `createStageService` | Validates stage belongs to pipeline (single read) | No |
| `createUserService` | Simple CRUD | No |
| `createActivityService` | Validates relations, but no uniqueness constraint | No |
| `createTaskService` | Validates relations, but no uniqueness constraint | No |
| `createNoteService` | Simple CRUD | No |
| `createProductService` | Simple CRUD | No |
| `createPaymentService` | Validates relations | No |
| `createContractService` | Validates relations | No |
| `createImportService` | Batch import — may benefit later | No (defer) |
| `createWebhookService` | Simple CRUD | No |
| `createOrganizationAdminService` | Bootstrap-scoped | No |
| `createApiKeyAdminService` | Simple CRUD | No |
| `createEntityTagAdminService` | Tag-association — may have race on duplicate tag+entity | **Yes** |

**Summary: 7 services need `tx` now, 1 forward-compatible.**

---

## 4. Worked Example: `sequences.create()` with Transaction

### 4.1 Updated service factory signature

```typescript
// packages/core/src/entities/sequences/service.ts

import type { TransactionScope } from '../../adapters/interface.js'

export function createSequenceService(deps: {
  sequences: SequenceRepository
  sequenceSteps: SequenceStepRepository
  sequenceEnrollments: SequenceEnrollmentRepository
  tx: TransactionScope  // <-- NEW
}): EntityService<SequenceCreateInput, SequenceUpdateInput, SequenceRecord> {
  return {
    async create(ctx, input) {
      const parsed = sequenceCreateInputSchema.parse(input)

      // Wrap the entire create in a transaction to prevent
      // race conditions on the uniqueness check
      return deps.tx.run(ctx, async (txDb) => {
        // Pass txDb to repositories so they execute inside the transaction
        const txSequences = deps.sequences.withDatabase(txDb)

        await assertUniqueSequenceName(ctx, txSequences, parsed.name)

        const now = new Date()
        try {
          return await txSequences.create(
            ctx,
            sequenceRecordSchema.parse({
              id: generateId('sequence'),
              organizationId: ctx.orgId,
              name: parsed.name,
              description: parsed.description ?? null,
              triggerEvent: parsed.triggerEvent ?? null,
              status: parsed.status ?? 'draft',
              customFields: parsed.customFields ?? {},
              createdAt: now,
              updatedAt: now,
            }),
          )
        } catch (error) {
          coerceSequenceConflict(error, parsed.name)
        }
      })
    },

    async update(ctx, id, input) {
      const parsed = sequenceUpdateInputSchema.parse(input)

      return deps.tx.run(ctx, async (txDb) => {
        const txSequences = deps.sequences.withDatabase(txDb)

        const current = assertFound(
          await txSequences.get(ctx, id),
          `Sequence ${id} not found`,
        )
        const nextName = parsed.name ?? current.name
        await assertUniqueSequenceName(ctx, txSequences, nextName, id)

        const patch: Partial<SequenceRecord> = {
          updatedAt: new Date(),
        }

        if (parsed.name !== undefined) patch.name = parsed.name
        if (parsed.description !== undefined) patch.description = parsed.description ?? null
        if (parsed.triggerEvent !== undefined) patch.triggerEvent = parsed.triggerEvent ?? null
        if (parsed.status !== undefined) patch.status = parsed.status
        if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

        try {
          return assertFound(
            await txSequences.update(ctx, id, patch),
            `Sequence ${id} not found`,
          )
        } catch (error) {
          coerceSequenceConflict(error, nextName)
        }
      })
    },

    // get, delete, list, search remain unchanged (no transaction needed)
    async get(ctx, id) {
      return deps.sequences.get(ctx, id)
    },
    async delete(ctx, id) {
      await assertSequenceDeleteAllowed(ctx, deps, id)
      assertDeleted(await deps.sequences.delete(ctx, id), `Sequence ${id} not found`)
    },
    async list(ctx, query) {
      return deps.sequences.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.sequences.search(ctx, query)
    },
  }
}
```

### 4.2 Repository `withDatabase` pattern

Repositories need a way to run against an alternate `OrbitDatabase` handle (the transaction-scoped one). Add this to the repository interface:

```typescript
// packages/core/src/entities/sequences/repository.ts

export interface SequenceRepository {
  create(ctx: OrbitAuthContext, record: SequenceRecord): Promise<SequenceRecord>
  get(ctx: OrbitAuthContext, id: string): Promise<SequenceRecord | null>
  update(ctx: OrbitAuthContext, id: string, patch: Partial<SequenceRecord>): Promise<SequenceRecord | null>
  delete(ctx: OrbitAuthContext, id: string): Promise<boolean>
  list(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceRecord>>
  search(ctx: OrbitAuthContext, query: SearchQuery): Promise<InternalPaginatedResult<SequenceRecord>>

  /**
   * Return a copy of this repository that uses the given database handle.
   * Used to run queries inside a transaction.
   */
  withDatabase(db: OrbitDatabase): SequenceRepository
}
```

For Postgres/SQLite repositories that store the adapter internally:

```typescript
// In createPostgresSequenceRepository:
return {
  // ... existing methods use `adapter` ...

  withDatabase(db: OrbitDatabase): SequenceRepository {
    // Return a new repository instance that uses the provided db handle
    // instead of adapter.unsafeRawDatabase
    return createPostgresSequenceRepository({ adapter: adapter.withDatabase(db) })
  },
}
```

For in-memory repositories (tests):

```typescript
// In createInMemorySequenceRepository:
return {
  // ... existing methods ...

  withDatabase(_db: OrbitDatabase): SequenceRepository {
    // In-memory: no-op, return self
    return this
  },
}
```

### 4.3 Alternative: Adapter `withDatabase`

The adapter itself can expose a `withDatabase(db: OrbitDatabase): StorageAdapter` method that returns a new adapter instance bound to the given database handle. This is cleaner than per-repository `withDatabase` because:

1. Only the adapter knows how to swap its internal database handle
2. Repositories don't need to change — they use the adapter they were given
3. The transaction scope passes the adapted adapter to a callback that reconstructs repositories

However, this creates a chicken-and-egg problem: repositories are created once in `createCoreServices`, and we cannot recreate them inside every transaction. Therefore, the **repository-level `withDatabase`** approach is preferred — it is lightweight and targeted.

---

## 5. Updated `createCoreServices` Factory

```typescript
// packages/core/src/services/index.ts

import type { TransactionScope } from '../adapters/interface.js'

export function createCoreServices(
  adapter: StorageAdapter,
  overrides: CoreRepositoryOverrides = {},
  overridesFactory?: {
    /**
     * Override service factories for testing.
     * Receives the TransactionScope so test implementations can
     * inject a noop or spy scope.
     */
    createService?: (deps: { tx: TransactionScope }) => CoreServices
  },
) {
  const tx = adapter.beginTransaction()

  // ... existing repository resolution ...

  return {
    // ... existing services ...

    sequences: createSequenceService({
      sequences: getSequencesRepository(),
      sequenceSteps: getSequenceStepsRepository(),
      sequenceEnrollments: getSequenceEnrollmentsRepository(),
      tx,  // <-- NEW
    }),

    tags: createTagService({
      tags: getTagsRepository(),
      tx,  // <-- NEW
    }),

    deals: createDealService({
      deals,
      pipelines,
      stages,
      contacts,
      companies,
      tx,  // <-- NEW
    }),

    // ... etc for the other services identified in section 3.2 ...
  }
}
```

---

## 6. Migration Impact — All Call Sites

### 6.1 Services that need signature updates

| Service Factory | File | Deps param change |
|---|---|---|
| `createSequenceService` | `entities/sequences/service.ts` | Add `tx: TransactionScope` |
| `createTagService` | `entities/tags/service.ts` | Add `tx: TransactionScope` |
| `createDealService` | `entities/deals/service.ts` | Add `tx: TransactionScope` |
| `createSequenceEnrollmentService` | `entities/sequence-enrollments/service.ts` | Add `tx: TransactionScope` |
| `createSequenceStepService` | `entities/sequence-steps/service.ts` | Add `tx: TransactionScope` |
| `createContactService` | `entities/contacts/service.ts` | Add `tx: TransactionScope` |
| `createEntityTagAdminService` | `entities/entity-tags/service.ts` | Add `tx: TransactionScope` |

### 6.2 Call sites in `services/index.ts`

All 7 service factory calls inside `createCoreServices` need `tx` added to their deps object. These are at approximately lines 748-937.

### 6.3 Test file call sites

Every test file that directly calls these factories needs the `tx` dependency. The affected test files:

| Test File | Service Called | Change Needed |
|---|---|---|
| `entities/sequences/service.test.ts` | `createSequenceService` | Pass `tx: createNoopTransactionScope()` |
| `entities/tags/service.test.ts` | `createTagService` | Pass `tx: createNoopTransactionScope()` |
| `entities/deals/service.test.ts` | `createDealService` | Pass `tx: createNoopTransactionScope()` |
| `entities/sequence-enrollments/service.test.ts` | `createSequenceEnrollmentService` | Pass `tx: createNoopTransactionScope()` |
| `entities/sequence-steps/service.test.ts` | `createSequenceStepService` | Pass `tx: createNoopTransactionScope()` |
| `entities/contacts/service.test.ts` | `createContactService` | Pass `tx: createNoopTransactionScope()` |
| `entities/entity-tags/service.test.ts` | `createEntityTagAdminService` | Pass `tx: createNoopTransactionScope()` |
| `entities/activities/service.test.ts` | `createDealService`, `createPipelineService`, `createStageService` (indirectly via deps) | No change if deps pass through; update if activities service also gets `tx` |
| `entities/tasks/service.test.ts` | `createDealService` (indirectly) | Same as above |
| `entities/sequence-events/service.test.ts` | `createSequenceService`, `createSequenceStepService`, `createSequenceEnrollmentService` | Pass `tx: createNoopTransactionScope()` |

### 6.4 Cross-package call sites

Search for `createDealService`, `createSequenceService`, `createTagService` in `packages/api`, `packages/mcp`, `packages/cli`, and `examples/`:

| Location | Service | Change |
|---|---|---|
| `packages/api/src/...` (route handlers) | Uses `CoreServices` | No change — `createCoreServices` provides `tx` internally |
| `packages/mcp/src/...` (tool handlers) | Uses `CoreServices` | No change |
| `packages/cli/src/...` | Uses `CoreServices` | No change |
| `examples/nextjs-crm/` | Uses `CoreServices` or `OrbitClient` | No change — the SDK wraps `createCoreServices` |

The only packages that directly call service factories are:
- `packages/core/src/services/index.ts` (the factory itself)
- `packages/core/src/entities/**/*.test.ts` (unit tests)

---

## 7. Testing Transactional Behavior

### 7.1 Principle

Tests must assert transactional behavior **without injecting production hooks**. The approach:

1. **Use a real SQLite adapter in tests** — SQLite supports transactions and runs fast. In-memory arrays cannot prove transaction rollback behavior.

2. **Pass a spy `TransactionScope`** — For unit tests that only care about the service logic, use `createNoopTransactionScope()`. For integration tests that verify atomicity, use a real adapter's `beginTransaction()`.

### 7.2 Example: Race Condition Test

```typescript
// packages/core/src/entities/sequences/service.transaction.test.ts

import { describe, it, expect } from 'vitest'
import { SqliteStorageAdapter, createSqliteStorageAdapter } from '../../adapters/sqlite/adapter.js'
import { Database } from 'better-sqlite3'
import { createPostgresSequenceRepository } from './repository.js'
import { createSequenceService } from './service.js'

describe('sequence uniqueness races', () => {
  it('prevents duplicate sequence names under concurrent creates', async () => {
    const db = new Database(':memory:')
    // ... run migrations on db ...
    const adapter = createSqliteStorageAdapter({ database: { /* wrapped */ } })
    await adapter.connect()

    const tx = adapter.beginTransaction()
    const sequences = createPostgresSequenceRepository(adapter)
    const service = createSequenceService({ sequences, sequenceSteps: /* mock */, sequenceEnrollments: /* mock */, tx })

    const ctx = { orgId: 'org_01ABC', userId: 'user_01ABC' }

    // Start two creates concurrently — both should not succeed
    const [result1, result2] = await Promise.allSettled([
      service.create(ctx, { name: 'duplicate-name' }),
      service.create(ctx, { name: 'duplicate-name' }),
    ])

    expect(result1.status).toBe('fulfilled')
    // One of them must fail with CONFLICT
    const results = [result1, result2]
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
  })
})
```

### 7.3 Example: Rollback on Error

```typescript
it('rolls back the uniqueness check write when create fails', async () => {
  // Use real SQLite adapter
  // Create a sequence with a name that will fail validation after the uniqueness check passes
  // Assert that the sequence was NOT inserted (transaction rolled back)
})
```

---

## 8. Implementation Order

### Phase 1: Foundation (Day 1)
1. Add `TransactionScope` interface to `adapters/interface.ts`
2. Implement `beginTransaction()` on `SqliteStorageAdapter`
3. Implement `beginTransaction()` on `PostgresStorageAdapter`
4. Create `createNoopTransactionScope()` in test helpers
5. Add `withDatabase(db: OrbitDatabase)` to all repository interfaces

### Phase 2: Service Wiring (Day 2-3)
6. Update `createSequenceService` with transaction pattern (worked example)
7. Update `createTagService`
8. Update `createDealService`
9. Update `createSequenceEnrollmentService`
10. Update `createSequenceStepService`
11. Update `createContactService`
12. Update `createEntityTagAdminService`
13. Update `createCoreServices` to pass `tx` to all affected factories

### Phase 3: Test Migration (Day 3-4)
14. Update all `*.test.ts` files that call affected factories
15. Write new `*.transaction.test.ts` files for race condition and rollback assertions

### Phase 4: Cross-Package Verification (Day 4)
16. Verify `packages/api` route handlers still work (no changes needed)
17. Verify `packages/mcp` tool handlers still work (no changes needed)
18. Run full test suite

---

## 9. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `withDatabase` on every repository is tedious | Write a generator/helper that creates the proxied repository from an adapter + original repo |
| SQLite adapter's `transaction()` may nest incorrectly | Drizzle ORM handles nested transactions via savepoints — rely on Drizzle, not raw SQL |
| Forgetting to pass `txDb` to a nested repository call inside a transaction | Type-check: `withDatabase` returns the same repository interface, so the compiler ensures the method signatures match. Review PRs carefully. |
| Tests pass with noop scope but fail with real scope | Require at least one integration test per affected service that uses a real SQLite adapter with `beginTransaction()` |

---

## 10. Future: Batch Operations and Idempotency

Once `TransactionScope` is in place, batch operations (create/update/delete multiple records atomically) become straightforward:

```typescript
async batch(ctx, operations) {
  return this.deps.tx.run(ctx, async (txDb) => {
    const results = []
    for (const op of operations) {
      try {
        // All operations run in the same transaction
        const result = await executeOp(op, txDb)
        results.push({ ok: true, result })
      } catch (error) {
        results.push({ ok: false, error })
        // Transaction will roll back automatically
      }
    }
    return results
  })
}
```

Combined with idempotency keys (already in the schema), this enables safe retry semantics for agent-driven CRM operations.
