import { z } from 'zod'
import type { IntegrationTool } from '../types.js'
import { sendMessage, listMessages } from './operations.js'
import { syncGmailMessage, type GmailSyncContext } from './sync.js'
import type { GmailConnectorConfig } from './types.js'
import type { CredentialStore } from '../credentials.js'
import { toIntegrationError } from '../errors.js'

export interface GmailToolContext {
  config: GmailConnectorConfig
  credentialStore: CredentialStore
  orgId: string
  syncContext: GmailSyncContext
}

/**
 * Build Gmail MCP tools. All tool names MUST start with 'integrations.'.
 */
export function buildGmailTools(context: GmailToolContext): IntegrationTool[] {
  return [
    {
      name: 'integrations.gmail.send_email',
      title: 'Send Email via Gmail',
      description: 'Send an email through the connected Gmail account',
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string(),
        body: z.string(),
        cc: z.array(z.string().email()).optional(),
        reply_to_message_id: z.string().optional(),
      }),
      async execute(args: Record<string, unknown>) {
        try {
          const input: { to: string; subject: string; body: string; cc?: string[]; replyToMessageId?: string } = {
            to: args['to'] as string,
            subject: args['subject'] as string,
            body: args['body'] as string,
          }
          const cc = args['cc'] as string[] | undefined
          if (cc !== undefined) input.cc = cc
          const replyTo = args['reply_to_message_id'] as string | undefined
          if (replyTo !== undefined) input.replyToMessageId = replyTo

          const result = await sendMessage(
            context.config,
            context.credentialStore,
            context.orgId,
            input,
          )
          return result.data
        } catch (err) {
          throw toIntegrationError(err, 'gmail')
        }
      },
    },
    {
      name: 'integrations.gmail.sync_thread',
      title: 'Sync Gmail Thread',
      description: 'Sync all messages in a Gmail thread as Orbit activities',
      inputSchema: z.object({
        thread_id: z.string(),
        max_messages: z.number().int().positive().default(50),
      }),
      async execute(args: Record<string, unknown>) {
        try {
          const listResult = await listMessages(
            context.config,
            context.credentialStore,
            context.orgId,
            {
              query: `rfc822msgid:${args['thread_id'] as string}`,
              maxResults: (args['max_messages'] as number | undefined) ?? 50,
            },
          )
          // Note: Full thread sync would get each message and call syncGmailMessage
          // For now, return the message list — full sync is done by pollGmailInbox
          return {
            messageCount: listResult.data.messages.length,
            messages: listResult.data.messages,
          }
        } catch (err) {
          throw toIntegrationError(err, 'gmail')
        }
      },
    },
  ]
}
