# Changelog

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

- [#83](https://github.com/sharonds/orbit-ai/pull/83) [`c4ea761`](https://github.com/sharonds/orbit-ai/commit/c4ea7614f921bd8eee2ab22718af504b4ccb0f54) Thanks [@sharonds](https://github.com/sharonds)! - Add release-readiness coverage for package metadata, publish artifacts, and lifecycle-script safety.

All notable changes to `@orbit-ai/create-orbit-app` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- Documented the `--version` flag and the `--install-cmd` hardening model: caller-provided install commands are trusted input, parsed into argv, executed without a shell, and mutually exclusive with `--no-install`.

### Initial release

- Zero-config scaffolder for Orbit AI starters (`npx @orbit-ai/create-orbit-app@alpha my-app`).
- Single `default` template: in-memory SQLite adapter, pre-seeded Acme Events demo tenant, SDK direct-mode queries.
- Interactive prompts via `@clack/prompts`; non-interactive mode via `--yes`.
- Package-manager detection (npm / pnpm / yarn / bun) from `npm_config_user_agent`; install step runs the detected manager's install command by default (`--no-install` opts out; `--install-cmd` overrides).
- Template placeholder substitution: `__APP_NAME__`, `__ORBIT_VERSION__` are replaced at scaffold time. Dotfile convention: `_gitignore` -> `.gitignore`.
- Project-name validation: lowercase letters, digits, `-`, `_` only (matches generated npm package-name rules); rejects `..`, spaces, uppercase.
- TTY guard: refuses to prompt in non-TTY environments unless `--yes` is passed, preventing CI hangs.
