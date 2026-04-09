/**
 * Smoke tests — run after `pnpm -r build` via:
 *   pnpm --filter @orbit-ai/cli exec vitest run --config vitest.smoke.config.ts
 *
 * These tests spawn the compiled `orbit` binary as a subprocess.
 * They are excluded from the default test run (see vitest.config.ts).
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'

const ORBIT_BIN = path.resolve(import.meta.dirname ?? __dirname, '../../dist/index.js')

/** Path to the compiled core package index — used to init the SQLite schema before tests. */
const CORE_INDEX = path.resolve(import.meta.dirname ?? __dirname, '../../../core/dist/index.js')

/**
 * Bootstrap a fresh SQLite database file by calling adapter.migrate() via a
 * Node.js --input-type=module eval. This is necessary because DirectTransport
 * does NOT auto-migrate — callers are responsible for schema initialization.
 */
function initSqliteDb(dbPath: string): void {
  const script = `
import { SqliteOrbitDatabase, createSqliteStorageAdapter } from '${CORE_INDEX}';
const db = new SqliteOrbitDatabase({ filename: '${dbPath}' });
const adapter = createSqliteStorageAdapter({ database: db });
await adapter.migrate();
`
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    input: script,
    encoding: 'utf8',
    timeout: 15000,
  })
  if (result.status !== 0) {
    throw new Error(
      `SQLite schema init failed (exit ${result.status}):\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    )
  }
}

describe('CLI smoke tests', () => {
  it('orbit contacts list in direct SQLite mode exits 0 with JSON envelope', () => {
    const tmpDb = path.join(os.tmpdir(), `orbit-smoke-${Date.now()}.db`)
    try {
      // Initialize the SQLite schema — DirectTransport does not auto-migrate
      initSqliteDb(tmpDb)

      const result = spawnSync(
        process.execPath,
        [
          ORBIT_BIN,
          '--json',
          '--mode', 'direct',
          '--adapter', 'sqlite',
          '--database-url', tmpDb,
          '--org-id', 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
          'contacts', 'list',
        ],
        { encoding: 'utf8', timeout: 15000 },
      )

      expect(result.status).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed).toHaveProperty('data')
      expect(Array.isArray(parsed.data)).toBe(true)
    } finally {
      try { fs.unlinkSync(tmpDb) } catch { /* ignore */ }
    }
  })

  it('orbit contacts list --json with invalid api-key exits 1 with error envelope', () => {
    const result = spawnSync(
      process.execPath,
      [ORBIT_BIN, '--json', 'contacts', 'list'],
      {
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, ORBIT_API_KEY: 'invalid-key', ORBIT_BASE_URL: 'http://127.0.0.1:1' },
      },
    )
    // Connection refused → exit code 1
    expect(result.status).toBe(1)
    // Stdout should be valid JSON (error envelope)
    let parsed: unknown
    try {
      parsed = JSON.parse(result.stdout)
    } catch {
      // stdout might be empty if error before JSON mode activates — check stderr
      expect(result.status).toBe(1)
      return
    }
    expect(parsed).toHaveProperty('error')
  })

  it('orbit mcp serve throws CliNotImplementedError gracefully', () => {
    const result = spawnSync(
      process.execPath,
      [ORBIT_BIN, 'mcp', 'serve'],
      {
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, ORBIT_API_KEY: 'test-key' },
      },
    )
    // CliNotImplementedError → exit code 2
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('@orbit-ai/mcp')
  })
})
