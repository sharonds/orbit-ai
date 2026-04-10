import type { PluginSchemaExtension } from '@orbit-ai/core'

export const integrationSchemaExtension: PluginSchemaExtension = {
  key: 'orbit-integrations',
  tables: ['integration_connections', 'integration_sync_state'],
  tenantScopedTables: ['integration_connections', 'integration_sync_state'],
  migrations: [
    {
      id: '001_create_integration_connections',
      up: [
        `CREATE TABLE IF NOT EXISTS integration_connections (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          connection_type TEXT NOT NULL DEFAULT 'oauth2',
          user_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          credentials_encrypted TEXT,
          refresh_token_encrypted TEXT,
          access_token_expires_at TIMESTAMPTZ,
          provider_account_id TEXT,
          provider_webhook_id TEXT,
          scopes TEXT,
          failure_count INTEGER NOT NULL DEFAULT 0,
          last_success_at TIMESTAMPTZ,
          last_failure_at TIMESTAMPTZ,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS ic_org_provider_user_idx
          ON integration_connections(organization_id, provider, user_id)`,
        `CREATE INDEX IF NOT EXISTS ic_org_provider_idx
          ON integration_connections(organization_id, provider)`,
        `CREATE INDEX IF NOT EXISTS ic_org_status_idx
          ON integration_connections(organization_id, status)`,
        `ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY ic_tenant_isolation ON integration_connections
          USING (organization_id = current_setting('app.current_org_id', TRUE))`,
      ],
      down: [
        `DROP TABLE IF EXISTS integration_connections`,
      ],
    },
    {
      id: '002_create_integration_sync_state',
      up: [
        `CREATE TABLE IF NOT EXISTS integration_sync_state (
          id TEXT PRIMARY KEY,
          connection_id TEXT NOT NULL,
          stream TEXT NOT NULL,
          cursor TEXT,
          processed_event_ids JSONB DEFAULT '[]'::jsonb,
          last_synced_at TIMESTAMPTZ,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS iss_connection_stream_idx
          ON integration_sync_state(connection_id, stream)`,
        `ALTER TABLE integration_sync_state ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY iss_tenant_isolation ON integration_sync_state
          USING (
            connection_id IN (
              SELECT id FROM integration_connections
              WHERE organization_id = current_setting('app.current_org_id', TRUE)
            )
          )`,
      ],
      down: [
        `DROP TABLE IF EXISTS integration_sync_state`,
      ],
    },
  ],
}
