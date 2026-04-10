import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pollCalendarEvents, type PollCalendarOptions } from './polling.js'
import type { CalendarConnectorConfig } from './types.js'
import type { CredentialStore } from '../credentials.js'
import type { CalendarSyncContext } from './sync.js'
import { isIntegrationError } from '../errors.js'

// Mock operations
const mockListEvents = vi.fn()
vi.mock('./operations.js', () => ({
  listEvents: (...args: unknown[]) => mockListEvents(...args),
}))

// Mock sync
const mockSyncCalendarEvent = vi.fn()
vi.mock('./sync.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./sync.js')>()
  return {
    ...original,
    syncCalendarEvent: (...args: unknown[]) => mockSyncCalendarEvent(...args),
  }
})

const config: CalendarConnectorConfig = {
  clientId: 'test-client-id',
  clientSecretEnv: 'CALENDAR_SECRET',
  redirectUri: 'https://localhost/callback',
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
}

const credentialStore: CredentialStore = {
  getCredentials: vi.fn(async () => ({
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
  })),
  saveCredentials: vi.fn(async () => {}),
  deleteCredentials: vi.fn(async () => {}),
}

function makeSyncContext(overrides?: Partial<CalendarSyncContext>): CalendarSyncContext {
  return {
    orgId: 'org-1',
    contactClient: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async () => ({ id: 'c-1' })),
    },
    companyClient: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async () => ({ id: 'comp-1' })),
    },
    autoCreateContacts: true,
    ...overrides,
  }
}

function makeCalendarEvent(id: string) {
  return {
    id,
    summary: `Meeting ${id}`,
    description: `Description ${id}`,
    start: '2026-04-10T09:00:00Z',
    end: '2026-04-10T10:00:00Z',
    attendees: [{ email: 'alice@company.com' }],
    status: 'confirmed',
    organizer: { email: 'alice@company.com' },
  }
}

function makeActivity(id: string) {
  return {
    type: 'meeting',
    subject: `Meeting ${id}`,
    direction: 'internal',
    contact_id: 'c-1',
    metadata: { calendar_event_id: id },
    occurred_at: '2026-04-10T09:00:00Z',
  }
}

describe('pollCalendarEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('processes events and returns activities', async () => {
    mockListEvents.mockResolvedValueOnce({
      data: {
        events: [makeCalendarEvent('evt-1'), makeCalendarEvent('evt-2')],
        nextPageToken: undefined,
      },
      provider: 'google-calendar',
    })
    mockSyncCalendarEvent
      .mockResolvedValueOnce({ activity: makeActivity('evt-1'), contactIds: ['c-1'] })
      .mockResolvedValueOnce({ activity: makeActivity('evt-2'), contactIds: ['c-1'] })

    const syncCtx = makeSyncContext()
    const result = await pollCalendarEvents(config, credentialStore, 'org-1', syncCtx)

    expect(result.synced).toBe(2)
    expect(result.activities).toHaveLength(2)
    expect(result.stoppedEarly).toBe(false)
    expect(result.newCursor).toBeUndefined()
  })

  it('respects maxEvents limit', async () => {
    mockListEvents.mockResolvedValueOnce({
      data: {
        events: [
          makeCalendarEvent('evt-1'),
          makeCalendarEvent('evt-2'),
          makeCalendarEvent('evt-3'),
        ],
        nextPageToken: undefined,
      },
      provider: 'google-calendar',
    })
    mockSyncCalendarEvent.mockResolvedValue({
      activity: makeActivity('evt-1'),
      contactIds: ['c-1'],
    })

    const options: PollCalendarOptions = { maxEvents: 2 }
    const syncCtx = makeSyncContext()
    const result = await pollCalendarEvents(
      config,
      credentialStore,
      'org-1',
      syncCtx,
      undefined,
      options,
    )

    expect(result.synced).toBe(2)
    expect(result.stoppedEarly).toBe(true)
  })

  it('returns empty on no events', async () => {
    mockListEvents.mockResolvedValueOnce({
      data: { events: [], nextPageToken: undefined },
      provider: 'google-calendar',
    })

    const syncCtx = makeSyncContext()
    const result = await pollCalendarEvents(config, credentialStore, 'org-1', syncCtx)

    expect(result.synced).toBe(0)
    expect(result.activities).toEqual([])
    expect(result.stoppedEarly).toBe(false)
  })

  it('returns cursor for pagination', async () => {
    mockListEvents.mockResolvedValueOnce({
      data: {
        events: [makeCalendarEvent('evt-1')],
        nextPageToken: 'page-token-abc',
      },
      provider: 'google-calendar',
    })
    // Second page returns empty to stop
    mockListEvents.mockResolvedValueOnce({
      data: { events: [], nextPageToken: undefined },
      provider: 'google-calendar',
    })
    mockSyncCalendarEvent.mockResolvedValueOnce({
      activity: makeActivity('evt-1'),
      contactIds: ['c-1'],
    })

    const syncCtx = makeSyncContext()
    const result = await pollCalendarEvents(config, credentialStore, 'org-1', syncCtx)

    expect(result.synced).toBe(1)
    // After second page returns empty, pageToken is undefined (no more pages)
    expect(result.stoppedEarly).toBe(false)
  })

  it('stops on maxDuration', async () => {
    // Date.now() call sequence in pollCalendarEvents:
    // 1: startTime = Date.now()          -> 1000
    // 2: while check: Date.now() - 1000  -> 0, not > 100 => continue
    // 3: for-loop check before evt-1     -> 0, not > 100 => process evt-1
    // 4: for-loop check before evt-2     -> 200, > 100 => stoppedEarly
    let callCount = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++
      if (callCount <= 3) return 1000
      return 1200
    })

    mockListEvents.mockResolvedValueOnce({
      data: {
        events: [makeCalendarEvent('evt-1'), makeCalendarEvent('evt-2')],
        nextPageToken: undefined,
      },
      provider: 'google-calendar',
    })
    mockSyncCalendarEvent.mockResolvedValue({
      activity: makeActivity('evt-1'),
      contactIds: ['c-1'],
    })

    const options: PollCalendarOptions = { maxDurationMs: 100 }
    const syncCtx = makeSyncContext()
    const result = await pollCalendarEvents(
      config,
      credentialStore,
      'org-1',
      syncCtx,
      undefined,
      options,
    )

    expect(result.synced).toBe(1)
    expect(result.stoppedEarly).toBe(true)
  })

  it('passes options through to listEvents', async () => {
    mockListEvents.mockResolvedValueOnce({
      data: { events: [], nextPageToken: undefined },
      provider: 'google-calendar',
    })

    const options: PollCalendarOptions = {
      timeMin: '2026-04-01T00:00:00Z',
      timeMax: '2026-04-30T23:59:59Z',
      calendarId: 'work@company.com',
    }
    const syncCtx = makeSyncContext()
    await pollCalendarEvents(config, credentialStore, 'org-1', syncCtx, undefined, options)

    expect(mockListEvents).toHaveBeenCalledWith(config, credentialStore, 'org-1', {
      maxResults: 20,
      timeMin: '2026-04-01T00:00:00Z',
      timeMax: '2026-04-30T23:59:59Z',
      calendarId: 'work@company.com',
    })
  })

  it('wraps errors with toIntegrationError', async () => {
    mockListEvents.mockRejectedValueOnce(new Error('API rate limit exceeded 429'))

    const syncCtx = makeSyncContext()
    try {
      await pollCalendarEvents(config, credentialStore, 'org-1', syncCtx)
      expect.fail('Expected an error')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.provider).toBe('google-calendar')
      }
    }
  })
})
