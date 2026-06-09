import { createCoreServices, type ActivityRecord } from '@orbit-ai/core'
import type { ScenarioRecordRef, ScenarioSeedOptions } from './types.js'
import { dateDaysAgo } from './types.js'

type PaymentRecord = Awaited<ReturnType<ReturnType<typeof createCoreServices>['payments']['create']>>

const SCENARIO = 'integration-events'
const PROVIDER_EXTERNAL_ID_FIELD = 'providerExternalId'

export interface FakeGmailThreadEvent {
  readonly provider: 'gmail'
  readonly externalId: string
  readonly from: string
  readonly subject: string
  readonly body: string
}

export interface FakeCalendarEvent {
  readonly provider: 'google-calendar'
  readonly externalId: string
  readonly summary: string
  readonly description: string
}

export interface FakeStripePaymentEvent {
  readonly provider: 'stripe'
  readonly externalId: string
  readonly amount: string
}

export interface IntegrationEventsScenarioResult {
  readonly scenario: typeof SCENARIO
  readonly organizationId: string
  readonly records: {
    readonly owner: ScenarioRecordRef
    readonly company: ScenarioRecordRef
    readonly contact: ScenarioRecordRef
    readonly deal: ScenarioRecordRef
  }
  readonly events: {
    readonly gmailThread: FakeGmailThreadEvent
    readonly calendarEvent: FakeCalendarEvent
    readonly stripePayment: FakeStripePaymentEvent
  }
}

export async function seedIntegrationEventsScenario(
  opts: ScenarioSeedOptions,
): Promise<IntegrationEventsScenarioResult> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }
  const owner = (await services.users.list(ctx, { limit: 1 })).data[0]
  if (!owner) throw new Error('integration-events scenario requires at least one seeded user')
  const pipeline = (await services.pipelines.list(ctx, { limit: 1 })).data[0]
  if (!pipeline) throw new Error('integration-events scenario requires a seeded pipeline')
  const proposalStage = (await services.stages.list(ctx, {
    limit: 100,
    filter: { pipeline_id: pipeline.id },
  })).data.find((candidate) => candidate.name === 'Proposal')
  if (!proposalStage) throw new Error('integration-events scenario requires Proposal stage')

  const company = await services.companies.create(ctx, {
    name: 'Scenario Integration Events Co',
    domain: 'scenario-integration-events.test',
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  const contact = await services.contacts.create(ctx, {
    name: 'Iris Integration',
    email: 'iris.integration@example.test',
    status: 'customer',
    companyId: company.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  const deal = await services.deals.create(ctx, {
    title: 'Scenario Integration Events Deal',
    value: '18000.00',
    currency: 'USD',
    status: 'open',
    pipelineId: pipeline.id,
    stageId: proposalStage.id,
    companyId: company.id,
    contactId: contact.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })

  return {
    scenario: SCENARIO,
    organizationId: opts.organizationId,
    records: {
      owner: { id: owner.id, label: owner.email },
      company: { id: company.id, label: company.name },
      contact: { id: contact.id, label: contact.email ?? contact.name },
      deal: { id: deal.id, label: deal.title },
    },
    events: {
      gmailThread: {
        provider: 'gmail',
        externalId: 'gmail_thread_scenario_integration_events',
        from: contact.email ?? 'iris.integration@example.test',
        subject: 'Integration event inbound request',
        body: 'Please attach this Gmail thread to the account.',
      },
      calendarEvent: {
        provider: 'google-calendar',
        externalId: 'calendar_event_scenario_integration_events',
        summary: 'Integration event account meeting',
        description: 'Calendar meeting should become a CRM activity.',
      },
      stripePayment: {
        provider: 'stripe',
        externalId: 'pi_scenario_integration_events',
        amount: '18000.00',
      },
    },
  }
}

export async function applyFakeGmailThread(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
  readonly now: number
  readonly event: FakeGmailThreadEvent
}): Promise<{ activity: ActivityRecord; created: boolean }> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const existing = await findActivityByProviderExternalId({
    services,
    organizationId: input.organizationId,
    externalId: input.event.externalId,
  })
  if (existing) return { activity: existing, created: false }
  const contact = (await services.contacts.list(ctx, {
    limit: 10,
    filter: { email: input.event.from },
  })).data[0]
  if (!contact) throw new Error(`No contact for Gmail event ${input.event.externalId}`)
  const activity = await services.activities.create(ctx, {
    type: 'email',
    subject: input.event.subject,
    body: input.event.body,
    direction: 'inbound',
    contactId: contact.id,
    companyId: contact.companyId,
    occurredAt: dateDaysAgo(input.now, 0),
    customFields: eventCustomFields(input.event.provider, input.event.externalId),
  })
  return { activity, created: true }
}

export async function applyFakeCalendarEvent(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
  readonly now: number
  readonly event: FakeCalendarEvent
}): Promise<{ activity: ActivityRecord; created: boolean }> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const existing = await findActivityByProviderExternalId({
    services,
    organizationId: input.organizationId,
    externalId: input.event.externalId,
  })
  if (existing) return { activity: existing, created: false }
  const company = (await services.companies.list(ctx, {
    limit: 10,
    filter: { domain: 'scenario-integration-events.test' },
  })).data[0]
  if (!company) throw new Error(`No company for Calendar event ${input.event.externalId}`)
  const activity = await services.activities.create(ctx, {
    type: 'meeting',
    subject: input.event.summary,
    body: input.event.description,
    direction: 'outbound',
    companyId: company.id,
    occurredAt: dateDaysAgo(input.now, 0),
    customFields: eventCustomFields(input.event.provider, input.event.externalId),
  })
  return { activity, created: true }
}

export async function applyFakeStripePaymentEvent(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
  readonly now: number
  readonly event: FakeStripePaymentEvent
}): Promise<{ payment: PaymentRecord; created: boolean }> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const existing = (await services.payments.list(ctx, {
    limit: 10,
    filter: { external_id: input.event.externalId },
  })).data[0]
  if (existing) return { payment: existing, created: false }
  const deal = (await services.deals.list(ctx, {
    limit: 10,
    filter: { title: 'Scenario Integration Events Deal' },
  })).data[0]
  if (!deal) throw new Error(`No deal for Stripe event ${input.event.externalId}`)
  const payment = await services.payments.create(ctx, {
    amount: input.event.amount,
    currency: 'USD',
    status: 'paid',
    method: 'card',
    paidAt: dateDaysAgo(input.now, 0),
    dealId: deal.id,
    contactId: deal.contactId,
    externalId: input.event.externalId,
    customFields: { scenario: SCENARIO, provider: input.event.provider },
  })
  return { payment, created: true }
}

function eventCustomFields(provider: string, externalId: string): Record<string, string> {
  return {
    scenario: SCENARIO,
    provider,
    [PROVIDER_EXTERNAL_ID_FIELD]: externalId,
  }
}

async function findActivityByProviderExternalId(input: {
  readonly services: ReturnType<typeof createCoreServices>
  readonly organizationId: string
  readonly externalId: string
}): Promise<ActivityRecord | undefined> {
  let cursor: string | undefined
  do {
    const page = await input.services.activities.list(
      { orgId: input.organizationId },
      { limit: 100, ...(cursor ? { cursor } : {}) },
    )
    const match = page.data.find((activity) => (
      activity.customFields?.[PROVIDER_EXTERNAL_ID_FIELD] === input.externalId
    ))
    if (match) return match
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return undefined
}
