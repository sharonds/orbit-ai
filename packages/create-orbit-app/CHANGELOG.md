# Changelog

All notable changes to `create-orbit-app` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Initial release

- Zero-config scaffolder for Orbit AI starters (`npx create-orbit-app@alpha my-app`).
- Single `default` template: in-memory SQLite adapter, pre-seeded Acme Events demo tenant, SDK direct-mode queries.
- Interactive prompts via `@clack/prompts`; non-interactive mode via `--yes`.
- Package-manager detection (npm / pnpm / yarn / bun) from `npm_config_user_agent`; install step runs the detected manager's install command by default (`--no-install` opts out; `--install-cmd` overrides).
- Template placeholder substitution: `__APP_NAME__`, `__ORBIT_VERSION__` are replaced at scaffold time. Dotfile convention: `_gitignore` -> `.gitignore`.
- Project-name validation: lowercase letters, digits, `-`, `_` only (matches npm unscoped-package rules); rejects `..`, spaces, uppercase.
- TTY guard: refuses to prompt in non-TTY environments unless `--yes` is passed, preventing CI hangs.
