import * as path from 'node:path'
import { Pool } from 'pg'
import {
  createSqliteStorageAdapter,
  createPostgresStorageAdapter,
  SqliteOrbitDatabase,
  PostgresOrbitDatabase,
  type StorageAdapter,
} from '@orbit-ai/core'
import { OrbitClient } from '@orbit-ai/sdk'
import { CliValidationError, CliUnsupportedAdapterError } from '../errors.js'
import { loadConfig, applyProfile, type OrbitConfig } from './files.js'
import type { GlobalFlags } from '../types.js'

/**
 * Direct-mode trust boundaries — the following middleware protections are NOT active in direct mode:
 * - API key authentication: no key validation occurs
 * - Rate limiting: no throttling on operations
 * - Scope enforcement: org isolation is the caller's responsibility
 * - Input validation: database URL / path is not validated beyond scheme and prefix checks
 *
 * Direct mode is trusted-caller-only. Ensure the database is local and the caller is authorized.
 */

const DIRECT_MODE_WARNING =
  'Warning: direct mode bypasses API key authentication, rate limiting, and scope enforcement. Ensure the caller is trusted and the database is local.\n'

export interface ResolveContextOptions {
  flags: GlobalFlags
  env?: NodeJS.ProcessEnv
  cwd?: string
  overrideHome?: string
}

