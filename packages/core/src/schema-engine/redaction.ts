/**
 * Shared denylist of schema migration internal field names.
 *
 * Raw SQL statements recorded on schema migration ledger rows must never
 * reach public API/SDK/CLI/MCP output. The engine's strict output schemas
 * prevent leakage at the source; every serialization boundary additionally
 * strips these names as defense-in-depth. All consumers (API responses,
 * API/SDK entity serialization, SDK direct transport, CLI error envelopes,
 * MCP output sanitization) must derive from this single list — do not
 * maintain independent copies.
 */
export const SCHEMA_MIGRATION_INTERNAL_FIELD_NAMES = [
  'sqlStatements',
  'rollbackStatements',
  'sql_statements',
  'rollback_statements',
] as const

const SCHEMA_MIGRATION_INTERNAL_FIELDS = new Set<string>(SCHEMA_MIGRATION_INTERNAL_FIELD_NAMES)

export function isSchemaMigrationInternalField(key: string): boolean {
  return SCHEMA_MIGRATION_INTERNAL_FIELDS.has(key)
}

export function stripSchemaMigrationInternalFields<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !isSchemaMigrationInternalField(key)),
  )
}
