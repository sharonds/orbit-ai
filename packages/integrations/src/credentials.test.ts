import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
  type OrbitAuthContext,
  type OrbitDatabase,
  type StorageAdapter,
} from '@orbit-ai/core'
import { InMemoryCredentialStore, TableBackedCredentialStore } from './credentials.js'
import type { StoredCredentials } from './credentials.js'
import { NoopEncryptionProvider } from './encryption.js'
import type { EncryptionProvider } from './encryption.js'
import { integrationSchemaExtension } from './schema-extension.js'

function isPostgresOnlyStatement(stmt: string): boolean {
  const s = stmt.trim().toUpperCase()
  return (
    s.includes('ENABLE ROW LEVEL SECURITY') ||
    s.startsWith('CREATE POLICY') ||
    s.startsWith('DROP POLICY')
  )
}

async function setupSqliteAdapter(): Promise<StorageAdapter> {
  const database = createSqliteOrbitDatabase()
  const adapter = createSqliteStorageAdapter({ database })
  for (const migration of integrationSchemaExtension.migrations) {
    for (const stmt of migration.up) {
      if (isPostgresOnlyStatement(stmt)) continue
      // SQLite doesn't recognize ::jsonb cast syntax — strip it for the test harness.
      const sanitized = stmt.replace(/::jsonb/g, '')
      await database.execute(sql.raw(sanitized))
    }
  }
  return adapter
}

function createTenantContextRecordingAdapter(queryRows: Record<string, unknown>[] = []): {
  adapter: StorageAdapter
  tenantDb: OrbitDatabase
  rawDb: OrbitDatabase
  contexts: OrbitAuthContext[]
} {
  const contexts: OrbitAuthContext[] = []
  const rawDb: OrbitDatabase = {
    transaction: vi.fn(async (fn) => fn(rawDb)),
    query: vi.fn(async () => {
      throw new Error('unsafe raw query used')
    }),
    execute: vi.fn(async () => {
      throw new Error('unsafe raw execute used')
    }),
  }
  const tenantDb: OrbitDatabase = {
    transaction: vi.fn(async (fn) => fn(tenantDb)),
    query: vi.fn(async () => queryRows),
    execute: vi.fn(async () => undefined),
  }
  const adapter: StorageAdapter = {
    name: 'sqlite',
    dialect: 'sqlite',
    supportsRls: false,
    supportsBranching: false,
    supportsJsonbIndexes: false,
    authorityModel: {
      runtimeAuthority: 'request-scoped',
      migrationAuthority: 'elevated',
      requestPathMayUseElevatedCredentials: false,
      notes: [],
    },
    unsafeRawDatabase: rawDb,
    users: {
      async resolveByExternalAuthId() {
        return null
      },
      async upsertFromAuth() {
        return 'user_test'
      },
    },
    async connect() {},
    async disconnect() {},
    async migrate() {},
    async runWithMigrationAuthority(fn) {
      return fn({} as never)
    },
    async lookupApiKeyForAuth() {
      return null
    },
    async transaction(fn) {
      return fn(tenantDb)
    },
    beginTransaction() {
      return {
        async run(ctx, fn) {
          contexts.push(ctx)
          return fn(tenantDb)
        },
      }
    },
    async execute() {
      return undefined
    },
    async query() {
      return []
    },
    async withTenantContext(ctx, fn) {
      contexts.push(ctx)
      return fn(tenantDb)
    },
    async getSchemaSnapshot() {
      return { customFields: [], tables: [] }
    },
  }

  return { adapter, tenantDb, rawDb, contexts }
}

class ThrowingEncryptionProvider implements EncryptionProvider {
  async encrypt(plaintext: string): Promise<string> {
    throw new Error(`encryption failed for ${plaintext}`)
  }

  async decrypt(ciphertext: string): Promise<string> {
    throw new Error(`decryption failed for ${ciphertext}`)
  }
}

const makeCredentials = (overrides: Partial<StoredCredentials> = {}): StoredCredentials => ({
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
  expiresAt: Date.now() + 3600_000,
  scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/calendar'],
  providerAccountId: 'user@example.com',
  ...overrides,
})

const ORG_1 = 'org_01ABCDEF0123456789ABCDEF01'
const ORG_2 = 'org_01ABCDEF0123456789ABCDEF02'

