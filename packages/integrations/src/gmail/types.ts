import { z } from 'zod'

export const gmailConnectorConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecretEnv: z.string().min(1), // env var name that holds the secret
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default([
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ]),
  auto_create_contacts: z.boolean().default(true),
})

export type GmailConnectorConfig = z.infer<typeof gmailConnectorConfigSchema>

export interface GmailMessage {
  id: string
  threadId: string
  from: string
  to: string[]
  cc?: string[]
  subject: string
  body: string
  date: string // ISO timestamp
  labels: string[]
}

export interface GmailSendInput {
  to: string
  subject: string
  body: string
  cc?: string[]
  replyToMessageId?: string
}
