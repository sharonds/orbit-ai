---
name: orbit-missing-org-id
enabled: false
event: file
pattern: (pgTable|sqliteTable)\s*\(
action: warn
---

⚠️ **New table definition detected — verify organization_id**

CLAUDE.md rule: "Every table MUST include organization_id + RLS policy (Postgres adapters)"

Before proceeding, confirm:
1. ✅ `organization_id` column is present in this table definition
2. ✅ RLS policy added in the Postgres adapter for this table
3. ✅ `orbit-tenant-safety-review` skill will be run before the PR

Missing `organization_id` is a multi-tenant isolation violation. Run `orbit-tenant-safety-review` at the end of this task.
