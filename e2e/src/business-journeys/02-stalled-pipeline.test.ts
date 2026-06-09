import { describe, expect, it } from 'vitest'
import { OrbitClient } from '@orbit-ai/sdk'
import {
  answerStalledPipelineQuestion,
  seedStalledPipelineScenario,
} from '@orbit-ai/demo-seed'
import { buildStack } from '../harness/build-stack.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('Business Journey 2 — stalled pipeline review', () => {
  it('identifies stuck deals and verifies next-step work through SDK surfaces', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })

    try {
      expect(stack.betaOrgId, 'business journey requires the beta tenant trap').toBeTruthy()

      const scenario = await seedStalledPipelineScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })

      const directAnswer = await answerStalledPipelineQuestion({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })
      expect(directAnswer).toEqual(scenario.expected.stalledPipeline)
      expect(directAnswer.stalledDealIds).not.toContain(scenario.records.closedWonControlDeal.id)
      expect(directAnswer.stalledDealIds).not.toContain(scenario.records.activeRecentDeal.id)

      for (const id of directAnswer.stalledDealIds) {
        const deal = await stack.sdkHttp.deals.get(id)
        expect(deal.id).toBe(id)
        expect(deal.organization_id).toBe(stack.acmeOrgId)
      }

      const moved = await stack.sdkHttp.deals.move(
        scenario.records.stalledProspectingDeal.id,
        { stage_id: scenario.records.proposalStage.id },
      )
      expect(moved.stage_id).toBe(scenario.records.proposalStage.id)

      const directMoved = await stack.sdkDirect.deals.get(scenario.records.stalledProspectingDeal.id)
      expect(directMoved.stage_id).toBe(scenario.records.proposalStage.id)

      const followUp = await stack.sdkHttp.tasks.create({
        title: 'Next step for high-value proposal',
        description: 'Created through SDK HTTP with a public ISO due_date.',
        due_date: new Date(fixedNow + 2 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        deal_id: scenario.records.highValueProposalDeal.id,
        assigned_to_user_id: scenario.records.owner.id,
        custom_fields: { scenario: 'stalled-pipeline', source: 'business-e2e' },
      })
      expect(followUp.id).toMatch(/^task_/)
      expect(followUp.due_date).toBe('2026-04-17T12:00:00.000Z')

      const refetchedTask = await stack.sdkDirect.tasks.get(followUp.id)
      expect(refetchedTask).toMatchObject({
        id: followUp.id,
        title: 'Next step for high-value proposal',
        due_date: '2026-04-17T12:00:00.000Z',
        deal_id: scenario.records.highValueProposalDeal.id,
        assigned_to_user_id: scenario.records.owner.id,
      })

      const afterTask = await answerStalledPipelineQuestion({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })
      expect(afterTask.stalledDealIds).toContain(scenario.records.highValueProposalDeal.id)
      expect(afterTask.highValueNoTaskDealIds).toEqual([])

      const betaAnswer = await answerStalledPipelineQuestion({
        adapter: stack.adapter,
        organizationId: stack.betaOrgId!,
        now: fixedNow,
      })
      expect(betaAnswer).toEqual({
        stalledDealIds: [],
        highValueNoTaskDealIds: [],
      })

      const betaClient = new OrbitClient({
        adapter: stack.adapter,
        context: { orgId: stack.betaOrgId! },
      })
      for (const id of directAnswer.stalledDealIds) {
        await expect(betaClient.deals.get(id)).rejects.toMatchObject({
          code: 'RESOURCE_NOT_FOUND',
        })
      }
    } finally {
      await stack.teardown()
    }
  })
})
