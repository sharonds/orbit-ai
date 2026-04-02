import { describe, expect, it } from 'vitest'

import { createInMemoryActivityRepository } from '../entities/activities/repository.js'
import { createInMemoryCompanyRepository } from '../entities/companies/repository.js'
import { createInMemoryContactRepository } from '../entities/contacts/repository.js'
import { createInMemoryDealRepository } from '../entities/deals/repository.js'
import { createInMemoryTaskRepository } from '../entities/tasks/repository.js'
import { createContactContextService } from './contact-context.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
}

describe('contact context service', () => {
  it('looks up contacts by exact email equality', async () => {
    const contacts = createInMemoryContactRepository([
      {
        id: 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: ctx.orgId,
        name: 'Taylor',
        email: 'taylor@example.com',
        phone: null,
        title: 'VP Sales',
        sourceChannel: null,
        status: 'lead',
        assignedToUserId: null,
        companyId: null,
        leadScore: 0,
        isHot: false,
        lastContactedAt: null,
        customFields: {},
        createdAt: new Date('2026-03-31T12:00:00.000Z'),
        updatedAt: new Date('2026-03-31T12:00:00.000Z'),
      },
      {
        id: 'contact_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
        organizationId: ctx.orgId,
        name: 'Taylor Example',
        email: 'taylor.example@wrong.test',
        phone: null,
        title: 'Engineer',
        sourceChannel: null,
        status: 'lead',
        assignedToUserId: null,
        companyId: null,
        leadScore: 0,
        isHot: false,
        lastContactedAt: null,
        customFields: {},
        createdAt: new Date('2026-03-31T12:00:00.000Z'),
        updatedAt: new Date('2026-03-31T12:00:00.000Z'),
      },
    ])
    const service = createContactContextService({
      contacts,
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      activities: createInMemoryActivityRepository(),
      tasks: createInMemoryTaskRepository(),
    })

    const context = await service.getContactContext(ctx, { email: 'taylor@example.com' })

    expect(context?.contact.id).toBe('contact_01ARYZ6S41YYYYYYYYYYYYYYYY')
    expect(context?.contact.email).toBe('taylor@example.com')
  })

  it('returns real recent activities and open tasks for the matched contact', async () => {
    const contactId = 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY'
    const contacts = createInMemoryContactRepository([
      {
        id: contactId,
        organizationId: ctx.orgId,
        name: 'Taylor',
        email: 'taylor@example.com',
        phone: null,
        title: 'VP Sales',
        sourceChannel: null,
        status: 'lead',
        assignedToUserId: null,
        companyId: null,
        leadScore: 0,
        isHot: false,
        lastContactedAt: new Date('2026-03-31T12:00:00.000Z'),
        customFields: {},
        createdAt: new Date('2026-03-31T12:00:00.000Z'),
        updatedAt: new Date('2026-03-31T12:00:00.000Z'),
      },
    ])
    const service = createContactContextService({
      contacts,
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      activities: createInMemoryActivityRepository([
        {
          id: 'activity_01ARYZ6S41YYYYYYYYYYYYYYA1',
          organizationId: ctx.orgId,
          type: 'call',
          subject: 'Latest touchpoint',
          body: null,
          direction: 'outbound',
          contactId,
          dealId: null,
          companyId: null,
          durationMinutes: 30,
          outcome: 'positive',
          occurredAt: new Date('2026-04-01T09:00:00.000Z'),
          loggedByUserId: null,
          metadata: {},
          customFields: {},
          createdAt: new Date('2026-04-01T09:00:00.000Z'),
          updatedAt: new Date('2026-04-01T09:00:00.000Z'),
        },
      ]),
      tasks: createInMemoryTaskRepository([
        {
          id: 'task_01ARYZ6S41YYYYYYYYYYYYYYYY',
          organizationId: ctx.orgId,
          title: 'Follow up',
          description: null,
          dueDate: new Date('2026-04-02T09:00:00.000Z'),
          priority: 'high',
          isCompleted: false,
          completedAt: null,
          contactId,
          dealId: null,
          companyId: null,
          assignedToUserId: null,
          customFields: {},
          createdAt: new Date('2026-04-01T10:00:00.000Z'),
          updatedAt: new Date('2026-04-01T10:00:00.000Z'),
        },
      ]),
    })

    const context = await service.getContactContext(ctx, { contactId })

    expect(context?.recentActivities).toHaveLength(1)
    expect(context?.openTasks).toHaveLength(1)
    expect(context?.recentActivities[0]?.subject).toBe('Latest touchpoint')
    expect(context?.openTasks[0]?.title).toBe('Follow up')
    expect(context?.lastContactDate).toBe('2026-04-01T09:00:00.000Z')
  })
})
