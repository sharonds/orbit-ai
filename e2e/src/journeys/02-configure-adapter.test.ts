import { describe, it, expect } from 'vitest'
import { runCli } from '../harness/run-cli.js'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'

describe('Journey 2 — configure adapter + working local context', () => {
  it('uses a file-backed SQLite adapter and resolves a direct-mode org context', async () => {
    const workspace = await prepareCliWorkspace({ tenant: 'acme' })
    try {
      const status = await runCli({
        args: ['--mode', 'direct', '--json', 'status'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(status.exitCode).toBe(0)
      expect(status.json).toMatchObject({ status: 'ok', connected: true })
    } finally {
      await workspace.cleanup()
    }
  })
})
