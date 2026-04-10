import { z } from 'zod'

export const calendarConnectorConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecretEnv: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default([
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ]),
})

export type CalendarConnectorConfig = z.infer<typeof calendarConnectorConfigSchema>

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: string            // ISO timestamp
  end: string              // ISO timestamp
  attendees: Array<{ email: string; displayName?: string; responseStatus?: string }>
  location?: string
  status: string           // confirmed, tentative, cancelled
  organizer: { email: string; displayName?: string }
  recurringEventId?: string
  htmlLink?: string
}

export interface CalendarEventInput {
  summary: string
  description?: string
  start: string
  end: string
  attendees?: Array<{ email: string }>
  location?: string
  timeZone?: string
}
