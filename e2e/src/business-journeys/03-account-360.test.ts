import { describe, expect, it } from 'vitest'
import { OrbitClient } from '@orbit-ai/sdk'
import {
  answerAccount360Question,
  seedAccount360Scenario,
} from '@orbit-ai/demo-seed'
import { buildStack, type Stack } from '../harness/build-stack.js'
import { expectMcpSuccess } from '../harness/mcp-envelope.js'
import { spawnMcp } from '../harness/run-mcp.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)
const API_VERSION = '2026-04-01'

describe('Business Journey 3 — account 360', () => {
  it('answers the account graph across SDK, raw API, MCP, and tenant boundaries', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })
    const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })

    try {
      expect(stack.betaOrgId, 'business journey requires the beta tenant trap').toBeTruthy()

      const scenario = await seedAccount360Scenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })
      await seedBetaTrap(stack)

      const directAnswer = await answerAccount360Question({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
      })
      expect(directAnswer).toEqual(scenario.expected.account360)
      expect(directAnswer.companyId).toBe(scenario.records.company.id)
      expect(directAnswer.openDealIds).not.toContain(scenario.records.closedWonControlDeal.id)
      expect(directAnswer.openTaskIds).not.toContain(scenario.records.completedControlTask.id)

      const httpCompany = await stack.sdkHttp.companies.get(directAnswer.companyId)
      expect(httpCompany).toMatchObject({
        id: scenario.records.company.id,
        organization_id: stack.acmeOrgId,
        name: 'Scenario Account 360 Corp',
      })

      for (const id of directAnswer.contactIds) {
        const contact = await stack.sdkHttp.contacts.get(id)
        expect(contact.organization_id).toBe(stack.acmeOrgId)
        expect(contact.company_id).toBe(scenario.records.company.id)
      }

      for (const id of directAnswer.openDealIds) {
        const deal = await stack.sdkHttp.deals.get(id)
        expect(deal.organization_id).toBe(stack.acmeOrgId)
        expect(deal.company_id).toBe(scenario.records.company.id)
        expect(deal.status).toBe('open')
      }

      const followUp = await stack.sdkHttp.tasks.create({
        title: 'Account 360 procurement follow-up',
        description: 'Created through SDK HTTP and verified through SDK direct.',
        due_date: new Date(fixedNow + 3 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        contact_id: scenario.records.financeContact.id,
        deal_id: scenario.records.expansionDeal.id,
        assigned_to_user_id: scenario.records.owner.id,
        custom_fields: { scenario: 'account-360', source: 'business-e2e' },
      })
      expect(followUp.id).toMatch(/^task_/)

      const refetchedTask = await stack.sdkDirect.tasks.get(followUp.id)
      expect(refetchedTask).toMatchObject({
        id: followUp.id,
        title: 'Account 360 procurement follow-up',
        contact_id: scenario.records.financeContact.id,
        deal_id: scenario.records.expansionDeal.id,
      })

      const rawApiCompany = await rawApiGet(stack, 'companies', scenario.records.company.id)
      expect(rawApiCompany).toMatchObject({
        id: scenario.records.company.id,
        organization_id: stack.acmeOrgId,
        name: 'Scenario Account 360 Corp',
      })

      const mcpCompanyPayload = expectMcpSuccess(
        await mcp.request('tools/call', {
          name: 'get_record',
          arguments: { object_type: 'companies', record_id: scenario.records.company.id },
        }),
        'mcp get account 360 company',
      )
      expect((unwrapData(mcpCompanyPayload) as { id?: string; organization_id?: string }).id).toBe(scenario.records.company.id)

      const mcpSearchPayload = expectMcpSuccess(
        await mcp.request('tools/call', {
          name: 'search_records',
          arguments: { object_type: 'companies', query: 'Scenario Account 360', limit: 10 },
        }),
        'mcp search account 360 companies',
      )
      const mcpSearchData = unwrapData(mcpSearchPayload) as { data?: Array<{ id: string; organization_id?: string }> } | Array<{ id: string; organization_id?: string }>
      const mcpRows = Array.isArray(mcpSearchData) ? mcpSearchData : (mcpSearchData.data ?? [])
      expect(mcpRows.some((row) => row.id === scenario.records.company.id)).toBe(true)
      expect(mcpRows.every((row) => row.organization_id === undefined || row.organization_id === stack.acmeOrgId)).toBe(true)

      const betaAnswer = await answerAccount360Question({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
      })
      expect(betaAnswer).toEqual({
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
      for (const id of [
        scenario.records.company.id,
        ...directAnswer.contactIds,
        ...directAnswer.openDealIds,
        ...directAnswer.activityIds,
        ...directAnswer.noteIds,
        ...directAnswer.openTaskIds,
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

async function seedBetaTrap(stack: Stack): Promise<void> {
  const betaClient = new OrbitClient({
    adapter: stack.adapter,
    context: { orgId: stack.betaOrgId! },
  })
  await betaClient.companies.create({
    name: 'Scenario Account 360 Corp',
    domain: 'beta-scenario-account-360.test',
    custom_fields: { scenario: 'account-360-beta-trap' },
  })
}

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
  if (id.startsWith('contact_')) return client.contacts.get(id)
  if (id.startsWith('deal_')) return client.deals.get(id)
  if (id.startsWith('activity_')) return client.activities.get(id)
  if (id.startsWith('note_')) return client.notes.get(id)
  if (id.startsWith('task_')) return client.tasks.get(id)
  throw new Error(`Unsupported Account 360 record id prefix: ${id}`)
}

function unwrapData(payload: Record<string, unknown>): unknown {
  return payload.data ?? payload
}
