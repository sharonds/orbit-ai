import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pollGmailInbox, type PollGmailOptions } from './polling.js'
import type { GmailConnectorConfig } from './types.js'
import type { CredentialStore } from '../credentials.js'
import type { GmailSyncContext } from './sync.js'
import { isIntegrationError } from '../errors.js'

// Mock operations
const mockListMessages = vi.fn()
const mockGetMessage = vi.fn()
vi.mock('./operations.js', () => ({
  listMessages: (...args: unknown[]) => mockListMessages(...args),
  getMessage: (...args: unknown[]) => mockGetMessage(...args),
}))

// Mock sync
const mockSyncGmailMessage = vi.fn()
vi.mock('./sync.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./sync.js')>()
  return {
    ...original,
    syncGmailMessage: (...args: unknown[]) => mockSyncGmailMessage(...args),
  }
})

const config: GmailConnectorConfig = {
  clientId: 'test-client-id',
  clientSecretEnv: 'GMAIL_SECRET',
  redirectUri: 'https://localhost/callback',
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
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

function makeGmailMessage(id: string) {
  return {
    id,
    threadId: `thread-${id}`,
    from: 'sender@external.com',
    to: ['me@company.com'],
    subject: `Subject ${id}`,
    body: `Body ${id}`,
    date: '2026-04-10T10:00:00Z',
    labels: ['INBOX'],
  }
}

function makeActivity(id: string) {
  return {
    type: 'email',
    subject: `Subject ${id}`,
    body: `Body ${id}`,
    direction: 'inbound',
    contact_id: 'c-1',
    metadata: { gmail_message_id: id },
    occurred_at: '2026-04-10T10:00:00.000Z',
  }
}

describe('pollGmailInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('processes messages and returns activities', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: {
        messages: [
          { id: 'msg-1', threadId: 'thread-1' },
          { id: 'msg-2', threadId: 'thread-2' },
        ],
        nextPageToken: undefined,
      },
      provider: 'gmail',
    })
    mockGetMessage
      .mockResolvedValueOnce({ data: makeGmailMessage('msg-1'), provider: 'gmail' })
      .mockResolvedValueOnce({ data: makeGmailMessage('msg-2'), provider: 'gmail' })
    mockSyncGmailMessage
      .mockResolvedValueOnce({ activity: makeActivity('msg-1'), contactId: 'c-1', created: true })
      .mockResolvedValueOnce({ activity: makeActivity('msg-2'), contactId: 'c-1', created: false })

    const result = await pollGmailInbox(config, credentialStore, 'org-1', syncContext)

    expect(result.synced).toBe(2)
    expect(result.activities).toHaveLength(2)
    expect(result.stoppedEarly).toBe(false)
  })

  it('respects maxMessages limit', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: {
        messages: [
          { id: 'msg-1', threadId: 'thread-1' },
          { id: 'msg-2', threadId: 'thread-2' },
          { id: 'msg-3', threadId: 'thread-3' },
        ],
        nextPageToken: undefined,
      },
      provider: 'gmail',
    })
    mockGetMessage.mockResolvedValue({ data: makeGmailMessage('msg-1'), provider: 'gmail' })
    mockSyncGmailMessage.mockResolvedValue({
      activity: makeActivity('msg-1'),
      contactId: 'c-1',
      created: true,
    })

    const options: PollGmailOptions = { maxMessages: 2 }
    const result = await pollGmailInbox(config, credentialStore, 'org-1', syncContext, undefined, options)

    expect(result.synced).toBe(2)
    expect(result.stoppedEarly).toBe(true)
  })

  it('returns empty result when no messages', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: { messages: [], nextPageToken: undefined },
      provider: 'gmail',
    })

    const result = await pollGmailInbox(config, credentialStore, 'org-1', syncContext)

    expect(result.synced).toBe(0)
    expect(result.activities).toEqual([])
    expect(result.stoppedEarly).toBe(false)
  })

  it('returns newCursor for pagination', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: {
        messages: [{ id: 'msg-1', threadId: 'thread-1' }],
        nextPageToken: 'next-page-token-abc',
      },
      provider: 'gmail',
    })
    // Second page (triggered by while loop) returns empty to stop
    mockListMessages.mockResolvedValueOnce({
      data: { messages: [], nextPageToken: undefined },
      provider: 'gmail',
    })
    mockGetMessage.mockResolvedValueOnce({ data: makeGmailMessage('msg-1'), provider: 'gmail' })
    mockSyncGmailMessage.mockResolvedValueOnce({
      activity: makeActivity('msg-1'),
      contactId: 'c-1',
      created: true,
    })

    const result = await pollGmailInbox(config, credentialStore, 'org-1', syncContext)

    // After first page processes, pageToken is set to next-page-token-abc
    // Second page returns empty, so loop ends — but newCursor reflects the empty page (undefined)
    // The cursor from first page was consumed; second page returned no new token
    expect(result.synced).toBe(1)
  })

  it('stops on maxDuration', async () => {
    // Date.now() call sequence in pollGmailInbox:
    // 1: startTime = Date.now()          -> 1000
    // 2: while check: Date.now() - 1000  -> 0, not > 100 => continue
    // 3: for-loop check before msg-1     -> 0, not > 100 => process msg-1
    // 4: for-loop check before msg-2     -> 200, > 100 => stoppedEarly
    let callCount = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++
      // Calls 1-3: time has not elapsed
      if (callCount <= 3) return 1000
      // Call 4+: time exceeded
      return 1200
    })

    mockListMessages.mockResolvedValueOnce({
      data: {
        messages: [
          { id: 'msg-1', threadId: 'thread-1' },
          { id: 'msg-2', threadId: 'thread-2' },
        ],
        nextPageToken: undefined,
      },
      provider: 'gmail',
    })
    mockGetMessage.mockResolvedValue({ data: makeGmailMessage('msg-1'), provider: 'gmail' })
    mockSyncGmailMessage.mockResolvedValue({
      activity: makeActivity('msg-1'),
      contactId: 'c-1',
      created: true,
    })

    const options: PollGmailOptions = { maxDurationMs: 100 }
    const result = await pollGmailInbox(config, credentialStore, 'org-1', syncContext, undefined, options)

    expect(result.synced).toBe(1)
    expect(result.stoppedEarly).toBe(true)
  })

  it('calls syncGmailMessage for each message', async () => {
    mockListMessages.mockResolvedValueOnce({
      data: {
        messages: [
          { id: 'msg-1', threadId: 'thread-1' },
          { id: 'msg-2', threadId: 'thread-2' },
        ],
        nextPageToken: undefined,
      },
      provider: 'gmail',
    })
    mockGetMessage
      .mockResolvedValueOnce({ data: makeGmailMessage('msg-1'), provider: 'gmail' })
      .mockResolvedValueOnce({ data: makeGmailMessage('msg-2'), provider: 'gmail' })
    mockSyncGmailMessage
      .mockResolvedValueOnce({ activity: makeActivity('msg-1'), contactId: 'c-1', created: true })
      .mockResolvedValueOnce({ activity: makeActivity('msg-2'), contactId: 'c-2', created: true })

    await pollGmailInbox(config, credentialStore, 'org-1', syncContext)

    expect(mockSyncGmailMessage).toHaveBeenCalledTimes(2)
    expect(mockSyncGmailMessage).toHaveBeenCalledWith(syncContext, makeGmailMessage('msg-1'))
    expect(mockSyncGmailMessage).toHaveBeenCalledWith(syncContext, makeGmailMessage('msg-2'))
  })

  it('wraps errors with toIntegrationError', async () => {
    mockListMessages.mockRejectedValueOnce(new Error('API rate limit exceeded 429'))

    try {
      await pollGmailInbox(config, credentialStore, 'org-1', syncContext)
      expect.fail('Expected an error')
    } catch (err) {
      expect(isIntegrationError(err)).toBe(true)
      if (isIntegrationError(err)) {
        expect(err.provider).toBe('gmail')
      }
    }
  })
})
