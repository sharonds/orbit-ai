# Schema Migrations

Read-only admin/system service for schema-migration metadata. Exposed as `system.schemaMigrations`.

- No redaction — SQL statements are operational metadata, not user secrets
- `appliedByUserId` and `approvedByUserId` must resolve in the same tenant when present
- Do NOT expose apply, approve, rollback, preview, or any schema-execution behavior from this module
- The schema-engine milestone owns migration authority — this module is metadata visibility only
