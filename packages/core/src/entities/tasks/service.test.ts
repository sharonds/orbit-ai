import { describe, expect, it } from 'vitest'

import { createInMemoryCompanyRepository } from '../companies/repository.js'
import { createCompanyService } from '../companies/service.js'
import { createInMemoryContactRepository } from '../contacts/repository.js'
import { createContactService } from '../contacts/service.js'
import { createInMemoryDealRepository } from '../deals/repository.js'
import { createDealService } from '../deals/service.js'
import { createInMemoryPipelineRepository } from '../pipelines/repository.js'
import { createPipelineService } from '../pipelines/service.js'
import { createInMemoryStageRepository } from '../stages/repository.js'
import { createStageService } from '../stages/service.js'
import { createInMemoryUserRepository } from '../users/repository.js'
import { createInMemoryTaskRepository } from './repository.js'
import { createTaskService } from './service.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

async function createLinkedDealGraph() {
  const companies = createInMemoryCompanyRepository()
  const contacts = createInMemoryContactRepository()
  const pipelines = createInMemoryPipelineRepository()
  const stages = createInMemoryStageRepository()
  const deals = createInMemoryDealRepository()
  const tasks = createInMemoryTaskRepository()
  const users = createInMemoryUserRepository()

  const companyService = createCompanyService(companies)
  const contactService = createContactService({ contacts, companies })
  const pipelineService = createPipelineService(pipelines)
  const stageService = createStageService({ stages, pipelines })
  const dealService = createDealService({ deals, pipelines, stages, contacts, companies })
  const taskService = createTaskService({ tasks, contacts, companies, deals, users })

  const company = await companyService.create(ctx, { name: 'Orbit Labs' })
  const contact = await contactService.create(ctx, {
    name: 'Taylor',
    email: 'taylor@orbit.test',
    companyId: company.id,
  })
  const pipeline = await pipelineService.create(ctx, { name: 'Sales' })
  const stage = await stageService.create(ctx, {
    pipelineId: pipeline.id,
    name: 'Qualified',
    stageOrder: 1,
    probability: 30,
  })
  const deal = await dealService.create(ctx, {
    title: 'Expansion',
    companyId: company.id,
    contactId: contact.id,
    stageId: stage.id,
  })

  return { taskService, company, contact, deal }
}

describe('task service', () => {
  it('creates tasks linked to contact and deal records', async () => {
    const { taskService, company, contact, deal } = await createLinkedDealGraph()

    const task = await taskService.create(ctx, {
      title: 'Send follow-up',
      contactId: contact.id,
      companyId: company.id,
      dealId: deal.id,
      dueDate: new Date('2026-04-03T09:00:00.000Z'),
    })

    expect(task.contactId).toBe(contact.id)
    expect(task.companyId).toBe(company.id)
    expect(task.dealId).toBe(deal.id)
  })

  it('rejects completedAt when the task is not completed', async () => {
    const taskService = createTaskService({
      tasks: createInMemoryTaskRepository(),
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
    })

    await expect(
      taskService.create(ctx, {
        title: 'Follow up',
        isCompleted: false,
        completedAt: new Date('2026-04-03T09:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('defaults completedAt when a task is created as completed', async () => {
    const taskService = createTaskService({
      tasks: createInMemoryTaskRepository(),
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
    })

    const before = Date.now()
    const task = await taskService.create(ctx, {
      title: 'Done already',
      isCompleted: true,
    })
    const after = Date.now()

    expect(task.completedAt).not.toBeNull()
    expect(task.completedAt!.getTime()).toBeGreaterThanOrEqual(before)
    expect(task.completedAt!.getTime()).toBeLessThanOrEqual(after)
  })

  it('defaults completedAt when a task transitions to completed', async () => {
    const taskService = createTaskService({
      tasks: createInMemoryTaskRepository(),
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
    })

    const created = await taskService.create(ctx, {
      title: 'Mark later',
      isCompleted: false,
    })

    const before = Date.now()
    const updated = await taskService.update(ctx, created.id, {
      isCompleted: true,
    })
    const after = Date.now()

    expect(updated.completedAt).not.toBeNull()
    expect(updated.completedAt!.getTime()).toBeGreaterThanOrEqual(before)
    expect(updated.completedAt!.getTime()).toBeLessThanOrEqual(after)
  })

  it('lists open tasks by due date and searches on task text', async () => {
    const { taskService } = await createLinkedDealGraph()

    await taskService.create(ctx, {
      title: 'Second task',
      description: 'Later follow-up',
      dueDate: new Date('2026-04-05T09:00:00.000Z'),
    })
    await taskService.create(ctx, {
      title: 'First task',
      description: 'Urgent pricing email',
      dueDate: new Date('2026-04-03T09:00:00.000Z'),
    })

    const list = await taskService.list(ctx, { limit: 10 })
    const search = await taskService.search(ctx, { query: 'pricing', limit: 10 })

    expect(list.data.map((record) => record.title)).toEqual(['First task', 'Second task'])
    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.title).toBe('First task')
  })

  it('rejects tasks assigned to users outside the tenant scope', async () => {
    const taskService = createTaskService({
      tasks: createInMemoryTaskRepository(),
      contacts: createInMemoryContactRepository(),
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      users: createInMemoryUserRepository(),
    })

    await expect(
      taskService.create(ctx, {
        title: 'Assigned task',
        assignedToUserId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })
})
