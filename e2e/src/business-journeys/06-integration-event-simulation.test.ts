import { describe, expect, it } from 'vitest'
import {
  applyFakeCalendarEvent,
  applyFakeGmailThread,
  applyFakeStripePaymentEvent,
  seedIntegrationEventsScenario,
} from '@orbit-ai/demo-seed'
import { buildStack } from '../harness/build-stack.js'

const fixedNow = Date.UTC(2026, 3, 15, 12, 0, 0)

describe('Business Journey 6 — fake integration event simulation', () => {
  it('applies fake provider events and rejects duplicate replay', async () => {
    const stack = await buildStack({ tenant: 'both', adapter: 'sqlite' })

    try {
      expect(stack.betaOrgId, 'business journey requires the beta tenant trap').toBeTruthy()
      const scenario = await seedIntegrationEventsScenario({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
      })

      const gmail = await applyFakeGmailThread({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.gmailThread,
      })
      const calendar = await applyFakeCalendarEvent({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.calendarEvent,
      })
      const stripe = await applyFakeStripePaymentEvent({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.stripePayment,
      })

      expect(await stack.sdkHttp.activities.get(gmail.activity.id)).toMatchObject({
        id: gmail.activity.id,
        organization_id: stack.acmeOrgId,
        contact_id: scenario.records.contact.id,
      })
      expect(await stack.sdkHttp.activities.get(calendar.activity.id)).toMatchObject({
        id: calendar.activity.id,
        organization_id: stack.acmeOrgId,
        company_id: scenario.records.company.id,
      })
      expect(await stack.sdkHttp.payments.get(stripe.payment.id)).toMatchObject({
        id: stripe.payment.id,
        organization_id: stack.acmeOrgId,
        deal_id: scenario.records.deal.id,
      })

      expect((await applyFakeGmailThread({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.gmailThread,
      })).created).toBe(false)
      expect((await applyFakeCalendarEvent({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.calendarEvent,
      })).created).toBe(false)
      expect((await applyFakeStripePaymentEvent({
        adapter: stack.adapter,
        organizationId: stack.acmeOrgId,
        now: fixedNow,
        event: scenario.events.stripePayment,
      })).created).toBe(false)

      await expect(stack.sdkDirect.payments.get(stripe.payment.id)).resolves.toMatchObject({
        id: stripe.payment.id,
        deal_id: scenario.records.deal.id,
        contact_id: scenario.records.contact.id,
      })
    } finally {
      await stack.teardown()
    }
  })
})
