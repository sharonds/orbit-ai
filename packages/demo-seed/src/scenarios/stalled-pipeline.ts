import {
  createCoreServices,
  type DealRecord,
  type StageRecord,
} from '@orbit-ai/core'
import type { ScenarioRecordRef, ScenarioSeedOptions } from './types.js'
import { dateDaysAgo } from './types.js'

const SCENARIO = 'stalled-pipeline'
const SCENARIO_TAG = 'scenario:stalled-pipeline'
const HIGH_VALUE_THRESHOLD = 50_000
const STALLED_DAYS = 14

export interface StalledPipelineAnswer {
  readonly stalledDealIds: string[]
  readonly highValueNoTaskDealIds: string[]
}

export interface StalledPipelineScenarioResult {
  readonly scenario: typeof SCENARIO
  readonly organizationId: string
  readonly records: {
    readonly company: ScenarioRecordRef
    readonly owner: ScenarioRecordRef
    readonly contact: ScenarioRecordRef
    readonly pipeline: ScenarioRecordRef
    readonly prospectingStage: ScenarioRecordRef
    readonly qualificationStage: ScenarioRecordRef
    readonly proposalStage: ScenarioRecordRef
    readonly closedWonStage: ScenarioRecordRef
    readonly stalledProspectingDeal: ScenarioRecordRef
    readonly stalledQualificationDeal: ScenarioRecordRef
    readonly highValueProposalDeal: ScenarioRecordRef
    readonly closedWonControlDeal: ScenarioRecordRef
    readonly activeRecentDeal: ScenarioRecordRef
    readonly scenarioTag: ScenarioRecordRef
  }
  readonly expected: {
    readonly stalledPipeline: StalledPipelineAnswer
  }
}

