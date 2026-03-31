# Spec 6: `@orbit-ai/integrations`

Status: Ready for implementation
Package: `packages/integrations`
Depends on: `@orbit-ai/core`, `@orbit-ai/sdk`, `@orbit-ai/api`

## 1. Scope

`@orbit-ai/integrations` packages Orbit’s external connectors. MVP connectors are extracted from the existing Orbit CRM codebase in `~/smb-sale-crm-app`:

- Gmail
- Google Calendar
- Stripe

This package also owns:

- plugin registration architecture
- integration configuration loading
- connector-provided MCP tools and CLI commands
- outbound webhook event subscriptions for connector workflows

Outbound webhook delivery infrastructure itself remains in `@orbit-ai/api`; this package consumes it.

## 2. Package Structure

```text
packages/integrations/
├── src/
│   ├── index.ts
│   ├── registry.ts
│   ├── types.ts
│   ├── config.ts
│   ├── gmail/
│   │   ├── connector.ts
│   │   ├── oauth.ts
│   │   ├── sync.ts
│   │   ├── handlers.ts
│   │   └── mcp-tools.ts
│   ├── google-calendar/
│   │   ├── connector.ts
│   │   ├── oauth.ts
│   │   ├── sync.ts
│   │   ├── handlers.ts
│   │   └── mcp-tools.ts
│   ├── stripe/
│   │   ├── connector.ts
│   │   ├── sync.ts
│   │   ├── webhooks.ts
│   │   └── mcp-tools.ts
│   └── plugins/
│       └── load.ts
└── package.json
```

## 3. Integration Plugin Contract

```typescript
// packages/integrations/src/types.ts
import type { StorageAdapter } from '@orbit-ai/core'
import type { OrbitClient } from '@orbit-ai/sdk'

export interface IntegrationCommand {
  name: string
  description: string
  register(program: import('commander').Command, context: IntegrationRuntime): void
}

export interface IntegrationTool {
  name: string
  definition: import('@modelcontextprotocol/sdk/types.js').Tool
  execute(args: Record<string, unknown>, context: IntegrationRuntime): Promise<unknown>
}

export interface IntegrationWebhookHandler {
  event: string
  handle(payload: Record<string, unknown>, context: IntegrationRuntime): Promise<void>
}

export interface IntegrationRuntime {
  adapter: StorageAdapter
  client: OrbitClient
  config: Record<string, unknown>
}

export interface OrbitIntegrationPlugin {
  slug: string
  title: string
  version: string
  commands: IntegrationCommand[]
  tools: IntegrationTool[]
  outboundEventHandlers: IntegrationWebhookHandler[]
  install(context: IntegrationRuntime): Promise<void>
  uninstall?(context: IntegrationRuntime): Promise<void>
  healthcheck?(context: IntegrationRuntime): Promise<Record<string, unknown>>
}
```

## 4. Registry and Config

Project-level config file:

```json
{
  "gmail": {
    "enabled": true,
    "client_id": "google-client-id",
    "client_secret_env": "GOOGLE_CLIENT_SECRET",
    "redirect_uri": "http://localhost:3000/oauth/google/callback"
  },
  "google_calendar": {
    "enabled": true
  },
  "stripe": {
    "enabled": true,
    "secret_key_env": "STRIPE_SECRET_KEY",
    "webhook_secret_env": "STRIPE_WEBHOOK_SECRET"
  }
}
```

Stored at:

```text
.orbit/integrations.json
```

```typescript
// packages/integrations/src/registry.ts
import { gmailPlugin } from './gmail/connector'
import { googleCalendarPlugin } from './google-calendar/connector'
import { stripePlugin } from './stripe/connector'
import type { OrbitIntegrationPlugin } from './types'

export const integrationRegistry: Record<string, OrbitIntegrationPlugin> = {
  gmail: gmailPlugin,
  google_calendar: googleCalendarPlugin,
  stripe: stripePlugin,
}
```

## 5. Gmail Connector

Responsibilities:

