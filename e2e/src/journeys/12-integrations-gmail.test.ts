import { describe, it, expect } from 'vitest'
import { runCli } from '../harness/run-cli.js'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'

describe('Journey 12 — configure Gmail connector', () => {
  it('accepts credentials and reports configured status', async () => {
    const ORBIT_CREDENTIAL_KEY = 'a'.repeat(64)
    const workspace = await prepareCliWorkspace({ tenant: 'acme' })
    try {
      const configure = await runCli({
        args: [
          '--mode', 'direct',
          '--apply-integrations-schema',
          'integrations', 'gmail', 'configure',
          '--access-token-env', 'ORBIT_GMAIL_ACCESS_TOKEN',
          '--refresh-token-env', 'ORBIT_GMAIL_REFRESH_TOKEN',
          '--skip-validation',
        ],
        cwd: workspace.cwd,
        env: {
          ...workspace.env,
          ORBIT_CREDENTIAL_KEY,
          ORBIT_GMAIL_ACCESS_TOKEN: 'e2e_access_token',
          ORBIT_GMAIL_REFRESH_TOKEN: 'e2e_refresh_token',
        },
      })
      expect(configure.exitCode).toBe(0)

      const status = await runCli({
        args: ['--mode', 'direct', '--json', 'integrations', 'gmail', 'status'],
        cwd: workspace.cwd,
        env: { ...workspace.env, ORBIT_CREDENTIAL_KEY },
      })
      expect(status.exitCode).toBe(0)
      const report = status.json as { configured?: boolean; status?: string }
      expect(report.configured ?? report.status === 'configured').toBe(true)

      expect(configure.stdout).not.toContain('e2e_access_token')
      expect(configure.stdout).not.toContain('e2e_refresh_token')
      expect(status.stdout).not.toContain('e2e_access_token')
      expect(status.stdout).not.toContain('e2e_refresh_token')
    } finally {
      await workspace.cleanup()
    }
  })
})
