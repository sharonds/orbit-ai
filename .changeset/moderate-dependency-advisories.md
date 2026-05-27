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

Resolve moderate dependency advisories by pinning patched transitive versions.

- Override `uuid` to `^11.1.1` for GHSA-w5hq-g745-h8pq.
- Override `qs` to `^6.15.2` for GHSA-q8mj-m7cp-5q26.
- Override `ws` to `^8.20.1` and upgrade `turbo` to `^2.9.14` so `pnpm audit --audit-level moderate` is clean.
