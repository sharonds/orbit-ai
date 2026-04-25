---
"@orbit-ai/core": patch
"@orbit-ai/integrations": patch
---

Internal Plan C hardening:

- `@orbit-ai/core`: require org context for schema-engine reads and reject deal values that do not fit numeric(18,2).
- `@orbit-ai/integrations`: replace Stripe's unscoped API-key sentinel with a namespaced sentinel and status handling.

The E2E launch gate was hardened with tenant-isolation, MCP tool invocation, CRUD update-persistence, and Postgres adapter-proof coverage.