describe('InMemoryCredentialStore', () => {
  let store: InMemoryCredentialStore

  beforeEach(() => {
    store = new InMemoryCredentialStore()
  })

  it('returns null when no credentials exist for org+provider+userId', async () => {
    const result = await store.getCredentials('org-1', 'gmail', 'user-1')
    expect(result).toBeNull()
  })

  it('saves and retrieves credentials', async () => {
    const creds = makeCredentials()
    await store.saveCredentials('org-1', 'gmail', 'user-1', creds)
    const result = await store.getCredentials('org-1', 'gmail', 'user-1')
    expect(result).toEqual(creds)
  })

  it('returns null after deleting credentials', async () => {
    const creds = makeCredentials()
    await store.saveCredentials('org-1', 'gmail', 'user-1', creds)
    await store.deleteCredentials('org-1', 'gmail', 'user-1')
    const result = await store.getCredentials('org-1', 'gmail', 'user-1')
    expect(result).toBeNull()
  })

  it('deleting without userId uses __default__ slot', async () => {
    const creds = makeCredentials()
    await store.saveCredentials('org-1', 'gmail', '__default__', creds)
    await store.deleteCredentials('org-1', 'gmail')
    expect(await store.getCredentials('org-1', 'gmail')).toBeNull()
  })

  it('scopes by userId — different userId returns different entry', async () => {
    const creds1 = makeCredentials({ accessToken: 'token-for-user-1' })
    const creds2 = makeCredentials({ accessToken: 'token-for-user-2' })
    await store.saveCredentials('org-1', 'gmail', 'user-1', creds1)
    await store.saveCredentials('org-1', 'gmail', 'user-2', creds2)

    const r1 = await store.getCredentials('org-1', 'gmail', 'user-1')
    const r2 = await store.getCredentials('org-1', 'gmail', 'user-2')
    expect(r1?.accessToken).toBe('token-for-user-1')
    expect(r2?.accessToken).toBe('token-for-user-2')
  })

  it('scopes by organizationId — same provider+userId but different org returns different entries', async () => {
    const credsA = makeCredentials({ accessToken: 'token-org-a' })
    const credsB = makeCredentials({ accessToken: 'token-org-b' })
    await store.saveCredentials('org-a', 'gmail', 'user-1', credsA)
    await store.saveCredentials('org-b', 'gmail', 'user-1', credsB)

    const rA = await store.getCredentials('org-a', 'gmail', 'user-1')
    const rB = await store.getCredentials('org-b', 'gmail', 'user-1')
    expect(rA?.accessToken).toBe('token-org-a')
    expect(rB?.accessToken).toBe('token-org-b')
  })

  it('scopes by provider — gmail and google-calendar are separate namespaces', async () => {
    const gmailCreds = makeCredentials({ accessToken: 'gmail-token' })
    const calCreds = makeCredentials({ accessToken: 'cal-token' })
    await store.saveCredentials('org-1', 'gmail', 'user-1', gmailCreds)
    await store.saveCredentials('org-1', 'google-calendar', 'user-1', calCreds)

    expect((await store.getCredentials('org-1', 'gmail', 'user-1'))?.accessToken).toBe('gmail-token')
    expect((await store.getCredentials('org-1', 'google-calendar', 'user-1'))?.accessToken).toBe('cal-token')
  })

  it('overwrites existing credentials on save', async () => {
    const original = makeCredentials({ accessToken: 'original-token' })
    const updated = makeCredentials({ accessToken: 'updated-token' })
    await store.saveCredentials('org-1', 'gmail', 'user-1', original)
    await store.saveCredentials('org-1', 'gmail', 'user-1', updated)

    const result = await store.getCredentials('org-1', 'gmail', 'user-1')
    expect(result?.accessToken).toBe('updated-token')
  })

  it('deleting non-existent entry does not throw', async () => {
    await expect(store.deleteCredentials('org-99', 'stripe', 'user-99')).resolves.toBeUndefined()
  })
})

