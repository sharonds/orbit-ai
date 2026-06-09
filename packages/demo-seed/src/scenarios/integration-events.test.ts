import { describe, expect, it } from 'vitest'
import {
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seed, TENANT_PROFILES } from '../index.js'
import {
  applyFakeCalendarEvent,
  applyFakeGmailThread,
  applyFakeStripePaymentEvent,
  seedIntegrationEventsScenario,
} from './integration-events.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('integration events scenario', () => {
  it('applies fake Gmail, Calendar, and Stripe events idempotently', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()

    try {
      const base = await seed(adapter, {
        profile: TENANT_PROFILES.acme,
        now: fixedNow,
      })
      const scenario = await seedIntegrationEventsScenario({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
      })

      const gmailFirst = await applyFakeGmailThread({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.gmailThread,
      })
      const gmailReplay = await applyFakeGmailThread({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.gmailThread,
      })
      expect(gmailReplay.activity.id).toBe(gmailFirst.activity.id)
      expect(gmailReplay.created).toBe(false)

      const calendarFirst = await applyFakeCalendarEvent({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.calendarEvent,
      })
      const calendarReplay = await applyFakeCalendarEvent({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.calendarEvent,
      })
      expect(calendarReplay.activity.id).toBe(calendarFirst.activity.id)
      expect(calendarReplay.created).toBe(false)

      const stripeFirst = await applyFakeStripePaymentEvent({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.stripePayment,
      })
      const stripeReplay = await applyFakeStripePaymentEvent({
        adapter,
        organizationId: base.organization.id,
        now: fixedNow,
        event: scenario.events.stripePayment,
      })
      expect(stripeReplay.payment.id).toBe(stripeFirst.payment.id)
      expect(stripeReplay.created).toBe(false)

      expect(gmailFirst.activity.contactId).toBe(scenario.records.contact.id)
      expect(calendarFirst.activity.companyId).toBe(scenario.records.company.id)
      expect(stripeFirst.payment.dealId).toBe(scenario.records.deal.id)
    } finally {
      await adapter.disconnect()
    }
  })
})
