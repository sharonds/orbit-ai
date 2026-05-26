import { describe, expect, it } from 'vitest'
import { answerAccount360Question, seedAccount360Scenario } from '@orbit-ai/demo-seed'
import { buildStack } from '../harness/build-stack.js'
import { startApiServer, type StartedApiServer } from '../harness/api-server.js'
import { runCli } from '../harness/run-cli.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('Security — CLI graph isolation', () => {
  it('does not expose Beta Account 360 graph IDs through Acme CLI API mode', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })
    let server: StartedApiServer | undefined
    try {
      expect(stack.betaOrgId, 'CLI graph isolation requires beta tenant').toBeTruthy()
      await seedAccount360Scenario({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
        now: fixedNow,
      })
      const betaAnswer = await answerAccount360Question({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
      })
      server = await startApiServer(stack.api)
      const env = {
        ORBIT_BASE_URL: server.baseUrl,
        ORBIT_API_KEY: stack.rawApiKey,
      }
      for (const [entity, id] of [
        ['companies', betaAnswer.companyId],
        ['contacts', betaAnswer.contactIds[0]!],
        ['deals', betaAnswer.openDealIds[0]!],
        ['activities', betaAnswer.activityIds[0]!],
        ['notes', betaAnswer.noteIds[0]!],
        ['tasks', betaAnswer.openTaskIds[0]!],
      ] as const) {
        const result = await runCli({
          args: ['--mode', 'api', '--json', entity, 'get', id],
          cwd: process.cwd(),
          env,
        })
        expect(result.exitCode, `cli ${entity} ${id}`).not.toBe(0)
        expect(errorCode(result.json), `cli ${entity} ${id}`).toBe('RESOURCE_NOT_FOUND')
      }
    } finally {
      if (server) await server.close()
      await stack.teardown()
    }
  })
})

function errorCode(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const error = record.error
  if (!error || typeof error !== 'object') return undefined
  return (error as Record<string, unknown>).code as string | undefined
}
