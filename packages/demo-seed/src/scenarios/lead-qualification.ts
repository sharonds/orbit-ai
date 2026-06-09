import {
  createCoreServices,
  type ContactRecord,
} from '@orbit-ai/core'
import type { ScenarioRecordRef, ScenarioSeedOptions } from './types.js'
import { dateDaysAgo } from './types.js'

const SCENARIO = 'lead-qualification'
const SCENARIO_TAG = 'scenario:lead-qualification'
const QUALIFIED_EMAILS = [
  'lena.qualification@example.test',
  'marco.enterprise@example.test',
  'no-company-lead@example.test',
] as const

export interface LeadQualificationAnswer {
  readonly qualifiedContactIds: string[]
  readonly missingCompanyContactIds: string[]
}

export interface LeadQualificationScenarioResult {
  readonly scenario: typeof SCENARIO
  readonly organizationId: string
  readonly records: {
    readonly company: ScenarioRecordRef
    readonly owner: ScenarioRecordRef
    readonly hotInboundLead: ScenarioRecordRef
    readonly hotEnterpriseLead: ScenarioRecordRef
    readonly missingCompanyLead: ScenarioRecordRef
    readonly coldImportedLead: ScenarioRecordRef
    readonly scenarioTag: ScenarioRecordRef
    readonly initialFollowUpTask: ScenarioRecordRef
  }
  readonly expected: {
    readonly leadQualification: LeadQualificationAnswer
  }
}