- OAuth 2.0 flow for Google Workspace mail scopes
- import inbound and outbound email threads as `activities`
- optionally create contacts/companies from unknown participants
- sync thread metadata onto `activities.metadata`
- expose Gmail-specific CLI and MCP tools

Required extracted capabilities from the existing Orbit CRM:

- Gmail scan / polling job
- token refresh handling
- email-to-activity mapping

### 5.1 Gmail Connector Interface

```typescript
// packages/integrations/src/gmail/connector.ts
import type { OrbitIntegrationPlugin } from '../types'

export const gmailPlugin: OrbitIntegrationPlugin = {
  slug: 'gmail',
  title: 'Gmail',
  version: '0.1.0',
  commands: [],
  tools: [],
  outboundEventHandlers: [],
  async install(context) {
    await ensureGoogleConnectionTables(context.adapter)
  },
}
```

### 5.2 Gmail Sync Contract

```typescript
// packages/integrations/src/gmail/sync.ts
export interface GmailMessageSyncInput {
  organizationId: string
  userId: string
  gmailMessageId: string
  threadId: string
  subject: string
  bodyText: string
  bodyHtml?: string
  from: string
  to: string[]
  cc: string[]
  sentAt: string
}

export async function syncGmailMessage(
  runtime: import('../types').IntegrationRuntime,
  input: GmailMessageSyncInput,
) {
  const participant = await findOrCreateContactFromEmail(runtime.client, input.from)

  return runtime.client.activities.create({
    type: 'email',
    subject: input.subject,
    body: input.bodyText,
    contact_id: participant.id,
    occurred_at: input.sentAt,
    direction: 'inbound',
    metadata: {
      gmail_message_id: input.gmailMessageId,
      gmail_thread_id: input.threadId,
      to: input.to,
      cc: input.cc,
    },
  })
}
```

### 5.3 Gmail MCP Tools

- `gmail_send_email`
- `gmail_sync_thread`

These tools are integration-scoped and registered only when the plugin is enabled.

## 6. Google Calendar Connector

Responsibilities:

- sync meetings into `activities`
- create follow-up `tasks` from RSVP or booking changes
- support booking page availability reads in a later package without blocking MVP
- expose event create/list tools

```typescript
// packages/integrations/src/google-calendar/sync.ts
export interface CalendarEventSyncInput {
  organizationId: string
  userId: string
  externalEventId: string
  title: string
  description?: string
  startsAt: string
  endsAt: string
  attendeeEmails: string[]
}

export async function syncCalendarEvent(
  runtime: import('../types').IntegrationRuntime,
  input: CalendarEventSyncInput,
) {
  const primaryContact = await findOrCreateContactByAttendees(runtime.client, input.attendeeEmails)

  return runtime.client.activities.create({
    type: 'meeting',
    subject: input.title,
    body: input.description,
    contact_id: primaryContact?.id,
    occurred_at: input.startsAt,
    duration_minutes: Math.max(
      0,
      Math.round((new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) / 60000),
    ),
    metadata: {
      external_event_id: input.externalEventId,
      attendee_emails: input.attendeeEmails,
      source: 'google_calendar',
    },
  })
}
```

Calendar-specific MCP tools:

- `calendar_list_events`
- `calendar_create_event`

Calendar-specific CLI commands:

- `orbit calendar list`
- `orbit calendar create`
- `orbit calendar sync`

## 7. Stripe Connector

Responsibilities:

- create payment links
- sync Stripe payments into `payments`
- optionally link charges to deals and contacts
- support Express Connect metadata from the legacy app where still relevant

```typescript
// packages/integrations/src/stripe/sync.ts
import Stripe from 'stripe'

export async function syncStripeCheckoutSession(
  runtime: import('../types').IntegrationRuntime,
  stripeClient: Stripe,
  sessionId: string,
) {
  const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent', 'customer'],
  })

  return runtime.client.payments.create({
    amount: ((session.amount_total ?? 0) / 100).toFixed(2),
    currency: (session.currency ?? 'usd').toUpperCase(),
    status: session.payment_status,
    method: 'stripe',
    external_id: session.id,
    contact_id: typeof session.customer === 'object' ? session.customer.metadata.orbit_contact_id : undefined,
    deal_id: session.metadata.orbit_deal_id,
    custom_fields: {
      checkout_session_id: session.id,
      payment_intent_id: typeof session.payment_intent === 'object' ? session.payment_intent.id : session.payment_intent,
    },
  })
}
```

