import type { GmailMessage } from './types.js'
import {
  findOrCreateContactFromEmail,
  detectDirection,
  type ContactLookupClient,
  type CompanyLookupClient,
} from '../shared/contacts.js'
import { toIntegrationError } from '../errors.js'

export interface GmailSyncContext {
  orgId: string
  contactClient: ContactLookupClient
  companyClient: CompanyLookupClient
  orgUserEmails: string[] // emails of org members (for direction detection)
  autoCreateContacts: boolean
}

export interface ActivityInput {
  type: string
  subject?: string
  body?: string
  direction?: string
  contact_id?: string
  company_id?: string
  metadata?: Record<string, unknown>
  occurred_at?: string
}

/**
 * Sync a Gmail message into an Orbit activity.
 * Returns the activity input shape that should be passed to the SDK's activities.create().
 */
export async function syncGmailMessage(
  context: GmailSyncContext,
  message: GmailMessage,
): Promise<{ activity: ActivityInput; contactId: string; created: boolean }> {
  try {
    const direction = detectDirection(message.from, context.orgUserEmails)

    // For inbound: sender is the contact. For outbound: first recipient is the contact.
    const contactEmail =
      direction === 'inbound'
        ? extractEmail(message.from)
        : extractEmail(message.to[0] ?? '')

    const { contactId, created } = await findOrCreateContactFromEmail(
      context.contactClient,
      context.companyClient,
      context.orgId,
      contactEmail,
      { autoCreate: context.autoCreateContacts },
    )

    const activity: ActivityInput = {
      type: 'email',
      subject: message.subject,
      body: message.body,
      direction,
      contact_id: contactId,
      metadata: {
        gmail_message_id: message.id,
        gmail_thread_id: message.threadId,
        gmail_labels: message.labels,
      },
      occurred_at: message.date
        ? new Date(message.date).toISOString()
        : new Date().toISOString(),
    }

    return { activity, contactId, created }
  } catch (err) {
    throw toIntegrationError(err, 'gmail')
  }
}

/**
 * Extract bare email from "Display Name <email@example.com>" format.
 */
function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1]! : raw).toLowerCase().trim()
}
