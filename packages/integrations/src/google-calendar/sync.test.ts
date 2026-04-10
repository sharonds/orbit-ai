import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncCalendarEvent, type CalendarSyncContext } from './sync.js'
import type { CalendarEvent } from './types.js'
import type { ContactLookupClient, CompanyLookupClient } from '../shared/contacts.js'

// Mock shared contacts
const mockFindOrCreateContactFromEmail = vi.fn()
vi.mock('../shared/contacts.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../shared/contacts.js')>()
  return {
    ...original,
    findOrCreateContactFromEmail: (...args: unknown[]) =>
      mockFindOrCreateContactFromEmail(...args),
  }
})

function makeContactClient(overrides?: Partial<ContactLookupClient>): ContactLookupClient {
  return {
    list: vi.fn(async () => ({ data: [] })),
    create: vi.fn(async () => ({ id: 'c-new' })),
    ...overrides,
  }
}

function makeCompanyClient(overrides?: Partial<CompanyLookupClient>): CompanyLookupClient {
  return {
    list: vi.fn(async () => ({ data: [] })),
    create: vi.fn(async () => ({ id: 'comp-1' })),
    ...overrides,
  }
}

function makeContext(overrides?: Partial<CalendarSyncContext>): CalendarSyncContext {
  return {
    orgId: 'org-1',
    contactClient: makeContactClient(),
    companyClient: makeCompanyClient(),
    autoCreateContacts: true,
    ...overrides,
  }
}

function makeEvent(overrides?: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'evt-1',
    summary: 'Team standup',
    description: 'Daily sync meeting',
    start: '2026-04-10T09:00:00Z',
    end: '2026-04-10T09:30:00Z',
    attendees: [
      { email: 'alice@company.com', displayName: 'Alice' },
      { email: 'bob@partner.com', displayName: 'Bob' },
    ],
    location: 'Room A',
    status: 'confirmed',
    organizer: { email: 'alice@company.com', displayName: 'Alice' },
    ...overrides,
  }
}

