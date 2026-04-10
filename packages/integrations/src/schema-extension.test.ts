import { describe, expect, it } from 'vitest'
import { integrationSchemaExtension } from './schema-extension.js'

describe('integrationSchemaExtension', () => {
  it('has key orbit-integrations', () => {
    expect(integrationSchemaExtension.key).toBe('orbit-integrations')
  })

  it('declares both tables', () => {
    expect(integrationSchemaExtension.tables).toContain('integration_connections')
    expect(integrationSchemaExtension.tables).toContain('integration_sync_state')
  })

  it('marks both tables as tenant-scoped', () => {
    expect(integrationSchemaExtension.tenantScopedTables).toContain('integration_connections')
    expect(integrationSchemaExtension.tenantScopedTables).toContain('integration_sync_state')
  })

  it('has 2 migrations', () => {
    expect(integrationSchemaExtension.migrations).toHaveLength(2)
  })

  it('migration 001 creates integration_connections table', () => {
    const migration = integrationSchemaExtension.migrations[0]!
    expect(migration.id).toBe('001_create_integration_connections')
    const createStatement = migration.up.find((sql) => sql.includes('CREATE TABLE'))
    expect(createStatement).toBeDefined()
    const cols = [
      'organization_id',
      'provider',
      'user_id',
      'status',
      'credentials_encrypted',
      'refresh_token_encrypted',
      'failure_count',
      'provider_account_id',
    ]
    for (const col of cols) {
      expect(createStatement).toContain(col)
    }
  })

  it('migration 001 includes RLS policy', () => {
    const migration = integrationSchemaExtension.migrations[0]!
    const hasRls = migration.up.some((sql) => sql.includes('ENABLE ROW LEVEL SECURITY'))
    const hasPolicy = migration.up.some((sql) => sql.includes('CREATE POLICY'))
    expect(hasRls).toBe(true)
    expect(hasPolicy).toBe(true)
  })

  it('migration 002 creates integration_sync_state table', () => {
    const migration = integrationSchemaExtension.migrations[1]!
    expect(migration.id).toBe('002_create_integration_sync_state')
    const createStatement = migration.up.find((sql) => sql.includes('CREATE TABLE'))
    expect(createStatement).toContain('connection_id')
    expect(createStatement).toContain('processed_event_ids')
  })

  it('migration 002 includes RLS policy scoped via connection_id subquery', () => {
    const migration = integrationSchemaExtension.migrations[1]!
    const hasRls = migration.up.some((sql) => sql.includes('ENABLE ROW LEVEL SECURITY'))
    const hasPolicy = migration.up.some((sql) => sql.includes('CREATE POLICY'))
    expect(hasRls).toBe(true)
    expect(hasPolicy).toBe(true)
    // Policy must use subquery into integration_connections for tenant isolation
    const policy = migration.up.find((sql) => sql.includes('CREATE POLICY'))
    expect(policy).toContain('integration_connections')
    expect(policy).toContain('organization_id')
  })

  it('migration 001 has required indexes', () => {
    const migration = integrationSchemaExtension.migrations[0]!
    const indexStatements = migration.up.filter(
      (sql) => sql.includes('CREATE') && sql.includes('INDEX'),
    )
    expect(indexStatements.length).toBeGreaterThanOrEqual(3)
  })

  it('down migrations drop the tables', () => {
    for (const migration of integrationSchemaExtension.migrations) {
      expect(migration.down.some((sql) => sql.includes('DROP TABLE'))).toBe(true)
    }
  })

  it('migration 001 unique index covers organization_id, provider, user_id', () => {
    const migration = integrationSchemaExtension.migrations[0]!
    const uniqueIdx = migration.up.find(
      (sql) => sql.includes('UNIQUE INDEX') || sql.includes('ic_org_provider_user_idx'),
    )
    expect(uniqueIdx).toBeDefined()
    expect(uniqueIdx).toContain('organization_id')
    expect(uniqueIdx).toContain('provider')
    expect(uniqueIdx).toContain('user_id')
  })

  it('migration 002 processed_event_ids defaults to empty array', () => {
    const migration = integrationSchemaExtension.migrations[1]!
    const createStatement = migration.up.find((sql) => sql.includes('CREATE TABLE'))
    expect(createStatement).toContain("DEFAULT '[]'::jsonb")
  })
})
