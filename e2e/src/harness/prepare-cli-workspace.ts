import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createSqliteOrbitDatabase, createSqliteStorageAdapter } from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '@orbit-ai/demo-seed'
import type { TenantProfile } from '@orbit-ai/demo-seed'

export interface PreparedWorkspace {
  readonly cwd: string
  readonly orgId: string
  readonly databaseUrl: string
  readonly env: Record<string, string>
  cleanup(): Promise<void>
}

export async function prepareCliWorkspace(opts: {
  tenant: keyof typeof TENANT_PROFILES
}): Promise<PreparedWorkspace> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-cli-'))
  const dbDir = path.join(cwd, '.orbit')
  fs.mkdirSync(dbDir, { recursive: true })
  const dbPath = path.join(dbDir, 'orbit.db')
  const databaseUrl = `file:${dbPath}`

  const database = createSqliteOrbitDatabase({ filename: dbPath })
  const adapter = createSqliteStorageAdapter({ database })
  await adapter.migrate()
  const profile: TenantProfile = TENANT_PROFILES[opts.tenant]
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
    databaseUrl,
    env,
    async cleanup() {
      fs.rmSync(cwd, { recursive: true, force: true })
    },
  }
}
