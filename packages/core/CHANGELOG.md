# @orbit-ai/core

## 0.1.0-alpha.1

### Patch Changes

- [#94](https://github.com/sharonds/orbit-ai/pull/94) [`58abcba`](https://github.com/sharonds/orbit-ai/commit/58abcba5d0c761aa8d9de46f028a545acdeaf9ea) Thanks [@sharonds](https://github.com/sharonds)! - Add deterministic SQLite business E2E demo-gate scenarios and strengthen public date input handling.

  - Add demo-seed business scenario overlays and expected-answer helpers for lead qualification, stalled pipeline, account 360, renewal/expansion, and fake integration events.
  - Add SQLite business journeys plus focused tenant, auth/scope, redaction, payload/rate-limit, webhook SSRF, and fake-event replay smokes.
  - Coerce known public date fields consistently across API and SDK direct transports and reject invalid date strings with structured validation errors.

- [#92](https://github.com/sharonds/orbit-ai/pull/92) [`8460425`](https://github.com/sharonds/orbit-ai/commit/846042535250baf354eabd223b97959babc0db63) Thanks [@sharonds](https://github.com/sharonds)! - Close 18 Dependabot alerts (4 high, 13 medium, 1 low) via dependency upgrades.

  - Bump `hono` from `^4.12.14` to `^4.12.18` in `@orbit-ai/api`. The most
    user-relevant fix is `GHSA-p77w-8qqv-26rm`, where Hono's cache middleware
    was ignoring `Vary: Authorization` / `Vary: Cookie` and could leak
    responses across tenants. Eight additional medium-severity Hono fixes
    ship in the same range (JSX/CSS injection in `hono/jsx`, cookie name
    handling, `bodyLimit()` bypass, `toSSG()` path traversal, repeated-slash
    middleware bypass in `serveStatic`, IPv4-mapped IPv6 in `ipRestriction()`,
    and JWT NumericDate validation).
  - Add pinned `pnpm.overrides` for four transitive dependencies that were
    flagged on `main`: `fast-uri` `^3.1.2` (host confusion, path traversal —
    high), `vite` `^7.3.2` (`server.fs.deny` bypass, dev-server WebSocket
    arbitrary file read — high), `postcss` `^8.5.10` (`</style>` XSS),
    `ip-address` `^10.1.1` (`Address6` HTML XSS). Each override is pinned
    to its current major to prevent a future lockfile refresh from picking
    up an incompatible major.

- [#96](https://github.com/sharonds/orbit-ai/pull/96) [`ac1bd5a`](https://github.com/sharonds/orbit-ai/commit/ac1bd5a750c59cb5a98b25fa22bee3b46a5d9899) Thanks [@sharonds](https://github.com/sharonds)! - Resolve moderate dependency advisories by pinning patched transitive versions.

  - Override `uuid` to `^11.1.1` for GHSA-w5hq-g745-h8pq.
  - Override `qs` to `^6.15.2` for GHSA-q8mj-m7cp-5q26.
  - Override `ws` to `^8.20.1` and upgrade `turbo` to `^2.9.14` so `pnpm audit --audit-level moderate` is clean.

- [#80](https://github.com/sharonds/orbit-ai/pull/80) [`3ec754c`](https://github.com/sharonds/orbit-ai/commit/3ec754c47b868bf8b98fc85d648250811fd0b857) Thanks [@sharonds](https://github.com/sharonds)! - Harden the alpha release pipeline and package readiness checks.

  - Enforce the E2E launch gate in release validation.
  - Keep private `@orbit-ai/e2e` out of Changesets versioning.
  - Verify package metadata, README/LICENSE, files allowlists, exports, and bin entrypoints before publish.
  - Reject package artifact paths that are absolute or escape the package root before publish.
  - Add build-before-pack hooks for publishable packages.
  - Improve release dry-run diagnostics for spawn failures, signals, and malformed manifests.
  - Fix release docs and stale Orbit SDK environment variable examples.

- [#82](https://github.com/sharonds/orbit-ai/pull/82) [`8f6291f`](https://github.com/sharonds/orbit-ai/commit/8f6291f0c71ea857a01d96dbcc5cd2bb52d23e63) Thanks [@sharonds](https://github.com/sharonds)! - Internal Plan C hardening:

  - `@orbit-ai/core`: require org context for schema-engine reads and reject deal values that do not fit numeric(18,2).
  - `@orbit-ai/integrations`: replace Stripe's unscoped API-key sentinel with a namespaced sentinel and status handling.

  The E2E launch gate was hardened with tenant-isolation, MCP tool invocation, CRUD update-persistence, and Postgres adapter-proof coverage.

- [#84](https://github.com/sharonds/orbit-ai/pull/84) [`e323e15`](https://github.com/sharonds/orbit-ai/commit/e323e155133be5b1397ee1d639e883f11ccdaefe) Thanks [@sharonds](https://github.com/sharonds)! - Add the alpha schema migration safety surface across core, API, SDK, and CLI:
  checksum-bound preview/apply/rollback, explicit migration authority gating,
  rollbackability reporting, and executable destructive custom-field delete/rename
  semantics. MCP intentionally continues to exclude destructive schema migration
  tools until a separate elicitation UX exists.

- [#113](https://github.com/sharonds/orbit-ai/pull/113) [`6ddab7b`](https://github.com/sharonds/orbit-ai/commit/6ddab7ba728d91b10a8af90724b820f88f1d7e13) Thanks [@sharonds](https://github.com/sharonds)! - Document schema migration hardening semantics in package READMEs: time-bound destructive confirmations, supported custom-field migration targets, SQL field redaction, and Postgres connection pool requirements for migration applies.

- [#111](https://github.com/sharonds/orbit-ai/pull/111) [`2185b8a`](https://github.com/sharonds/orbit-ai/commit/2185b8a93cde791944a57500233e30c1c372f261) Thanks [@sharonds](https://github.com/sharonds)! - Harden schema migration execution and public output boundaries: validate custom-field migration targets, fail closed on metadata DML row-count drift, time-bound destructive confirmations, recheck idempotency inside migration locks, and redact raw SQL statement fields across API, SDK, CLI, and MCP outputs.