export async function seedStalledPipelineScenario(
  opts: ScenarioSeedOptions,
): Promise<StalledPipelineScenarioResult> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }

  const users = await services.users.list(ctx, { limit: 1 })
  const owner = users.data[0]
  if (!owner) {
    throw new Error('stalled-pipeline scenario requires at least one seeded user')
  }

  const pipelines = await services.pipelines.list(ctx, { limit: 1 })
  const pipeline = pipelines.data[0]
  if (!pipeline) {
    throw new Error('stalled-pipeline scenario requires a seeded pipeline')
  }
  const stages = await listStagesForPipeline(opts, pipeline.id)
  const prospectingStage = requireStage(stages, 'Prospecting')
  const qualificationStage = requireStage(stages, 'Qualification')
  const proposalStage = requireStage(stages, 'Proposal')
  const closedWonStage = requireStage(stages, 'Closed Won')

  const company = await services.companies.create(ctx, {
    name: 'Scenario Pipeline Review Co',
    domain: 'scenario-pipeline-review.test',
    industry: 'Consulting',
    size: 350,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })
  const contact = await services.contacts.create(ctx, {
    name: 'Priya Pipeline',
    email: 'priya.pipeline@example.test',
    title: 'Head of Revenue',
    status: 'lead',
    companyId: company.id,
    assignedToUserId: owner.id,
    leadScore: 76,
    isHot: true,
    customFields: { scenario: SCENARIO },
  })

  const stalledProspectingDeal = await createScenarioDeal(opts, {
    title: 'Scenario Stalled Prospecting',
    value: '18000.00',
    stageId: prospectingStage.id,
    pipelineId: pipeline.id,
    contactId: contact.id,
    companyId: company.id,
    assignedToUserId: owner.id,
    status: 'open',
    lastActivityDaysAgo: 21,
  })
  const stalledQualificationDeal = await createScenarioDeal(opts, {
    title: 'Scenario Stalled Qualification',
    value: '27000.00',
    stageId: qualificationStage.id,
    pipelineId: pipeline.id,
    contactId: contact.id,
    companyId: company.id,
    assignedToUserId: owner.id,
    status: 'open',
    lastActivityDaysAgo: 18,
  })
  const highValueProposalDeal = await createScenarioDeal(opts, {
    title: 'Scenario High Value Proposal',
    value: '75000.00',
    stageId: proposalStage.id,
    pipelineId: pipeline.id,
    contactId: contact.id,
    companyId: company.id,
    assignedToUserId: owner.id,
    status: 'open',
    lastActivityDaysAgo: 16,
  })
  const closedWonControlDeal = await createScenarioDeal(opts, {
    title: 'Scenario Closed Won Control',
    value: '90000.00',
    stageId: closedWonStage.id,
    pipelineId: pipeline.id,
    contactId: contact.id,
    companyId: company.id,
    assignedToUserId: owner.id,
    status: 'won',
    lastActivityDaysAgo: 30,
  })
  const activeRecentDeal = await createScenarioDeal(opts, {
    title: 'Scenario Active Recent Deal',
    value: '62000.00',
    stageId: proposalStage.id,
    pipelineId: pipeline.id,
    contactId: contact.id,
    companyId: company.id,
    assignedToUserId: owner.id,
    status: 'open',
    lastActivityDaysAgo: 2,
  })

  await services.tasks.create(ctx, {
    title: 'Keep active recent deal moving',
    dealId: activeRecentDeal.id,
    companyId: company.id,
    contactId: contact.id,
    assignedToUserId: owner.id,
    priority: 'medium',
    isCompleted: false,
    customFields: { scenario: SCENARIO },
  })

  const scenarioTag = await services.tags.create(ctx, {
    name: SCENARIO_TAG,
    color: '#dc2626',
  })
  for (const deal of [
    stalledProspectingDeal,
    stalledQualificationDeal,
    highValueProposalDeal,
    closedWonControlDeal,
    activeRecentDeal,
  ]) {
    await services.tags.attach(ctx, scenarioTag.id, {
      entityType: 'deals',
      entityId: deal.id,
    })
  }

  return {
    scenario: SCENARIO,
    organizationId: opts.organizationId,
    records: {
      company: { id: company.id, label: company.name },
      owner: { id: owner.id, label: owner.email },
      contact: { id: contact.id, label: contact.email ?? contact.name },
      pipeline: { id: pipeline.id, label: pipeline.name },
      prospectingStage: { id: prospectingStage.id, label: prospectingStage.name },
      qualificationStage: { id: qualificationStage.id, label: qualificationStage.name },
      proposalStage: { id: proposalStage.id, label: proposalStage.name },
      closedWonStage: { id: closedWonStage.id, label: closedWonStage.name },
      stalledProspectingDeal: { id: stalledProspectingDeal.id, label: stalledProspectingDeal.title },
      stalledQualificationDeal: { id: stalledQualificationDeal.id, label: stalledQualificationDeal.title },
      highValueProposalDeal: { id: highValueProposalDeal.id, label: highValueProposalDeal.title },
      closedWonControlDeal: { id: closedWonControlDeal.id, label: closedWonControlDeal.title },
      activeRecentDeal: { id: activeRecentDeal.id, label: activeRecentDeal.title },
      scenarioTag: { id: scenarioTag.id, label: scenarioTag.name },
    },
    expected: {
      stalledPipeline: {
        stalledDealIds: [
          stalledProspectingDeal.id,
          stalledQualificationDeal.id,
          highValueProposalDeal.id,
        ],
        highValueNoTaskDealIds: [highValueProposalDeal.id],
      },
    },
  }
}

async function createScenarioDeal(
  opts: ScenarioSeedOptions,
  input: {
    readonly title: string
    readonly value: string
    readonly stageId: string
    readonly pipelineId: string
    readonly contactId: string
    readonly companyId: string
    readonly assignedToUserId: string
    readonly status: string
    readonly lastActivityDaysAgo: number
  },
): Promise<DealRecord> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }
  const deal = await services.deals.create(ctx, {
    title: input.title,
    value: input.value,
    currency: 'USD',
    stageId: input.stageId,
    pipelineId: input.pipelineId,
    contactId: input.contactId,
    companyId: input.companyId,
    assignedToUserId: input.assignedToUserId,
    status: input.status,
    customFields: { scenario: SCENARIO },
  })
  await services.activities.create(ctx, {
    type: 'call',
    subject: `${input.title} last touch`,
    body: 'Synthetic last activity for stalled pipeline scenario.',
    direction: 'outbound',
    dealId: deal.id,
    contactId: input.contactId,
    companyId: input.companyId,
    loggedByUserId: input.assignedToUserId,
    occurredAt: dateDaysAgo(opts.now, input.lastActivityDaysAgo),
    customFields: { scenario: SCENARIO },
  })
  return deal
}

