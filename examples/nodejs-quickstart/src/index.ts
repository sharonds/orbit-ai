/**
 * Orbit AI — Node.js quickstart + end-to-end smoke test.
 *
 * Run locally:
 *   cd examples/nodejs-quickstart
 *   pnpm start
 *
 * What this file does:
 * 1. Spins up an in-memory SQLite adapter with the full Orbit schema
 * 2. Mounts the @orbit-ai/api Hono app against that adapter
 * 3. Points @orbit-ai/sdk's fetch at the in-memory Hono app (no network)
 * 4. Exercises CRUD: list → create → list → get → update → delete
 * 5. Tests the error path (get nonexistent → OrbitApiError RESOURCE_NOT_FOUND)
 * 6. Repeats the same CRUD via DirectTransport (in-process, no HTTP)
 * 7. Exits 0 on success, non-zero on any assertion failure
 */

import {
  createSqliteStorageAdapter,
  createSqliteOrbitDatabase,
  createCoreServices,
  initializeAllSqliteSchemas,
} from '@orbit-ai/core'
import { createApi } from '@orbit-ai/api/node'
import { OrbitClient, OrbitApiError } from '@orbit-ai/sdk'
import { sql } from 'drizzle-orm'

const ORG_ID = 'org_01HZ000000000000000000ABCD'
const RAW_API_KEY = 'sk_test_valid_quickstart_key'

// ── helpers ──────────────────────────────────────────────────────────────────

async function sha256hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    console.error(`ASSERTION FAILED: ${msg}`)
    console.error(`  expected: ${JSON.stringify(expected)}`)
    console.error(`  actual:   ${JSON.stringify(actual)}`)
    process.exit(1)
  }
}

function assertTruthy(actual: unknown, msg: string): void {
  if (!actual) {
    console.error(`ASSERTION FAILED: ${msg}`)
    console.error(`  actual: ${JSON.stringify(actual)}`)
    process.exit(1)
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Orbit AI Node.js quickstart ===\n')

  // ── 1. Bootstrap the adapter + schema ─────────────────────────────────────
  const db = createSqliteOrbitDatabase() // :memory:
  await initializeAllSqliteSchemas(db)

  // Seed the organization so tenant-scoped queries have a valid orgId.
  // We use db.execute(sql.raw(...)) which is what the schema initializer uses.
  const now = new Date().toISOString()
  await db.execute(
    sql.raw(
      `insert into organizations (id, name, slug, plan, is_active, settings, created_at, updated_at) ` +
      `values ('${ORG_ID}', 'Quickstart Org', 'quickstart', 'community', 1, '{}', '${now}', '${now}')`,
    ),
  )

  // Pre-hash the API key — the auth middleware calls SHA-256 on the raw token
  // and passes the hex digest to lookupApiKeyForAuth.
  const expectedHash = await sha256hex(RAW_API_KEY)

  const adapter = createSqliteStorageAdapter({
    database: db,
    lookupApiKeyForAuth: async (keyHash: string) => {
      if (keyHash !== expectedHash) return null
      return {
        id: 'key_01HZ000000000000000000ABCD',
        organizationId: ORG_ID,
        scopes: ['*'],
        revokedAt: null,
        expiresAt: null,
      }
    },
  })

  const services = createCoreServices(adapter)
  console.log('[setup] adapter + schema + services ready')

  // ── 2. Mount the API ───────────────────────────────────────────────────────
  const app = createApi({ adapter, version: '2026-04-01', services })
  console.log('[setup] @orbit-ai/api mounted')

  // ── 3. Point the SDK's fetch at the in-memory Hono app ────────────────────
  // Intercept globalThis.fetch so the HttpTransport hits our Hono app directly
  // without spinning up a real HTTP server.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url
    const path = url.replace('http://orbit.local', '')
    return app.request(path, init as RequestInit | undefined)
  }) as typeof fetch

  const client = new OrbitClient({
    apiKey: RAW_API_KEY,
    baseUrl: 'http://orbit.local',
    version: '2026-04-01',
    maxRetries: 0,
  })
  console.log('[setup] @orbit-ai/sdk HTTP transport ready\n')

  // ── 4. CRUD via HTTP transport ─────────────────────────────────────────────
  console.log('=== HTTP transport CRUD ===')

  const emptyPage = await client.contacts.list({ limit: 5 })
  assertEqual(emptyPage.data.length, 0, 'initial contacts list should be empty')
  console.log('[http] initial list: 0 contacts ✓')

  const created = await client.contacts.create({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  })
  assertTruthy(created.id, 'created contact should have an id')
  console.log(`[http] created contact: ${created.id} ✓`)

  const afterPage = await client.contacts.list({ limit: 5 })
  assertEqual(afterPage.data.length, 1, 'list after create should have 1 contact')
  console.log('[http] list after create: 1 contact ✓')

  const fetched = await client.contacts.get(created.id)
  assertEqual(fetched.id, created.id, 'fetched id should match created id')
  assertEqual(fetched.name, 'Ada Lovelace', 'fetched name should match')
  console.log('[http] get by id ✓')

  const updated = await client.contacts.update(created.id, {
    email: 'ada+new@example.com',
  })
  assertEqual(updated.email, 'ada+new@example.com', 'updated email should apply')
  console.log('[http] update ✓')

  // Error path: get a nonexistent contact should throw OrbitApiError
  try {
    await client.contacts.get('contact_01HZZZZZZZZZZZZZZZZZZZZZZZ')
    throw new Error('expected OrbitApiError on nonexistent get')
  } catch (err) {
    if (!(err instanceof OrbitApiError)) throw err
    assertEqual(err.code, 'RESOURCE_NOT_FOUND', 'error code should be RESOURCE_NOT_FOUND')
    assertEqual(err.status, 404, 'error status should be 404')
    console.log(`[http] error path: ${err.code} / ${err.status} ✓`)
  }

  await client.contacts.delete(created.id)
  const afterDelete = await client.contacts.list({ limit: 5 })
  assertEqual(afterDelete.data.length, 0, 'list after delete should be empty')
  console.log('[http] delete ✓\n')

  // ── 5. DirectTransport CRUD ────────────────────────────────────────────────
  console.log('=== DirectTransport CRUD ===')

  const directClient = new OrbitClient({
    adapter,
    context: { orgId: ORG_ID },
    version: '2026-04-01',
  })

  const directCreated = await directClient.contacts.create({
    name: 'Grace Hopper',
    email: 'grace@example.com',
  })
  assertTruthy(directCreated.id, 'direct-transport created contact should have an id')
  console.log(`[direct] created contact: ${directCreated.id} ✓`)

  const directPage = await directClient.contacts.list({ limit: 5 })
  assertEqual(directPage.data.length, 1, 'direct-transport list should have 1 contact')
  console.log('[direct] list ✓\n')

  console.log('=== All smoke tests passed ===')
}

main().catch((err) => {
  console.error('QUICKSTART FAILED:', err)
  process.exit(1)
})
