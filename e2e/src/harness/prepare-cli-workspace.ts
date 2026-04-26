import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  PostgresOrbitDatabase,
  createPostgresStorageAdapter,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '@orbit-ai/demo-seed'
import type { TenantProfile } from '@orbit-ai/demo-seed'
import { sql } from 'drizzle-orm'
import { assertSafePostgresE2eUrl } from './postgres-safety.js'

export interface PreparedWorkspace {
  readonly cwd: string
  readonly orgId: string
  readonly adapter: 'sqlite' | 'postgres'
  readonly databaseUrl: string
  readonly proof: {
    readonly adapter: 'sqlite' | 'postgres'
    readonly source: 'runtime'
    verifiedBy: 'metadata' | 'fresh-adapter-read'
  }
  readonly env: Record<string, string>
  cleanup(): Promise<void>
}

export async function prepareCliWorkspace(opts: {
  tenant: keyof typeof TENANT_PROFILES
  adapter?: 'sqlite' | 'postgres'
}): Promise<PreparedWorkspace> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-cli-'))
  const dbDir = path.join(cwd, '.orbit')
  fs.mkdirSync(dbDir, { recursive: true })
  const profile: TenantProfile = TENANT_PROFILES[opts.tenant]
  const adapterType = opts.adapter ?? ((process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres')

  if (adapterType === 'postgres') {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required when ORBIT_E2E_ADAPTER=postgres')
    assertSafePostgresE2eUrl(databaseUrl)

    const database = new PostgresOrbitDatabase({ connectionString: databaseUrl })
    const adapter = createPostgresStorageAdapter({
      database,
      disconnect: async () => database.close(),
    })
    await adapter.migrate()
    const result = await seed(adapter, { profile, mode: 'reset', allowResetOfExistingOrg: true })
    await database.execute(sql`
      DELETE FROM custom_field_definitions
      WHERE organization_id = ${result.organization.id}
      AND entity_type = 'contacts'
      AND field_name IN ('lifetime_value', 'region')
    `)
    await adapter.disconnect()

    fs.writeFileSync(
      path.join(dbDir, 'config.json'),
      JSON.stringify({ orgId: result.organization.id, userId: 'cli-user' }, null, 2),
      { mode: 0o600 },
    )

    return {
      cwd,
      orgId: result.organization.id,
      adapter: 'postgres',
      databaseUrl,
      proof: { adapter: 'postgres', source: 'runtime', verifiedBy: 'metadata' },
      env: {
        ORBIT_ORG_ID: result.organization.id,
        ORBIT_USER_ID: 'cli-user',
        ORBIT_ADAPTER: 'postgres',
        DATABASE_URL: databaseUrl,
        ...postgresClientEnv(databaseUrl),
      },
      async cleanup() {
        fs.rmSync(cwd, { recursive: true, force: true })
      },
    }
  }

  const dbPath = path.join(dbDir, 'orbit.db')
  const databaseUrl = `file:${dbPath}`

  const database = createSqliteOrbitDatabase({ filename: dbPath })
  const adapter = createSqliteStorageAdapter({ database })
  await adapter.migrate()
  const result = await seed(adapter, { profile })
  await adapter.disconnect()

  fs.writeFileSync(
    path.join(dbDir, 'config.json'),
    JSON.stringify({ orgId: result.organization.id, userId: 'cli-user' }, null, 2),
    { mode: 0o600 },
  )

  const env: Record<string, string> = {
    ORBIT_ORG_ID: result.organization.id,
    ORBIT_USER_ID: 'cli-user',
    ORBIT_ADAPTER: 'sqlite',
    DATABASE_URL: databaseUrl,
  }

  return {
    cwd,
    orgId: result.organization.id,
    adapter: 'sqlite',
    databaseUrl,
    proof: { adapter: 'sqlite', source: 'runtime', verifiedBy: 'metadata' },
    env,
    async cleanup() {
      fs.rmSync(cwd, { recursive: true, force: true })
    },
  }
}

function postgresClientEnv(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl)
  const env: Record<string, string> = {}
  if (!url.username) {
    const user = process.env.PGUSER ?? process.env.USER
    if (user) env.PGUSER = user
  }
  for (const key of ['PGPASSWORD', 'PGSSLMODE'] as const) {
    const value = process.env[key]
    if (value) env[key] = value
  }
  return env
}
