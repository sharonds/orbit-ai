import type {
  OrbitAuthContext,
  OrbitDatabase,
  StorageAdapter,
} from './interface.js'

/**
 * Wrap a `StorageAdapter` so that any call to `withTenantContext` runs the
 * callback against the supplied transaction-scoped database handle instead of
 * opening a fresh transaction.
 *
 * This exists because Orbit's tenant repositories all call
 * `adapter.withTenantContext(ctx, fn)` for every method. On Postgres that
 * helper opens a real transaction and issues `set_config('app.current_org_id',
 * …, true)`. When a service has already opened an outer transaction via
 * `TransactionScope.run()`, the inner repository calls would otherwise spin up
 * nested savepoints and (worse) discard the outer transaction's view because
 * `withTenantContext` reaches back to the original adapter's connection.
 *
 * The bound adapter:
 *
 *   1. Intercepts `withTenantContext` and runs the callback against `txDb`.
 *      The outer `TransactionScope.run()` already issued `set_config` so the
 *      RLS context is in place for the entire transaction.
 *   2. Intercepts `unsafeRawDatabase` and returns the `txDb` handle. This
 *      makes the bound adapter look transaction-scoped even when consumed
 *      defensively.
 *   3. **Hard-throws on every other path that would silently leak out of the
 *      enclosing transaction.** Specifically: `transaction`, `beginTransaction`,
 *      `execute`, `query`, and `runWithMigrationAuthority`. Any of those, if
 *      called against the underlying base adapter from inside `tx.run`, would
 *      either open a fresh top-level transaction on a different connection
 *      (writing data the outer tx cannot roll back), bypass RLS via the
 *      migration database, or read from a snapshot the outer tx will never see.
 *      Failing fast at call time turns a class of silent corruption into a
 *      loud test failure.
 *
 * Use via `repository.withDatabase(txDb)` — service code never constructs the
 * bound adapter directly.
 */
export function createTxBoundAdapter(
  base: StorageAdapter,
  txDb: OrbitDatabase,
): StorageAdapter {
  function refuse(method: string): never {
    throw new Error(
      `[orbit] tx-bound-adapter: \`${method}\` is not available inside a TransactionScope ` +
        'callback. Either call this on the outer adapter (and accept that the work runs ' +
        'outside the enclosing transaction) or use the txDb handle passed to your tx.run() ' +
        'function directly.',
    )
  }

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === 'withTenantContext') {
        return async function withTenantContextBound<T>(
          _ctx: OrbitAuthContext,
          fn: (db: OrbitDatabase) => Promise<T>,
        ): Promise<T> {
          return fn(txDb)
        }
      }
      if (prop === 'unsafeRawDatabase') {
        return txDb
      }
      // Hard-disallowed methods: any of these would leak out of the
      // enclosing transaction. See the doc-block above for details.
      if (prop === 'transaction') {
        return () => refuse('transaction')
      }
      if (prop === 'beginTransaction') {
        return () => refuse('beginTransaction')
      }
      if (prop === 'execute') {
        return () => refuse('execute')
      }
      if (prop === 'query') {
        return () => refuse('query')
      }
      if (prop === 'runWithMigrationAuthority') {
        return () => refuse('runWithMigrationAuthority')
      }
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function') {
        return value.bind(target)
      }
      return value
    },
  })
}
