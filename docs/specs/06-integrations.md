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
- connector-provided extension MCP tools and CLI commands
- outbound webhook event subscriptions for connector workflows

Outbound webhook delivery infrastructure itself remains in `@orbit-ai/api`; this package consumes it.

Extension model:

- `@orbit-ai/mcp` itself remains fixed at 23 core tools
- integrations may add extension tools only when running in a composite server alongside `@orbit-ai/mcp`
- integration tool names must be namespaced, for example `integrations.gmail.send_email`

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
  eventBus: OrbitIntegrationEventBus
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

```typescript
export interface OrbitIntegrationEventBus {
  publish(event: { type: string; organizationId: string; payload: Record<string, unknown> }): Promise<void>
  subscribe(pattern: string, handler: IntegrationWebhookHandler): Promise<void>
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

Shared connector helpers live in `packages/integrations/src/shared/contacts.ts` and own:

- `findOrCreateContactFromEmail`
- `findOrCreateContactByAttendees`
- contact/company dedupe rules
- the policy for when connectors are allowed to auto-create records

Dedupe rules:

1. exact normalized email match
2. existing company match by domain
3. create only when connector config explicitly allows auto-create

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

- `integrations.gmail.send_email`
- `integrations.gmail.sync_thread`

These are extension tools and are registered only when the plugin is enabled in a composite MCP runtime.

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

- `integrations.google_calendar.list_events`
- `integrations.google_calendar.create_event`

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

- `integrations.stripe.create_payment_link`
- `integrations.stripe.get_payment_status`

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
import { orbit, text, jsonb, integer, timestamp } from '@orbit-ai/core/schema/helpers'
import { organizations, users } from '@orbit-ai/core/schema/tables'

export const integrationConnections = orbit.table('integration_connections', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  provider: text('provider').notNull(),
  connectionType: text('connection_type').notNull().default('oauth'),
  userId: text('user_id').references(() => users.id),
  status: text('status').notNull().default('active'),
  credentialsEncrypted: text('credentials_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  providerAccountId: text('provider_account_id'),
  providerWebhookId: text('provider_webhook_id'),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  failureCount: integer('failure_count').notNull().default(0),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const integrationSyncState = orbit.table('integration_sync_state', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  provider: text('provider').notNull(),
  connectionId: text('connection_id').notNull().references(() => integrationConnections.id),
  stream: text('stream').notNull(),
  cursor: text('cursor'),
  checkpoint: jsonb('checkpoint').$type<Record<string, unknown>>().notNull().default({}),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastSeenExternalUpdatedAt: timestamp('last_seen_external_updated_at', { withTimezone: true }),
  failureCount: integer('failure_count').notNull().default(0),
  lastError: text('last_error'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

These tables must be registered through the core plugin schema extension contract so they receive migrations, tenant filtering, and RLS coverage like first-party tenant tables.

```typescript
// packages/integrations/src/schema-extension.ts
export const integrationSchemaExtension: import('@orbit-ai/core').PluginSchemaExtension = {
  key: 'integrations',
  tables: ['integration_connections', 'integration_sync_state'],
  tenantScopedTables: ['integration_connections', 'integration_sync_state'],
  migrations: [
    {
      id: '20260401_integrations_base',
      up: ['create table orbit.integration_connections (...)', 'create table orbit.integration_sync_state (...)'],
      down: ['drop table orbit.integration_sync_state', 'drop table orbit.integration_connections'],
    },
  ],
}
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

Integration packages must register their commands and extension tools dynamically.

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

Composite MCP runtime rule:

- the base `@orbit-ai/mcp` server registers the 23 core tools
- the composite runtime may append integration extension tools after loading enabled plugins
- extension tools must not shadow or replace core tool names

## 11. Event Architecture

Integrations depend on three distinct event paths.

### 11.1 Internal Orbit Domain Events

Used for connector reactions to Orbit changes:

- `contact.created`
- `deal.stage_moved`
- `payment.created`

These are published on the internal event bus and consumed by integration handlers.

### 11.2 Outbound Customer Webhooks

Used to notify Orbit customers and external automation systems.

- delivered by the API webhook delivery worker
- not reused as the connector event bus
- uses the Standard Webhooks contract from the API spec

### 11.3 Inbound Provider Webhooks and Polling

Used to ingest changes from Gmail, Google Calendar, and Stripe.

- Stripe: provider webhooks
- Gmail: polling and optional Gmail push watch support
- Google Calendar: provider webhooks where available plus polling fallback

Integrations must not route inbound provider events through the customer outbound webhook delivery worker.

## 12. Connector Event Consumption

Integrations consume internal Orbit events to trigger follow-on connector behavior.

Examples:

- `contact.created` -> optionally create Google Contacts entry later
- `deal.stage_moved` -> optionally create Calendar follow-up
- `payment.created` -> enrich Stripe metadata or send receipt email

Connector handlers are registered by event name and invoked from the internal event bus or provider-specific inbound webhook/polling workers, depending on direction.

## 13. Extraction Guidance From `~/smb-sale-crm-app`

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

## 14. Acceptance Criteria

1. The package can enable Gmail, Google Calendar, and Stripe via `.orbit/integrations.json`.
2. Each connector exposes installation logic, commands, tools, and sync handlers.
3. Connector state is stored in Orbit-owned tenant-scoped tables.
4. Connector tables are registered through the core plugin schema extension contract.
5. Commands and extension tools are registered dynamically only when the plugin is enabled.
6. Connector flows distinguish internal domain events, outbound customer webhooks, and inbound provider webhooks/polling.
