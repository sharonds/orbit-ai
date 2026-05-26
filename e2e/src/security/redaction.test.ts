import { describe, expect, it } from 'vitest'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'
import { runCli } from '../harness/run-cli.js'

const ORBIT_CREDENTIAL_KEY = 'a'.repeat(64)
const SECRET_SENTINELS = {
  gmailAccessToken: 'gmail_access_secret_sentinel',
  gmailRefreshToken: 'gmail_refresh_secret_sentinel',
  calendarAccessToken: 'calendar_access_secret_sentinel',
  calendarRefreshToken: 'calendar_refresh_secret_sentinel',
  stripeApiKey: 'sk_test_scope_should_not_leak_sentinel',
}

describe('Security — redaction', () => {
  it('does not expose connector credential sentinels in CLI configure or status output', async () => {
    const workspace = await prepareCliWorkspace({ tenant: 'acme', adapter: 'sqlite' })
    try {
      const outputs: string[] = []

      outputs.push(await runIntegrationCommand({
        cwd: workspace.cwd,
        env: {
          ...workspace.env,
          ORBIT_CREDENTIAL_KEY,
          ORBIT_GMAIL_ACCESS_TOKEN: SECRET_SENTINELS.gmailAccessToken,
          ORBIT_GMAIL_REFRESH_TOKEN: SECRET_SENTINELS.gmailRefreshToken,
        },
        args: [
          '--mode', 'direct',
          '--apply-integrations-schema',
          'integrations', 'gmail', 'configure',
          '--access-token-env', 'ORBIT_GMAIL_ACCESS_TOKEN',
          '--refresh-token-env', 'ORBIT_GMAIL_REFRESH_TOKEN',
          '--skip-validation',
        ],
      }))
      outputs.push(await runIntegrationCommand({
        cwd: workspace.cwd,
        env: { ...workspace.env, ORBIT_CREDENTIAL_KEY },
        args: ['--mode', 'direct', '--json', 'integrations', 'gmail', 'status'],
      }))

      outputs.push(await runIntegrationCommand({
        cwd: workspace.cwd,
        env: {
          ...workspace.env,
          ORBIT_CREDENTIAL_KEY,
          ORBIT_GOOGLE_CALENDAR_ACCESS_TOKEN: SECRET_SENTINELS.calendarAccessToken,
          ORBIT_GOOGLE_CALENDAR_REFRESH_TOKEN: SECRET_SENTINELS.calendarRefreshToken,
        },
        args: [
          '--mode', 'direct',
          '--apply-integrations-schema',
          'integrations', 'google-calendar', 'configure',
          '--access-token-env', 'ORBIT_GOOGLE_CALENDAR_ACCESS_TOKEN',
          '--refresh-token-env', 'ORBIT_GOOGLE_CALENDAR_REFRESH_TOKEN',
          '--skip-validation',
        ],
      }))
      outputs.push(await runIntegrationCommand({
        cwd: workspace.cwd,
        env: { ...workspace.env, ORBIT_CREDENTIAL_KEY },
        args: ['--mode', 'direct', '--json', 'integrations', 'google-calendar', 'status'],
      }))

      outputs.push(await runIntegrationCommand({
        cwd: workspace.cwd,
        env: {
          ...workspace.env,
          ORBIT_CREDENTIAL_KEY,
          ORBIT_STRIPE_API_KEY: SECRET_SENTINELS.stripeApiKey,
        },
        args: [
          '--mode', 'direct',
          '--apply-integrations-schema',
          'integrations', 'stripe', 'configure',
          '--skip-validation',
        ],
      }))
      outputs.push(await runIntegrationCommand({
        cwd: workspace.cwd,
        env: { ...workspace.env, ORBIT_CREDENTIAL_KEY },
        args: ['--mode', 'direct', '--json', 'integrations', 'stripe', 'status'],
      }))

      const joined = outputs.join('\n')
      for (const secret of Object.values(SECRET_SENTINELS)) {
        expect(joined).not.toContain(secret)
      }
    } finally {
      await workspace.cleanup()
    }
  })
})

async function runIntegrationCommand(input: {
  readonly cwd: string
  readonly env: Record<string, string>
  readonly args: readonly string[]
}): Promise<string> {
  const result = await runCli(input)
  expect(result.exitCode, `cli ${input.args.join(' ')} exitCode`).toBe(0)
  return `${result.stdout}\n${result.stderr}`
}
