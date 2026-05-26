import {
  createCoreServices,
  type ActivityRecord,
  type CompanyRecord,
  type DealRecord,
} from '@orbit-ai/core'
import type { ScenarioRecordRef, ScenarioSeedOptions } from './types.js'
import { dateDaysAgo } from './types.js'

type RenewalContractRecord = Awaited<ReturnType<ReturnType<typeof createCoreServices>['contracts']['create']>>
type RenewalPaymentRecord = Awaited<ReturnType<ReturnType<typeof createCoreServices>['payments']['create']>>

const SCENARIO = 'renewal-expansion'
const SCENARIO_TAG = 'scenario:renewal-expansion'
const CANDIDATE_COMPANY_ORDER = ['Scenario Renewal Candidate Co'] as const
const EXPANSION_DEAL_ORDER = ['Scenario Renewal Platform Expansion'] as const
const CONTRACT_ORDER = ['Scenario Renewal Candidate Contract'] as const
const PAYMENT_ORDER = ['pi_scenario_renewal_paid'] as const

export interface RenewalExpansionAnswer {
  readonly candidateCompanyIds: string[]
  readonly expansionDealIds: string[]
  readonly contractIds: string[]
  readonly paymentIds: string[]
  readonly dormantControlCompanyIds: string[]
  readonly dataQualityIssues: string[]
}

export interface RenewalExpansionScenarioResult {
  readonly scenario: typeof SCENARIO
  readonly organizationId: string
  readonly records: {
    readonly owner: ScenarioRecordRef
    readonly candidateCompany: ScenarioRecordRef
    readonly dormantControlCompany: ScenarioRecordRef
    readonly championContact: ScenarioRecordRef
    readonly dormantContact: ScenarioRecordRef
    readonly historicalWonDeal: ScenarioRecordRef
    readonly expansionDeal: ScenarioRecordRef
    readonly dormantClosedWonDeal: ScenarioRecordRef
    readonly recentPositiveActivity: ScenarioRecordRef
    readonly dormantOldActivity: ScenarioRecordRef
    readonly signedContract: ScenarioRecordRef
    readonly paidPayment: ScenarioRecordRef
    readonly followUpTask: ScenarioRecordRef
    readonly scenarioTag: ScenarioRecordRef
  }
  readonly expected: {
    readonly renewalExpansion: RenewalExpansionAnswer
  }
}

