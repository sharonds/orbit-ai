import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  type ApiKeyAuthLookup,
} from '@orbit-ai/core'
import { createApi } from '@orbit-ai/api/node'
import { OrbitClient } from '@orbit-ai/sdk'
import { seed, TENANT_PROFILES } from '@orbit-ai/demo-seed'
import type { SqliteStorageAdapter } from '@orbit-ai/core'

export interface StackOptions {
  readonly tenant: 'acme' | 'beta' | 'both'
}

export interface Stack {
  readonly adapter: SqliteStorageAdapter
  readonly api: ReturnType<typeof createApi>
  readonly sdkHttp: OrbitClient
  readonly sdkDirect: OrbitClient
  readonly acmeOrgId: string
  readonly betaOrgId?: string
  readonly rawApiKey: string
  readonly teardown: () => Promise<void>
}

const RAW_API_KEY = 'sk_test_e2e_alpha1_key_do_not_use_in_prod'

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function buildStack(opts: StackOptions): Promise<Stack> {
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

  apiKeyHash = await sha256hex(RAW_API_KEY)
  apiKeyAuth = {
    id: 'key_01e2e0000000000000000001',
    organizationId: acme.organization.id,
    scopes: ['*'],
    revokedAt: null,
    expiresAt: null,
  }

  const api = createApi({ adapter, version: '2026-04-01' })

  const previousFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
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

  const sdkHttp = new OrbitClient({
    baseUrl: 'http://test.local',
    apiKey: RAW_API_KEY,
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
    rawApiKey: RAW_API_KEY,
    async teardown() {
      globalThis.fetch = previousFetch
      await adapter.disconnect()
    },
  }
}
