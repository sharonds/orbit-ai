import { sql } from 'drizzle-orm'
import { newDb } from 'pg-mem'
import { describe, expect, it, vi } from 'vitest'

import type { OrbitDatabase } from '../interface.js'
import { asMigrationDatabase } from '../interface.js'
import { createPostgresStorageAdapter } from './adapter.js'
import { createPostgresOrbitDatabase } from './database.js'
import { initializePostgresWave1Schema } from './schema.js'

const ctxA = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

async function createAdapter() {
  const memory = newDb()
  const { Pool } = memory.adapters.createPg()
  const pool = new Pool({ max: 1 })
  const database = createPostgresOrbitDatabase({ pool })

  await initializePostgresWave1Schema(database)

  const adapter = createPostgresStorageAdapter({
    database,
    getSchemaSnapshot: async () => ({
      customFields: [],
      tables: [
        'organizations',
        'users',
        'organization_memberships',
        'api_keys',
        'companies',
        'contacts',
        'pipelines',
        'stages',
        'deals',
      ],
    }),
  })

  return { adapter, database, pool }
}

describe('PostgresStorageAdapter', () => {
  it('keeps tenant context transaction-local under pooled connection reuse', async () => {
    const state = { currentOrgId: null as string | null }
    const database = {
      async transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>) {
        const previous = state.currentOrgId
        try {
          return await fn(database as unknown as OrbitDatabase)
        } finally {
          state.currentOrgId = previous
        }
      },
      async execute(statement: SQL) {
        const query = render(statement)
        if (query.sql.includes("set_config('app.current_org_id'")) {
          state.currentOrgId = String(query.params[0] ?? null)
        }
        return undefined
      },
      async query<T extends Record<string, unknown>>(statement: SQL) {
        const query = render(statement)
        if (query.sql.includes("current_setting('app.current_org_id'")) {
          return [{ current_org_id: state.currentOrgId }] as T[]
        }
        return [] as T[]
      },
    } satisfies OrbitDatabase
    const adapter = createPostgresStorageAdapter({ database })

    const readCurrentOrg = () =>
      database.query<{ current_org_id: string | null }>(
        sql`select current_setting('app.current_org_id', true) as current_org_id`,
      )

    await adapter.withTenantContext(ctxA, async (db) => {
      const rows = await db.query<{ current_org_id: string | null }>(
        sql`select current_setting('app.current_org_id', true) as current_org_id`,
      )
      expect(rows[0]?.current_org_id).toBe(ctxA.orgId)
    })

    const outside = await readCurrentOrg()
    expect(outside[0]?.current_org_id ?? null).toBeNull()
  })

  it('returns the minimal auth lookup DTO only', async () => {
    const { adapter, pool } = await createAdapter()

    await adapter.transaction(async (db) => {
      await db.execute(sql`insert into organizations (
        id, name, slug, plan, is_active, settings, created_at, updated_at
      ) values (
        ${ctxA.orgId}, ${'Acme'}, ${'acme'}, ${'community'}, ${true}, ${{}}, ${new Date('2026-04-01T10:00:00.000Z')}, ${new Date('2026-04-01T10:00:00.000Z')}
      )`)

      await db.execute(sql`insert into api_keys (
        id, organization_id, name, key_hash, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_by_user_id, created_at, updated_at
      ) values (
        ${'key_01ARYZ6S41YYYYYYYYYYYYYYYY'},
        ${ctxA.orgId},
        ${'Server'},
        ${'hash_live'},
        ${'orbt_live'},
        ${['contacts:read', 'deals:write']},
        ${null},
        ${new Date('2026-06-01T00:00:00.000Z')},
        ${null},
        ${null},
        ${new Date('2026-04-01T10:00:00.000Z')},
        ${new Date('2026-04-01T10:00:00.000Z')}
      )`)
    })

    const result = await adapter.lookupApiKeyForAuth('hash_live')

    expect(result).toEqual({
      id: 'key_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: ctxA.orgId,
      scopes: ['contacts:read', 'deals:write'],
      revokedAt: null,
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    })
    expect(Object.keys(result ?? {}).sort()).toEqual(['expiresAt', 'id', 'organizationId', 'revokedAt', 'scopes'])

    await pool.end()
  })

  it('keeps migration authority separate from runtime database access', async () => {
    const runtimeDb = {
      async transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>) {
        return fn(this)
      },
      async execute() {
        return undefined
      },
      async query() {
        return []
      },
    } satisfies OrbitDatabase
    const migrationDb = {
      async transaction<T>(fn: (tx: OrbitDatabase) => Promise<T>) {
        return fn(this)
      },
      async execute() {
        return undefined
      },
      async query() {
        return []
      },
    } satisfies OrbitDatabase

    const adapter = createPostgresStorageAdapter({
      database: runtimeDb,
      migrationDatabase: asMigrationDatabase(migrationDb),
    })

    const runtimeExecute = vi.spyOn(runtimeDb, 'execute')
    const migrationExecute = vi.spyOn(migrationDb, 'execute')

    await adapter.execute(sql`select 1`)
    await adapter.runWithMigrationAuthority(async (db) => {
      await db.execute(sql`select 2`)
      return null
    })

    expect(runtimeExecute).toHaveBeenCalledTimes(1)
    expect(migrationExecute).toHaveBeenCalledTimes(1)
    expect(adapter.authorityModel.requestPathMayUseElevatedCredentials).toBe(false)
  })
})
