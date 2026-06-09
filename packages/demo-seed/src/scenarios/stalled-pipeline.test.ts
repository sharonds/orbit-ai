import { describe, expect, it } from 'vitest'
import {
  createCoreServices,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '../index.js'
import {
  answerStalledPipelineQuestion,
  seedStalledPipelineScenario,
} from './stalled-pipeline.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('stalled pipeline scenario', () => {
  it('seeds deterministic stalled deals and expected pipeline answers', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()

    try {
      const base = await seed(adapter, {
        profile: TENANT_PROFILES.acme,
        now: fixedNow,
      })
      const scenario = await seedStalledPipelineScenario({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
      })

      const answer = await answerStalledPipelineQuestion({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
      })

      expect(scenario.scenario).toBe('stalled-pipeline')
      expect(answer).toEqual(scenario.expected.stalledPipeline)
      expect(answer.stalledDealIds).toEqual([
        scenario.records.stalledProspectingDeal.id,
        scenario.records.stalledQualificationDeal.id,
        scenario.records.highValueProposalDeal.id,
      ])
      expect(answer.highValueNoTaskDealIds).toEqual([
        scenario.records.highValueProposalDeal.id,
      ])
      expect(answer.stalledDealIds).not.toContain(scenario.records.closedWonControlDeal.id)
      expect(answer.stalledDealIds).not.toContain(scenario.records.activeRecentDeal.id)

      const services = createCoreServices(adapter)
      const ctx = { orgId: base.organization.id }
      await services.tasks.create(ctx, {
        title: 'Follow up high-value proposal',
        dealId: scenario.records.highValueProposalDeal.id,
        assignedToUserId: scenario.records.owner.id,
        priority: 'high',
        isCompleted: false,
      })

      const afterTask = await answerStalledPipelineQuestion({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
      })
      expect(afterTask.stalledDealIds).toContain(scenario.records.highValueProposalDeal.id)
      expect(afterTask.highValueNoTaskDealIds).toEqual([])
    } finally {
      await adapter.disconnect()
    }
  })
})
