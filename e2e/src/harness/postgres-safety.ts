const POSTGRES_TEST_DATABASE_NAMES = new Set(['orbit_e2e', 'orbit_e2e_test', 'orbit_ai_test'])

export function assertSafePostgresE2eUrl(databaseUrl: string): void {
  const url = new URL(databaseUrl)
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
  const databaseName = url.pathname.replace(/^\//, '')

  if (!isLocalhost || !POSTGRES_TEST_DATABASE_NAMES.has(databaseName)) {
    throw new Error(
      `Refusing to run Postgres e2e tests against ${url.hostname}/${databaseName}. ` +
      `Use localhost with one of: ${[...POSTGRES_TEST_DATABASE_NAMES].join(', ')}.`,
    )
  }
}
