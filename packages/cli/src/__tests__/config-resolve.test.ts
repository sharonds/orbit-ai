import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeTmpDir } from './setup.js'
import { CliConfigError, CliValidationError, CliUnsupportedAdapterError } from '../errors.js'

// ---------------------------------------------------------------------------
// Mocks — hoisted before any dynamic imports
// ---------------------------------------------------------------------------

const mockSqliteAdapter = { name: 'sqlite', dialect: 'sqlite' }
const mockPostgresAdapter = { name: 'postgres', dialect: 'postgres' }

vi.mock('@orbit-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orbit-ai/core')>()
  return {
    ...actual,
    // Mock SqliteOrbitDatabase to avoid calling node:sqlite DatabaseSync.exec
    SqliteOrbitDatabase: vi.fn().mockImplementation(() => ({
      transaction: vi.fn(),
      execute: vi.fn(),
      query: vi.fn(),
      client: { exec: vi.fn(), prepare: vi.fn() },
    })),
    createSqliteStorageAdapter: vi.fn(() => mockSqliteAdapter),
    createPostgresStorageAdapter: vi.fn(() => mockPostgresAdapter),
  }
})

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn().mockImplementation((opts: unknown) => ({ _opts: opts })),
}))

// Mock pg Pool to avoid real connections
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation((opts: unknown) => ({ _opts: opts })),
}))