describe('syncCalendarEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates activity with type=meeting', async () => {
    mockFindOrCreateContactFromEmail
      .mockResolvedValueOnce({ contactId: 'c-1', created: false })
      .mockResolvedValueOnce({ contactId: 'c-2', created: true })

    const result = await syncCalendarEvent(makeContext(), makeEvent())

    expect(result.activity.type).toBe('meeting')
    expect(result.activity.direction).toBe('internal')
  })

  it('sets duration_minutes from start/end', async () => {
    mockFindOrCreateContactFromEmail
      .mockResolvedValueOnce({ contactId: 'c-1', created: false })
      .mockResolvedValueOnce({ contactId: 'c-2', created: true })

    const event = makeEvent({
      start: '2026-04-10T09:00:00Z',
      end: '2026-04-10T10:15:00Z',
    })
    const result = await syncCalendarEvent(makeContext(), event)

    expect(result.activity.metadata?.duration_minutes).toBe(75)
  })

  it('resolves attendees to contacts via shared helper', async () => {
    mockFindOrCreateContactFromEmail
      .mockResolvedValueOnce({ contactId: 'c-alice', created: false })
      .mockResolvedValueOnce({ contactId: 'c-bob', created: true })

    const ctx = makeContext()
    const event = makeEvent()
    const result = await syncCalendarEvent(ctx, event)

    expect(mockFindOrCreateContactFromEmail).toHaveBeenCalledTimes(2)
    expect(mockFindOrCreateContactFromEmail).toHaveBeenCalledWith(
      ctx.contactClient,
      ctx.companyClient,
      'org-1',
      'alice@company.com',
      { autoCreate: true },
    )
    expect(mockFindOrCreateContactFromEmail).toHaveBeenCalledWith(
      ctx.contactClient,
      ctx.companyClient,
      'org-1',
      'bob@partner.com',
      { autoCreate: true },
    )
    expect(result.contactIds).toEqual(['c-alice', 'c-bob'])
    expect(result.activity.contact_id).toBe('c-alice') // primary attendee
  })

  it('sets metadata with calendar_event_id and attendee_count', async () => {
    mockFindOrCreateContactFromEmail
      .mockResolvedValueOnce({ contactId: 'c-1', created: false })
      .mockResolvedValueOnce({ contactId: 'c-2', created: true })

    const event = makeEvent()
    const result = await syncCalendarEvent(makeContext(), event)

    expect(result.activity.metadata?.calendar_event_id).toBe('evt-1')
    expect(result.activity.metadata?.attendee_count).toBe(2)
    expect(result.activity.metadata?.calendar_status).toBe('confirmed')
    expect(result.activity.metadata?.location).toBe('Room A')
    expect(result.activity.metadata?.organizer_email).toBe('alice@company.com')
    expect(result.activity.metadata?.all_contact_ids).toEqual(['c-1', 'c-2'])
  })

  it('with autoCreateContacts=false skips unresolved attendees', async () => {
    // First attendee found, second throws (autoCreate disabled)
    mockFindOrCreateContactFromEmail
      .mockResolvedValueOnce({ contactId: 'c-1', created: false })
      .mockRejectedValueOnce({
        _type: 'IntegrationError',
        code: 'NOT_FOUND',
        message: 'Contact not found for email bob@partner.com and auto_create is disabled',
      })

    const ctx = makeContext({ autoCreateContacts: false })
    const result = await syncCalendarEvent(ctx, makeEvent())

    // Only one contact resolved, skipped attendee does not break sync
    expect(result.contactIds).toEqual(['c-1'])
    expect(result.activity.contact_id).toBe('c-1')
  })

  it('cross-org: same attendee email in different org contexts do NOT collide', async () => {
    // Org A
    mockFindOrCreateContactFromEmail.mockResolvedValueOnce({ contactId: 'c-org-a', created: true })
    const ctxA = makeContext({ orgId: 'org-a' })
    const eventA = makeEvent({ attendees: [{ email: 'shared@example.com' }] })
    const resultA = await syncCalendarEvent(ctxA, eventA)

    // Org B — same email, different org
    mockFindOrCreateContactFromEmail.mockResolvedValueOnce({ contactId: 'c-org-b', created: true })
    const ctxB = makeContext({ orgId: 'org-b' })
    const eventB = makeEvent({ attendees: [{ email: 'shared@example.com' }] })
    const resultB = await syncCalendarEvent(ctxB, eventB)

    // Verify orgId is passed through to findOrCreateContactFromEmail
    expect(mockFindOrCreateContactFromEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'org-a',
      'shared@example.com',
      expect.anything(),
    )
    expect(mockFindOrCreateContactFromEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'org-b',
      'shared@example.com',
      expect.anything(),
    )

    // Different contact IDs per org
    expect(resultA.contactIds[0]).toBe('c-org-a')
    expect(resultB.contactIds[0]).toBe('c-org-b')
    expect(resultA.contactIds[0]).not.toBe(resultB.contactIds[0])
  })

  it('sets subject, body, and occurred_at from event', async () => {
    mockFindOrCreateContactFromEmail
      .mockResolvedValueOnce({ contactId: 'c-1', created: false })
      .mockResolvedValueOnce({ contactId: 'c-2', created: false })

    const event = makeEvent()
    const result = await syncCalendarEvent(makeContext(), event)

    expect(result.activity.subject).toBe('Team standup')
    expect(result.activity.body).toBe('Daily sync meeting')
    expect(result.activity.occurred_at).toBe('2026-04-10T09:00:00Z')
  })

  it('handles event with no attendees', async () => {
    const event = makeEvent({ attendees: [] })
    const result = await syncCalendarEvent(makeContext(), event)

    expect(mockFindOrCreateContactFromEmail).not.toHaveBeenCalled()
    expect(result.contactIds).toEqual([])
    expect(result.activity.contact_id).toBeUndefined()
    expect(result.activity.metadata?.attendee_count).toBe(0)
  })
})
