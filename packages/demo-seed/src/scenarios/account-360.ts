import {
  createCoreServices,
  type ActivityRecord,
  type CompanyRecord,
  type ContactRecord,
  type DealRecord,
  type NoteRecord,
} from '@orbit-ai/core'
import type { ScenarioRecordRef, ScenarioSeedOptions } from './types.js'
import { dateDaysAgo } from './types.js'

type Account360TaskRecord = Awaited<ReturnType<ReturnType<typeof createCoreServices>['tasks']['create']>>

const SCENARIO = 'account-360'
const SCENARIO_TAG = 'scenario:account-360'

const CONTACT_EMAIL_ORDER = [
  'ava.account360@example.test',
  'noah.account360@example.test',
  'mia.account360@example.test',
] as const
const OPEN_DEAL_ORDER = [
  'Scenario Account 360 Platform Expansion',
  'Scenario Account 360 Services Pilot',
] as const
const ACTIVITY_ORDER = [
  'Executive renewal meeting',
  'Security review follow-up',
  'Implementation health check',
] as const
const NOTE_ORDER = [
  'Account 360 summary note',
  'Account 360 risk note',
] as const
const OPEN_TASK_ORDER = [
  'Prepare Account 360 executive brief',
  'Resolve Account 360 security questionnaire',
] as const

export interface Account360Answer {
  readonly companyId: string
  readonly contactIds: string[]
  readonly openDealIds: string[]
  readonly activityIds: string[]
  readonly noteIds: string[]
  readonly openTaskIds: string[]
  readonly dataQualityIssues: string[]
}

export interface Account360ScenarioResult {
  readonly scenario: typeof SCENARIO
  readonly organizationId: string
  readonly records: {
    readonly company: ScenarioRecordRef
    readonly owner: ScenarioRecordRef
    readonly executiveContact: ScenarioRecordRef
    readonly technicalContact: ScenarioRecordRef
    readonly financeContact: ScenarioRecordRef
    readonly expansionDeal: ScenarioRecordRef
    readonly servicesDeal: ScenarioRecordRef
    readonly closedWonControlDeal: ScenarioRecordRef
    readonly executiveMeetingActivity: ScenarioRecordRef
    readonly securityActivity: ScenarioRecordRef
    readonly healthCheckActivity: ScenarioRecordRef
    readonly summaryNote: ScenarioRecordRef
    readonly riskNote: ScenarioRecordRef
    readonly executiveBriefTask: ScenarioRecordRef
    readonly securityTask: ScenarioRecordRef
    readonly completedControlTask: ScenarioRecordRef
    readonly scenarioTag: ScenarioRecordRef
  }
  readonly expected: {
    readonly account360: Account360Answer
  }
}

