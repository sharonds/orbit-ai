import { describe, expect, it } from 'vitest'
import { OrbitClient } from '@orbit-ai/sdk'
import {
  answerLeadQualificationQuestion,
  seedLeadQualificationScenario,
} from '@orbit-ai/demo-seed'
import { buildStack } from '../harness/build-stack.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('Business Journey 1 — lead qualification', () => {
  it('answers which leads sales should qualify and persists follow-up work across SDK surfaces', async () => {
    const stack = await buildStack({
      tenant: 'both',
      adapter: 'sqlite',
    })

    try {
      expect(stack.betaOrgId, 'business journey requires the beta tenant trap').toBeTruthy()

      const scenario = await seedLeadQualificationScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })

      const directAnswer = await answerLeadQualificationQuestion({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
      })
      expect(directAnswer).toEqual(scenario.expected.leadQualification)
      expect(directAnswer.qualifiedContactIds).not.toContain(scenario.records.coldImportedLead.id)
      expect(directAnswer.missingCompanyContactIds).toEqual([
        scenario.records.missingCompanyLead.id,
      ])

      for (const id of directAnswer.qualifiedContactIds) {
        const contact = await stack.sdkHttp.contacts.get(id)
        expect(contact.id).toBe(id)
        expect(contact.organization_id).toBe(stack.acmeOrgId)
      }

      const followUp = await stack.sdkHttp.tasks.create({
        title: 'Business E2E follow-up for Marco Enterprise',
        description: 'Created through SDK HTTP and verified through SDK direct.',
        priority: 'high',
        contact_id: scenario.records.hotEnterpriseLead.id,
        assigned_to_user_id: scenario.records.owner.id,
        custom_fields: { scenario: 'lead-qualification', source: 'business-e2e' },
      })
      expect(followUp.id).toMatch(/^task_/)

      const refetchedTask = await stack.sdkDirect.tasks.get(followUp.id)
      expect(refetchedTask).toMatchObject({
        id: followUp.id,
        title: 'Business E2E follow-up for Marco Enterprise',
        contact_id: scenario.records.hotEnterpriseLead.id,
        assigned_to_user_id: scenario.records.owner.id,
      })

      const betaAnswer = await answerLeadQualificationQuestion({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
      })
      expect(betaAnswer).toEqual({
        qualifiedContactIds: [],
        missingCompanyContactIds: [],
      })

      const betaClient = new OrbitClient({
        adapter: stack.adapter,
        context: { orgId: stack.betaOrgId! },
      })
      for (const id of directAnswer.qualifiedContactIds) {
        await expect(betaClient.contacts.get(id)).rejects.toMatchObject({
          code: 'RESOURCE_NOT_FOUND',
        })
      }
    } finally {
      await stack.teardown()
    }
  })
})