export function resolveAdapter(flags: GlobalFlags, config: OrbitConfig, cwd: string): StorageAdapter {
  const adapterName = flags.adapter ?? config.adapter ?? 'sqlite'
  const dbUrl = flags.databaseUrl ?? config.databaseUrl ?? ''

  if (adapterName === 'sqlite') {
    // Validate URL scheme — block any scheme except file:
    if (dbUrl && /^[a-z][a-z0-9+\-.]*:\/\//i.test(dbUrl) && !/^file:\/\//i.test(dbUrl)) {
      let safeUrl = dbUrl
      try {
        const parsed = new URL(dbUrl)
        safeUrl = `${parsed.protocol}//${parsed.hostname}`
      } catch {
        safeUrl = '[unparseable]'
      }
      throw new CliValidationError(
        `SQLite database URL must be a file path or file: URI, not a remote URL. Scheme+host: '${safeUrl}'`,
        { code: 'INVALID_DATABASE_URL', path: 'databaseUrl' },
      )
    }

    // Resolve actual file path from file: URI or bare path
    let dbPath: string
    if (dbUrl.startsWith('file:')) {
      // Use URL.pathname to correctly handle file:///abs/path and file:/abs/path
      try {
        const parsed = new URL(dbUrl)
        if (parsed.hostname && parsed.hostname !== 'localhost') {
          throw new CliValidationError(
            `SQLite file: URI must not specify a remote host. Got hostname: '${parsed.hostname}'`,
            { code: 'INVALID_DATABASE_URL', path: 'databaseUrl' },
          )
        }
        dbPath = parsed.pathname
      } catch (err) {
        if (err instanceof CliValidationError) throw err
        throw new CliValidationError(
          `Malformed file: URI for SQLite database: '${dbUrl}'. Use 'file:///absolute/path' or a bare file path.`,
          { code: 'INVALID_DATABASE_URL', path: 'databaseUrl' },
        )
      }
    } else {
      dbPath = dbUrl || path.join(cwd, '.orbit', 'orbit.db')
    }

    const database =
      dbPath === ':memory:'
        ? new SqliteOrbitDatabase()
        : new SqliteOrbitDatabase({ filename: dbPath })
    return createSqliteStorageAdapter({ database })
  }

  if (adapterName === 'postgres') {
    if (!dbUrl || (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://'))) {
      let safeUrl = dbUrl
      try {
        safeUrl = new URL(dbUrl).hostname
      } catch {
        safeUrl = '[unparseable]'
      }
      throw new CliValidationError(
        `Postgres database URL must use postgresql:// or postgres:// scheme. Host: '${safeUrl}'`,
        { code: 'INVALID_DATABASE_URL', adapter: 'postgres' },
      )
    }

    const pool = new Pool({ connectionString: dbUrl })
    const database = new PostgresOrbitDatabase({ pool })
    return createPostgresStorageAdapter({ database })
  }

  if (adapterName === 'supabase' || adapterName === 'neon') {
    throw new CliUnsupportedAdapterError(adapterName)
  }

  throw new CliUnsupportedAdapterError(adapterName)
}

export function resolveClient(options: ResolveContextOptions): OrbitClient {
  const { flags, env = process.env, cwd, overrideHome } = options

  // Warn if --api-key appeared in argv (security: key visible in process list)
  const argvApiKey =
    process.argv.includes('--api-key') || process.argv.some((a) => a.startsWith('--api-key='))
  if (argvApiKey) {
    process.stderr.write(
      'Warning: --api-key is visible in process listings. Prefer ORBIT_API_KEY env var.\n',
    )
    // Redact from argv — handle both --api-key <value> and --api-key=<value>
    for (let i = 0; i < process.argv.length; i++) {
      const arg = process.argv[i] ?? ''
      if (arg === '--api-key' && i + 1 < process.argv.length) {
        // Two-token form: --api-key <value>
        process.argv[i + 1] = '[REDACTED]'
        break
      } else if (arg.startsWith('--api-key=')) {
        // Single-token form: --api-key=<value>
        process.argv[i] = '--api-key=[REDACTED]'
        break
      }
    }
  }

  // Load config from files
  const fileConfig = loadConfig(cwd, overrideHome)

  // Resolve profile: flag > env > config default
  const profileName = flags.profile ?? env['ORBIT_PROFILE'] ?? fileConfig.profile
  const mergedFileConfig = profileName ? applyProfile(fileConfig, profileName) : fileConfig

  // Resolve effective config: flags > env > project/user config file
  // Use Object.assign pattern to avoid assigning `undefined` to optional keys
  // (required by exactOptionalPropertyTypes)
  const resolvedConfig: OrbitConfig = {}
  const mode = flags.mode ?? mergedFileConfig.mode ?? 'api'
  resolvedConfig.mode = mode
  const apiKeyFromEnvName =
    mergedFileConfig.apiKeyEnv ? env[mergedFileConfig.apiKeyEnv] : undefined
  // Priority: CLI flag > ORBIT_API_KEY env > apiKeyEnv-indirected env > literal key in config file
  // apiKeyEnv lets the config file name a custom env var (e.g. MY_APP_KEY) for environments
  // where ORBIT_API_KEY is not the standard name.
  const apiKey =
    flags.apiKey ?? env['ORBIT_API_KEY'] ?? apiKeyFromEnvName ?? mergedFileConfig.apiKey
  if (apiKey !== undefined) resolvedConfig.apiKey = apiKey
  const baseUrl = flags.baseUrl ?? env['ORBIT_BASE_URL'] ?? mergedFileConfig.baseUrl
  if (baseUrl !== undefined) resolvedConfig.baseUrl = baseUrl
  const orgId = flags.orgId ?? env['ORBIT_ORG_ID'] ?? mergedFileConfig.orgId
  if (orgId !== undefined) resolvedConfig.orgId = orgId
  const userId = flags.userId ?? env['ORBIT_USER_ID'] ?? mergedFileConfig.userId
  if (userId !== undefined) resolvedConfig.userId = userId
  const adapter = flags.adapter ?? env['ORBIT_ADAPTER'] ?? mergedFileConfig.adapter
  if (adapter !== undefined) resolvedConfig.adapter = adapter
  const databaseUrl = flags.databaseUrl ?? env['DATABASE_URL'] ?? mergedFileConfig.databaseUrl
  if (databaseUrl !== undefined) resolvedConfig.databaseUrl = databaseUrl

  if (mode === 'direct') {
    // Warn unless quiet (emit in all contexts including CI/piped)
    if (!flags.quiet) {
      process.stderr.write(DIRECT_MODE_WARNING)
    }

    const resolvedOrgId = resolvedConfig.orgId
    if (!resolvedOrgId) {
      throw new CliValidationError(
        'orgId is required in direct mode. Set --org-id or ORBIT_ORG_ID.',
        { code: 'MISSING_REQUIRED_CONFIG', path: 'context.orgId' },
      )
    }

    const resolvedAdapter = resolveAdapter(flags, resolvedConfig, cwd ?? process.cwd())

    return new OrbitClient({
      adapter: resolvedAdapter,
      context: {
        orgId: resolvedOrgId,
        ...(resolvedConfig.userId ? { userId: resolvedConfig.userId } : {}),
      },
    })
  }

  // API mode
  const resolvedApiKey = resolvedConfig.apiKey
  if (!resolvedApiKey) {
    throw new CliValidationError(
      'apiKey is required in API mode. Set --api-key or ORBIT_API_KEY.',
      { code: 'MISSING_REQUIRED_CONFIG', path: 'apiKey' },
    )
  }

  const clientOpts: import('@orbit-ai/sdk').OrbitClientOptions = { apiKey: resolvedApiKey }
  if (baseUrl !== undefined) clientOpts.baseUrl = baseUrl
  if (resolvedConfig.orgId !== undefined) {
    const ctxOrgId = resolvedConfig.orgId
    clientOpts.context = { orgId: ctxOrgId }
    if (resolvedConfig.userId !== undefined) {
      clientOpts.context.userId = resolvedConfig.userId
    }
  }
  return new OrbitClient(clientOpts)
}