export async function seedRenewalExpansionScenario(
  opts: ScenarioSeedOptions,
): Promise<RenewalExpansionScenarioResult> {
  const services = createCoreServices(opts.adapter)
  const ctx = { orgId: opts.organizationId }

  const users = await services.users.list(ctx, { limit: 1 })
  const owner = users.data[0]
  if (!owner) throw new Error('renewal-expansion scenario requires at least one seeded user')

  const pipelines = await services.pipelines.list(ctx, { limit: 1 })
  const pipeline = pipelines.data[0]
  if (!pipeline) throw new Error('renewal-expansion scenario requires a seeded pipeline')
  const stages = await services.stages.list(ctx, {
    limit: 100,
    filter: { pipeline_id: pipeline.id },
  })
  const proposalStage = requireStage(stages.data, 'Proposal')
  const closedWonStage = requireStage(stages.data, 'Closed Won')

  const candidateCompany = await services.companies.create(ctx, {
    name: 'Scenario Renewal Candidate Co',
    domain: 'scenario-renewal-candidate.test',
    industry: 'Healthcare',
    size: 650,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO, renewalSegment: 'candidate' },
  })
  const dormantControlCompany = await services.companies.create(ctx, {
    name: 'Scenario Dormant Renewal Control',
    domain: 'scenario-dormant-renewal.test',
    industry: 'Retail',
    size: 220,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO, renewalSegment: 'dormant-control' },
  })

  const championContact = await services.contacts.create(ctx, {
    name: 'Riley Renewal',
    email: 'riley.renewal@example.test',
    title: 'VP Customer Operations',
    status: 'customer',
    companyId: candidateCompany.id,
    assignedToUserId: owner.id,
    leadScore: 89,
    isHot: true,
    lastContactedAt: dateDaysAgo(opts.now, 2),
    customFields: { scenario: SCENARIO, role: 'renewal-champion' },
  })
  const dormantContact = await services.contacts.create(ctx, {
    name: 'Dana Dormant',
    email: 'dana.dormant-renewal@example.test',
    title: 'Operations Manager',
    status: 'customer',
    companyId: dormantControlCompany.id,
    assignedToUserId: owner.id,
    leadScore: 40,
    isHot: false,
    lastContactedAt: dateDaysAgo(opts.now, 90),
    customFields: { scenario: SCENARIO, role: 'dormant-control' },
  })

  const historicalWonDeal = await services.deals.create(ctx, {
    title: 'Scenario Renewal Original Subscription',
    value: '96000.00',
    currency: 'USD',
    pipelineId: pipeline.id,
    stageId: closedWonStage.id,
    companyId: candidateCompany.id,
    contactId: championContact.id,
    assignedToUserId: owner.id,
    status: 'won',
    wonAt: dateDaysAgo(opts.now, 330),
    customFields: { scenario: SCENARIO, motion: 'original-subscription' },
  })
  const expansionDeal = await services.deals.create(ctx, {
    title: 'Scenario Renewal Platform Expansion',
    value: '58000.00',
    currency: 'USD',
    pipelineId: pipeline.id,
    stageId: proposalStage.id,
    companyId: candidateCompany.id,
    contactId: championContact.id,
    assignedToUserId: owner.id,
    status: 'open',
    expectedCloseDate: dateDaysAgo(opts.now, -25),
    customFields: { scenario: SCENARIO, motion: 'expansion' },
  })
  const dormantClosedWonDeal = await services.deals.create(ctx, {
    title: 'Scenario Dormant Closed Won Control',
    value: '42000.00',
    currency: 'USD',
    pipelineId: pipeline.id,
    stageId: closedWonStage.id,
    companyId: dormantControlCompany.id,
    contactId: dormantContact.id,
    assignedToUserId: owner.id,
    status: 'won',
    wonAt: dateDaysAgo(opts.now, 420),
    customFields: { scenario: SCENARIO, motion: 'dormant-control' },
  })

  const recentPositiveActivity = await services.activities.create(ctx, {
    type: 'meeting',
    subject: 'Renewal expansion success meeting',
    body: 'Champion confirmed positive outcomes and expansion budget.',
    direction: 'outbound',
    companyId: candidateCompany.id,
    contactId: championContact.id,
    dealId: expansionDeal.id,
    loggedByUserId: owner.id,
    occurredAt: dateDaysAgo(opts.now, 3),
    customFields: { scenario: SCENARIO, sentiment: 'positive' },
  })
  const dormantOldActivity = await services.activities.create(ctx, {
    type: 'email',
    subject: 'Dormant renewal control old touch',
    body: 'Old check-in with no current renewal signal.',
    direction: 'outbound',
    companyId: dormantControlCompany.id,
    contactId: dormantContact.id,
    dealId: dormantClosedWonDeal.id,
    loggedByUserId: owner.id,
    occurredAt: dateDaysAgo(opts.now, 90),
    customFields: { scenario: SCENARIO, sentiment: 'stale' },
  })

  const signedContract = await services.contracts.create(ctx, {
    title: 'Scenario Renewal Candidate Contract',
    content: 'Synthetic annual contract for renewal-expansion scenario.',
    status: 'signed',
    signedAt: dateDaysAgo(opts.now, 330),
    expiresAt: dateDaysAgo(opts.now, -35),
    companyId: candidateCompany.id,
    contactId: championContact.id,
    dealId: historicalWonDeal.id,
    externalSignatureId: 'sig_scenario_renewal_candidate',
    customFields: { scenario: SCENARIO },
  })
  const paidPayment = await services.payments.create(ctx, {
    amount: '96000.00',
    currency: 'USD',
    status: 'paid',
    method: 'card',
    paidAt: dateDaysAgo(opts.now, 320),
    contactId: championContact.id,
    dealId: historicalWonDeal.id,
    externalId: 'pi_scenario_renewal_paid',
    customFields: { scenario: SCENARIO },
  })
  const followUpTask = await services.tasks.create(ctx, {
    title: 'Prepare renewal expansion proposal',
    description: 'Package success outcomes and expansion quote.',
    dueDate: dateDaysAgo(opts.now, -4),
    priority: 'high',
    isCompleted: false,
    companyId: candidateCompany.id,
    contactId: championContact.id,
    dealId: expansionDeal.id,
    assignedToUserId: owner.id,
    customFields: { scenario: SCENARIO },
  })

  const scenarioTag = await services.tags.create(ctx, {
    name: SCENARIO_TAG,
    color: '#7c3aed',
  })
  for (const entity of [
    { entityType: 'companies', entityId: candidateCompany.id },
    { entityType: 'companies', entityId: dormantControlCompany.id },
    { entityType: 'deals', entityId: expansionDeal.id },
    { entityType: 'deals', entityId: dormantClosedWonDeal.id },
    { entityType: 'contacts', entityId: championContact.id },
    { entityType: 'contacts', entityId: dormantContact.id },
  ]) {
    await services.tags.attach(ctx, scenarioTag.id, entity)
  }

  return {
    scenario: SCENARIO,
    organizationId: opts.organizationId,
    records: {
      owner: { id: owner.id, label: owner.email },
      candidateCompany: { id: candidateCompany.id, label: candidateCompany.name },
      dormantControlCompany: { id: dormantControlCompany.id, label: dormantControlCompany.name },
      championContact: { id: championContact.id, label: championContact.email ?? championContact.name },
      dormantContact: { id: dormantContact.id, label: dormantContact.email ?? dormantContact.name },
      historicalWonDeal: { id: historicalWonDeal.id, label: historicalWonDeal.title },
      expansionDeal: { id: expansionDeal.id, label: expansionDeal.title },
      dormantClosedWonDeal: { id: dormantClosedWonDeal.id, label: dormantClosedWonDeal.title },
      recentPositiveActivity: { id: recentPositiveActivity.id, label: recentPositiveActivity.subject ?? recentPositiveActivity.type },
      dormantOldActivity: { id: dormantOldActivity.id, label: dormantOldActivity.subject ?? dormantOldActivity.type },
      signedContract: { id: signedContract.id, label: signedContract.title },
      paidPayment: { id: paidPayment.id, label: paidPayment.externalId ?? paidPayment.id },
      followUpTask: { id: followUpTask.id, label: followUpTask.title },
      scenarioTag: { id: scenarioTag.id, label: scenarioTag.name },
    },
    expected: {
      renewalExpansion: expectedRenewalExpansionAnswer({
        companies: [candidateCompany, dormantControlCompany],
        deals: [historicalWonDeal, expansionDeal, dormantClosedWonDeal],
        activities: [recentPositiveActivity, dormantOldActivity],
        contracts: [signedContract],
        payments: [paidPayment],
      }),
    },
  }
}

