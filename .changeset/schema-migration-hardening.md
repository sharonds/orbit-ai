---
"@orbit-ai/api": patch
"@orbit-ai/cli": patch
"@orbit-ai/core": patch
"@orbit-ai/mcp": patch
"@orbit-ai/sdk": patch
---

Harden schema migration execution and public output boundaries: validate custom-field migration targets, fail closed on metadata DML row-count drift, time-bound destructive confirmations, recheck idempotency inside migration locks, and redact raw SQL statement fields across API, SDK, CLI, and MCP outputs.
