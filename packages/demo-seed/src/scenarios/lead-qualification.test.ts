import { describe, expect, it } from 'vitest'
import {
  createCoreServices,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '../index.js'
import {
  answerLeadQualificationQuestion,
  seedLeadQualificationScenario,
} from './lead-qualification.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('lead qualification scenario', () => {
  it('seeds deterministic hot leads and expected qualification answers', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()

    try {
      const base = await seed(adapter, {
        profile: TENANT_PROFILES.acme,
        now: fixedNow,
      })
      const scenario = await seedLeadQualificationScenario({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
      })

      const services = createCoreServices(adapter)
      const ctx = { orgId: base.organization.id }

      const expected = scenario.expected.leadQualification
      const answer = await answerLeadQualificationQuestion({
        adapter,
        organizationId: base.organization.id,
      })

      expect(scenario.scenario).toBe('lead-qualification')
      expect(answer).toEqual(expected)
      expect(answer.qualifiedContactIds).toEqual([
        scenario.records.hotInboundLead.id,
        scenario.records.hotEnterpriseLead.id,
        scenario.records.missingCompanyLead.id,
      ])
      expect(answer.missingCompanyContactIds).toEqual([
        scenario.records.missingCompanyLead.id,
      ])
      expect(answer.qualifiedContactIds).not.toContain(scenario.records.coldImportedLead.id)

      const contacts = []
      for (const id of answer.qualifiedContactIds) {
        contacts.push(await services.contacts.get(ctx, id))
      }
      expect(contacts.map((contact) => contact?.email).sort()).toEqual([
        'lena.qualification@example.test',
        'marco.enterprise@example.test',
        'no-company-lead@example.test',
      ])

      const tasks = await services.tasks.list(ctx, {
        limit: 10,
        filter: { contact_id: scenario.records.hotInboundLead.id },
      })
      expect(tasks.data).toEqual([
        expect.objectContaining({
          title: 'Qualify Lena Qualification',
          contactId: scenario.records.hotInboundLead.id,
          assignedToUserId: scenario.records.owner.id,
          isCompleted: false,
        }),
      ])

      const scenarioTags = await services.tags.list(ctx, {
        limit: 10,
        filter: { name: 'scenario:lead-qualification' },
      })
      expect(scenarioTags.data).toHaveLength(1)
      expect(scenario.records.scenarioTag.id).toBe(scenarioTags.data[0]?.id)
    } finally {
      await adapter.disconnect()
    }
  })
})
