import type { OrbitAuthContext, OrbitDatabase, TransactionScope } from './interface.js'

/**
 * A `TransactionScope` that does NOT open a real transaction. Intended for
 * unit tests that pair the scope with in-memory repositories — those repos
 * have no notion of a database, so the `txDb` parameter is meaningless.
 *
 * Tests that need to assert real transactional behavior (commit/rollback,
 * race conditions, savepoint nesting) MUST use a real adapter's
 * `beginTransaction()` instead. This helper is for service-logic unit tests
 * only.
 */
export function createNoopTransactionScope(): TransactionScope {
  return {
    async run<T>(_ctx: OrbitAuthContext, fn: (txDb: OrbitDatabase) => Promise<T>): Promise<T> {
      // The in-memory repos never read from txDb, so passing an empty object
      // is safe. Any production repo that received this would crash on the
      // first method call — which is the desired behavior if a misconfigured
      // service somehow received the noop scope at runtime.
      return fn({} as OrbitDatabase)
    },
  }
}