export async function seedLeadQualificationScenario(
  opts: ScenarioSeedOptions,
): Promise<LeadQualificationScenarioResult> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }

  const users = await services.users.list(ctx, { limit: 1 })
  const owner = users.data[0]
  if (!owner) {
    throw new Error('lead-qualification scenario requires at least one seeded user')
  }

  const company = await services.companies.create(ctx, {
    name: 'Scenario Enterprise Labs',
    domain: 'scenario-enterprise.test',
    industry: 'Software',
    size: 1200,
    website: 'https://www.scenario-enterprise.test',
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })

  const hotInboundLead = await services.contacts.create(ctx, {
    name: 'Lena Qualification',
    email: 'lena.qualification@example.test',
    title: 'VP Operations',
    status: 'lead',
    sourceChannel: 'inbound',
    companyId: company.id,
    assignedToUserId: owner.id,
    leadScore: 92,
    isHot: true,
    customFields: { scenario: SCENARIO, qualificationSignal: 'pricing-request' },
  })
  const hotEnterpriseLead = await services.contacts.create(ctx, {
    name: 'Marco Enterprise',
    email: 'marco.enterprise@example.test',
    title: 'Chief Revenue Officer',
    status: 'lead',
    sourceChannel: 'referral',
    companyId: company.id,
    assignedToUserId: owner.id,
    leadScore: 88,
    isHot: true,
    customFields: { scenario: SCENARIO, qualificationSignal: 'buying-committee' },
  })
  const missingCompanyLead = await services.contacts.create(ctx, {
    name: 'No Company Lead',
    email: 'no-company-lead@example.test',
    title: 'Founder',
    status: 'lead',
    sourceChannel: 'web',
    assignedToUserId: owner.id,
    leadScore: 82,
    isHot: true,
    customFields: { scenario: SCENARIO, qualificationSignal: 'demo-request' },
  })
  const coldImportedLead = await services.contacts.create(ctx, {
    name: 'Cold Imported Lead',
    email: 'cold-imported-lead@example.test',
    title: 'Analyst',
    status: 'lead',
    sourceChannel: 'import',
    companyId: company.id,
    assignedToUserId: owner.id,
    leadScore: 12,
    isHot: false,
    customFields: { scenario: SCENARIO, qualificationSignal: 'cold-import' },
  })

  const scenarioTag = await services.tags.create(ctx, {
    name: SCENARIO_TAG,
    color: '#2563eb',
  })
  for (const contact of [hotInboundLead, hotEnterpriseLead, missingCompanyLead, coldImportedLead]) {
    await services.tags.attach(ctx, scenarioTag.id, {
      entityType: 'contacts',
      entityId: contact.id,
    })
  }

  await services.activities.create(ctx, {
    type: 'email',
    subject: 'Inbound qualification request',
    body: 'Prospect asked for pricing and implementation timeline.',
    direction: 'inbound',
    contactId: hotInboundLead.id,
    companyId: company.id,
    occurredAt: dateDaysAgo(opts.now, 1),
    loggedByUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  await services.activities.create(ctx, {
    type: 'email',
    subject: 'Enterprise buying committee',
    body: 'Prospect confirmed budget and decision date.',
    direction: 'inbound',
    contactId: hotEnterpriseLead.id,
    companyId: company.id,
    occurredAt: dateDaysAgo(opts.now, 2),
    loggedByUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })

  const initialFollowUpTask = await services.tasks.create(ctx, {
    title: 'Qualify Lena Qualification',
    description: 'Call back after inbound pricing request.',
    dueDate: dateDaysAgo(opts.now, -1),
    priority: 'high',
    isCompleted: false,
    contactId: hotInboundLead.id,
    companyId: company.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })

  return {
    scenario: SCENARIO,
    organizationId: opts.organizationId,
    records: {
      company: { id: company.id, label: company.name },
      owner: { id: owner.id, label: owner.email },
      hotInboundLead: { id: hotInboundLead.id, label: hotInboundLead.email ?? hotInboundLead.name },
      hotEnterpriseLead: { id: hotEnterpriseLead.id, label: hotEnterpriseLead.email ?? hotEnterpriseLead.name },
      missingCompanyLead: { id: missingCompanyLead.id, label: missingCompanyLead.email ?? missingCompanyLead.name },
      coldImportedLead: { id: coldImportedLead.id, label: coldImportedLead.email ?? coldImportedLead.name },
      scenarioTag: { id: scenarioTag.id, label: scenarioTag.name },
      initialFollowUpTask: { id: initialFollowUpTask.id, label: initialFollowUpTask.title },
    },
    expected: {
      leadQualification: expectedLeadQualificationAnswer([
        hotInboundLead,
        hotEnterpriseLead,
        missingCompanyLead,
      ]),
    },
  }
}

export function expectedLeadQualificationAnswer(
  contacts: readonly ContactRecord[],
): LeadQualificationAnswer {
  return {
    qualifiedContactIds: contacts.map((contact) => contact.id),
    missingCompanyContactIds: contacts
      .filter((contact) => contact.companyId === null)
      .map((contact) => contact.id),
  }
}

export async function answerLeadQualificationQuestion(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
}): Promise<LeadQualificationAnswer> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const contacts: ContactRecord[] = []
  let cursor: string | undefined
  do {
    const page = await services.contacts.list(ctx, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
      filter: { status: 'lead' },
      sort: [{ field: 'created_at', direction: 'asc' }],
    })
    contacts.push(...page.data)
    cursor = page.nextCursor ?? undefined
  } while (cursor)

  const scenarioContacts = contacts
    .filter(
      (contact) =>
        contact.customFields.scenario === SCENARIO &&
        contact.email !== null &&
        QUALIFIED_EMAILS.includes(contact.email as (typeof QUALIFIED_EMAILS)[number]) &&
        contact.isHot === true &&
        contact.leadScore >= 80,
    )
    .sort((a, b) => {
      const aIndex = QUALIFIED_EMAILS.indexOf(a.email as (typeof QUALIFIED_EMAILS)[number])
      const bIndex = QUALIFIED_EMAILS.indexOf(b.email as (typeof QUALIFIED_EMAILS)[number])
      return aIndex - bIndex
    })

  return expectedLeadQualificationAnswer(scenarioContacts)
}
