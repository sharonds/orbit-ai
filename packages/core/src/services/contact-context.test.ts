import { describe, expect, it, vi } from 'vitest'

import { createInMemoryActivityRepository } from '../entities/activities/repository.js'
import { createInMemoryCompanyRepository } from '../entities/companies/repository.js'
import { createInMemoryContactRepository } from '../entities/contacts/repository.js'
import { createInMemoryDealRepository } from '../entities/deals/repository.js'
import { createInMemoryEntityTagRepository } from '../entities/entity-tags/repository.js'
import { createInMemoryTagRepository } from '../entities/tags/repository.js'
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

  it('returns real tags from entity tag integration', async () => {
    const contactId = 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY'
    const contacts = createInMemoryContactRepository([
      {
        id: contactId,
        organizationId: ctx.orgId,
        name: 'Taylor',
        email: 'taylor@example.com',
        phone: null,
        title: null,
        sourceChannel: null,
        status: 'lead',
        assignedToUserId: null,
        companyId: null,
        leadScore: 0,
        isHot: false,
        lastContactedAt: null,
        customFields: {},
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
    ])

    const tagId = 'tag_01ARYZ6S41YYYYYYYYYYYYYYYY'
    const tags = createInMemoryTagRepository([
      {
        id: tagId,
        organizationId: ctx.orgId,
        name: 'VIP',
        color: '#gold',
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
    ])

    const entityTags = createInMemoryEntityTagRepository([
      {
        id: 'etag_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: ctx.orgId,
        tagId,
        entityType: 'contacts',
        entityId: contactId,
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
    ])

    const service = createContactContextService({
      contacts,
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      entityTags,
      tags,
    })

    const context = await service.getContactContext(ctx, { contactId })
    expect(context?.tags).toHaveLength(1)
    expect(context?.tags[0]).toEqual({ id: tagId, name: 'VIP', color: '#gold' })
  })

  it('uses listByIds for tag lookup — single batch call, never N individual get() calls', async () => {
    const contactId = 'contact_01ARYZ6S41YYYYYYYYYYYYYYYY'
    const contacts = createInMemoryContactRepository([
      {
        id: contactId,
        organizationId: ctx.orgId,
        name: 'Taylor',
        email: 'taylor@example.com',
        phone: null,
        title: null,
        sourceChannel: null,
        status: 'lead',
        assignedToUserId: null,
        companyId: null,
        leadScore: 0,
        isHot: false,
        lastContactedAt: null,
        customFields: {},
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
    ])

    const tagId1 = 'tag_01ARYZ6S41YYYYYYYYYYYYYYYA'
    const tagId2 = 'tag_01ARYZ6S41YYYYYYYYYYYYYYZZ'
    const tags = createInMemoryTagRepository([
      {
        id: tagId1,
        organizationId: ctx.orgId,
        name: 'VIP',
        color: '#gold',
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
      {
        id: tagId2,
        organizationId: ctx.orgId,
        name: 'Hot Lead',
        color: '#red',
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
    ])

    // Spy to verify batch path is used (no individual get calls)
    const listByIdsSpy = vi.spyOn(tags, 'listByIds')
    const getSpy = vi.spyOn(tags, 'get')

    const entityTags = createInMemoryEntityTagRepository([
      {
        id: 'etag_01ARYZ6S41YYYYYYYYYYYYYYYA',
        organizationId: ctx.orgId,
        tagId: tagId1,
        entityType: 'contacts',
        entityId: contactId,
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
      {
        id: 'etag_01ARYZ6S41YYYYYYYYYYYYYYZZ',
        organizationId: ctx.orgId,
        tagId: tagId2,
        entityType: 'contacts',
        entityId: contactId,
        createdAt: new Date('2026-04-02T12:00:00.000Z'),
        updatedAt: new Date('2026-04-02T12:00:00.000Z'),
      },
    ])

    const service = createContactContextService({
      contacts,
      companies: createInMemoryCompanyRepository(),
      deals: createInMemoryDealRepository(),
      entityTags,
      tags,
    })

    const context = await service.getContactContext(ctx, { contactId })

    // All tags are returned correctly
    expect(context?.tags).toHaveLength(2)
    expect(context?.tags.map((t) => t.name).sort()).toEqual(['Hot Lead', 'VIP'])

    // listByIds called exactly once — not N individual get() calls
    expect(listByIdsSpy).toHaveBeenCalledTimes(1)
    expect(listByIdsSpy).toHaveBeenCalledWith(ctx, expect.arrayContaining([tagId1, tagId2]))
    expect(getSpy).not.toHaveBeenCalled()
  })
})
