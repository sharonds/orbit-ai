# Audit Logs

Read-only admin/system service for persisted audit records. Exposed as `system.auditLogs`.

- `before` and `after` fields are REDACTED in admin reads (may contain sensitive entity snapshots)
- `actorUserId` and `actorApiKeyId` must resolve in the same tenant when present
- Do NOT add automatic "write an audit row on every mutation" behavior — that is a later middleware milestone
- The internal repository `create` method exists for test fixtures and future audit middleware only
