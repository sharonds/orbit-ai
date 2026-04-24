import { sql } from 'drizzle-orm'
import type { StorageAdapter } from '@orbit-ai/core'
import { isOrbitId } from '@orbit-ai/core'
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
  /** Test/operator escape hatch. Runtime commands default to no schema mutation. */
  applySchema?: boolean
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
  const profileName = opts.flags.profile ?? process.env['ORBIT_PROFILE'] ?? rawConfig.profile
  const config = profileName ? applyProfile(rawConfig, profileName) : rawConfig

  const orgId = nonBlank(opts.flags.orgId) ?? nonBlank(process.env['ORBIT_ORG_ID']) ?? nonBlank(config.orgId)
  if (!orgId) {
    throw new CliValidationError(
      'orgId is required for integrations. Pass --org-id, set ORBIT_ORG_ID, or run `orbit init --org-id <id>` to persist it in .orbit/config.json.',
      { code: 'MISSING_REQUIRED_CONFIG', path: 'context.orgId' },
    )
  }
  if (!isOrbitId(orgId, 'organization')) {
    throw new CliValidationError(
      `orgId must be a valid org ULID (org_...). Got: '${orgId}'`,
      { code: 'INVALID_ORG_ID', path: 'context.orgId' },
    )
  }
  const userId =
    nonBlank(opts.flags.userId) ??
    nonBlank(process.env['ORBIT_USER_ID']) ??
    nonBlank(config.userId) ??
    'cli-user'

  const adapter = resolveAdapter(opts.flags, config, opts.cwd, process.env)

  if (opts.applySchema === true || opts.flags.applyIntegrationsSchema === true) {
    await applyIntegrationsSchemaExtension(adapter)
  }

  const encryption = new AesGcmEncryptionProvider()
  const credentialStore = new TableBackedCredentialStore(adapter, encryption)

  const jsonMode = isJsonMode()

  return {
    organizationId: orgId,
    userId,
    credentialStore,
    isJsonMode: jsonMode,
    print(value: unknown) {
      const safe = sanitizeForPrint(value)
      if (jsonMode) {
        console.log(JSON.stringify(safe))
      } else {
        console.log(typeof safe === 'string' ? safe : JSON.stringify(safe, null, 2))
      }
    },
  }
}

function nonBlank(v: string | undefined | null): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined
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

const SECRET_KEY_PATTERN = /token|secret|key|password/i

function sanitizeForPrint(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => sanitizeForPrint(v))
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(src)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? '***' : sanitizeForPrint(src[key])
    }
    return out
  }
  return value
}
