import type { GmailConnectorConfig } from './types.js'
import type { CredentialStore } from '../credentials.js'
import { listMessages, getMessage } from './operations.js'
import { syncGmailMessage, type GmailSyncContext, type ActivityInput } from './sync.js'
import { toIntegrationError } from '../errors.js'

export interface PollGmailOptions {
  maxMessages?: number     // default: 50
  maxDurationMs?: number   // default: 30_000 (30 seconds)
}

export interface PollGmailResult {
  synced: number
  activities: ActivityInput[]
  newCursor?: string       // next page token for continuation
  stoppedEarly: boolean    // true if hit maxMessages or maxDuration
}

/**
 * Poll Gmail inbox for new messages since the last sync cursor.
 * Queries Gmail API, syncs each new message, returns activity inputs.
 * Bounded by maxMessages and maxDuration to prevent runaway polls.
 */
export async function pollGmailInbox(
  config: GmailConnectorConfig,
  credentialStore: CredentialStore,
  orgId: string,
  syncContext: GmailSyncContext,
  cursor?: string,
  options?: PollGmailOptions,
): Promise<PollGmailResult> {
  const maxMessages = options?.maxMessages ?? 50
  const maxDurationMs = options?.maxDurationMs ?? 30_000
  const startTime = Date.now()
  const activities: ActivityInput[] = []
  let pageToken = cursor
  let stoppedEarly = false

  try {
    let messagesProcessed = 0

    while (messagesProcessed < maxMessages) {
      // Check time bound
      if (Date.now() - startTime > maxDurationMs) {
        stoppedEarly = true
        break
      }

      const batchSize = Math.min(20, maxMessages - messagesProcessed)
      const listOpts: { maxResults: number; pageToken?: string; query?: string } = {
        maxResults: batchSize,
      }
      if (pageToken !== undefined) listOpts.pageToken = pageToken
      if (cursor !== undefined) listOpts.query = `after:${cursor}`
      const listResult = await listMessages(config, credentialStore, orgId, listOpts)

      if (listResult.data.messages.length === 0) break

      for (const msgSummary of listResult.data.messages) {
        if (messagesProcessed >= maxMessages) {
          stoppedEarly = true
          break
        }
        if (Date.now() - startTime > maxDurationMs) {
          stoppedEarly = true
          break
        }

        const fullMessage = await getMessage(config, credentialStore, orgId, msgSummary.id)
        const syncResult = await syncGmailMessage(syncContext, fullMessage.data)
        activities.push(syncResult.activity)
        messagesProcessed++
      }

      pageToken = listResult.data.nextPageToken
      if (!pageToken) break
    }

    const result: PollGmailResult = {
      synced: activities.length,
      activities,
      stoppedEarly,
    }
    if (pageToken !== undefined) result.newCursor = pageToken
    return result
  } catch (err) {
    throw toIntegrationError(err, 'gmail')
  }
}
