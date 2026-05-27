import { describe, expect, it } from 'vitest'
import {
  answerLeadQualificationQuestion,
  seedLeadQualificationScenario,
} from '@orbit-ai/demo-seed'
import { buildStack } from '../harness/build-stack.js'
import { expectMcpSuccess } from '../harness/mcp-envelope.js'
import { spawnMcp } from '../harness/run-mcp.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('Business Journey 7 — MCP agent Q&A smoke', () => {
  it('answers lead qualification through MCP tools and keeps tenant-scoped outputs grounded', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })
    const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })

    try {
      expect(stack.betaOrgId, 'MCP business smoke requires beta tenant trap').toBeTruthy()

      const scenario = await seedLeadQualificationScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })
      const betaTrap = await seedLeadQualificationScenario({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
        now: fixedNow,
      })

      const expected = await answerLeadQualificationQuestion({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
      })
      expect(expected).toEqual(scenario.expected.leadQualification)

      const discoveredContacts = await mcpSearchData<ContactMcpRecord>(mcp, {
        object_type: 'contacts',
        filter: { status: 'lead', is_hot: true },
        sort: [{ field: 'created_at', direction: 'asc' }],
        limit: 100,
      }, 'mcp search lead contacts')
      const scenarioContacts = discoveredContacts.filter((contact) => customFieldsOf(contact).scenario === 'lead-qualification')
      const expectedOrder = new Map(expected.qualifiedContactIds.map((id, index) => [id, index]))
      const mcpAnswer = {
        qualifiedContactIds: scenarioContacts
          .filter((contact) => isHotLead(contact))
          .map((contact) => contact.id)
          .sort((left, right) => (expectedOrder.get(left) ?? 999) - (expectedOrder.get(right) ?? 999)),
        missingCompanyContactIds: scenarioContacts
          .filter((contact) => isHotLead(contact) && companyIdOf(contact) === null)
          .map((contact) => contact.id),
      }

      expect(mcpAnswer).toEqual(expected)
      expect(mcpAnswer.qualifiedContactIds).not.toContain(scenario.records.coldImportedLead.id)
      expect(mcpAnswer.qualifiedContactIds).not.toContain(betaTrap.records.hotInboundLead.id)
      expect(scenarioContacts.every((contact) => organizationIdOf(contact) === stack.acmeOrgId)).toBe(true)

      for (const id of [
        scenario.records.hotInboundLead.id,
        scenario.records.hotEnterpriseLead.id,
      ]) {
        const activities = await mcpListActivities(mcp, id)
        expect(activities.some((activity) => activity.type === 'email')).toBe(true)
      }

      const createdTaskPayload = expectMcpSuccess(
        await mcp.request('tools/call', {
          name: 'create_record',
          arguments: {
            object_type: 'tasks',
            record: {
              title: 'MCP agent follow-up for Marco Enterprise',
              description: 'Created by the MCP business Q&A smoke and verified through SDK direct.',
              priority: 'high',
              contact_id: scenario.records.hotEnterpriseLead.id,
              assigned_to_user_id: scenario.records.owner.id,
              custom_fields: { scenario: 'lead-qualification', source: 'mcp-agent-qa-smoke' },
            },
          },
        }),
        'mcp create lead qualification follow-up task',
      )
      const createdTask = unwrapData(createdTaskPayload) as { id?: string; organization_id?: string }
      expect(createdTask.id).toMatch(/^task_/)
      expect(createdTask.organization_id).toBe(stack.acmeOrgId)

      const persistedTask = await stack.sdkDirect.tasks.get(createdTask.id!)
      expect(persistedTask).toMatchObject({
        id: createdTask.id,
        title: 'MCP agent follow-up for Marco Enterprise',
        contact_id: scenario.records.hotEnterpriseLead.id,
        assigned_to_user_id: scenario.records.owner.id,
      })

      const betaContactPayload = expectMcpSuccess(
        await mcp.request('tools/call', {
          name: 'search_records',
          arguments: {
            object_type: 'contacts',
            query: betaTrap.records.hotInboundLead.label,
            limit: 10,
          },
        }),
        'mcp search beta lead by label from acme context',
      )
      const betaSearchRows = extractDataRows<ContactMcpRecord>(betaContactPayload)
      expect(betaSearchRows.some((contact) => contact.id === betaTrap.records.hotInboundLead.id)).toBe(false)
    } finally {
      await mcp.close()
      await stack.teardown()
    }
  })
})

type McpHandle = Awaited<ReturnType<typeof spawnMcp>>

interface ContactMcpRecord {
  readonly id: string
  readonly organization_id?: string
  readonly organizationId?: string
  readonly company_id?: string | null
  readonly companyId?: string | null
  readonly lead_score?: number
  readonly leadScore?: number
  readonly is_hot?: boolean
  readonly isHot?: boolean
  readonly custom_fields?: Record<string, unknown>
  readonly customFields?: Record<string, unknown>
}

interface ActivityMcpRecord {
  readonly type?: string
  readonly direction?: string
}

async function mcpSearchData<T>(
  mcp: McpHandle,
  args: Record<string, unknown>,
  label: string,
): Promise<T[]> {
  const payload = expectMcpSuccess(
    await mcp.request('tools/call', {
      name: 'search_records',
      arguments: args,
    }),
    label,
  )
  return extractDataRows<T>(payload)
}

async function mcpListActivities(mcp: McpHandle, contactId: string): Promise<ActivityMcpRecord[]> {
  const payload = expectMcpSuccess(
    await mcp.request('tools/call', {
      name: 'list_activities',
      arguments: { contact_id: contactId, type: 'email', limit: 10 },
    }),
    `mcp list email activities for ${contactId}`,
  )
  return extractDataRows<ActivityMcpRecord>(payload)
}

function extractDataRows<T>(payload: Record<string, unknown>): T[] {
  const data = unwrapData(payload)
  if (Array.isArray(data)) {
    return data as T[]
  }
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: T[] }).data
  }
  return []
}

function unwrapData(payload: Record<string, unknown>): unknown {
  return payload.data ?? payload
}

function customFieldsOf(contact: ContactMcpRecord): Record<string, unknown> {
  return contact.custom_fields ?? contact.customFields ?? {}
}

function companyIdOf(contact: ContactMcpRecord): string | null | undefined {
  if ('company_id' in contact) {
    return contact.company_id
  }
  return contact.companyId
}

function organizationIdOf(contact: ContactMcpRecord): string | undefined {
  return contact.organization_id ?? contact.organizationId
}

function isHotLead(contact: ContactMcpRecord): boolean {
  return (contact.is_hot ?? contact.isHot) === true && Number(contact.lead_score ?? contact.leadScore) >= 80
}
