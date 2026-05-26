import { describe, expect, it } from 'vitest'
import { OrbitClient } from '@orbit-ai/sdk'
import {
  answerRenewalExpansionQuestion,
  seedRenewalExpansionScenario,
} from '@orbit-ai/demo-seed'
import { buildStack, type Stack } from '../harness/build-stack.js'
import { expectMcpSuccess } from '../harness/mcp-envelope.js'
import { spawnMcp } from '../harness/run-mcp.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)
const API_VERSION = '2026-04-01'

describe('Business Journey 4 — renewal and expansion', () => {
  it('identifies renewal expansion candidates across SDK, raw API, MCP, and tenant boundaries', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })
    const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })

    try {
      expect(stack.betaOrgId, 'business journey requires the beta tenant trap').toBeTruthy()

      const scenario = await seedRenewalExpansionScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })

      const directAnswer = await answerRenewalExpansionQuestion({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
      })
      expect(directAnswer).toEqual(scenario.expected.renewalExpansion)
      expect(directAnswer.candidateCompanyIds).toEqual([scenario.records.candidateCompany.id])
      expect(directAnswer.expansionDealIds).toEqual([scenario.records.expansionDeal.id])
      expect(directAnswer.candidateCompanyIds).not.toContain(scenario.records.dormantControlCompany.id)
      expect(directAnswer.expansionDealIds).not.toContain(scenario.records.dormantClosedWonDeal.id)

      const httpCompany = await stack.sdkHttp.companies.get(scenario.records.candidateCompany.id)
      expect(httpCompany).toMatchObject({
        id: scenario.records.candidateCompany.id,
        organization_id: stack.acmeOrgId,
        name: 'Scenario Renewal Candidate Co',
      })

      const httpDeal = await stack.sdkHttp.deals.get(scenario.records.expansionDeal.id)
      expect(httpDeal).toMatchObject({
        id: scenario.records.expansionDeal.id,
        organization_id: stack.acmeOrgId,
        company_id: scenario.records.candidateCompany.id,
        status: 'open',
      })

      const rawApiDeal = await rawApiGet(stack, 'deals', scenario.records.expansionDeal.id)
      expect(rawApiDeal).toMatchObject({
        id: scenario.records.expansionDeal.id,
        organization_id: stack.acmeOrgId,
        company_id: scenario.records.candidateCompany.id,
      })

      const mcpDealPayload = expectMcpSuccess(
        await mcp.request('tools/call', {
          name: 'get_record',
          arguments: { object_type: 'deals', record_id: scenario.records.expansionDeal.id },
        }),
        'mcp get renewal expansion deal',
      )
      expect((unwrapData(mcpDealPayload) as { id?: string }).id).toBe(scenario.records.expansionDeal.id)

      const mcpSearchPayload = expectMcpSuccess(
        await mcp.request('tools/call', {
          name: 'search_records',
          arguments: { object_type: 'companies', query: 'Scenario Renewal Candidate', limit: 10 },
        }),
        'mcp search renewal companies',
      )
      const searchData = unwrapData(mcpSearchPayload) as { data?: Array<{ id: string; organization_id?: string }> } | Array<{ id: string; organization_id?: string }>
      const searchRows = Array.isArray(searchData) ? searchData : (searchData.data ?? [])
      expect(searchRows.some((row) => row.id === scenario.records.candidateCompany.id)).toBe(true)
      expect(searchRows.every((row) => row.organization_id === undefined || row.organization_id === stack.acmeOrgId)).toBe(true)

      const followUp = await stack.sdkHttp.tasks.create({
        title: 'Renewal expansion pricing follow-up',
        description: 'Created through SDK HTTP and verified through SDK direct.',
        due_date: new Date(fixedNow + 4 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        contact_id: scenario.records.championContact.id,
        deal_id: scenario.records.expansionDeal.id,
        assigned_to_user_id: scenario.records.owner.id,
        custom_fields: { scenario: 'renewal-expansion', source: 'business-e2e' },
      })
      expect(followUp.id).toMatch(/^task_/)

      const directTask = await stack.sdkDirect.tasks.get(followUp.id)
      expect(directTask).toMatchObject({
        id: followUp.id,
        title: 'Renewal expansion pricing follow-up',
        contact_id: scenario.records.championContact.id,
        deal_id: scenario.records.expansionDeal.id,
      })

      const betaAnswer = await answerRenewalExpansionQuestion({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
      })
      expect(betaAnswer).toEqual({
        candidateCompanyIds: [],
        expansionDealIds: [],
        contractIds: [],
        paymentIds: [],
        dormantControlCompanyIds: [],
        dataQualityIssues: ['scenario-company-not-found'],
      })

      const betaClient = new OrbitClient({
        adapter: stack.adapter,
        context: { orgId: stack.betaOrgId! },
      })
      for (const id of [
        scenario.records.candidateCompany.id,
        scenario.records.expansionDeal.id,
        scenario.records.signedContract.id,
        scenario.records.paidPayment.id,
        scenario.records.followUpTask.id,
      ]) {
        await expect(getByPrefix(betaClient, id)).rejects.toMatchObject({
          code: 'RESOURCE_NOT_FOUND',
        })
      }
    } finally {
      await mcp.close()
      await stack.teardown()
    }
  })
})

async function rawApiGet(
  stack: Stack,
  entity: string,
  id: string,
): Promise<Record<string, unknown>> {
  const response = await stack.api.fetch(new Request(`http://test.local/v1/${entity}/${id}`, {
    headers: {
      Authorization: `Bearer ${stack.rawApiKey}`,
      'Orbit-Version': API_VERSION,
    },
  }))
  expect(response.status, `raw api get ${entity}/${id}`).toBe(200)
  const envelope = (await response.json()) as { data?: Record<string, unknown> }
  expect(envelope.data, `raw api get ${entity}/${id} data`).toBeTruthy()
  return envelope.data!
}

async function getByPrefix(client: OrbitClient, id: string): Promise<unknown> {
  if (id.startsWith('company_')) return client.companies.get(id)
  if (id.startsWith('deal_')) return client.deals.get(id)
  if (id.startsWith('contract_')) return client.contracts.get(id)
  if (id.startsWith('payment_')) return client.payments.get(id)
  if (id.startsWith('task_')) return client.tasks.get(id)
  throw new Error(`Unsupported Renewal/Expansion record id prefix: ${id}`)
}

function unwrapData(payload: Record<string, unknown>): unknown {
  return payload.data ?? payload
}
