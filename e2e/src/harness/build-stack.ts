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

export async function buildStack(opts: StackOptions): Promise<Stack> {
  const adapterType = opts.adapter ?? 'sqlite'
  const rawApiKey = createRawApiKey()

  if (adapterType === 'postgres') {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required when adapter is postgres')
    assertSafePostgresE2eUrl(databaseUrl)

    const database = new PostgresOrbitDatabase({ connectionString: databaseUrl })
    const adapter = createPostgresStorageAdapter({
      database,
      disconnect: async () => database.close(),
    })
    await adapter.migrate()

    // Postgres CI runs multiple journey files against the same safe local test
    // database, so each stack build resets the deterministic demo tenants.
    const postgresSeedOptions = { mode: 'reset' as const, allowResetOfExistingOrg: true }
    const acme = await seed(adapter, { profile: TENANT_PROFILES.acme, ...postgresSeedOptions })
    const beta =
      opts.tenant === 'both' || opts.tenant === 'beta'
        ? await seed(adapter, { profile: TENANT_PROFILES.beta, ...postgresSeedOptions })
        : undefined

    // Insert test API key directly into the database
    const keyHash = await sha256hex(rawApiKey)
    const keyId = `key_e2e_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
    const keyPrefix = rawApiKey.slice(0, 16)
    const now = new Date().toISOString()
    await database.execute(sql`
      INSERT INTO api_keys (id, organization_id, name, key_hash, key_prefix, scopes, created_at, updated_at)
      VALUES (${keyId}, ${acme.organization.id}, ${'e2e-test-key'}, ${keyHash}, ${keyPrefix}, ${'["*"]'}::jsonb, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT (key_prefix) DO UPDATE SET organization_id = excluded.organization_id, key_hash = excluded.key_hash, updated_at = excluded.updated_at
    `)

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
          await database.execute(sql`DELETE FROM api_keys WHERE id = ${keyId}`)
          await adapter.disconnect()
        } catch (err) {
          console.error('build-stack: adapter.disconnect failed:', err instanceof Error ? err.message : String(err))
        }
      },
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
