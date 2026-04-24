import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { run } from '../index.js'

/**
 * The tests in this file exercise `run()` end-to-end and assert on the error paths.
 * `process.exit` is stubbed to throw so we can observe the exit code without
 * terminating the vitest worker. Each test restores all mocks in afterEach.
 *
 * Prompts-cancel path: intentionally not covered here — @clack/prompts requires a
 * real TTY to render and the merge logic is already covered by prompts.test.ts
 * via `mergeOptionsWithAnswers`. Reaching the cancel branch would require stdin
 * injection that's flaky across platforms.
 */

type ExitSpy = ReturnType<typeof vi.spyOn>

function stubExit(): ExitSpy {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code ?? 0}`)
  }) as never)
}

describe('run() error paths', () => {
  const originalCwd = process.cwd()
  const originalIsTTY = process.stdin.isTTY
  let workDir: string

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-run-'))
    process.chdir(workDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    process.stdin.isTTY = originalIsTTY
    fs.rmSync(workDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('exits 1 with a TTY hint when stdin is not a TTY and prompts would be needed', async () => {
    process.stdin.isTTY = false
    const exitSpy = stubExit()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // No --yes, so the run needs to prompt for the template; with no TTY this must bail.
    await expect(run(['my-app'])).rejects.toThrow(/exit:1/)
    expect(exitSpy).toHaveBeenCalledWith(1)
    const messages = errSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(messages).toMatch(/No TTY detected/i)
    expect(messages).toMatch(/--yes/)
  })

  it('exits 1 when the target directory exists and is not empty', async () => {
    const targetDir = path.join(workDir, 'my-app')
    fs.mkdirSync(targetDir)
    fs.writeFileSync(path.join(targetDir, 'existing.txt'), 'hi')

    const exitSpy = stubExit()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(run(['my-app', '--yes', '--no-install'])).rejects.toThrow(/exit:1/)
    expect(exitSpy).toHaveBeenCalledWith(1)
    const messages = errSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(messages).toMatch(/not empty/i)
  })

  it('exits 1 and prints a manual-recovery hint when install fails', async () => {
    const exitSpy = stubExit()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Write a tiny JS file that exits nonzero; pass `node <path>` as --install-cmd.
    // We go through a file rather than `node -e "..."` because parseInstallCmd
    // whitespace-splits the command and quotes become literal args.
    const scriptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-script-'))
    const scriptPath = path.join(scriptDir, 'fail.js')
    fs.writeFileSync(scriptPath, 'process.exit(7)\n')

    try {
      await expect(
        run(['my-app', '--yes', '--install-cmd', `node ${scriptPath}`]),
      ).rejects.toThrow(/exit:1/)
      expect(exitSpy).toHaveBeenCalledWith(1)

      const messages = errSpy.mock.calls.map((c) => String(c[0])).join('\n')
      expect(messages).toMatch(/Install failed/i)
      expect(messages).toMatch(/cd my-app/)
      expect(messages).toMatch(/install/i)

      // Avoid an unused-var lint complaint from strict tsc settings.
      expect(logSpy).toBeDefined()
    } finally {
      fs.rmSync(scriptDir, { recursive: true, force: true })
    }
  })
})
