// @orbit-ai/integrations — Drizzle table definitions for integration tables.
// These are Postgres-native (pgTable). Actual migrations go through
// PluginSchemaExtension.migrations (see schema-extension.ts).

import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    provider: text('provider').notNull(),
    connectionType: text('connection_type').notNull().default('oauth2'),
    userId: text('user_id'),
    status: text('status').notNull().default('active'),
    credentialsEncrypted: text('credentials_encrypted'),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    providerAccountId: text('provider_account_id'),
    providerWebhookId: text('provider_webhook_id'),
    scopes: text('scopes'),
    failureCount: integer('failure_count').notNull().default(0),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('ic_org_provider_user_idx').on(table.organizationId, table.provider, table.userId),
    index('ic_org_provider_idx').on(table.organizationId, table.provider),
    index('ic_org_status_idx').on(table.organizationId, table.status),
  ],
)

export const integrationSyncState = pgTable(
  'integration_sync_state',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id').notNull(),
    stream: text('stream').notNull(),
    cursor: text('cursor'),
    processedEventIds: jsonb('processed_event_ids').$type<string[]>().default([]),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('iss_connection_stream_idx').on(table.connectionId, table.stream),
  ],
)
