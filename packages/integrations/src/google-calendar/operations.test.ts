import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IntegrationError } from '../errors.js'
import type { CalendarConnectorConfig } from './types.js'

// Setup googleapis mock
const mockEventsList = vi.fn()
const mockEventsInsert = vi.fn()
const mockEventsPatch = vi.fn()
const mockEventsDelete = vi.fn()
const mockFreebusyQuery = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
      })),
    },
    calendar: vi.fn(() => ({
      events: {
        list: mockEventsList,
        insert: mockEventsInsert,
        patch: mockEventsPatch,
        delete: mockEventsDelete,
      },
      freebusy: {
        query: mockFreebusyQuery,
      },
    })),
  },
}))

vi.mock('./auth.js', () => ({
  getCalendarClient: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
}))

const TEST_CONFIG: CalendarConnectorConfig = {
  clientId: 'test-client-id',
  clientSecretEnv: 'TEST_SECRET',
  redirectUri: 'http://localhost:3000/callback',
  scopes: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ],
}

const ORG_ID = 'org-test-1'

const MOCK_RAW_EVENT = {
  id: 'evt-1',
  summary: 'Team Standup',
  description: 'Daily sync',
  start: { dateTime: '2026-04-10T09:00:00+02:00' },
  end: { dateTime: '2026-04-10T09:30:00+02:00' },
  attendees: [
    { email: 'alice@example.com', displayName: 'Alice', responseStatus: 'accepted' },
    { email: 'bob@example.com' },
  ],
  location: 'Room 42',
  status: 'confirmed',
  organizer: { email: 'alice@example.com', displayName: 'Alice' },
  recurringEventId: 'rec-1',
  htmlLink: 'https://calendar.google.com/event?eid=evt-1',
}

