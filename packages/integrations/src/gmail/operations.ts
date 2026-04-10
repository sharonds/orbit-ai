import { google, type gmail_v1 } from 'googleapis'
import type { GmailConnectorConfig, GmailMessage, GmailSendInput } from './types.js'
import type { IntegrationResult } from '../types.js'
import { toIntegrationError } from '../errors.js'
import { getGmailClient } from './auth.js'
import type { CredentialStore } from '../credentials.js'

/**
 * Create an authenticated Gmail API client instance.
 */
async function getGmailApi(
  config: GmailConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
): Promise<gmail_v1.Gmail> {
  const { accessToken } = await getGmailClient(config, credentialStore, orgId)
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.gmail({ version: 'v1', auth })
}

/**
 * List messages from Gmail inbox.
 */
export async function listMessages(
  config: GmailConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  options?: { maxResults?: number; query?: string; pageToken?: string },
): Promise<IntegrationResult<{ messages: Array<{ id: string; threadId: string }>; nextPageToken?: string }>> {
  try {
    const gmail = await getGmailApi(config, credentialStore, orgId)

    const listParams: Record<string, unknown> = {
      userId: 'me',
      maxResults: options?.maxResults ?? 20,
    }
    if (options?.query) listParams['q'] = options.query
    if (options?.pageToken) listParams['pageToken'] = options.pageToken

    const response = await gmail.users.messages.list(
      listParams as gmail_v1.Params$Resource$Users$Messages$List,
    )

    const data = response.data as gmail_v1.Schema$ListMessagesResponse
    const messages = (data.messages ?? []).map((m) => ({
      id: m.id ?? '',
      threadId: m.threadId ?? '',
    }))

    const resultData: { messages: Array<{ id: string; threadId: string }>; nextPageToken?: string } =
      { messages }
    if (data.nextPageToken) {
      resultData.nextPageToken = data.nextPageToken
    }

    return {
      data: resultData,
      provider: 'gmail',
      rawResponse: data,
    }
  } catch (err) {
    throw toIntegrationError(err, 'gmail')
  }
}

/**
 * Get a single Gmail message by ID.
 */
export async function getMessage(
  config: GmailConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  messageId: string,
): Promise<IntegrationResult<GmailMessage>> {
  try {
    const gmail = await getGmailApi(config, credentialStore, orgId)
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    const headers = response.data.payload?.headers ?? []
    const getHeader = (name: string): string =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

    const body = extractBody(response.data.payload)

    const ccHeader = getHeader('cc')
    const ccList = ccHeader ? ccHeader.split(',').map((s) => s.trim()).filter(Boolean) : []

    const base = {
      id: response.data.id ?? '',
      threadId: response.data.threadId ?? '',
      from: getHeader('from'),
      to: getHeader('to').split(',').map((s) => s.trim()).filter(Boolean),
      subject: getHeader('subject'),
      body,
      date: getHeader('date'),
      labels: response.data.labelIds ?? [],
    }

    const message: GmailMessage = ccList.length > 0
      ? { ...base, cc: ccList }
      : base

    return { data: message, provider: 'gmail', rawResponse: response.data }
  } catch (err) {
    throw toIntegrationError(err, 'gmail')
  }
}

/**
 * Send a Gmail message.
 * Constructs an RFC 2822 MIME message and base64url-encodes it per Gmail API spec.
 */
export async function sendMessage(
  config: GmailConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  input: GmailSendInput,
): Promise<IntegrationResult<{ id: string; threadId: string }>> {
  try {
    const gmail = await getGmailApi(config, credentialStore, orgId)

    // Build RFC 2822 MIME message
    const mimeLines: string[] = [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
    ]
    if (input.cc && input.cc.length > 0) {
      mimeLines.push(`Cc: ${input.cc.join(', ')}`)
    }
    mimeLines.push('', input.body)
    const mimeString = mimeLines.join('\r\n')

    // base64url encode per Gmail API spec
    const raw = Buffer.from(mimeString).toString('base64url')

    const params: gmail_v1.Params$Resource$Users$Messages$Send = {
      userId: 'me',
      requestBody: { raw },
    }
    if (input.replyToMessageId) {
      params.requestBody = { raw, threadId: input.replyToMessageId }
    }

    const response = await gmail.users.messages.send(params)

    return {
      data: {
        id: response.data.id ?? '',
        threadId: response.data.threadId ?? '',
      },
      provider: 'gmail',
      rawResponse: response.data,
    }
  } catch (err) {
    throw toIntegrationError(err, 'gmail')
  }
}

/**
 * Extract body text from Gmail payload (handles multipart MIME).
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''

  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }

  // Multipart — search for text/plain first, then text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      }
    }
    // Nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }

  return ''
}
