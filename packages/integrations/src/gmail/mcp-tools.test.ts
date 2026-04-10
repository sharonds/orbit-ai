import { describe, it, expect, vi } from 'vitest'
import { buildGmailTools, type GmailToolContext } from './mcp-tools.js'
import type { GmailConnectorConfig } from './types.js'
import type { CredentialStore } from '../credentials.js'
import type { GmailSyncContext } from './sync.js'

// Mock operations
vi.mock('./operations.js', () => ({
  sendMessage: vi.fn(async () => ({
    data: { id: 'sent-1', threadId: 'thread-1' },
    provider: 'gmail',
  })),
  listMessages: vi.fn(async () => ({
    data: { messages: [{ id: 'msg-1', threadId: 'thread-1' }] },
    provider: 'gmail',
  })),
}))

function makeContext(): GmailToolContext {
  const config: GmailConnectorConfig = {
    clientId: 'test-client-id',
    clientSecretEnv: 'GMAIL_SECRET',
    redirectUri: 'https://localhost/callback',
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    auto_create_contacts: true,
  }

  const credentialStore: CredentialStore = {
    getCredentials: vi.fn(async () => ({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
    })),
    saveCredentials: vi.fn(async () => {}),
    deleteCredentials: vi.fn(async () => {}),
  }

  const syncContext: GmailSyncContext = {
    orgId: 'org-1',
    contactClient: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async () => ({ id: 'c-1' })),
    },
    companyClient: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async () => ({ id: 'comp-1' })),
    },
    orgUserEmails: ['me@company.com'],
    autoCreateContacts: true,
  }

  return { config, credentialStore, orgId: 'org-1', syncContext }
}

describe('buildGmailTools', () => {
  it('returns 2 tools', () => {
    const tools = buildGmailTools(makeContext())
    expect(tools).toHaveLength(2)
  })

  it('all tool names start with integrations.', () => {
    const tools = buildGmailTools(makeContext())
    for (const tool of tools) {
      expect(tool.name).toMatch(/^integrations\./)
    }
  })

  it('send_email tool has correct name and description', () => {
    const tools = buildGmailTools(makeContext())
    const sendTool = tools.find((t) => t.name === 'integrations.gmail.send_email')
    expect(sendTool).toBeDefined()
    expect(sendTool!.description).toBe('Send an email through the connected Gmail account')
  })

  it('send_email tool execute calls sendMessage and returns data', async () => {
    const { sendMessage } = await import('./operations.js')
    const tools = buildGmailTools(makeContext())
    const sendTool = tools.find((t) => t.name === 'integrations.gmail.send_email')!

    const result = await sendTool.execute({
      to: 'test@example.com',
      subject: 'Hello',
      body: 'World',
    })

    expect(sendMessage).toHaveBeenCalled()
    expect(result).toEqual({ id: 'sent-1', threadId: 'thread-1' })
  })

  it('sync_thread tool has correct name and description', () => {
    const tools = buildGmailTools(makeContext())
    const syncTool = tools.find((t) => t.name === 'integrations.gmail.sync_thread')
    expect(syncTool).toBeDefined()
    expect(syncTool!.description).toBe('Sync all messages in a Gmail thread as Orbit activities')
  })

  it('sync_thread tool execute calls listMessages and returns message count', async () => {
    const { listMessages } = await import('./operations.js')
    const tools = buildGmailTools(makeContext())
    const syncTool = tools.find((t) => t.name === 'integrations.gmail.sync_thread')!

    const result = await syncTool.execute({
      thread_id: 'thread-abc',
      max_messages: 10,
    })

    expect(listMessages).toHaveBeenCalled()
    expect(result).toEqual({
      messageCount: 1,
      messages: [{ id: 'msg-1', threadId: 'thread-1' }],
    })
  })
})