describe('Google Calendar operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listEvents', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('returns events with correct shape', async () => {
      const { listEvents } = await loadOps()
      mockEventsList.mockResolvedValue({
        data: {
          items: [MOCK_RAW_EVENT],
          nextPageToken: 'page-2',
        },
      })

      const result = await listEvents(TEST_CONFIG, {} as never, ORG_ID)

      expect(result.provider).toBe('google-calendar')
      expect(result.data.events).toHaveLength(1)
      const event = result.data.events[0]
      expect(event.id).toBe('evt-1')
      expect(event.summary).toBe('Team Standup')
      expect(event.description).toBe('Daily sync')
      expect(event.start).toBe('2026-04-10T09:00:00+02:00')
      expect(event.end).toBe('2026-04-10T09:30:00+02:00')
      expect(event.attendees).toHaveLength(2)
      expect(event.attendees[0]).toEqual({
        email: 'alice@example.com',
        displayName: 'Alice',
        responseStatus: 'accepted',
      })
      expect(event.attendees[1]).toEqual({ email: 'bob@example.com' })
      expect(event.location).toBe('Room 42')
      expect(event.status).toBe('confirmed')
      expect(event.organizer).toEqual({ email: 'alice@example.com', displayName: 'Alice' })
      expect(event.recurringEventId).toBe('rec-1')
      expect(event.htmlLink).toBe('https://calendar.google.com/event?eid=evt-1')
      expect(result.data.nextPageToken).toBe('page-2')
      expect(result.rawResponse).toBeDefined()
    })

    it('handles empty results', async () => {
      const { listEvents } = await loadOps()
      mockEventsList.mockResolvedValue({
        data: { items: undefined, nextPageToken: undefined },
      })

      const result = await listEvents(TEST_CONFIG, {} as never, ORG_ID)

      expect(result.data.events).toEqual([])
      expect(result.data.nextPageToken).toBeUndefined()
    })

    it('passes options to the API', async () => {
      const { listEvents } = await loadOps()
      mockEventsList.mockResolvedValue({
        data: { items: [], nextPageToken: undefined },
      })

      await listEvents(TEST_CONFIG, {} as never, ORG_ID, {
        maxResults: 10,
        timeMin: '2026-04-01T00:00:00Z',
        timeMax: '2026-04-30T23:59:59Z',
        pageToken: 'tok-1',
        calendarId: 'work@group.calendar.google.com',
      })

      expect(mockEventsList).toHaveBeenCalledWith({
        calendarId: 'work@group.calendar.google.com',
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: '2026-04-01T00:00:00Z',
        timeMax: '2026-04-30T23:59:59Z',
        pageToken: 'tok-1',
      })
    })
  })

  describe('createEvent', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('sends event data and returns created event', async () => {
      const { createEvent } = await loadOps()
      mockEventsInsert.mockResolvedValue({
        data: {
          ...MOCK_RAW_EVENT,
          id: 'evt-new',
        },
      })

      const result = await createEvent(TEST_CONFIG, {} as never, ORG_ID, {
        summary: 'Team Standup',
        description: 'Daily sync',
        start: '2026-04-10T09:00:00+02:00',
        end: '2026-04-10T09:30:00+02:00',
        attendees: [{ email: 'alice@example.com' }],
        location: 'Room 42',
        timeZone: 'Europe/Amsterdam',
      })

      expect(result.provider).toBe('google-calendar')
      expect(result.data.id).toBe('evt-new')
      expect(result.data.summary).toBe('Team Standup')

      const insertCall = mockEventsInsert.mock.calls[0][0]
      expect(insertCall.calendarId).toBe('primary')
      expect(insertCall.requestBody.summary).toBe('Team Standup')
      expect(insertCall.requestBody.description).toBe('Daily sync')
      expect(insertCall.requestBody.location).toBe('Room 42')
      expect(insertCall.requestBody.start).toEqual({
        dateTime: '2026-04-10T09:00:00+02:00',
        timeZone: 'Europe/Amsterdam',
      })
      expect(insertCall.requestBody.attendees).toEqual([{ email: 'alice@example.com' }])
    })
  })

  describe('updateEvent', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('sends partial update', async () => {
      const { updateEvent } = await loadOps()
      mockEventsPatch.mockResolvedValue({
        data: {
          ...MOCK_RAW_EVENT,
          summary: 'Updated Standup',
        },
      })

      const result = await updateEvent(TEST_CONFIG, {} as never, ORG_ID, 'evt-1', {
        summary: 'Updated Standup',
      })

      expect(result.provider).toBe('google-calendar')
      expect(result.data.summary).toBe('Updated Standup')

      const patchCall = mockEventsPatch.mock.calls[0][0]
      expect(patchCall.calendarId).toBe('primary')
      expect(patchCall.eventId).toBe('evt-1')
      expect(patchCall.requestBody.summary).toBe('Updated Standup')
      // Should not include fields not in the partial update
      expect(patchCall.requestBody.description).toBeUndefined()
    })
  })

  describe('deleteEvent', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('returns { deleted: true }', async () => {
      const { deleteEvent } = await loadOps()
      mockEventsDelete.mockResolvedValue({ data: {} })

      const result = await deleteEvent(TEST_CONFIG, {} as never, ORG_ID, 'evt-1')

      expect(result.provider).toBe('google-calendar')
      expect(result.data).toEqual({ deleted: true })

      const deleteCall = mockEventsDelete.mock.calls[0][0]
      expect(deleteCall.calendarId).toBe('primary')
      expect(deleteCall.eventId).toBe('evt-1')
    })

    it('uses custom calendarId when provided', async () => {
      const { deleteEvent } = await loadOps()
      mockEventsDelete.mockResolvedValue({ data: {} })

      await deleteEvent(TEST_CONFIG, {} as never, ORG_ID, 'evt-2', 'custom@group.calendar.google.com')

      const deleteCall = mockEventsDelete.mock.calls[0][0]
      expect(deleteCall.calendarId).toBe('custom@group.calendar.google.com')
    })
  })

  describe('checkAvailability', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('calls freebusy.query and parses busy slots', async () => {
      const { checkAvailability } = await loadOps()
      mockFreebusyQuery.mockResolvedValue({
        data: {
          calendars: {
            'alice@example.com': {
              busy: [
                { start: '2026-04-10T09:00:00Z', end: '2026-04-10T09:30:00Z' },
                { start: '2026-04-10T14:00:00Z', end: '2026-04-10T15:00:00Z' },
              ],
            },
            'bob@example.com': {
              busy: [],
            },
          },
        },
      })

      const result = await checkAvailability(TEST_CONFIG, {} as never, ORG_ID, {
        timeMin: '2026-04-10T00:00:00Z',
        timeMax: '2026-04-10T23:59:59Z',
        emails: ['alice@example.com', 'bob@example.com'],
      })

      expect(result.provider).toBe('google-calendar')
      expect(result.data).toHaveLength(2)
      expect(result.data[0].email).toBe('alice@example.com')
      expect(result.data[0].busy).toHaveLength(2)
      expect(result.data[0].busy[0]).toEqual({
        start: '2026-04-10T09:00:00Z',
        end: '2026-04-10T09:30:00Z',
      })
      expect(result.data[1].email).toBe('bob@example.com')
      expect(result.data[1].busy).toEqual([])

      const queryCall = mockFreebusyQuery.mock.calls[0][0]
      expect(queryCall.requestBody.timeMin).toBe('2026-04-10T00:00:00Z')
      expect(queryCall.requestBody.timeMax).toBe('2026-04-10T23:59:59Z')
      expect(queryCall.requestBody.items).toEqual([
        { id: 'alice@example.com' },
        { id: 'bob@example.com' },
      ])
    })
  })

  describe('error mapping', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('maps 401 auth failure to AUTH_EXPIRED', async () => {
      const { listEvents } = await loadOps()
      mockEventsList.mockRejectedValue(new Error('Request failed with status 401 Unauthorized'))

      try {
        await listEvents(TEST_CONFIG, {} as never, ORG_ID)
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('AUTH_EXPIRED')
        expect(ie.provider).toBe('google-calendar')
      }
    })

    it('maps 429 rate limit to RATE_LIMITED', async () => {
      const { createEvent } = await loadOps()
      mockEventsInsert.mockRejectedValue(new Error('Request failed with status 429 rate limit exceeded'))

      try {
        await createEvent(TEST_CONFIG, {} as never, ORG_ID, {
          summary: 'Test',
          start: '2026-04-10T09:00:00Z',
          end: '2026-04-10T10:00:00Z',
        })
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('RATE_LIMITED')
        expect(ie.provider).toBe('google-calendar')
      }
    })

    it('maps 404 not found to NOT_FOUND', async () => {
      const { updateEvent } = await loadOps()
      mockEventsPatch.mockRejectedValue(new Error('Request failed with status 404 not found'))

      try {
        await updateEvent(TEST_CONFIG, {} as never, ORG_ID, 'nonexistent', { summary: 'x' })
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('NOT_FOUND')
        expect(ie.provider).toBe('google-calendar')
      }
    })
  })
})
