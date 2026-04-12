import { google, type calendar_v3 } from 'googleapis'
import type { CalendarConnectorConfig, CalendarEvent, CalendarEventInput } from './types.js'
import type { IntegrationResult } from '../types.js'
import { toIntegrationError } from '../errors.js'
import { getCalendarClient } from './auth.js'
import type { CredentialStore } from '../credentials.js'

/**
 * Create an authenticated Google Calendar API client instance.
 */
async function getCalendarApi(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  userId?: string,
): Promise<calendar_v3.Calendar> {
  const { accessToken } = await getCalendarClient(config, credentialStore, orgId, userId)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.calendar({ version: 'v3', auth })
}

/**
 * Map a Google Calendar API event object to our CalendarEvent interface.
 */
function mapEvent(event: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: event.id ?? '',
    summary: event.summary ?? '',
    ...(event.description !== undefined && event.description !== null
      ? { description: event.description }
      : {}),
    start: event.start?.dateTime ?? event.start?.date ?? '',
    end: event.end?.dateTime ?? event.end?.date ?? '',
    attendees: (event.attendees ?? []).map((a) => {
      const base: { email: string; displayName?: string; responseStatus?: string } = {
        email: a.email ?? '',
      }
      if (a.displayName) base.displayName = a.displayName
      if (a.responseStatus) base.responseStatus = a.responseStatus
      return base
    }),
    ...(event.location !== undefined && event.location !== null
      ? { location: event.location }
      : {}),
    status: event.status ?? 'confirmed',
    organizer: {
      email: event.organizer?.email ?? '',
      ...(event.organizer?.displayName ? { displayName: event.organizer.displayName } : {}),
    },
    ...(event.recurringEventId ? { recurringEventId: event.recurringEventId } : {}),
    ...(event.htmlLink ? { htmlLink: event.htmlLink } : {}),
  }
}

/**
 * List calendar events.
 */
export async function listEvents(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  options?: {
    maxResults?: number
    timeMin?: string
    timeMax?: string
    pageToken?: string
    calendarId?: string
  },
  userId?: string,
): Promise<IntegrationResult<{ events: CalendarEvent[]; nextPageToken?: string }>> {
  try {
    const calendar = await getCalendarApi(config, credentialStore, orgId, userId)
    const calendarId = options?.calendarId ?? 'primary'

    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      maxResults: options?.maxResults ?? 25,
      singleEvents: true,
      orderBy: 'startTime',
    }
    if (options?.timeMin) params.timeMin = options.timeMin
    if (options?.timeMax) params.timeMax = options.timeMax
    if (options?.pageToken) params.pageToken = options.pageToken

    const response = await calendar.events.list(params)
    const data = response.data

    const events = (data.items ?? []).map(mapEvent)

    const resultData: { events: CalendarEvent[]; nextPageToken?: string } = { events }
    if (data.nextPageToken) {
      resultData.nextPageToken = data.nextPageToken
    }

    return {
      data: resultData,
      provider: 'google-calendar',
      rawResponse: data,
    }
  } catch (err) {
    throw toIntegrationError(err, 'google-calendar')
  }
}

/**
 * Create a calendar event.
 */
export async function createEvent(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  input: CalendarEventInput,
  calendarId?: string,
  userId?: string,
): Promise<IntegrationResult<CalendarEvent>> {
  try {
    const calendar = await getCalendarApi(config, credentialStore, orgId, userId)

    const requestBody: calendar_v3.Schema$Event = {
      summary: input.summary,
      start: { dateTime: input.start, ...(input.timeZone ? { timeZone: input.timeZone } : {}) },
      end: { dateTime: input.end, ...(input.timeZone ? { timeZone: input.timeZone } : {}) },
    }
    if (input.description) requestBody.description = input.description
    if (input.location) requestBody.location = input.location
    if (input.attendees) {
      requestBody.attendees = input.attendees.map((a) => ({ email: a.email }))
    }

    const response = await calendar.events.insert({
      calendarId: calendarId ?? 'primary',
      requestBody,
    })

    return {
      data: mapEvent(response.data),
      provider: 'google-calendar',
      rawResponse: response.data,
    }
  } catch (err) {
    throw toIntegrationError(err, 'google-calendar')
  }
}

/**
 * Update an existing calendar event.
 */
export async function updateEvent(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  eventId: string,
  input: Partial<CalendarEventInput>,
  calendarId?: string,
  userId?: string,
): Promise<IntegrationResult<CalendarEvent>> {
  try {
    const calendar = await getCalendarApi(config, credentialStore, orgId, userId)

    const requestBody: calendar_v3.Schema$Event = {}
    if (input.summary !== undefined) requestBody.summary = input.summary
    if (input.description !== undefined) requestBody.description = input.description
    if (input.location !== undefined) requestBody.location = input.location
    if (input.start !== undefined) requestBody.start = { dateTime: input.start, ...(input.timeZone ? { timeZone: input.timeZone } : {}) }
    if (input.end !== undefined) requestBody.end = { dateTime: input.end, ...(input.timeZone ? { timeZone: input.timeZone } : {}) }
    if (input.attendees !== undefined) {
      requestBody.attendees = input.attendees.map((a) => ({ email: a.email }))
    }

    const response = await calendar.events.patch({
      calendarId: calendarId ?? 'primary',
      eventId,
      requestBody,
    })

    return {
      data: mapEvent(response.data),
      provider: 'google-calendar',
      rawResponse: response.data,
    }
  } catch (err) {
    throw toIntegrationError(err, 'google-calendar')
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  eventId: string,
  calendarId?: string,
  userId?: string,
): Promise<IntegrationResult<{ deleted: true }>> {
  try {
    const calendar = await getCalendarApi(config, credentialStore, orgId, userId)

    await calendar.events.delete({
      calendarId: calendarId ?? 'primary',
      eventId,
    })

    return {
      data: { deleted: true },
      provider: 'google-calendar',
    }
  } catch (err) {
    throw toIntegrationError(err, 'google-calendar')
  }
}

/**
 * Check availability using the freebusy API.
 */
export async function checkAvailability(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  options: { timeMin: string; timeMax: string; emails: string[] },
  userId?: string,
): Promise<IntegrationResult<Array<{ email: string; busy: Array<{ start: string; end: string }> }>>> {
  try {
    const calendar = await getCalendarApi(config, credentialStore, orgId, userId)

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        items: options.emails.map((email) => ({ id: email })),
      },
    })

    const calendars = response.data.calendars ?? {}
    const result = options.emails.map((email) => {
      const calData = calendars[email]
      const busy = (calData?.busy ?? []).map((slot) => ({
        start: slot.start ?? '',
        end: slot.end ?? '',
      }))
      return { email, busy }
    })

    return {
      data: result,
      provider: 'google-calendar',
      rawResponse: response.data,
    }
  } catch (err) {
    throw toIntegrationError(err, 'google-calendar')
  }
}
