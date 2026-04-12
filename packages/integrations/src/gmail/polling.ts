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
  // Tracks the last page token for which we fully processed all messages.
  // Starts as the incoming cursor (so on mid-page interruption we can resume from there).
  let lastCompletedPageToken = cursor

  try {
    let messagesProcessed = 0

    while (messagesProcessed < maxMessages) {
      // Check time bound
      if (Date.now() - startTime > maxDurationMs) {
        stoppedEarly = true
        break
      }

      const currentPageToken = pageToken
      const batchSize = Math.min(20, maxMessages - messagesProcessed)
      const listOpts: { maxResults: number; pageToken?: string } = {
        maxResults: batchSize,
      }
      if (currentPageToken !== undefined) listOpts.pageToken = currentPageToken
      const listResult = await listMessages(config, credentialStore, orgId, listOpts)

      if (listResult.data.messages.length === 0) break

      let pageFullyProcessed = true
      for (const msgSummary of listResult.data.messages) {
        if (messagesProcessed >= maxMessages) {
          stoppedEarly = true
          pageFullyProcessed = false
          break
        }
        if (Date.now() - startTime > maxDurationMs) {
          stoppedEarly = true
          pageFullyProcessed = false
          break
        }

        const fullMessage = await getMessage(config, credentialStore, orgId, msgSummary.id)
        const syncResult = await syncGmailMessage(syncContext, fullMessage.data)
        activities.push(syncResult.activity)
        messagesProcessed++
      }

      pageToken = listResult.data.nextPageToken
      if (pageFullyProcessed) {
        // Only advance the completed cursor when the page was fully processed.
        // This means newCursor points to the next unprocessed page.
        lastCompletedPageToken = pageToken
      }
      if (!pageToken) break
    }

    const result: PollGmailResult = {
      synced: activities.length,
      activities,
      stoppedEarly,
    }
    if (lastCompletedPageToken !== undefined) result.newCursor = lastCompletedPageToken
    return result
  } catch (err) {
    throw toIntegrationError(err, 'gmail')
  }
}
