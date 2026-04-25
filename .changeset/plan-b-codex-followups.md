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

Harden the alpha release pipeline and package readiness checks.

- Enforce the E2E launch gate in release validation.
- Keep private `@orbit-ai/e2e` out of Changesets versioning.
- Verify package metadata, README/LICENSE, files allowlists, exports, and bin entrypoints before publish.
- Add build-before-pack hooks for publishable packages.
- Improve release dry-run diagnostics for spawn failures, signals, and malformed manifests.
- Fix release docs and stale Orbit SDK environment variable examples.
