---
name: orbit-raw-sql
enabled: false
event: file
pattern: (CREATE TABLE|ALTER TABLE|DROP TABLE|CREATE INDEX)\s+
action: block
---

🚫 **Raw SQL detected in a TypeScript file**

CLAUDE.md rule: "All schema definitions use Drizzle ORM syntax — never raw SQL strings"

If you need a schema change:
- Use `pgTable()` / `sqliteTable()` in `packages/core/src/schema/<entity>.ts`
- Use Drizzle's programmatic migration API (`drizzle-kit/api`) for migrations
- Run `orbit-schema-change` skill for guidance

Raw SQL strings bypass type safety and break the migration audit trail.
