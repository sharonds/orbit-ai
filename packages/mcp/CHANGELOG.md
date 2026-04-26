# @orbit-ai/mcp

## 0.1.0-alpha.1

### Patch Changes

- [#80](https://github.com/sharonds/orbit-ai/pull/80) [`3ec754c`](https://github.com/sharonds/orbit-ai/commit/3ec754c47b868bf8b98fc85d648250811fd0b857) Thanks [@sharonds](https://github.com/sharonds)! - Harden the alpha release pipeline and package readiness checks.

  - Enforce the E2E launch gate in release validation.
  - Keep private `@orbit-ai/e2e` out of Changesets versioning.
  - Verify package metadata, README/LICENSE, files allowlists, exports, and bin entrypoints before publish.
  - Reject package artifact paths that are absolute or escape the package root before publish.
  - Add build-before-pack hooks for publishable packages.
  - Improve release dry-run diagnostics for spawn failures, signals, and malformed manifests.
  - Fix release docs and stale Orbit SDK environment variable examples.

- Updated dependencies [[`3ec754c`](https://github.com/sharonds/orbit-ai/commit/3ec754c47b868bf8b98fc85d648250811fd0b857)]:
  - @orbit-ai/api@0.1.0-alpha.1
  - @orbit-ai/sdk@0.1.0-alpha.1
