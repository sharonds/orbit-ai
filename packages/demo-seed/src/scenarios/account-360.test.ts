import { describe, expect, it } from 'vitest'
import {
  createCoreServices,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '../index.js'
import {
  answerAccount360Question,
  seedAccount360Scenario,
} from './account-360.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('account 360 scenario', () => {
  it('seeds a deterministic account graph and expected account summary', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()

    try {
      const base = await seed(adapter, {
        profile: TENANT_PROFILES.acme,
        now: fixedNow,
      })
      const scenario = await seedAccount360Scenario({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
      })

      const answer = await answerAccount360Question({
        adapter,
        organizationId: base.organization.id,
      })

      expect(scenario.scenario).toBe('account-360')
      expect(answer).toEqual(scenario.expected.account360)
      expect(answer.companyId).toBe(scenario.records.company.id)
      expect(answer.contactIds).toEqual([
        scenario.records.executiveContact.id,
        scenario.records.technicalContact.id,
        scenario.records.financeContact.id,
      ])
      expect(answer.openDealIds).toEqual([
        scenario.records.expansionDeal.id,
        scenario.records.servicesDeal.id,
      ])
      expect(answer.openDealIds).not.toContain(scenario.records.closedWonControlDeal.id)
      expect(answer.activityIds).toEqual([
        scenario.records.executiveMeetingActivity.id,
        scenario.records.securityActivity.id,
        scenario.records.healthCheckActivity.id,
      ])
      expect(answer.noteIds).toEqual([
        scenario.records.summaryNote.id,
        scenario.records.riskNote.id,
      ])
      expect(answer.openTaskIds).toEqual([
        scenario.records.executiveBriefTask.id,
        scenario.records.securityTask.id,
      ])
      expect(answer.openTaskIds).not.toContain(scenario.records.completedControlTask.id)
      expect(answer.dataQualityIssues).toEqual([])

      const services = createCoreServices(adapter)
      const ctx = { orgId: base.organization.id }
      const company = await services.companies.get(ctx, scenario.records.company.id)
      expect(company?.name).toBe('Scenario Account 360 Corp')

      const scenarioTags = await services.tags.list(ctx, {
        limit: 10,
        filter: { name: 'scenario:account-360' },
      })
      expect(scenarioTags.data).toHaveLength(1)
      expect(scenario.records.scenarioTag.id).toBe(scenarioTags.data[0]?.id)
    } finally {
      await adapter.disconnect()
    }
  })
})