export function expectedRenewalExpansionAnswer(input: {
  readonly companies: readonly CompanyRecord[]
  readonly deals: readonly DealRecord[]
  readonly activities: readonly ActivityRecord[]
  readonly contracts: readonly RenewalContractRecord[]
  readonly payments: readonly RenewalPaymentRecord[]
}): RenewalExpansionAnswer {
  const candidateCompanies = input.companies.filter((company) => {
    if (company.customFields.renewalSegment !== 'candidate') return false
    const hasOpenExpansion = input.deals.some((deal) => deal.companyId === company.id && deal.status === 'open')
    const hasRecentPositiveActivity = input.activities.some(
      (activity) => activity.companyId === company.id && activity.customFields.sentiment === 'positive',
    )
    const hasSignedContract = input.contracts.some((contract) => contract.companyId === company.id && contract.status === 'signed')
    const hasPaidHistory = input.payments.some((payment) => {
      const deal = input.deals.find((candidate) => candidate.id === payment.dealId)
      return payment.status === 'paid' && deal?.companyId === company.id
    })
    return hasOpenExpansion && hasRecentPositiveActivity && hasSignedContract && hasPaidHistory
  })
  const candidateCompanyIds = sortCompanies(candidateCompanies).map((company) => company.id)
  const expansionDeals = input.deals.filter(
    (deal) => candidateCompanyIds.includes(deal.companyId ?? '') && deal.status === 'open',
  )

  return {
    candidateCompanyIds,
    expansionDealIds: sortDeals(expansionDeals).map((deal) => deal.id),
    contractIds: sortContracts(input.contracts.filter((contract) => candidateCompanyIds.includes(contract.companyId ?? ''))).map((contract) => contract.id),
    paymentIds: sortPayments(input.payments.filter((payment) => payment.status === 'paid')).map((payment) => payment.id),
    dormantControlCompanyIds: sortCompanies(input.companies.filter((company) => company.customFields.renewalSegment === 'dormant-control')).map((company) => company.id),
    dataQualityIssues: [],
  }
}

