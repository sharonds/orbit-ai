import { describe, expect, it } from 'vitest'
import {
  seedAccount360Scenario,
  seedLeadQualificationScenario,
  seedRenewalExpansionScenario,
  seedStalledPipelineScenario,
} from '@orbit-ai/demo-seed'
import { buildStack } from '../harness/build-stack.js'
import { startApiServer, type StartedApiServer } from '../harness/api-server.js'
import { runCli } from '../harness/run-cli.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('Business Journey 5 — CLI business surface smoke', () => {
  it('fetches representative business scenario records through CLI API mode', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: 'sqlite' })
    let server: StartedApiServer | undefined

    try {
      const lead = await seedLeadQualificationScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })
      const stalled = await seedStalledPipelineScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })
      const account = await seedAccount360Scenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })
      const renewal = await seedRenewalExpansionScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })

      server = await startApiServer(stack.api)
      const env = {
        ORBIT_BASE_URL: server.baseUrl,
        ORBIT_API_KEY: stack.rawApiKey,
      }

      await expectCliGet({
        entity: 'contacts',
        id: lead.records.hotInboundLead.id,
        expectedOrgId: stack.acmeOrgId,
        env,
      })
      await expectCliGet({
        entity: 'deals',
        id: stalled.records.highValueProposalDeal.id,
        expectedOrgId: stack.acmeOrgId,
        env,
      })
      await expectCliGet({
        entity: 'companies',
        id: account.records.company.id,
        expectedOrgId: stack.acmeOrgId,
        env,
      })
      await expectCliGet({
        entity: 'deals',
        id: renewal.records.expansionDeal.id,
        expectedOrgId: stack.acmeOrgId,
        env,
      })
      await expectCliList({
        entity: 'contacts',
        expectedOrgId: stack.acmeOrgId,
        env,
      })
      await expectCliSearch({
        query: lead.records.hotInboundLead.label,
        expectedId: lead.records.hotInboundLead.id,
        env,
      })
      await expectCliDealMove({
        dealId: stalled.records.activeRecentDeal.id,
        stageId: stalled.records.qualificationStage.id,
        expectedOrgId: stack.acmeOrgId,
        env,
      })
    } finally {
      if (server) await server.close()
      await stack.teardown()
    }
  })
})

async function expectCliGet(input: {
  readonly entity: string
  readonly id: string
  readonly expectedOrgId: string
  readonly env: Record<string, string>
}): Promise<void> {
  const result = await runCli({
    args: ['--mode', 'api', '--json', input.entity, 'get', input.id],
    cwd: process.cwd(),
    env: input.env,
  })
  expect(result.exitCode, `cli ${input.entity} get ${input.id} exitCode`).toBe(0)
  const data = unwrapData(result.json)
  expect(data?.id, `cli ${input.entity} get ${input.id} id`).toBe(input.id)
  expect(data?.organization_id, `cli ${input.entity} get ${input.id} organization`).toBe(input.expectedOrgId)
}

async function expectCliList(input: {
  readonly entity: string
  readonly expectedOrgId: string
  readonly env: Record<string, string>
}): Promise<void> {
  const result = await runCli({
    args: ['--mode', 'api', '--json', input.entity, 'list', '--limit', '5'],
    cwd: process.cwd(),
    env: input.env,
  })
  expect(result.exitCode, `cli ${input.entity} list exitCode`).toBe(0)
  const data = unwrapListData(result.json)
  expect(data.length, `cli ${input.entity} list rows`).toBeGreaterThan(0)
  expect(data.every((row) => row.organization_id === input.expectedOrgId), `cli ${input.entity} list org scope`).toBe(true)
}

async function expectCliSearch(input: {
  readonly query: string
  readonly expectedId: string
  readonly env: Record<string, string>
}): Promise<void> {
  const result = await runCli({
    args: ['--mode', 'api', '--json', 'search', input.query, '--types', 'contacts', '--limit', '10'],
    cwd: process.cwd(),
    env: input.env,
  })
  expect(result.exitCode, `cli search ${input.query} exitCode`).toBe(0)
  const data = unwrapListData(result.json)
  expect(data.some((row) => row.id === input.expectedId), `cli search includes ${input.expectedId}`).toBe(true)
}

async function expectCliDealMove(input: {
  readonly dealId: string
  readonly stageId: string
  readonly expectedOrgId: string
  readonly env: Record<string, string>
}): Promise<void> {
  const result = await runCli({
    args: ['--mode', 'api', '--json', 'deals', 'move', input.dealId, '--stage-id', input.stageId],
    cwd: process.cwd(),
    env: input.env,
  })
  expect(result.exitCode, `cli deals move ${input.dealId} exitCode`).toBe(0)
  const data = unwrapData(result.json)
  expect(data?.id, `cli deals move ${input.dealId} id`).toBe(input.dealId)
  expect(data?.organization_id, `cli deals move ${input.dealId} organization`).toBe(input.expectedOrgId)
  expect(data?.stage_id, `cli deals move ${input.dealId} stage`).toBe(input.stageId)
}

function unwrapData(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const data = record.data
  if (data && typeof data === 'object') return data as Record<string, unknown>
  return record
}

function unwrapListData(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const data = record.data
  return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : []
}
