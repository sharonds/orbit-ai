import { describe, expect, it } from 'vitest'
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '../index.js'
import {
  answerRenewalExpansionQuestion,
  seedRenewalExpansionScenario,
} from './renewal-expansion.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('renewal expansion scenario', () => {
  it('seeds deterministic renewal and expansion signals with dormant controls', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()

    try {
      const base = await seed(adapter, {
        profile: TENANT_PROFILES.acme,
        now: fixedNow,
      })
      const scenario = await seedRenewalExpansionScenario({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
      })

      const answer = await answerRenewalExpansionQuestion({
        adapter,
        organizationId: base.organization.id,
      })

      expect(scenario.scenario).toBe('renewal-expansion')
      expect(answer).toEqual(scenario.expected.renewalExpansion)
      expect(answer.candidateCompanyIds).toEqual([scenario.records.candidateCompany.id])
      expect(answer.expansionDealIds).toEqual([scenario.records.expansionDeal.id])
      expect(answer.contractIds).toEqual([scenario.records.signedContract.id])
      expect(answer.paymentIds).toEqual([scenario.records.paidPayment.id])
      expect(answer.dormantControlCompanyIds).toEqual([scenario.records.dormantControlCompany.id])
      expect(answer.candidateCompanyIds).not.toContain(scenario.records.dormantControlCompany.id)
      expect(answer.expansionDealIds).not.toContain(scenario.records.dormantClosedWonDeal.id)
      expect(answer.dataQualityIssues).toEqual([])
    } finally {
      await adapter.disconnect()
    }
  })
})