Stripe-specific MCP tools:

- `stripe_create_payment_link`
- `stripe_get_payment_status`

Stripe-specific CLI commands:

- `orbit payments link create`
- `orbit payments sync stripe`

## 8. Connector-Owned Tables

Connector credentials and sync state need first-party tables. These are still Orbit tables and must follow the core invariants.

Required tables:

- `integration_connections`
- `integration_sync_state`

Example definitions:

```typescript
// packages/integrations/src/schema.ts
import { orbit, text, jsonb, boolean, timestamp } from '@orbit-ai/core/schema/helpers'
import { organizations, users } from '@orbit-ai/core/schema/tables'

export const integrationConnections = orbit.table('integration_connections', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  provider: text('provider').notNull(),
  userId: text('user_id').references(() => users.id),
  status: text('status').notNull().default('active'),
  credentialsEncrypted: text('credentials_encrypted').notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

## 9. Plugin Loading

```typescript
// packages/integrations/src/plugins/load.ts
import { integrationRegistry } from '../registry'

export async function loadEnabledIntegrations(
  runtime: import('../types').IntegrationRuntime,
  config: Record<string, { enabled?: boolean }>,
) {
  const enabled = Object.entries(config)
    .filter(([, value]) => value.enabled)
    .map(([slug]) => slug)

  return Promise.all(
    enabled.map(async (slug) => {
      const plugin = integrationRegistry[slug]
      if (!plugin) throw new Error(`Unknown integration plugin "${slug}"`)
      await plugin.install({ ...runtime, config: config[slug] ?? {} })
      return plugin
    }),
  )
}
```

## 10. CLI and MCP Registration

Integration packages must register their commands and tools dynamically.

```typescript
// packages/integrations/src/index.ts
export async function registerIntegrationCommands(
  program: import('commander').Command,
  runtime: import('./types').IntegrationRuntime,
  config: Record<string, unknown>,
) {
  const plugins = await loadEnabledIntegrations(runtime, config as Record<string, { enabled?: boolean }>)
  for (const plugin of plugins) {
    for (const command of plugin.commands) {
      command.register(program, runtime)
    }
  }
}

export async function getIntegrationTools(
  runtime: import('./types').IntegrationRuntime,
  config: Record<string, unknown>,
) {
  const plugins = await loadEnabledIntegrations(runtime, config as Record<string, { enabled?: boolean }>)
  return plugins.flatMap((plugin) => plugin.tools)
}
```

## 11. Outbound Webhook Consumption

Integrations consume API-layer events to trigger sync behavior.

Examples:

- `contact.created` -> optionally create Google Contacts entry later
- `deal.stage_moved` -> optionally create Calendar follow-up
- `payment.created` -> enrich Stripe metadata or send receipt email

Connector handlers are registered by event name and invoked from the webhook delivery worker or an internal event bus.

## 12. Extraction Guidance From `~/smb-sale-crm-app`

Before implementation, extract these bounded capabilities:

- Gmail OAuth token lifecycle and mailbox scan logic
- Google Calendar token lifecycle and event sync mapping
- Stripe payment link / webhook / transaction normalization

Do not carry over:

- Next.js route handlers
- app-specific UI state
- SMB-specific wording, field names, or pricing rules
- assumptions that the source CRM owns the frontend

The target output is a reusable connector package, not a direct port.

## 13. Acceptance Criteria

1. The package can enable Gmail, Google Calendar, and Stripe via `.orbit/integrations.json`.
2. Each connector exposes installation logic, commands, tools, and sync handlers.
3. Connector state is stored in Orbit-owned tenant-scoped tables.
4. Connectors reuse the API webhook system rather than inventing a second delivery mechanism.
5. Commands and tools are registered dynamically only when the plugin is enabled.
