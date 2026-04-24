import { describe, it, expect } from 'vitest'
import { runCli } from '../harness/run-cli.js'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'

describe('Journey 14 — configure Stripe connector', () => {
  it('accepts API key and reports configured status', async () => {
    const ORBIT_CREDENTIAL_KEY = 'a'.repeat(64)
    const workspace = await prepareCliWorkspace({ tenant: 'acme' })
    try {
      const configure = await runCli({
        args: [
          '--mode', 'direct',
          '--apply-integrations-schema',
          'integrations', 'stripe', 'configure',
          '--skip-validation',
        ],
        cwd: workspace.cwd,
        env: {
          ...workspace.env,
          ORBIT_CREDENTIAL_KEY,
          ORBIT_STRIPE_API_KEY: 'sk_test_e2e_fake_not_real',
        },
      })
      expect(configure.exitCode).toBe(0)

      const status = await runCli({
        args: ['--mode', 'direct', '--json', 'integrations', 'stripe', 'status'],
        cwd: workspace.cwd,
        env: { ...workspace.env, ORBIT_CREDENTIAL_KEY },
      })
      expect(status.exitCode).toBe(0)
      const report = status.json as { configured?: boolean; status?: string }
      expect(report.configured ?? report.status === 'configured').toBe(true)

      expect(configure.stdout).not.toContain('sk_test_e2e_fake_not_real')
      expect(status.stdout).not.toContain('sk_test_e2e_fake_not_real')
    } finally {
      await workspace.cleanup()
    }
  })
})
