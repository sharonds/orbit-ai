import { describe, it, expect, vi } from 'vitest'
import { syncGmailMessage, type GmailSyncContext } from './sync.js'
import type { GmailMessage } from './types.js'
import type { ContactLookupClient, CompanyLookupClient } from '../shared/contacts.js'
import { isIntegrationError } from '../errors.js'

function makeContactClient(options?: {
  existingId?: string;
}): ContactLookupClient {
  const existingId = options?.existingId
  return {
    list: vi.fn(async () => {
      if (existingId) {
        return { data: [{ id: existingId, email: 'sender@external.com' }] }
      }
      return { data: [] }
    }),
    create: vi.fn(async (data: { email: string; first_name?: string; company_id?: string }) => {
      return { id: `created-${data.email}` }
    }),
  }
}

function makeCompanyClient(): CompanyLookupClient {
  return {
    list: vi.fn(async () => ({ data: [] })),
    create: vi.fn(async (data: { name: string; domain?: string }) => {
      return { id: `comp-${data.domain ?? data.name}` }
    }),
  }
}

function makeMessage(overrides?: Partial<GmailMessage>): GmailMessage {
  return {
    id: 'msg-001',
    threadId: 'thread-001',
    from: 'Sender <sender@external.com>',
    to: ['me@mycompany.com'],
    subject: 'Test email',
    body: 'Hello from tests',
    date: '2026-04-10T10:00:00Z',
    labels: ['INBOX', 'UNREAD'],
    ...overrides,
  }
}

function makeContext(overrides?: Partial<GmailSyncContext>): GmailSyncContext {
  return {
    orgId: 'org-1',
    contactClient: makeContactClient(),
    companyClient: makeCompanyClient(),
    orgUserEmails: ['me@mycompany.com'],
    autoCreateContacts: true,
    ...overrides,
  }
}

describe('syncGmailMessage', () => {
  it('creates activity with type=email and direction=inbound', async () => {
    const context = makeContext()
    const message = makeMessage()

    const result = await syncGmailMessage(context, message)

    expect(result.activity.type).toBe('email')
    expect(result.activity.direction).toBe('inbound')
    expect(result.activity.subject).toBe('Test email')
    expect(result.activity.body).toBe('Hello from tests')
  })

  it('creates activity with direction=outbound when sender is org user', async () => {
    const context = makeContext()
    const message = makeMessage({
      from: 'me@mycompany.com',
      to: ['recipient@external.com'],
    })

    const result = await syncGmailMessage(context, message)

    expect(result.activity.direction).toBe('outbound')
    // For outbound, contact is the first recipient
    expect(result.contactId).toBe('created-recipient@external.com')
  })

  it('sets metadata with gmail_message_id, gmail_thread_id, gmail_labels', async () => {
    const context = makeContext()
    const message = makeMessage()

    const result = await syncGmailMessage(context, message)

    expect(result.activity.metadata).toEqual({
      gmail_message_id: 'msg-001',
      gmail_thread_id: 'thread-001',
      gmail_labels: ['INBOX', 'UNREAD'],
    })
  })

  it('activity shape matches CreateActivityInput structure', async () => {
    const context = makeContext()
    const message = makeMessage()

    const result = await syncGmailMessage(context, message)

    // Verify all expected fields are present
    expect(result.activity).toHaveProperty('type')
    expect(result.activity).toHaveProperty('body')
    expect(result.activity).toHaveProperty('direction')
    expect(result.activity).toHaveProperty('metadata')
    expect(result.activity).toHaveProperty('contact_id')
    expect(result.activity).toHaveProperty('occurred_at')
    expect(result.activity).toHaveProperty('subject')

    // Verify contactId and created are returned
    expect(typeof result.contactId).toBe('string')
    expect(typeof result.created).toBe('boolean')
  })

  it('with autoCreateContacts=false does not create new contacts', async () => {
    const contactClient = makeContactClient()
    const context = makeContext({
      contactClient,
      autoCreateContacts: false,
    })
    const message = makeMessage()

    try {
      await syncGmailMessage(context, message)
      expect.fail('Expected an error to be thrown')
    } catch (err) {
      // The error is wrapped by toIntegrationError
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.code).toBe('NOT_FOUND')
      }
      // Verify create was never called
      expect(contactClient.create).not.toHaveBeenCalled()
    }
  })

  it('sets occurred_at from message date as ISO string', async () => {
    const context = makeContext()
    const message = makeMessage({ date: '2026-04-10T10:00:00Z' })

    const result = await syncGmailMessage(context, message)

    expect(result.activity.occurred_at).toBe('2026-04-10T10:00:00.000Z')
  })

  it('uses existing contact when found', async () => {
    const contactClient = makeContactClient({ existingId: 'existing-c-1' })
    const context = makeContext({ contactClient })
    const message = makeMessage()

    const result = await syncGmailMessage(context, message)

    expect(result.contactId).toBe('existing-c-1')
    expect(result.created).toBe(false)
    expect(contactClient.create).not.toHaveBeenCalled()
  })
})
