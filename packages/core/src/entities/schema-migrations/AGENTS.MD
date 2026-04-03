# Schema Migrations

Read-only admin/system service for schema-migration metadata. Exposed as `system.schemaMigrations`.

- `sqlStatements` and `rollbackStatements` are REDACTED in admin reads to avoid exposing raw schema-change SQL through the generic `system.*` surface
- `appliedByUserId` and `approvedByUserId` must resolve in the same tenant when present
- Do NOT expose apply, approve, rollback, preview, or any schema-execution behavior from this module
- The schema-engine milestone owns migration authority — this module is metadata visibility only