export async function answerStalledPipelineQuestion(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
  readonly now: number
}): Promise<StalledPipelineAnswer> {
  const deals = await listScenarioDeals(input)
  const stalledDealIds: string[] = []
  const highValueNoTaskDealIds: string[] = []

  for (const deal of deals) {
    if (deal.status !== 'open') continue

    const lastActivity = await latestActivityForDeal(input, deal.id)
    const daysSinceLastActivity = lastActivity
      ? Math.floor((input.now - lastActivity.getTime()) / 86_400_000)
      : Number.POSITIVE_INFINITY
    if (daysSinceLastActivity >= STALLED_DAYS) {
      stalledDealIds.push(deal.id)
    }

    const hasOpenTask = await hasOpenTaskForDeal(input, deal.id)
    const value = deal.value === null ? 0 : Number(deal.value)
    if (value >= HIGH_VALUE_THRESHOLD && !hasOpenTask) {
      highValueNoTaskDealIds.push(deal.id)
    }
  }

  return {
    stalledDealIds: sortByScenarioOrder(stalledDealIds, deals),
    highValueNoTaskDealIds: sortByScenarioOrder(highValueNoTaskDealIds, deals),
  }
}

async function listScenarioDeals(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
}): Promise<DealRecord[]> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const deals: DealRecord[] = []
  let cursor: string | undefined
  do {
    const page = await services.deals.list(ctx, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    })
    deals.push(...page.data.filter((deal) => deal.customFields.scenario === SCENARIO))
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return deals
}

async function latestActivityForDeal(
  input: { readonly adapter: ScenarioSeedOptions['adapter']; readonly organizationId: string },
  dealId: string,
): Promise<Date | null> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const activityDates: Date[] = []
  let cursor: string | undefined
  do {
    const page = await services.activities.list(ctx, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
      filter: { deal_id: dealId },
    })
    activityDates.push(...page.data.map((activity) => activity.occurredAt))
    cursor = page.nextCursor ?? undefined
  } while (cursor)

  const latest = activityDates.sort((a, b) => b.getTime() - a.getTime())[0]
  return latest ?? null
}

async function hasOpenTaskForDeal(
  input: { readonly adapter: ScenarioSeedOptions['adapter']; readonly organizationId: string },
  dealId: string,
): Promise<boolean> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  let cursor: string | undefined
  do {
    const page = await services.tasks.list(ctx, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
      filter: { deal_id: dealId },
    })
    if (page.data.some((task) => task.isCompleted === false)) return true
    cursor = page.nextCursor ?? undefined
  } while (cursor)

  return false
}

async function listStagesForPipeline(
  opts: ScenarioSeedOptions,
  pipelineId: string,
): Promise<StageRecord[]> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }
  const page = await services.stages.list(ctx, {
    limit: 100,
    filter: { pipeline_id: pipelineId },
  })
  return page.data
}

function requireStage(stages: readonly StageRecord[], name: string): StageRecord {
  const stage = stages.find((candidate) => candidate.name === name)
  if (!stage) throw new Error(`stalled-pipeline scenario requires stage '${name}'`)
  return stage
}

function sortByScenarioOrder(ids: readonly string[], deals: readonly DealRecord[]): string[] {
  const order = [
    'Scenario Stalled Prospecting',
    'Scenario Stalled Qualification',
    'Scenario High Value Proposal',
    'Scenario Closed Won Control',
    'Scenario Active Recent Deal',
  ]
  const dealById = new Map(deals.map((deal) => [deal.id, deal]))
  return [...ids].sort((a, b) => {
    const aTitle = dealById.get(a)?.title ?? ''
    const bTitle = dealById.get(b)?.title ?? ''
    return order.indexOf(aTitle) - order.indexOf(bTitle)
  })
}