export async function answerRenewalExpansionQuestion(input: {
  readonly adapter: ScenarioSeedOptions['adapter']
  readonly organizationId: string
}): Promise<RenewalExpansionAnswer> {
  const services = createCoreServices(input.adapter)
  const ctx = { orgId: input.organizationId }
  const companies = (await listAll(services.companies, ctx)).filter((company) => company.customFields.scenario === SCENARIO)

  if (companies.length === 0) {
    return {
      candidateCompanyIds: [],
      expansionDealIds: [],
      contractIds: [],
      paymentIds: [],
      dormantControlCompanyIds: [],
      dataQualityIssues: ['scenario-company-not-found'],
    }
  }

  const deals = (await listAll(services.deals, ctx)).filter((deal) => deal.customFields.scenario === SCENARIO)
  const activities = (await listAll(services.activities, ctx)).filter((activity) => activity.customFields.scenario === SCENARIO)
  const contracts = (await listAll(services.contracts, ctx)).filter((contract) => contract.customFields.scenario === SCENARIO)
  const payments = (await listAll(services.payments, ctx)).filter((payment) => payment.customFields.scenario === SCENARIO)

  return expectedRenewalExpansionAnswer({ companies, deals, activities, contracts, payments })
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

function requireStage(stages: readonly { id: string; name: string }[], name: string): { id: string; name: string } {
  const stage = stages.find((candidate) => candidate.name === name)
  if (!stage) throw new Error(`renewal-expansion scenario requires stage '${name}'`)
  return stage
}

function sortCompanies(companies: readonly CompanyRecord[]): CompanyRecord[] {
  return [...companies].sort((a, b) => {
    const aIndex = CANDIDATE_COMPANY_ORDER.indexOf(a.name as (typeof CANDIDATE_COMPANY_ORDER)[number])
    const bIndex = CANDIDATE_COMPANY_ORDER.indexOf(b.name as (typeof CANDIDATE_COMPANY_ORDER)[number])
    return aIndex - bIndex
  })
}

function sortDeals(deals: readonly DealRecord[]): DealRecord[] {
  return [...deals].sort((a, b) => EXPANSION_DEAL_ORDER.indexOf(a.title as (typeof EXPANSION_DEAL_ORDER)[number]) - EXPANSION_DEAL_ORDER.indexOf(b.title as (typeof EXPANSION_DEAL_ORDER)[number]))
}

function sortContracts(contracts: readonly RenewalContractRecord[]): RenewalContractRecord[] {
  return [...contracts].sort((a, b) => CONTRACT_ORDER.indexOf(a.title as (typeof CONTRACT_ORDER)[number]) - CONTRACT_ORDER.indexOf(b.title as (typeof CONTRACT_ORDER)[number]))
}

function sortPayments(payments: readonly RenewalPaymentRecord[]): RenewalPaymentRecord[] {
  return [...payments].sort((a, b) => PAYMENT_ORDER.indexOf(a.externalId as (typeof PAYMENT_ORDER)[number]) - PAYMENT_ORDER.indexOf(b.externalId as (typeof PAYMENT_ORDER)[number]))
}
