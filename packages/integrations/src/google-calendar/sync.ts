import type { CalendarEvent } from './types.js'
import {
  findOrCreateContactFromEmail,
  type ContactLookupClient,
  type CompanyLookupClient,
} from '../shared/contacts.js'
import type { ActivityInput } from '../gmail/sync.js'
import { toIntegrationError } from '../errors.js'

export interface CalendarSyncContext {
  orgId: string
  contactClient: ContactLookupClient
  companyClient: CompanyLookupClient
  autoCreateContacts: boolean
}

/**
 * Sync a CalendarEvent into an Orbit activity.
 * Resolves attendees to contacts via the shared findOrCreateContactFromEmail helper.
 * Returns the activity input shape for activities.create() plus all resolved contact IDs.
 */
export async function syncCalendarEvent(
  context: CalendarSyncContext,
  event: CalendarEvent,
): Promise<{ activity: ActivityInput; contactIds: string[] }> {
  try {
    const contactIds: string[] = []

    // Resolve attendees to contacts using shared helper
    for (const attendee of event.attendees) {
      try {
        const result = await findOrCreateContactFromEmail(
          context.contactClient,
          context.companyClient,
          context.orgId,
          attendee.email,
          { autoCreate: context.autoCreateContacts },
        )
        contactIds.push(result.contactId)
      } catch (err) {
        // Skip attendees that can't be resolved (e.g., autoCreate disabled)
        console.error(
          'Failed to resolve attendee:',
          err instanceof Error ? err.message : String(err),
        )
      }
    }

    // Calculate duration in minutes
    const startMs = new Date(event.start).getTime()
    const endMs = new Date(event.end).getTime()
    const durationMinutes = Math.round((endMs - startMs) / 60000)

    const activity: ActivityInput = {
      type: 'meeting',
      subject: event.summary,
      direction: 'internal',
      metadata: {
        calendar_event_id: event.id,
        calendar_status: event.status,
        attendee_count: event.attendees.length,
        organizer_email: event.organizer.email,
        duration_minutes: durationMinutes,
        all_contact_ids: contactIds,
      },
      occurred_at: event.start,
    }
    if (event.description !== undefined) activity.body = event.description
    if (contactIds[0] !== undefined) activity.contact_id = contactIds[0]
    if (event.location !== undefined) {
      activity.metadata!.location = event.location
    }

    return { activity, contactIds }
  } catch (err) {
    throw toIntegrationError(err, 'google-calendar')
  }
}
