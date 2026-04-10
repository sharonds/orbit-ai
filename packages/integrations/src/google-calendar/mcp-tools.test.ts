import { describe, it, expect, vi } from 'vitest'
import { buildCalendarTools, buildCalendarCommands, type CalendarToolContext } from './mcp-tools.js'
import type { CalendarConnectorConfig } from './types.js'
import type { CredentialStore } from '../credentials.js'

// Mock operations
vi.mock('./operations.js', () => ({
  listEvents: vi.fn(async () => ({
    data: { events: [{ id: 'evt-1', summary: 'Meeting' }], nextPageToken: undefined },
    provider: 'google-calendar',
  })),
  createEvent: vi.fn(async () => ({
    data: { id: 'evt-2', summary: 'New Meeting', start: '2026-04-10T10:00:00Z', end: '2026-04-10T11:00:00Z' },
    provider: 'google-calendar',
  })),
}))

vi.mock('./auth.js', () => ({
  getCalendarClient: vi.fn(async () => ({
    accessToken: 'test-token',
  })),
}))

function makeContext(): CalendarToolContext {
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

  return { config, credentialStore, orgId: 'org-1' }
}

describe('buildCalendarTools', () => {
  it('returns 2 tools', () => {
    const tools = buildCalendarTools(makeContext())
    expect(tools).toHaveLength(2)
  })

  it('all tool names start with integrations.', () => {
    const tools = buildCalendarTools(makeContext())
    for (const tool of tools) {
      expect(tool.name).toMatch(/^integrations\./)
    }
  })

  it('list_events tool has correct name and description', () => {
    const tools = buildCalendarTools(makeContext())
    const listTool = tools.find((t) => t.name === 'integrations.google_calendar.list_events')
    expect(listTool).toBeDefined()
    expect(listTool!.description).toBe('List events from Google Calendar')
  })

  it('list_events tool has correct inputSchema', () => {
    const tools = buildCalendarTools(makeContext())
    const listTool = tools.find((t) => t.name === 'integrations.google_calendar.list_events')!
    // Schema should accept max_results, time_min, time_max
    const parsed = listTool.inputSchema.parse({ max_results: 5 })
    expect(parsed).toEqual({ max_results: 5 })
  })

  it('create_event tool has correct name and description', () => {
    const tools = buildCalendarTools(makeContext())
    const createTool = tools.find((t) => t.name === 'integrations.google_calendar.create_event')
    expect(createTool).toBeDefined()
    expect(createTool!.description).toBe('Create a new event on Google Calendar')
  })

  it('create_event tool has correct inputSchema', () => {
    const tools = buildCalendarTools(makeContext())
    const createTool = tools.find((t) => t.name === 'integrations.google_calendar.create_event')!
    const parsed = createTool.inputSchema.parse({
      summary: 'Test',
      start: '2026-04-10T10:00:00Z',
      end: '2026-04-10T11:00:00Z',
    })
    expect(parsed).toEqual({
      summary: 'Test',
      start: '2026-04-10T10:00:00Z',
      end: '2026-04-10T11:00:00Z',
    })
  })

  it('list_events execute calls listEvents and returns data', async () => {
    const { listEvents } = await import('./operations.js')
    const tools = buildCalendarTools(makeContext())
    const listTool = tools.find((t) => t.name === 'integrations.google_calendar.list_events')!

    const result = await listTool.execute({ max_results: 5 })

    expect(listEvents).toHaveBeenCalled()
    expect(result).toEqual({ events: [{ id: 'evt-1', summary: 'Meeting' }], nextPageToken: undefined })
  })

  it('create_event execute calls createEvent and returns data', async () => {
    const { createEvent } = await import('./operations.js')
    const tools = buildCalendarTools(makeContext())
    const createTool = tools.find((t) => t.name === 'integrations.google_calendar.create_event')!

    const result = await createTool.execute({
      summary: 'New Meeting',
      start: '2026-04-10T10:00:00Z',
      end: '2026-04-10T11:00:00Z',
    })

    expect(createEvent).toHaveBeenCalled()
    expect(result).toEqual({
      id: 'evt-2',
      summary: 'New Meeting',
      start: '2026-04-10T10:00:00Z',
      end: '2026-04-10T11:00:00Z',
    })
  })
})

describe('buildCalendarCommands', () => {
  it('returns 3 commands', () => {
    const commands = buildCalendarCommands(makeContext())
    expect(commands).toHaveLength(3)
  })

  it('command names are list, create, sync', () => {
    const commands = buildCalendarCommands(makeContext())
    const names = commands.map((c) => c.name)
    expect(names).toEqual(['list', 'create', 'sync'])
  })

  it('list command has correct options', () => {
    const commands = buildCalendarCommands(makeContext())
    const listCmd = commands.find((c) => c.name === 'list')!
    expect(listCmd.options).toBeDefined()
    expect(listCmd.options!.length).toBe(3)
    expect(listCmd.options!.map((o) => o.flags)).toEqual([
      '-n, --max <number>',
      '--from <date>',
      '--to <date>',
    ])
  })

  it('create command has correct options', () => {
    const commands = buildCalendarCommands(makeContext())
    const createCmd = commands.find((c) => c.name === 'create')!
    expect(createCmd.options).toBeDefined()
    expect(createCmd.options!.length).toBe(3)
  })

  it('sync command has correct options', () => {
    const commands = buildCalendarCommands(makeContext())
    const syncCmd = commands.find((c) => c.name === 'sync')!
    expect(syncCmd.options).toBeDefined()
    expect(syncCmd.options!.length).toBe(1)
    expect(syncCmd.options![0].defaultValue).toBe('50')
  })
})
