import { sql } from 'drizzle-orm'
import type { StorageAdapter } from '@orbit-ai/core'
import {
  AesGcmEncryptionProvider,
  TableBackedCredentialStore,
  integrationSchemaExtension,
  type CliRuntimeContext,
} from '@orbit-ai/integrations'
import { CliValidationError } from '../errors.js'
import type { GlobalFlags } from '../types.js'
import { loadConfig, applyProfile } from './files.js'
import { resolveAdapter } from './resolve-context.js'
import { isJsonMode } from '../program.js'

export interface ResolveIntegrationsRuntimeOptions {
  flags: GlobalFlags
  cwd: string
}

export async function resolveIntegrationsRuntime(
  opts: ResolveIntegrationsRuntimeOptions,
): Promise<CliRuntimeContext> {
  const rawConfig = loadConfig(opts.cwd)
  if (!rawConfig || Object.keys(rawConfig).length === 0) {
    throw new CliValidationError(
      'No .orbit/config.json found. Run `orbit init` first.',
      { code: 'MISSING_REQUIRED_CONFIG', path: 'config' },
    )
  }
  const config = opts.flags.profile ? applyProfile(rawConfig, opts.flags.profile) : rawConfig

  const orgId = opts.flags.orgId ?? process.env['ORBIT_ORG_ID'] ?? config.orgId
  if (!orgId) {
    throw new CliValidationError(
      'orgId is required for integrations. Pass --org-id, set ORBIT_ORG_ID, or run `orbit init --org-id <id>` to persist it in .orbit/config.json.',
      { code: 'MISSING_REQUIRED_CONFIG', path: 'context.orgId' },
    )
  }
  const userId =
    opts.flags.userId ?? process.env['ORBIT_USER_ID'] ?? config.userId ?? 'cli-user'

  const adapter = resolveAdapter(opts.flags, config, opts.cwd)

  await applyIntegrationsSchemaExtension(adapter)

  const encryption = new AesGcmEncryptionProvider()
  const credentialStore = new TableBackedCredentialStore(adapter, encryption)

  return {
    organizationId: orgId,
    userId,
    credentialStore,
    isJsonMode: isJsonMode(),
    print(value: unknown) {
      if (isJsonMode()) {
        console.log(JSON.stringify(value))
      } else {
        console.log(maskSecrets(value))
      }
    },
  }
}

function isPostgresOnlyStatement(stmt: string): boolean {
  const s = stmt.trim().toUpperCase()
  return (
    s.includes('ENABLE ROW LEVEL SECURITY') ||
    s.startsWith('CREATE POLICY') ||
    s.startsWith('DROP POLICY')
  )
}

export async function applyIntegrationsSchemaExtension(adapter: StorageAdapter): Promise<void> {
  const isSqlite = adapter.dialect === 'sqlite'
  await adapter.runWithMigrationAuthority(async (db) => {
    for (const migration of integrationSchemaExtension.migrations) {
      for (const stmt of migration.up) {
        if (isSqlite && isPostgresOnlyStatement(stmt)) continue
        const sanitized = isSqlite ? stmt.replace(/::jsonb/g, '') : stmt
        try {
          await db.execute(sql.raw(sanitized))
        } catch (err) {
          console.error(
            `[applyIntegrationsSchemaExtension] failed statement in ${migration.id}: ${err instanceof Error ? err.message : String(err)}`,
          )
          throw err
        }
      }
    }
  })
}

function maskSecrets(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value)
  const masked: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const key of Object.keys(masked)) {
    if (/token|secret|key|password/i.test(key)) masked[key] = '***'
  }
  return JSON.stringify(masked, null, 2)
}
