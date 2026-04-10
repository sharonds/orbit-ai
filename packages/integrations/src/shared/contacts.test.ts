import { describe, it, expect, vi } from 'vitest'
import {
  findOrCreateContactFromEmail,
  detectDirection,
  type ContactLookupClient,
  type CompanyLookupClient,
} from './contacts.js'
import { isIntegrationError } from '../errors.js'

function makeContactClient(
  existingContacts: Array<{ id: string; email: string; company_id?: string }> = [],
): ContactLookupClient {
  return {
    list: vi.fn(async (params: { filter?: Record<string, unknown> }) => {
      const emailFilter = params.filter?.['email'] as string | undefined
      const matches = emailFilter
        ? existingContacts.filter((c) => c.email === emailFilter)
        : existingContacts
      return { data: matches }
    }),
    create: vi.fn(async (data: { email: string; first_name?: string; company_id?: string }) => {
      return { id: `new-contact-${data.email}` }
    }),
  }
}

function makeCompanyClient(
  existingCompanies: Array<{ id: string; domain: string }> = [],
): CompanyLookupClient {
  return {
    list: vi.fn(async (params: { filter?: Record<string, unknown> }) => {
      const domainFilter = params.filter?.['domain'] as string | undefined
      const matches = domainFilter
        ? existingCompanies.filter((c) => c.domain === domainFilter)
        : existingCompanies
      return { data: matches }
    }),
    create: vi.fn(async (data: { name: string; domain?: string }) => {
      return { id: `new-company-${data.domain ?? data.name}` }
    }),
  }
}

describe('findOrCreateContactFromEmail', () => {
  it('returns existing contact when email matches', async () => {
    const contactClient = makeContactClient([
      { id: 'c-1', email: 'alice@example.com' },
    ])
    const companyClient = makeCompanyClient()

    const result = await findOrCreateContactFromEmail(
      contactClient,
      companyClient,
      'org-1',
      'alice@example.com',
    )

    expect(result.contactId).toBe('c-1')
    expect(result.created).toBe(false)
    // Should not attempt to create
    expect(contactClient.create).not.toHaveBeenCalled()
  })

  it('creates a new contact when autoCreate is true (default)', async () => {
    const contactClient = makeContactClient()
    const companyClient = makeCompanyClient()

    const result = await findOrCreateContactFromEmail(
      contactClient,
      companyClient,
      'org-1',
      'bob@newdomain.com',
    )

    expect(result.created).toBe(true)
    expect(result.contactId).toBe('new-contact-bob@newdomain.com')
    expect(contactClient.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'bob@newdomain.com', first_name: 'bob' }),
    )
  })

  it('creates contact with company_id when domain matches', async () => {
    const contactClient = makeContactClient()
    const companyClient = makeCompanyClient([
      { id: 'comp-1', domain: 'acme.com' },
    ])

    const result = await findOrCreateContactFromEmail(
      contactClient,
      companyClient,
      'org-1',
      'charlie@acme.com',
    )

    expect(result.created).toBe(true)
    expect(contactClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'charlie@acme.com',
        company_id: 'comp-1',
      }),
    )
  })

  it('throws NOT_FOUND when autoCreate is false and contact does not exist', async () => {
    const contactClient = makeContactClient()
    const companyClient = makeCompanyClient()

    try {
      await findOrCreateContactFromEmail(
        contactClient,
        companyClient,
        'org-1',
        'nobody@example.com',
        { autoCreate: false },
      )
      expect.fail('Expected an error to be thrown')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.code).toBe('NOT_FOUND')
        expect(err.message).toContain('nobody@example.com')
      }
    }
  })

  it('normalizes email to lowercase before lookup', async () => {
    const contactClient = makeContactClient([
      { id: 'c-upper', email: 'alice@example.com' },
    ])
    const companyClient = makeCompanyClient()

    const result = await findOrCreateContactFromEmail(
      contactClient,
      companyClient,
      'org-1',
      '  Alice@Example.COM  ',
    )

    expect(result.contactId).toBe('c-upper')
    expect(result.created).toBe(false)
    // Verify the filter used the normalized email
    expect(contactClient.list).toHaveBeenCalledWith({
      filter: { email: 'alice@example.com' },
    })
  })

  it('cross-org isolation — same email in different orgs gets separate lookup calls', async () => {
    // Org A has the contact, Org B does not
    const orgAContactClient = makeContactClient([
      { id: 'c-org-a', email: 'shared@example.com' },
    ])
    const orgBContactClient = makeContactClient([])
    const companyClient = makeCompanyClient()

    const resultA = await findOrCreateContactFromEmail(
      orgAContactClient,
      companyClient,
      'org-a',
      'shared@example.com',
    )

    const resultB = await findOrCreateContactFromEmail(
      orgBContactClient,
      companyClient,
      'org-b',
      'shared@example.com',
    )

    // Org A finds existing contact
    expect(resultA.contactId).toBe('c-org-a')
    expect(resultA.created).toBe(false)

    // Org B creates a new contact (different client scope)
    expect(resultB.created).toBe(true)
    expect(resultB.contactId).toBe('new-contact-shared@example.com')

    // Each client received exactly one list call with the same filter
    expect(orgAContactClient.list).toHaveBeenCalledWith({
      filter: { email: 'shared@example.com' },
    })
    expect(orgBContactClient.list).toHaveBeenCalledWith({
      filter: { email: 'shared@example.com' },
    })

    // Org A never called create, Org B did
    expect(orgAContactClient.create).not.toHaveBeenCalled()
    expect(orgBContactClient.create).toHaveBeenCalled()
  })
})

describe('detectDirection', () => {
  it('returns outbound when sender is an org user', () => {
    const result = detectDirection('me@mycompany.com', ['me@mycompany.com'])
    expect(result).toBe('outbound')
  })

  it('returns inbound when sender is external', () => {
    const result = detectDirection('external@other.com', ['me@mycompany.com'])
    expect(result).toBe('inbound')
  })

  it('handles "Name <email>" format', () => {
    const result = detectDirection(
      'John Doe <john@mycompany.com>',
      ['john@mycompany.com'],
    )
    expect(result).toBe('outbound')
  })

  it('is case-insensitive', () => {
    const result = detectDirection(
      'Alice@MyCompany.COM',
      ['alice@mycompany.com'],
    )
    expect(result).toBe('outbound')
  })

  it('returns inbound for empty org user list', () => {
    const result = detectDirection('someone@example.com', [])
    expect(result).toBe('inbound')
  })
})
