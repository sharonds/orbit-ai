import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  PostgresOrbitDatabase,
  createPostgresStorageAdapter,
  type StorageAdapter,
  type ApiKeyAuthLookup,
} from '@orbit-ai/core'
import { createApi } from '@orbit-ai/api/node'
import { OrbitClient } from '@orbit-ai/sdk'
import { seed, TENANT_PROFILES } from '@orbit-ai/demo-seed'
import { sql } from 'drizzle-orm'
import { assertSafePostgresE2eUrl } from './postgres-safety.js'

export interface StackOptions {
  readonly tenant: 'acme' | 'beta' | 'both'
  readonly adapter?: 'sqlite' | 'postgres'
  readonly rawApiKey?: string
}

export interface Stack {
  readonly adapter: StorageAdapter
  readonly api: ReturnType<typeof createApi>
  readonly sdkHttp: OrbitClient
  readonly sdkDirect: OrbitClient
  readonly acmeOrgId: string
  readonly betaOrgId: string | undefined
  readonly rawApiKey: string
  readonly teardown: () => Promise<void>
}

function createRawApiKey(): string {
  return `sk_test_e2e_${crypto.randomUUID().replace(/-/g, '')}`
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function buildFetchInterceptor(api: ReturnType<typeof createApi>, previousFetch: typeof fetch): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url
    if (url.startsWith('http://test.local')) {
      const path = url.replace('http://test.local', '')
      return api.fetch(new Request(`http://test.local${path}`, init))
    }
    return previousFetch(input, init)
  }) as typeof fetch
}

async function insertPostgresE2eApiKey(
  database: PostgresOrbitDatabase,
  input: {
    readonly organizationId: string
    readonly rawApiKey: string
  },
): Promise<{ id: string; keyHash: string; keyPrefix: string }> {
  const keyHash = await sha256hex(input.rawApiKey)
  const keyId = `key_e2e_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
  const keyPrefix = input.rawApiKey.slice(0, 16)
  const now = new Date().toISOString()

  await database.execute(sql`
    INSERT INTO api_keys (id, organization_id, name, key_hash, key_prefix, scopes, created_at, updated_at)
    VALUES (${keyId}, ${input.organizationId}, ${'e2e-test-key'}, ${keyHash}, ${keyPrefix}, ${'["*"]'}::jsonb, ${now}::timestamptz, ${now}::timestamptz)
    ON CONFLICT (key_hash) DO NOTHING
  `)

  const rows = await database.query<{ id: string; organization_id: string }>(
    sql`SELECT id, organization_id FROM api_keys WHERE key_hash = ${keyHash} LIMIT 1`,
  )
  const row = rows[0]
  if (!row) {
    throw new Error('Postgres e2e API key insert did not create or find a key row')
  }
  if (row.organization_id !== input.organizationId) {
    throw new Error('Postgres e2e API key hash collision belongs to a different organization')
  }

  return { id: row.id, keyHash, keyPrefix }
}

export async function buildStack(opts: StackOptions): Promise<Stack> {
  const adapterType = opts.adapter ?? 'sqlite'
  const rawApiKey = opts.rawApiKey ?? createRawApiKey()

  if (adapterType === 'postgres') {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required when adapter is postgres')
    assertSafePostgresE2eUrl(databaseUrl)

    const database = new PostgresOrbitDatabase({ connectionString: databaseUrl })
    const adapter = createPostgresStorageAdapter({
      database,
      disconnect: async () => database.close(),
    })

    let restoreFetch: (() => void) | undefined
    try {
      await adapter.migrate()

      // Postgres CI runs multiple journey files against the same safe local test
      // database, so each stack build resets the deterministic demo tenants.
      const postgresSeedOptions = { mode: 'reset' as const, allowResetOfExistingOrg: true }
      const acme = await seed(adapter, { profile: TENANT_PROFILES.acme, ...postgresSeedOptions })
      const beta =
        opts.tenant === 'both' || opts.tenant === 'beta'
          ? await seed(adapter, { profile: TENANT_PROFILES.beta, ...postgresSeedOptions })
          : undefined

      const apiKey = await insertPostgresE2eApiKey(database, {
        organizationId: acme.organization.id,
        rawApiKey,
      })

      const api = createApi({ adapter, version: '2026-04-01' })
      const previousFetch = globalThis.fetch
      restoreFetch = () => {
        globalThis.fetch = previousFetch
      }
      globalThis.fetch = buildFetchInterceptor(api, previousFetch)

      const sdkHttp = new OrbitClient({
        baseUrl: 'http://test.local',
        apiKey: rawApiKey,
        version: '2026-04-01',
        maxRetries: 0,
      })
      const sdkDirect = new OrbitClient({
        adapter,
        context: { orgId: acme.organization.id },
      })

      return {
        adapter,
        api,
        sdkHttp,
        sdkDirect,
        acmeOrgId: acme.organization.id,
        betaOrgId: beta?.organization.id,
        rawApiKey,
        async teardown() {
          restoreFetch?.()
          try {
            await database.execute(sql`DELETE FROM api_keys WHERE id = ${apiKey.id}`)
          } catch (err) {
            console.error('build-stack: API key cleanup failed:', err instanceof Error ? err.message : String(err))
          } finally {
            try {
              await adapter.disconnect()
            } catch (err) {
              console.error('build-stack: adapter.disconnect failed:', err instanceof Error ? err.message : String(err))
            }
          }
        },
      }
    } catch (err) {
      restoreFetch?.()
      try {
        await adapter.disconnect()
      } catch (disconnectErr) {
        console.error(
          'build-stack: adapter.disconnect failed after setup error:',
          disconnectErr instanceof Error ? disconnectErr.message : String(disconnectErr),
        )
      }
      throw err
    }
  }

  // SQLite path (default)
  const database = createSqliteOrbitDatabase()
  let apiKeyHash: string | undefined
  let apiKeyAuth: ApiKeyAuthLookup | null = null

  const adapter = createSqliteStorageAdapter({
    database,
    lookupApiKeyForAuth: async (hash) => (hash === apiKeyHash ? apiKeyAuth : null),
  })
  await adapter.migrate()

  const acme = await seed(adapter, { profile: TENANT_PROFILES.acme })
  const beta =
    opts.tenant === 'both' || opts.tenant === 'beta'
      ? await seed(adapter, { profile: TENANT_PROFILES.beta })
      : undefined

  apiKeyHash = await sha256hex(rawApiKey)
  apiKeyAuth = {
    id: 'key_01e2e0000000000000000001',
    organizationId: acme.organization.id,
    scopes: ['*'],
    revokedAt: null,
    expiresAt: null,
  }

  const api = createApi({ adapter, version: '2026-04-01' })

  const previousFetch = globalThis.fetch
  globalThis.fetch = buildFetchInterceptor(api, previousFetch)

  const sdkHttp = new OrbitClient({
    baseUrl: 'http://test.local',
    apiKey: rawApiKey,
    version: '2026-04-01',
    maxRetries: 0,
  })

  const sdkDirect = new OrbitClient({
    adapter,
    context: { orgId: acme.organization.id },
  })

  return {
    adapter,
    api,
    sdkHttp,
    sdkDirect,
    acmeOrgId: acme.organization.id,
    betaOrgId: beta?.organization.id,
    rawApiKey,
    async teardown() {
      globalThis.fetch = previousFetch
      try {
        await adapter.disconnect()
      } catch (err) {
        console.error('build-stack: adapter.disconnect failed:', err instanceof Error ? err.message : String(err))
      }
    },
  }
}
