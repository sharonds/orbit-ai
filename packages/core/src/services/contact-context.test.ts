import { describe, expect, it } from 'vitest'

import { createInMemoryCompanyRepository } from '../entities/companies/repository.js'
import { createInMemoryContactRepository } from '../entities/contacts/repository.js'
import { createInMemoryDealRepository } from '../entities/deals/repository.js'
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
    })

    const context = await service.getContactContext(ctx, { email: 'taylor@example.com' })

    expect(context?.contact.id).toBe('contact_01ARYZ6S41YYYYYYYYYYYYYYYY')
    expect(context?.contact.email).toBe('taylor@example.com')
  })
})