describe('TableBackedCredentialStore', () => {
  let adapter: StorageAdapter
  let store: TableBackedCredentialStore

  beforeEach(async () => {
    adapter = await setupSqliteAdapter()
    store = new TableBackedCredentialStore(adapter, new NoopEncryptionProvider())
  })

  it('returns null when no credentials exist', async () => {
    const result = await store.getCredentials(ORG_1, 'gmail', 'user-1')
    expect(result).toBeNull()
  })

  it('round-trips credentials through encryption + decryption', async () => {
    const creds = makeCredentials()
    await store.saveCredentials(ORG_1, 'gmail', 'user-1', creds)
    const result = await store.getCredentials(ORG_1, 'gmail', 'user-1')
    expect(result).not.toBeNull()
    expect(result?.accessToken).toBe(creds.accessToken)
    expect(result?.refreshToken).toBe(creds.refreshToken)
    expect(result?.providerAccountId).toBe(creds.providerAccountId)
    expect(result?.scopes).toEqual(creds.scopes)
    expect(result?.expiresAt).toBe(creds.expiresAt)
  })

  it('UPSERTs on duplicate (org, provider, user) — second save wins', async () => {
    const original = makeCredentials({ accessToken: 'first-access', refreshToken: 'first-refresh' })
    const updated = makeCredentials({ accessToken: 'second-access', refreshToken: 'second-refresh' })
    await store.saveCredentials(ORG_1, 'gmail', 'user-1', original)
    await expect(store.saveCredentials(ORG_1, 'gmail', 'user-1', updated)).resolves.toBeUndefined()
    const result = await store.getCredentials(ORG_1, 'gmail', 'user-1')
    expect(result?.accessToken).toBe('second-access')
    expect(result?.refreshToken).toBe('second-refresh')
  })

  it('delete removes the row', async () => {
    await store.saveCredentials(ORG_1, 'gmail', 'user-1', makeCredentials())
    await store.deleteCredentials(ORG_1, 'gmail', 'user-1')
    expect(await store.getCredentials(ORG_1, 'gmail', 'user-1')).toBeNull()
  })

  it('isolates tenants — org A credentials are invisible to org B', async () => {
    await store.saveCredentials(ORG_1, 'gmail', 'user-1', makeCredentials({ accessToken: 'a-token' }))
    expect(await store.getCredentials(ORG_2, 'gmail', 'user-1')).toBeNull()
    expect((await store.getCredentials(ORG_1, 'gmail', 'user-1'))?.accessToken).toBe('a-token')
  })

  it('handles credentials without optional fields', async () => {
    const minimal: StoredCredentials = { accessToken: 'a', refreshToken: 'r' }
    await store.saveCredentials(ORG_1, 'stripe', 'user-1', minimal)
    const result = await store.getCredentials(ORG_1, 'stripe', 'user-1')
    expect(result?.accessToken).toBe('a')
    expect(result?.refreshToken).toBe('r')
    expect(result?.scopes).toBeUndefined()
    expect(result?.expiresAt).toBeUndefined()
    expect(result?.providerAccountId).toBeUndefined()
  })

  it('runs get, save, and delete inside tenant context using the callback database handle', async () => {
    const { adapter, contexts, rawDb, tenantDb } = createTenantContextRecordingAdapter()
    const recordedStore = new TableBackedCredentialStore(adapter, new NoopEncryptionProvider())

    await recordedStore.getCredentials(ORG_1, 'gmail', 'user-1')
    await recordedStore.saveCredentials(ORG_1, 'gmail', 'user-1', makeCredentials())
    await recordedStore.deleteCredentials(ORG_1, 'gmail', 'user-1')

    expect(contexts).toEqual([
      { orgId: ORG_1, userId: 'user-1' },
      { orgId: ORG_1, userId: 'user-1' },
      { orgId: ORG_1, userId: 'user-1' },
    ])
    expect(tenantDb.query).toHaveBeenCalledTimes(1)
    expect(tenantDb.execute).toHaveBeenCalledTimes(2)
    expect(rawDb.query).not.toHaveBeenCalled()
    expect(rawDb.execute).not.toHaveBeenCalled()
  })

  it('does not log plaintext secrets when credential encryption fails', async () => {
    const { adapter } = createTenantContextRecordingAdapter()
    const recordedStore = new TableBackedCredentialStore(adapter, new ThrowingEncryptionProvider())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const credentials = makeCredentials({
      accessToken: 'plaintext-access-secret',
      refreshToken: 'plaintext-refresh-secret',
    })

    try {
      await expect(recordedStore.saveCredentials(ORG_1, 'gmail', 'user-1', credentials)).rejects.toThrow(
        'plaintext-access-secret',
      )

      expect(consoleError).not.toHaveBeenCalled()
      expect(
        consoleError.mock.calls
          .flat()
          .some((part) =>
            String(part).includes('plaintext-access-secret') ||
            String(part).includes('plaintext-refresh-secret'),
          ),
      ).toBe(false)
    } finally {
      consoleError.mockRestore()
    }
  })
})
