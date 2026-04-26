# Changelog

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
