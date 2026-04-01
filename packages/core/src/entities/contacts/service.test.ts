import { describe, expect, it } from 'vitest'

import { createInMemoryContactRepository } from './repository.js'
import { createContactService } from './service.js'
import { createCompanyService } from '../companies/service.js'
import { createInMemoryCompanyRepository } from '../companies/repository.js'

const ctx = {
  orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
  userId: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
} as const

describe('contact service', () => {
  it('creates contacts linked to in-org companies', async () => {
    const companies = createInMemoryCompanyRepository()
    const contacts = createInMemoryContactRepository()
    const companyService = createCompanyService(companies)
    const contactService = createContactService({ companies, contacts })

    const company = await companyService.create(ctx, {
      name: 'Orbit Labs',
    })
    const contact = await contactService.create(ctx, {
      name: 'Sharon',
      email: 'sharon@orbit.dev',
      companyId: company.id,
    })

    expect(contact.companyId).toBe(company.id)
    await expect(contactService.get(ctx, contact.id)).resolves.toEqual(contact)
  })

  it('rejects contacts that reference companies outside the org scope', async () => {
    const companies = createInMemoryCompanyRepository()
    const contacts = createInMemoryContactRepository()
    const contactService = createContactService({ companies, contacts })

    await expect(
      contactService.create(ctx, {
        name: 'Sharon',
        companyId: 'company_01ARYZ6S41YYYYYYYYYYYYYYYY',
      }),
    ).rejects.toMatchObject({
      code: 'RELATION_NOT_FOUND',
    })
  })

  it('lists and searches contacts within the org scope', async () => {
    const companies = createInMemoryCompanyRepository()
    const contacts = createInMemoryContactRepository()
    const contactService = createContactService({ companies, contacts })

    await contactService.create(ctx, {
      name: 'Sharon',
      email: 'sharon@orbit.dev',
    })
    await contactService.create(ctx, {
      name: 'Taylor',
      email: 'taylor@example.com',
    })

    const search = await contactService.search(ctx, {
      query: 'orbit.dev',
    })

    expect(search.data).toHaveLength(1)
    expect(search.data[0]?.name).toBe('Sharon')
  })
})
