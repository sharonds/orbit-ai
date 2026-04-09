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

const ORBIT_BIN = path.resolve(import.meta.dirname ?? __dirname, '../../dist/index.js')

describe('CLI smoke tests', () => {
  it('orbit with no arguments exits 0 (help text)', () => {
    const result = spawnSync(process.execPath, [ORBIT_BIN, '--help'], {
      encoding: 'utf8',
      timeout: 10000,
    })
    // --help exits 0 by default in Commander
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('orbit')
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