// Mock node:sqlite to be safe
vi.mock('node:sqlite', () => ({
  DatabaseSync: vi.fn().mockImplementation(() => ({
    exec: vi.fn(),
    prepare: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { resolveClient } from '../config/resolve-context.js'
import { readConfigFile, canonicalizePath } from '../config/files.js'
import { createSqliteStorageAdapter, createPostgresStorageAdapter } from '@orbit-ai/core'
import { OrbitClient } from '@orbit-ai/sdk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeConfig(dir: string, subPath: string, data: object): string {
  const fullPath = path.join(dir, subPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, JSON.stringify(data), { mode: 0o600 })
  return fullPath
}

function makeProjectConfig(cwd: string, data: object): void {
  writeConfig(cwd, '.orbit/config.json', data)
}

function makeUserConfig(home: string, data: object): void {
  writeConfig(home, '.config/orbit/config.json', data)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('config resolution — resolveClient', () => {
  let originalArgv: string[]
  let stderrOutput: string

  beforeEach(() => {
    originalArgv = [...process.argv]
    stderrOutput = ''
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput += String(chunk)
      return true
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.argv = originalArgv
    vi.restoreAllMocks()
  })

  // Test 1: --api-key flag overrides ORBIT_API_KEY env var
  it('1: --api-key flag overrides ORBIT_API_KEY env var', () => {
    const cwd = makeTmpDir()
    resolveClient({
      flags: { apiKey: 'flag-key', mode: 'api' },
      env: { ORBIT_API_KEY: 'env-key' },
      cwd,
      overrideHome: cwd,
    })
    expect(OrbitClient).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'flag-key' }))
  })

  // Test 2: ORBIT_API_KEY env var overrides .orbit/config.json value
  it('2: ORBIT_API_KEY env var overrides .orbit/config.json value', () => {
    const cwd = makeTmpDir()
    makeProjectConfig(cwd, { apiKey: 'config-key', mode: 'api' })
    resolveClient({
      flags: { mode: 'api' },
      env: { ORBIT_API_KEY: 'env-key' },
      cwd,
      overrideHome: cwd,
    })
    expect(OrbitClient).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'env-key' }))
  })

  // Test 3: .orbit/config.json (project) overrides ~/.config/orbit/config.json (user)
  it('3: project config overrides user config', () => {
    const cwd = makeTmpDir()
    const home = makeTmpDir()
    makeUserConfig(home, { apiKey: 'user-key', mode: 'api' })
    makeProjectConfig(cwd, { apiKey: 'project-key', mode: 'api' })
    resolveClient({
      flags: {},
      env: {},
      cwd,
      overrideHome: home,
    })
    expect(OrbitClient).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'project-key' }))
  })

  // Test 4: Only user config present → its value is used
  it('4: only user config present → its value is used', () => {
    const cwd = makeTmpDir()
    const home = makeTmpDir()
    makeUserConfig(home, { apiKey: 'user-only-key', mode: 'api' })
    resolveClient({
      flags: {},
      env: {},
      cwd,
      overrideHome: home,
    })
    expect(OrbitClient).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'user-only-key' }))
  })

  // Test 5: Missing apiKey in API mode → CliValidationError
  it('5: missing apiKey in API mode → CliValidationError', () => {
    const cwd = makeTmpDir()
    expect(() =>
      resolveClient({
        flags: { mode: 'api' },
        env: {},
        cwd,
        overrideHome: cwd,
      }),
    ).toThrowError(
      expect.objectContaining({
        name: 'CliValidationError',
        details: expect.objectContaining({ code: 'MISSING_REQUIRED_CONFIG' }),
      }),
    )
  })

  // Test 6: mode: 'direct' with adapter: 'sqlite' → calls createSqliteStorageAdapter
  it('6: direct mode sqlite → calls createSqliteStorageAdapter', () => {
    const cwd = makeTmpDir()
    resolveClient({
      flags: { mode: 'direct', adapter: 'sqlite', orgId: 'org_test123' },
      env: {},
      cwd,
      overrideHome: cwd,
    })
    expect(createSqliteStorageAdapter).toHaveBeenCalled()
  })

  // Test 7: mode: 'direct' with adapter: 'postgres' → calls createPostgresStorageAdapter
  it('7: direct mode postgres → calls createPostgresStorageAdapter', () => {
    const cwd = makeTmpDir()
    resolveClient({
      flags: {
        mode: 'direct',
        adapter: 'postgres',
        orgId: 'org_test123',
        databaseUrl: 'postgres://localhost/testdb',
      },
      env: {},
      cwd,
      overrideHome: cwd,
    })
    expect(createPostgresStorageAdapter).toHaveBeenCalled()
  })

  // Test 8: mode: 'direct' with adapter: 'supabase' → throws CliUnsupportedAdapterError
  it('8: direct mode supabase → throws CliUnsupportedAdapterError', () => {
    const cwd = makeTmpDir()
    expect(() =>
      resolveClient({
        flags: { mode: 'direct', adapter: 'supabase', orgId: 'org_test123' },
        env: {},
        cwd,
        overrideHome: cwd,
      }),
    ).toThrow(CliUnsupportedAdapterError)
  })

  // Test 9: mode: 'direct' with adapter: 'neon' → throws CliUnsupportedAdapterError
  it('9: direct mode neon → throws CliUnsupportedAdapterError', () => {
    const cwd = makeTmpDir()
    expect(() =>
      resolveClient({
        flags: { mode: 'direct', adapter: 'neon', orgId: 'org_test123' },
        env: {},
        cwd,
        overrideHome: cwd,
      }),
    ).toThrow(CliUnsupportedAdapterError)
  })

  // Test 10: Malformed config JSON → CliConfigError with code: 'CONFIG_PARSE_ERROR'
  it('10: malformed config JSON → CliConfigError CONFIG_PARSE_ERROR', () => {
    const cwd = makeTmpDir()
    const cfgDir = path.join(cwd, '.orbit')
    fs.mkdirSync(cfgDir, { recursive: true })
    fs.writeFileSync(path.join(cfgDir, 'config.json'), '{ not valid json', { mode: 0o600 })
    // readConfigFile directly to bypass allowedRoots check in loadConfig
    expect(() =>
      readConfigFile(path.join(cfgDir, 'config.json')),
    ).toThrowError(
      expect.objectContaining({
        name: 'CliConfigError',
        details: expect.objectContaining({ code: 'CONFIG_PARSE_ERROR' }),
      }),
    )
  })

  // Test 11: Missing orgId in direct mode → CliValidationError MISSING_REQUIRED_CONFIG
  it('11: missing orgId in direct mode → CliValidationError MISSING_REQUIRED_CONFIG', () => {
    const cwd = makeTmpDir()
    expect(() =>
      resolveClient({
        flags: { mode: 'direct', adapter: 'sqlite' },
        env: {},
        cwd,
        overrideHome: cwd,
      }),
    ).toThrowError(
      expect.objectContaining({
        details: expect.objectContaining({
          code: 'MISSING_REQUIRED_CONFIG',
          path: 'context.orgId',
        }),
      }),
    )
  })

  // Test 12: SQLite with http:// scheme → CliValidationError (URL scheme allowlist)
  it('12: sqlite with http:// scheme → CliValidationError', () => {
    const cwd = makeTmpDir()
    expect(() =>
      resolveClient({
        flags: {
          mode: 'direct',
          adapter: 'sqlite',
          orgId: 'org_test123',
          databaseUrl: 'http://example.com/db.sqlite',
        },
        env: {},
        cwd,
        overrideHome: cwd,
      }),
    ).toThrow(CliValidationError)
  })

  // Test 13: Config path outside project root → CliConfigError (path canonicalization)
  it('13: config path outside project root → CliConfigError', () => {
    const cwd = makeTmpDir()
    const home = makeTmpDir()
    expect(() =>
      canonicalizePath('/etc/passwd', [cwd, home]),
    ).toThrowError(
      expect.objectContaining({
        name: 'CliConfigError',
        details: expect.objectContaining({ code: 'CONFIG_PATH_OUTSIDE_ALLOWED' }),
      }),
    )
  })

  // Test 14: Direct mode in TTY → warning emitted to stderr
  it('14: direct mode in TTY → warning emitted to stderr listing missing middleware', () => {
    const cwd = makeTmpDir()
    const origIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })

    try {
      resolveClient({
        flags: { mode: 'direct', adapter: 'sqlite', orgId: 'org_test123' },
        env: {},
        cwd,
        overrideHome: cwd,
      })
      expect(stderrOutput).toContain('direct mode')
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: origIsTTY, configurable: true })
    }
  })

  // Test 15: --api-key in argv (two-token form) → stderr warning + argv redaction
  it('15: --api-key in argv → stderr warning + argv redaction', () => {
    const cwd = makeTmpDir()
    process.argv = ['node', 'orbit', '--api-key', 'secret-key-value', '--mode', 'api']
    resolveClient({
      flags: { apiKey: 'secret-key-value', mode: 'api' },
      env: {},
      cwd,
      overrideHome: cwd,
    })
    expect(stderrOutput).toContain('--api-key')
    expect(stderrOutput).toContain('visible in process listings')
    expect(process.argv).not.toContain('secret-key-value')
    expect(process.argv).toContain('[REDACTED]')
  })

  // Test 15b: --api-key=value (single-token form) → stderr warning + argv redaction
  it('15b: --api-key=value in argv → stderr warning + argv redaction', () => {
    const cwd = makeTmpDir()
    process.argv = ['node', 'orbit', '--api-key=secret-key-value', '--mode', 'api']
    resolveClient({
      flags: { apiKey: 'secret-key-value', mode: 'api' },
      env: {},
      cwd,
      overrideHome: cwd,
    })
    expect(stderrOutput).toContain('--api-key')
    expect(stderrOutput).toContain('visible in process listings')
    expect(process.argv).not.toContain('--api-key=secret-key-value')
    expect(process.argv).toContain('--api-key=[REDACTED]')
  })
})
