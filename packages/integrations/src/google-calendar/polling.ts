import type { CalendarConnectorConfig } from './types.js'
import type { CredentialStore } from '../credentials.js'
import { listEvents } from './operations.js'
import { syncCalendarEvent, type CalendarSyncContext } from './sync.js'
import type { ActivityInput } from '../gmail/sync.js'
import { toIntegrationError } from '../errors.js'

export interface PollCalendarOptions {
  maxEvents?: number       // default: 50
  maxDurationMs?: number   // default: 30_000 (30 seconds)
  timeMin?: string
  timeMax?: string
  calendarId?: string
}

export interface PollCalendarResult {
  synced: number
  activities: ActivityInput[]
  newCursor?: string       // next page token for continuation
  stoppedEarly: boolean    // true if hit maxEvents or maxDuration
}

/**
 * Poll Google Calendar for events and sync each into Orbit activities.
 * Queries the Calendar API page-by-page, resolves attendees to contacts,
 * and returns activity inputs. Bounded by maxEvents and maxDuration.
 */
export async function pollCalendarEvents(
  config: CalendarConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  syncContext: CalendarSyncContext,
  cursor?: string,
  options?: PollCalendarOptions,
): Promise<PollCalendarResult> {
  const maxEvents = options?.maxEvents ?? 50
  const maxDurationMs = options?.maxDurationMs ?? 30_000
  const startTime = Date.now()
  const activities: ActivityInput[] = []
  let pageToken = cursor
  let stoppedEarly = false

  try {
    let eventsProcessed = 0

    while (eventsProcessed < maxEvents) {
      // Check time bound
      if (Date.now() - startTime > maxDurationMs) {
        stoppedEarly = true
        break
      }

      const listOpts: {
        maxResults: number
        pageToken?: string
        timeMin?: string
        timeMax?: string
        calendarId?: string
      } = {
        maxResults: Math.min(20, maxEvents - eventsProcessed),
      }
      if (pageToken !== undefined) listOpts.pageToken = pageToken
      if (options?.timeMin !== undefined) listOpts.timeMin = options.timeMin
      if (options?.timeMax !== undefined) listOpts.timeMax = options.timeMax
      if (options?.calendarId !== undefined) listOpts.calendarId = options.calendarId

      const listResult = await listEvents(config, credentialStore, orgId, listOpts)

      if (listResult.data.events.length === 0) break

      for (const event of listResult.data.events) {
        if (eventsProcessed >= maxEvents) {
          stoppedEarly = true
          break
        }
        if (Date.now() - startTime > maxDurationMs) {
          stoppedEarly = true
          break
        }

        const syncResult = await syncCalendarEvent(syncContext, event)
        activities.push(syncResult.activity)
        eventsProcessed++
      }

      pageToken = listResult.data.nextPageToken
      if (!pageToken) break
    }

    const result: PollCalendarResult = {
      synced: activities.length,
      activities,
      stoppedEarly,
    }
    if (pageToken !== undefined) result.newCursor = pageToken
    return result
  } catch (err) {
    throw toIntegrationError(err, 'google-calendar')
  }
}
