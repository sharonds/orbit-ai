import { z } from 'zod'
import type { IntegrationTool, IntegrationCommand } from '../types.js'
import { listEvents, createEvent } from './operations.js'
import type { CalendarConnectorConfig } from './types.js'
import type { CredentialStore } from '../credentials.js'
import { toIntegrationError } from '../errors.js'

export interface CalendarToolContext {
  config: CalendarConnectorConfig
  credentialStore: CredentialStore
  orgId: string
}

/**
 * Build Google Calendar MCP tools. All tool names MUST start with 'integrations.'.
 */
export function buildCalendarTools(context: CalendarToolContext): IntegrationTool[] {
  return [
    {
      name: 'integrations.google_calendar.list_events',
      title: 'List Calendar Events',
      description: 'List events from Google Calendar',
      inputSchema: z.object({
        max_results: z.number().int().positive().default(10),
        time_min: z.string().optional(),
        time_max: z.string().optional(),
      }),
      async execute(args: Record<string, unknown>) {
        try {
          const opts: { maxResults: number; timeMin?: string; timeMax?: string } = {
            maxResults: (args['max_results'] as number | undefined) ?? 10,
          }
          const timeMin = args['time_min'] as string | undefined
          if (timeMin !== undefined) opts.timeMin = timeMin
          const timeMax = args['time_max'] as string | undefined
          if (timeMax !== undefined) opts.timeMax = timeMax

          const result = await listEvents(context.config, context.credentialStore, context.orgId, opts)
          return result.data
        } catch (err) {
          throw toIntegrationError(err, 'google-calendar')
        }
      },
    },
    {
      name: 'integrations.google_calendar.create_event',
      title: 'Create Calendar Event',
      description: 'Create a new event on Google Calendar',
      inputSchema: z.object({
        summary: z.string(),
        start: z.string(),
        end: z.string(),
        description: z.string().optional(),
        attendees: z.array(z.object({ email: z.string().email() })).optional(),
        location: z.string().optional(),
      }),
      async execute(args: Record<string, unknown>) {
        try {
          const input: { summary: string; start: string; end: string; description?: string; attendees?: Array<{ email: string }>; location?: string } = {
            summary: args['summary'] as string,
            start: args['start'] as string,
            end: args['end'] as string,
          }
          const description = args['description'] as string | undefined
          if (description !== undefined) input.description = description
          const attendees = args['attendees'] as Array<{ email: string }> | undefined
          if (attendees !== undefined) input.attendees = attendees
          const location = args['location'] as string | undefined
          if (location !== undefined) input.location = location

          const result = await createEvent(context.config, context.credentialStore, context.orgId, input)
          return result.data
        } catch (err) {
          throw toIntegrationError(err, 'google-calendar')
        }
      },
    },
  ]
}

/**
 * Build MCP-tool-style command builders for Calendar (list/create/sync).
 * Distinct from the CLI factory in `./cli.ts` which builds configure/status.
 */
export function buildCalendarMcpTools(context: CalendarToolContext): IntegrationCommand[] {
  return [
    {
      name: 'list',
      description: 'List upcoming calendar events',
      options: [
        { flags: '-n, --max <number>', description: 'Maximum events to show', defaultValue: '10' },
        { flags: '--from <date>', description: 'Start date (ISO format)' },
        { flags: '--to <date>', description: 'End date (ISO format)' },
      ],
      async action(...args: unknown[]) {
        // Commander passes options as last arg
        const opts = args[args.length - 1] as Record<string, string | undefined>
        try {
          const listOpts: { maxResults: number; timeMin?: string; timeMax?: string } = {
            maxResults: Number(opts['max'] ?? '10'),
          }
          const from = opts['from']
          if (from !== undefined) listOpts.timeMin = from
          const to = opts['to']
          if (to !== undefined) listOpts.timeMax = to

          const result = await listEvents(context.config, context.credentialStore, context.orgId, listOpts)
          console.log(JSON.stringify(result.data, null, 2))
        } catch (err) {
          throw toIntegrationError(err, 'google-calendar')
        }
      },
    },
    {
      name: 'create',
      description: 'Create a calendar event',
      options: [
        { flags: '-s, --summary <text>', description: 'Event summary/title' },
        { flags: '--start <datetime>', description: 'Start datetime (ISO)' },
        { flags: '--end <datetime>', description: 'End datetime (ISO)' },
      ],
      async action(...args: unknown[]) {
        const opts = args[args.length - 1] as Record<string, string>
        try {
          const result = await createEvent(context.config, context.credentialStore, context.orgId, {
            summary: opts['summary'] ?? 'New Event',
            start: opts['start'] ?? new Date().toISOString(),
            end: opts['end'] ?? new Date(Date.now() + 3600000).toISOString(),
          })
          console.log(JSON.stringify(result.data, null, 2))
        } catch (err) {
          throw toIntegrationError(err, 'google-calendar')
        }
      },
    },
    {
      name: 'sync',
      description: 'Sync calendar events to Orbit activities',
      options: [
        { flags: '-n, --max <number>', description: 'Maximum events to sync', defaultValue: '50' },
      ],
      async action(...args: unknown[]) {
        const opts = args[args.length - 1] as Record<string, string | undefined>
        console.log(`Syncing up to ${opts['max'] ?? '50'} calendar events...`)
        // Full sync implementation uses pollCalendarEvents from polling.ts
        // The actual wiring happens via the dynamic registration in Slice 22
      },
    },
  ]
}
