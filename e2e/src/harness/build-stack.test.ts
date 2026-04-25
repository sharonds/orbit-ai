import {
  createPostgresStorageAdapter,
  PostgresOrbitDatabase,
  type StorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '@orbit-ai/demo-seed'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildStack } from './build-stack.js'
import { assertSafePostgresE2eUrl } from './postgres-safety.js'

type ApiKeySnapshot = {
  id: string
  organization_id: string
  key_hash: string
  key_prefix: string
  scopes: string
  revoked_at: string | null
  expires_at: string | null
}

const databaseUrl = process.env.DATABASE_URL
const describePostgres = databaseUrl ? describe : describe.skip
const sharedPrefix = 'sk_test_samepref'
const hashCollisionRawKey = `${sharedPrefix}_hash_collision`
const prefixConflictRawKey = `${sharedPrefix}_prefix_conflict`

let database: PostgresOrbitDatabase | undefined
let adapter: StorageAdapter | undefined

describe('buildStack', () => {
  it('returns a working stack seeded with the acme tenant', async () => {
    const stack = await buildStack({ tenant: 'acme' })
    try {
      expect(stack.acmeOrgId).toMatch(/^org_/)
      expect(stack.rawApiKey).toMatch(/^sk_test_/)
      const contacts = await stack.sdkHttp.contacts.list({ limit: 5 })
      expect(contacts.data.length).toBeGreaterThan(0)
    } finally {
      await stack.teardown()
    }
  }, 120_000)
})

describePostgres('buildStack Postgres API key setup', () => {
  beforeEach(async () => {
    if (!databaseUrl) throw new Error('DATABASE_URL is required for Postgres build-stack tests')
    assertSafePostgresE2eUrl(databaseUrl)
    database = new PostgresOrbitDatabase({ connectionString: databaseUrl })
    adapter = createPostgresStorageAdapter({
      database,
      disconnect: async () => database?.close(),
    })
    await adapter.migrate()
    await cleanupApiKeys()
  })

  afterEach(async () => {
    try {
      await cleanupApiKeys()
    } finally {
      await adapter?.disconnect()
      adapter = undefined
      database = undefined
    }
  })

  it('does not reassign an existing API key hash to the seeded acme tenant', async () => {
    const { betaOrgId } = await seedBothTenants()
    const betaRow = await insertBetaApiKey({
      id: 'key_e2e_collision_hash',
      organizationId: betaOrgId,
      rawApiKey: hashCollisionRawKey,
      keyPrefix: hashCollisionRawKey.slice(0, 16),
    })

    await expect(
      buildStack({ tenant: 'both', adapter: 'postgres', rawApiKey: hashCollisionRawKey }),
    ).rejects.toThrow(/hash collision belongs to a different organization/)

    await expect(selectApiKey(betaRow.id)).resolves.toEqual(betaRow)
  })

  it('does not reassign an existing API key prefix when the hash differs', async () => {
    const { betaOrgId } = await seedBothTenants()
    const betaRow = await insertBetaApiKey({
      id: 'key_e2e_collision_prefix',
      organizationId: betaOrgId,
      rawApiKey: hashCollisionRawKey,
      keyPrefix: prefixConflictRawKey.slice(0, 16),
    })

    await expect(
      buildStack({ tenant: 'both', adapter: 'postgres', rawApiKey: prefixConflictRawKey }),
    ).rejects.toThrow()

    await expect(selectApiKey(betaRow.id)).resolves.toEqual(betaRow)
  })

  it('rejects same-org API key hash collisions for non-harness rows', async () => {
    const { acmeOrgId } = await seedAcmeTenant()
    const existingRow = await insertApiKey({
      id: 'key_e2e_collision_same_org',
      organizationId: acmeOrgId,
      rawApiKey: hashCollisionRawKey,
      keyPrefix: hashCollisionRawKey.slice(0, 16),
      name: 'consumer-owned key',
      scopes: '["contacts:read"]',
    })

    await expect(
      buildStack({ tenant: 'acme', adapter: 'postgres', rawApiKey: hashCollisionRawKey }),
    ).rejects.toThrow(/pre-existing non-harness key/)

    await expect(selectApiKey(existingRow.id)).resolves.toEqual(existingRow)
  })
})

async function seedAcmeTenant(): Promise<{ acmeOrgId: string }> {
  const activeAdapter = adapter
  if (!activeAdapter) throw new Error('Postgres adapter not initialized')
  const seedOptions = { mode: 'reset' as const, allowResetOfExistingOrg: true }
  const acme = await seed(activeAdapter, { profile: TENANT_PROFILES.acme, ...seedOptions })
  return { acmeOrgId: acme.organization.id }
}

async function seedBothTenants(): Promise<{ betaOrgId: string }> {
  const activeAdapter = adapter
  if (!activeAdapter) throw new Error('Postgres adapter not initialized')
  const seedOptions = { mode: 'reset' as const, allowResetOfExistingOrg: true }
  await seed(activeAdapter, { profile: TENANT_PROFILES.acme, ...seedOptions })
  const beta = await seed(activeAdapter, { profile: TENANT_PROFILES.beta, ...seedOptions })
  return { betaOrgId: beta.organization.id }
}

async function insertBetaApiKey(input: {
  readonly id: string
  readonly organizationId: string
  readonly rawApiKey: string
  readonly keyPrefix: string
}): Promise<ApiKeySnapshot> {
  return insertApiKey({
    ...input,
    name: 'beta collision key',
    scopes: '["contacts:read"]',
  })
}

async function insertApiKey(input: {
  readonly id: string
  readonly organizationId: string
  readonly rawApiKey: string
  readonly keyPrefix: string
  readonly name: string
  readonly scopes: string
}): Promise<ApiKeySnapshot> {
  const activeDatabase = database
  if (!activeDatabase) throw new Error('Postgres database not initialized')
  const keyHash = await sha256hex(input.rawApiKey)
  await activeDatabase.execute(sql`
    INSERT INTO api_keys (
      id, organization_id, name, key_hash, key_prefix, scopes, revoked_at, expires_at, created_at, updated_at
    )
    VALUES (
      ${input.id},
      ${input.organizationId},
      ${input.name},
      ${keyHash},
      ${input.keyPrefix},
      ${input.scopes}::jsonb,
      NULL,
      ${'2035-01-01T00:00:00.000Z'}::timestamptz,
      ${'2026-01-01T00:00:00.000Z'}::timestamptz,
      ${'2026-01-01T00:00:00.000Z'}::timestamptz
    )
  `)
  return selectApiKey(input.id)
}

async function selectApiKey(id: string): Promise<ApiKeySnapshot> {
  const activeDatabase = database
  if (!activeDatabase) throw new Error('Postgres database not initialized')
  const rows = await activeDatabase.query<ApiKeySnapshot>(sql`
    SELECT
      id,
      organization_id,
      key_hash,
      key_prefix,
      scopes::text AS scopes,
      revoked_at::text AS revoked_at,
      expires_at::text AS expires_at
    FROM api_keys
    WHERE id = ${id}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) throw new Error(`Missing API key row ${id}`)
  return row
}

async function cleanupApiKeys(): Promise<void> {
  const activeDatabase = database
  if (!activeDatabase) return
  await activeDatabase.execute(sql`
    DELETE FROM api_keys
    WHERE id IN (${'key_e2e_collision_hash'}, ${'key_e2e_collision_prefix'}, ${'key_e2e_collision_same_org'})
      OR key_prefix = ${sharedPrefix}
  `)
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
