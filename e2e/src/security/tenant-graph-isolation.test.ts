import { describe, expect, it } from 'vitest'
import { OrbitClient } from '@orbit-ai/sdk'
import {
  answerAccount360Question,
  seedAccount360Scenario,
} from '@orbit-ai/demo-seed'
import { buildStack, type Stack } from '../harness/build-stack.js'
import { expectMcpError } from '../harness/mcp-envelope.js'
import { spawnMcp } from '../harness/run-mcp.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)
const API_VERSION = '2026-04-01'

describe('Security — tenant graph isolation', () => {
  it('blocks Acme-bound surfaces from reading a Beta account graph', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })
    const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })

    try {
      expect(stack.betaOrgId, 'tenant graph isolation requires beta tenant').toBeTruthy()

      const betaScenario = await seedAccount360Scenario({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
        now: fixedNow,
      })
      const betaAnswer = await answerAccount360Question({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
      })

      const betaIds = [
        betaAnswer.companyId,
        ...betaAnswer.contactIds,
        ...betaAnswer.openDealIds,
        ...betaAnswer.activityIds,
        ...betaAnswer.noteIds,
        ...betaAnswer.openTaskIds,
      ]
      expect(betaIds.length).toBeGreaterThanOrEqual(8)

      for (const id of betaIds) {
        await expect(getByPrefix(stack.sdkDirect, id), `sdk-direct ${id}`).rejects.toMatchObject({
          code: 'RESOURCE_NOT_FOUND',
        })
        await expect(getByPrefix(stack.sdkHttp, id), `sdk-http ${id}`).rejects.toMatchObject({
          code: 'RESOURCE_NOT_FOUND',
        })
        await expectRawApiNotFound(stack, id)
        expectMcpError(
          await mcp.request('tools/call', {
            name: 'get_record',
            arguments: { object_type: objectTypeForId(id), record_id: id },
          }),
          'RESOURCE_NOT_FOUND',
          `mcp get_record ${id}`,
        )
      }

      const acmeAnswer = await answerAccount360Question({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
      })
      expect(acmeAnswer).toEqual({
        companyId: '',
        contactIds: [],
        openDealIds: [],
        activityIds: [],
        noteIds: [],
        openTaskIds: [],
        dataQualityIssues: ['scenario-company-not-found'],
      })

      const betaClient = new OrbitClient({
        adapter: stack.adapter,
        context: { orgId: stack.betaOrgId! },
      })
      expect(await betaClient.companies.get(betaScenario.records.company.id)).toMatchObject({
        id: betaScenario.records.company.id,
        organization_id: stack.betaOrgId,
      })
    } finally {
      await mcp.close()
      await stack.teardown()
    }
  })
})

async function expectRawApiNotFound(stack: Stack, id: string): Promise<void> {
  const response = await stack.api.fetch(new Request(`http://test.local/v1/${objectTypeForId(id)}/${id}`, {
    headers: {
      Authorization: `Bearer ${stack.rawApiKey}`,
      'Orbit-Version': API_VERSION,
    },
  }))
  expect(response.status, `raw-api ${id} status`).toBe(404)
  const envelope = (await response.json()) as { error?: { code?: string } }
  expect(envelope.error?.code, `raw-api ${id} code`).toBe('RESOURCE_NOT_FOUND')
}

async function getByPrefix(client: OrbitClient, id: string): Promise<unknown> {
  if (id.startsWith('company_')) return client.companies.get(id)
  if (id.startsWith('contact_')) return client.contacts.get(id)
  if (id.startsWith('deal_')) return client.deals.get(id)
  if (id.startsWith('activity_')) return client.activities.get(id)
  if (id.startsWith('note_')) return client.notes.get(id)
  if (id.startsWith('task_')) return client.tasks.get(id)
  throw new Error(`Unsupported tenant graph record id prefix: ${id}`)
}

function objectTypeForId(id: string): string {
  if (id.startsWith('company_')) return 'companies'
  if (id.startsWith('contact_')) return 'contacts'
  if (id.startsWith('deal_')) return 'deals'
  if (id.startsWith('activity_')) return 'activities'
  if (id.startsWith('note_')) return 'notes'
  if (id.startsWith('task_')) return 'tasks'
  throw new Error(`Unsupported tenant graph record id prefix: ${id}`)
}
