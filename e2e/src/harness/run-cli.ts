import { execa } from 'execa'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// e2e/src/harness/ is 3 levels deep from repo root
const CLI_ENTRY = path.resolve(__dirname, '../../../packages/cli/dist/index.js')

export interface CliInvocation {
  readonly args: readonly string[]
  readonly cwd: string
  readonly env?: Record<string, string>
}

export interface CliResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly json?: unknown
}

export async function runCli(invocation: CliInvocation): Promise<CliResult> {
  try {
    const res = await execa('node', [CLI_ENTRY, ...invocation.args], {
      cwd: invocation.cwd,
      env: { ...process.env, ...invocation.env, NODE_ENV: 'test' },
      reject: false,
    })
    let json: unknown
    const trimmed = res.stdout.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        json = JSON.parse(res.stdout)
      } catch (err) {
        console.error('runCli: JSON.parse failed:', err instanceof Error ? err.message : String(err))
      }
    }
    return { exitCode: res.exitCode ?? 0, stdout: res.stdout, stderr: res.stderr, json }
  } catch (err) {
    console.error('runCli: unexpected error:', err instanceof Error ? err.message : String(err))
    const e = err as { exitCode?: number; stdout?: string; stderr?: string }
    return {
      exitCode: e.exitCode ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? String(err),
    }
  }
}