export async function seedAccount360Scenario(
  opts: ScenarioSeedOptions,
): Promise<Account360ScenarioResult> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }

  const users = await services.users.list(ctx, { limit: 1 })
  const owner = users.data[0]
  if (!owner) {
    throw new Error('account-360 scenario requires at least one seeded user')
  }

  const pipelines = await services.pipelines.list(ctx, { limit: 1 })
  const pipeline = pipelines.data[0]
  if (!pipeline) {
    throw new Error('account-360 scenario requires a seeded pipeline')
  }
  const stages = await services.stages.list(ctx, {
    limit: 100,
    filter: { pipeline_id: pipeline.id },
  })
  const qualificationStage = requireStage(stages.data, 'Qualification')
  const proposalStage = requireStage(stages.data, 'Proposal')
  const closedWonStage = requireStage(stages.data, 'Closed Won')

  const company = await services.companies.create(ctx, {
    name: 'Scenario Account 360 Corp',
    domain: 'scenario-account-360.test',
    industry: 'Manufacturing',
    size: 900,
    website: 'https://www.scenario-account-360.test',
    assignedToUserId: owner.id,
    notes: 'Strategic account for account 360 business E2E.',
    customFields: { scenario: SCENARIO, segment: 'strategic' },
  })

  const executiveContact = await services.contacts.create(ctx, {
    name: 'Ava Account360',
    email: 'ava.account360@example.test',
    title: 'Chief Operating Officer',
    status: 'customer',
    companyId: company.id,
    assignedToUserId: owner.id,
    leadScore: 91,
    isHot: true,
    lastContactedAt: dateDaysAgo(opts.now, 1),
    customFields: { scenario: SCENARIO, role: 'executive-sponsor' },
  })
  const technicalContact = await services.contacts.create(ctx, {
    name: 'Noah Account360',
    email: 'noah.account360@example.test',
    title: 'VP Engineering',
    status: 'customer',
    companyId: company.id,
    assignedToUserId: owner.id,
    leadScore: 86,
    isHot: true,
    lastContactedAt: dateDaysAgo(opts.now, 2),
    customFields: { scenario: SCENARIO, role: 'technical-buyer' },
  })
  const financeContact = await services.contacts.create(ctx, {
    name: 'Mia Account360',
    email: 'mia.account360@example.test',
    title: 'Director of Finance',
    status: 'customer',
    companyId: company.id,
    assignedToUserId: owner.id,
    leadScore: 73,
    isHot: false,
    customFields: { scenario: SCENARIO, role: 'economic-buyer' },
  })

  const expansionDeal = await services.deals.create(ctx, {
    title: 'Scenario Account 360 Platform Expansion',
    value: '125000.00',
    currency: 'USD',
    pipelineId: pipeline.id,
    stageId: proposalStage.id,
    companyId: company.id,
    contactId: executiveContact.id,
    assignedToUserId: owner.id,
    status: 'open',
    expectedCloseDate: dateDaysAgo(opts.now, -30),
    customFields: { scenario: SCENARIO, revenueMotion: 'expansion' },
  })
  const servicesDeal = await services.deals.create(ctx, {
    title: 'Scenario Account 360 Services Pilot',
    value: '24000.00',
    currency: 'USD',
    pipelineId: pipeline.id,
    stageId: qualificationStage.id,
    companyId: company.id,
    contactId: technicalContact.id,
    assignedToUserId: owner.id,
    status: 'open',
    expectedCloseDate: dateDaysAgo(opts.now, -45),
    customFields: { scenario: SCENARIO, revenueMotion: 'services' },
  })
  const closedWonControlDeal = await services.deals.create(ctx, {
    title: 'Scenario Account 360 Closed Won Control',
    value: '80000.00',
    currency: 'USD',
    pipelineId: pipeline.id,
    stageId: closedWonStage.id,
    companyId: company.id,
    contactId: financeContact.id,
    assignedToUserId: owner.id,
    status: 'won',
    wonAt: dateDaysAgo(opts.now, 90),
    customFields: { scenario: SCENARIO, revenueMotion: 'historical' },
  })

  const executiveMeetingActivity = await services.activities.create(ctx, {
    type: 'meeting',
    subject: 'Executive renewal meeting',
    body: 'COO confirmed expansion interest and timeline.',
    direction: 'outbound',
    contactId: executiveContact.id,
    companyId: company.id,
    dealId: expansionDeal.id,
    loggedByUserId: owner.id,
    occurredAt: dateDaysAgo(opts.now, 1),
    customFields: { scenario: SCENARIO },
  })
  const securityActivity = await services.activities.create(ctx, {
    type: 'email',
    subject: 'Security review follow-up',
    body: 'Engineering requested updated security questionnaire.',
    direction: 'inbound',
    contactId: technicalContact.id,
    companyId: company.id,
    dealId: servicesDeal.id,
    loggedByUserId: owner.id,
    occurredAt: dateDaysAgo(opts.now, 3),
    customFields: { scenario: SCENARIO },
  })
  const healthCheckActivity = await services.activities.create(ctx, {
    type: 'call',
    subject: 'Implementation health check',
    body: 'Customer success logged positive implementation feedback.',
    direction: 'outbound',
    contactId: financeContact.id,
    companyId: company.id,
    loggedByUserId: owner.id,
    occurredAt: dateDaysAgo(opts.now, 7),
    customFields: { scenario: SCENARIO },
  })

  const summaryNote = await services.notes.create(ctx, {
    content: 'Account 360 summary note: strategic expansion candidate with executive sponsorship.',
    companyId: company.id,
    contactId: executiveContact.id,
    dealId: expansionDeal.id,
    createdByUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  const riskNote = await services.notes.create(ctx, {
    content: 'Account 360 risk note: security questionnaire must be resolved before procurement.',
    companyId: company.id,
    contactId: technicalContact.id,
    dealId: servicesDeal.id,
    createdByUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })

  const executiveBriefTask = await services.tasks.create(ctx, {
    title: 'Prepare Account 360 executive brief',
    description: 'Summarize expansion opportunity before renewal meeting.',
    dueDate: dateDaysAgo(opts.now, -2),
    priority: 'high',
    isCompleted: false,
    companyId: company.id,
    contactId: executiveContact.id,
    dealId: expansionDeal.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  const securityTask = await services.tasks.create(ctx, {
    title: 'Resolve Account 360 security questionnaire',
    description: 'Send completed questionnaire to engineering buyer.',
    dueDate: dateDaysAgo(opts.now, -5),
    priority: 'high',
    isCompleted: false,
    companyId: company.id,
    contactId: technicalContact.id,
    dealId: servicesDeal.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  const completedControlTask = await services.tasks.create(ctx, {
    title: 'Completed Account 360 billing check',
    priority: 'low',
    isCompleted: true,
    companyId: company.id,
    contactId: financeContact.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })

  const scenarioTag = await services.tags.create(ctx, {
    name: SCENARIO_TAG,
    color: '#16a34a',
  })
  for (const entity of [
    { entityType: 'companies', entityId: company.id },
    { entityType: 'contacts', entityId: executiveContact.id },
    { entityType: 'contacts', entityId: technicalContact.id },
    { entityType: 'contacts', entityId: financeContact.id },
    { entityType: 'deals', entityId: expansionDeal.id },
    { entityType: 'deals', entityId: servicesDeal.id },
    { entityType: 'deals', entityId: closedWonControlDeal.id },
  ]) {
    await services.tags.attach(ctx, scenarioTag.id, entity)
  }

  return {
    scenario: SCENARIO,
    organizationId: opts.organizationId,
    records: {
      company: { id: company.id, label: company.name },
      owner: { id: owner.id, label: owner.email },
      executiveContact: { id: executiveContact.id, label: executiveContact.email ?? executiveContact.name },
      technicalContact: { id: technicalContact.id, label: technicalContact.email ?? technicalContact.name },
      financeContact: { id: financeContact.id, label: financeContact.email ?? financeContact.name },
      expansionDeal: { id: expansionDeal.id, label: expansionDeal.title },
      servicesDeal: { id: servicesDeal.id, label: servicesDeal.title },
      closedWonControlDeal: { id: closedWonControlDeal.id, label: closedWonControlDeal.title },
      executiveMeetingActivity: { id: executiveMeetingActivity.id, label: executiveMeetingActivity.subject ?? executiveMeetingActivity.type },
      securityActivity: { id: securityActivity.id, label: securityActivity.subject ?? securityActivity.type },
      healthCheckActivity: { id: healthCheckActivity.id, label: healthCheckActivity.subject ?? healthCheckActivity.type },
      summaryNote: { id: summaryNote.id, label: 'Account 360 summary note' },
      riskNote: { id: riskNote.id, label: 'Account 360 risk note' },
      executiveBriefTask: { id: executiveBriefTask.id, label: executiveBriefTask.title },
      securityTask: { id: securityTask.id, label: securityTask.title },
      completedControlTask: { id: completedControlTask.id, label: completedControlTask.title },
      scenarioTag: { id: scenarioTag.id, label: scenarioTag.name },
    },
    expected: {
      account360: expectedAccount360Answer({
        company,
        contacts: [executiveContact, technicalContact, financeContact],
        deals: [expansionDeal, servicesDeal, closedWonControlDeal],
        activities: [executiveMeetingActivity, securityActivity, healthCheckActivity],
        notes: [summaryNote, riskNote],
        tasks: [executiveBriefTask, securityTask, completedControlTask],
      }),
    },
  }
}

export function expectedAccount360Answer(input: {
  readonly company: CompanyRecord
  readonly contacts: readonly ContactRecord[]
  readonly deals: readonly DealRecord[]
  readonly activities: readonly ActivityRecord[]
  readonly notes: readonly NoteRecord[]
  readonly tasks: readonly Account360TaskRecord[]
}): Account360Answer {
  const openTasks = input.tasks.filter((task) => task.isCompleted === false)
  return {
    companyId: input.company.id,
    contactIds: sortContacts(input.contacts).map((contact) => contact.id),
    openDealIds: sortDeals(input.deals.filter((deal) => deal.status === 'open')).map((deal) => deal.id),
    activityIds: sortActivities(input.activities).map((activity) => activity.id),
    noteIds: sortNotes(input.notes).map((note) => note.id),
    openTaskIds: sortTasks(openTasks).map((task) => task.id),
    dataQualityIssues: openTasks.length === 0 ? ['no-open-follow-up-task'] : [],
  }
}

export async function answerAccount360Question(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
}): Promise<Account360Answer> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const company = (await listAll(services.companies, ctx))
    .find((candidate) => candidate.customFields.scenario === SCENARIO)

  if (!company) {
    return {
      companyId: '',
      contactIds: [],
      openDealIds: [],
      activityIds: [],
      noteIds: [],
      openTaskIds: [],
      dataQualityIssues: ['scenario-company-not-found'],
    }
  }

  const contacts = await listAll(services.contacts, ctx)
  const deals = await listAll(services.deals, ctx)
  const activities = await listAll(services.activities, ctx)
  const notes = await listAll(services.notes, ctx)
  const tasks = await listAll(services.tasks, ctx)

  return expectedAccount360Answer({
    company,
    contacts: contacts.filter((contact) => contact.companyId === company.id && contact.customFields.scenario === SCENARIO),
    deals: deals.filter((deal) => deal.companyId === company.id && deal.customFields.scenario === SCENARIO),
    activities: activities.filter((activity) => activity.companyId === company.id && activity.customFields.scenario === SCENARIO),
    notes: notes.filter((note) => note.companyId === company.id && note.customFields.scenario === SCENARIO),
    tasks: tasks.filter((task) => task.companyId === company.id && task.customFields.scenario === SCENARIO),
  })
}

async function listAll<T extends { id: string }>(
  service: {
    list(
      ctx: { orgId: string },
      query: { limit: number; cursor?: string },
    ): Promise<{ data: T[]; nextCursor: string | null }>
  },
  ctx: { orgId: string },
): Promise<T[]> {
  const records: T[] = []
  let cursor: string | undefined
  do {
    const page = await service.list(ctx, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    })
    records.push(...page.data)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return records
}

function requireStage(stages: readonly { name: string }[], name: string): { id: string; name: string } {
  const stage = stages.find((candidate): candidate is { id: string; name: string } => candidate.name === name)
  if (!stage) throw new Error(`account-360 scenario requires stage '${name}'`)
  return stage
}

function sortContacts(contacts: readonly ContactRecord[]): ContactRecord[] {
  return [...contacts].sort((a, b) => {
    const aIndex = CONTACT_EMAIL_ORDER.indexOf(a.email as (typeof CONTACT_EMAIL_ORDER)[number])
    const bIndex = CONTACT_EMAIL_ORDER.indexOf(b.email as (typeof CONTACT_EMAIL_ORDER)[number])
    return aIndex - bIndex
  })
}

function sortDeals(deals: readonly DealRecord[]): DealRecord[] {
  return [...deals].sort((a, b) => OPEN_DEAL_ORDER.indexOf(a.title as (typeof OPEN_DEAL_ORDER)[number]) - OPEN_DEAL_ORDER.indexOf(b.title as (typeof OPEN_DEAL_ORDER)[number]))
}

function sortActivities(activities: readonly ActivityRecord[]): ActivityRecord[] {
  return [...activities].sort((a, b) => ACTIVITY_ORDER.indexOf(a.subject as (typeof ACTIVITY_ORDER)[number]) - ACTIVITY_ORDER.indexOf(b.subject as (typeof ACTIVITY_ORDER)[number]))
}

function sortNotes(notes: readonly NoteRecord[]): NoteRecord[] {
  return [...notes].sort((a, b) => NOTE_ORDER.findIndex((label) => a.content.startsWith(label)) - NOTE_ORDER.findIndex((label) => b.content.startsWith(label)))
}

function sortTasks(tasks: readonly Account360TaskRecord[]): Account360TaskRecord[] {
  return [...tasks].sort((a, b) => OPEN_TASK_ORDER.indexOf(a.title as (typeof OPEN_TASK_ORDER)[number]) - OPEN_TASK_ORDER.indexOf(b.title as (typeof OPEN_TASK_ORDER)[number]))
}
