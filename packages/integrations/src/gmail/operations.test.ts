import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IntegrationError } from '../errors.js'
import type { GmailConnectorConfig } from './types.js'

// Setup googleapis mock
const mockMessagesList = vi.fn()
const mockMessagesGet = vi.fn()
const mockMessagesSend = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
      })),
    },
    gmail: vi.fn(() => ({
      users: {
        messages: {
          list: mockMessagesList,
          get: mockMessagesGet,
          send: mockMessagesSend,
        },
      },
    })),
  },
}))

vi.mock('./auth.js', () => ({
  getGmailClient: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
}))

const TEST_CONFIG: GmailConnectorConfig = {
  clientId: 'test-client-id',
  clientSecretEnv: 'TEST_SECRET',
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  auto_create_contacts: true,
}

const ORG_ID = 'org-test-1'

describe('Gmail operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listMessages', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('returns message list with correct shape', async () => {
      const { listMessages } = await loadOps()
      mockMessagesList.mockResolvedValue({
        data: {
          messages: [
            { id: 'msg-1', threadId: 'thread-1' },
            { id: 'msg-2', threadId: 'thread-2' },
          ],
          nextPageToken: 'page-token-2',
        },
      })

      const result = await listMessages(TEST_CONFIG, {} as never, ORG_ID)

      expect(result.provider).toBe('gmail')
      expect(result.data.messages).toHaveLength(2)
      expect(result.data.messages[0]).toEqual({ id: 'msg-1', threadId: 'thread-1' })
      expect(result.data.nextPageToken).toBe('page-token-2')
      expect(result.rawResponse).toBeDefined()
    })

    it('handles empty results', async () => {
      const { listMessages } = await loadOps()
      mockMessagesList.mockResolvedValue({
        data: { messages: undefined, nextPageToken: undefined },
      })

      const result = await listMessages(TEST_CONFIG, {} as never, ORG_ID)

      expect(result.data.messages).toEqual([])
      expect(result.data.nextPageToken).toBeUndefined()
    })

    it('passes maxResults, query, and pageToken params', async () => {
      const { listMessages } = await loadOps()
      mockMessagesList.mockResolvedValue({
        data: { messages: [], nextPageToken: undefined },
      })

      await listMessages(TEST_CONFIG, {} as never, ORG_ID, {
        maxResults: 10,
        query: 'from:test@example.com',
        pageToken: 'token-abc',
      })

      expect(mockMessagesList).toHaveBeenCalledWith({
        userId: 'me',
        maxResults: 10,
        q: 'from:test@example.com',
        pageToken: 'token-abc',
      })
    })
  })

  describe('getMessage', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('extracts headers correctly (from, to, subject, cc)', async () => {
      const { getMessage } = await loadOps()
      mockMessagesGet.mockResolvedValue({
        data: {
          id: 'msg-100',
          threadId: 'thread-100',
          labelIds: ['INBOX', 'UNREAD'],
          payload: {
            headers: [
              { name: 'From', value: 'alice@example.com' },
              { name: 'To', value: 'bob@example.com, charlie@example.com' },
              { name: 'Cc', value: 'dave@example.com' },
              { name: 'Subject', value: 'Hello World' },
              { name: 'Date', value: 'Thu, 10 Apr 2026 10:00:00 +0200' },
            ],
            body: { data: Buffer.from('Plain body text').toString('base64url') },
          },
        },
      })

      const result = await getMessage(TEST_CONFIG, {} as never, ORG_ID, 'msg-100')

      expect(result.data.id).toBe('msg-100')
      expect(result.data.threadId).toBe('thread-100')
      expect(result.data.from).toBe('alice@example.com')
      expect(result.data.to).toEqual(['bob@example.com', 'charlie@example.com'])
      expect(result.data.cc).toEqual(['dave@example.com'])
      expect(result.data.subject).toBe('Hello World')
      expect(result.data.date).toBe('Thu, 10 Apr 2026 10:00:00 +0200')
      expect(result.data.labels).toEqual(['INBOX', 'UNREAD'])
      expect(result.data.body).toBe('Plain body text')
    })

    it('extracts body from text/plain part', async () => {
      const { getMessage } = await loadOps()
      mockMessagesGet.mockResolvedValue({
        data: {
          id: 'msg-200',
          threadId: 'thread-200',
          labelIds: [],
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'me@example.com' },
              { name: 'Subject', value: 'Test' },
              { name: 'Date', value: '2026-04-10' },
            ],
            parts: [
              {
                mimeType: 'text/plain',
                body: { data: Buffer.from('Text body content').toString('base64url') },
              },
              {
                mimeType: 'text/html',
                body: { data: Buffer.from('<b>HTML body</b>').toString('base64url') },
              },
            ],
          },
        },
      })

      const result = await getMessage(TEST_CONFIG, {} as never, ORG_ID, 'msg-200')

      expect(result.data.body).toBe('Text body content')
    })

    it('handles multipart — prefers text/plain over text/html', async () => {
      const { getMessage } = await loadOps()
      mockMessagesGet.mockResolvedValue({
        data: {
          id: 'msg-300',
          threadId: 'thread-300',
          labelIds: [],
          payload: {
            headers: [
              { name: 'From', value: 'x@x.com' },
              { name: 'To', value: 'y@y.com' },
              { name: 'Subject', value: 'Multi' },
              { name: 'Date', value: '2026-04-10' },
            ],
            parts: [
              {
                mimeType: 'text/html',
                body: { data: Buffer.from('<p>HTML only</p>').toString('base64url') },
              },
            ],
          },
        },
      })

      const result = await getMessage(TEST_CONFIG, {} as never, ORG_ID, 'msg-300')

      // Falls back to HTML when no text/plain
      expect(result.data.body).toBe('<p>HTML only</p>')
    })
  })

  describe('sendMessage', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('builds RFC 2822 MIME and base64url encodes it', async () => {
      const { sendMessage } = await loadOps()
      mockMessagesSend.mockResolvedValue({
        data: { id: 'sent-1', threadId: 'thread-sent-1' },
      })

      const result = await sendMessage(TEST_CONFIG, {} as never, ORG_ID, {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Hello from test',
      })

      expect(result.data.id).toBe('sent-1')
      expect(result.data.threadId).toBe('thread-sent-1')
      expect(result.provider).toBe('gmail')

      // Verify MIME structure was base64url encoded
      const sendCall = mockMessagesSend.mock.calls[0][0]
      expect(sendCall.userId).toBe('me')
      const raw = sendCall.requestBody.raw
      const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
      expect(decoded).toContain('To: recipient@example.com')
      expect(decoded).toContain('Subject: Test Subject')
      expect(decoded).toContain('Content-Type: text/plain; charset=utf-8')
      expect(decoded).toContain('MIME-Version: 1.0')
      expect(decoded).toContain('Hello from test')
    })

    it('includes Cc header when provided', async () => {
      const { sendMessage } = await loadOps()
      mockMessagesSend.mockResolvedValue({
        data: { id: 'sent-2', threadId: 'thread-sent-2' },
      })

      await sendMessage(TEST_CONFIG, {} as never, ORG_ID, {
        to: 'a@a.com',
        subject: 'CC Test',
        body: 'Body',
        cc: ['b@b.com', 'c@c.com'],
      })

      const raw = mockMessagesSend.mock.calls[0][0].requestBody.raw
      const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
      expect(decoded).toContain('Cc: b@b.com, c@c.com')
    })

    it('strips CR/LF from MIME header fields to prevent injection', async () => {
      const { sendMessage } = await loadOps()
      mockMessagesSend.mockResolvedValue({ data: { id: 'msg_1', threadId: 'th_1' } })

      await sendMessage(TEST_CONFIG, {} as never, ORG_ID, {
        to: 'user@example.com',
        subject: 'Hello\r\nBcc: attacker@evil.com',
        body: 'test body',
      })

      const call = mockMessagesSend.mock.calls[0]![0] as Record<string, unknown>
      const raw = (call['requestBody'] as Record<string, string>)['raw']
      const decoded = Buffer.from(raw, 'base64url').toString('utf-8')

      // The injected Bcc header must NOT appear as a separate header line
      expect(decoded).not.toMatch(/^Bcc:/m)
      // Subject should be on a single line (CR/LF stripped)
      expect(decoded).toMatch(/^Subject: Hello Bcc: attacker@evil\.com$/m)
    })

    it('includes threadId for replies', async () => {
      const { sendMessage } = await loadOps()
      mockMessagesSend.mockResolvedValue({
        data: { id: 'sent-3', threadId: 'thread-reply' },
      })

      await sendMessage(TEST_CONFIG, {} as never, ORG_ID, {
        to: 'reply@example.com',
        subject: 'Re: Original',
        body: 'Reply body',
        replyToMessageId: 'thread-reply',
      })

      const sendCall = mockMessagesSend.mock.calls[0][0]
      expect(sendCall.requestBody.threadId).toBe('thread-reply')
    })
  })

  describe('error mapping', () => {
    async function loadOps() {
      return import('./operations.js')
    }

    it('maps 401 auth failure to AUTH_EXPIRED', async () => {
      const { listMessages } = await loadOps()
      mockMessagesList.mockRejectedValue(new Error('Request failed with status 401 Unauthorized'))

      try {
        await listMessages(TEST_CONFIG, {} as never, ORG_ID)
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('AUTH_EXPIRED')
        expect(ie.provider).toBe('gmail')
      }
    })

    it('maps 429 rate limit to RATE_LIMITED', async () => {
      const { getMessage } = await loadOps()
      mockMessagesGet.mockRejectedValue(new Error('Request failed with status 429 rate limit exceeded'))

      try {
        await getMessage(TEST_CONFIG, {} as never, ORG_ID, 'msg-x')
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('RATE_LIMITED')
        expect(ie.provider).toBe('gmail')
      }
    })

    it('maps 404 not found to NOT_FOUND', async () => {
      const { sendMessage } = await loadOps()
      mockMessagesSend.mockRejectedValue(new Error('Request failed with status 404 not found'))

      try {
        await sendMessage(TEST_CONFIG, {} as never, ORG_ID, {
          to: 'x@x.com',
          subject: 'Test',
          body: 'Body',
        })
        expect.fail('Should have thrown')
      } catch (err) {
        const ie = err as IntegrationError
        expect(ie._type).toBe('IntegrationError')
        expect(ie.code).toBe('NOT_FOUND')
        expect(ie.provider).toBe('gmail')
      }
    })
  })
})
