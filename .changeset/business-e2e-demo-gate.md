---
"@orbit-ai/api": patch
"@orbit-ai/cli": patch
"@orbit-ai/core": patch
"@orbit-ai/create-orbit-app": patch
"@orbit-ai/demo-seed": patch
"@orbit-ai/integrations": patch
"@orbit-ai/mcp": patch
"@orbit-ai/sdk": patch
---

Add deterministic SQLite business E2E demo-gate scenarios and strengthen public date input handling.

- Add demo-seed business scenario overlays and expected-answer helpers for lead qualification, stalled pipeline, account 360, renewal/expansion, and fake integration events.
- Add SQLite business journeys plus focused tenant, auth/scope, redaction, payload/rate-limit, webhook SSRF, and fake-event replay smokes.
- Coerce known public date fields consistently across API and SDK direct transports and reject invalid date strings with structured validation errors.
