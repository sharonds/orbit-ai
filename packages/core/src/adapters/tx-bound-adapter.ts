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
 * The bound adapter short-circuits that path: `withTenantContext` simply
 * invokes the callback with `txDb`, leaving every other adapter capability
 * untouched. The outer `TransactionScope.run()` is responsible for issuing the
 * `set_config` call once at the start of the transaction so the RLS context is
 * already in place.
 *
 * Use via `repository.withDatabase(txDb)` — service code never constructs the
 * bound adapter directly.
 */
export function createTxBoundAdapter(
  base: StorageAdapter,
  txDb: OrbitDatabase,
): StorageAdapter {
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
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function') {
        return value.bind(target)
      }
      return value
    },
  })
}
