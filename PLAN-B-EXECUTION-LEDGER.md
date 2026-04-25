# Plan B Execution Ledger

Date: 2026-04-25

Scope: `CODEX-PLAN-2026-04-25-plan-b-followups.md`.

## Coverage

| Plan task | Files changed | Verification command | Result | Evidence |
|---|---|---|---|---|
| 1. Release-workflow regression tests first | `scripts/release-workflow.test.mjs` | `node --test scripts/release-workflow.test.mjs` | Pass | 30 tests pass; release E2E gate, provenance precondition, action-pin comments, Changesets ignore, and CI E2E regex tests are included. |
| 2. Package verifier regression tests first | `scripts/release-workflow.test.mjs` | `node --test scripts/release-workflow.test.mjs` | Pass | Fixture tests cover string-form and object-form `bin`, empty/invalid `bin`, missing `license`, missing `README.md`, missing `LICENSE`, missing/empty `files`, allowlist omissions, glob allowlists, negated allowlist entries, private/non-orbit skips, multiple failures, and malformed manifest paths. |
| 3. Dry-run diagnostics regression tests first | `scripts/release-workflow.test.mjs` | `node --test scripts/release-workflow.test.mjs` | Pass | Fixture tests cover spawn failure, signal termination, non-zero status, malformed package JSON path diagnostics, missing `packages/`, no publishable packages, and no stack trace leakage for expected dry-run setup failures. |
| 4. Implement release workflow, Changesets, and CI gates | `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `.changeset/config.json` | `node --test scripts/release-workflow.test.mjs`; `pnpm changeset status` | Pass | Release validation runs `@orbit-ai/e2e` with explicit SQLite adapter before package tests; publish explicitly fails closed on GitHub visibility lookup errors or non-public repositories before provenance publish; CI regexes include release-sensitive files and Postgres journey helpers; Changesets ignores `@orbit-ai/e2e`. |
| 5. Implement package metadata and build-before-pack | `packages/create-orbit-app/package.json`, `packages/api/package.json`, `packages/cli/package.json`, `packages/core/package.json`, `packages/integrations/package.json`, `packages/mcp/package.json`, `packages/sdk/package.json` | package metadata Node check; publishable prepack loop | Pass | `@orbit-ai/create-orbit-app` has license plus public package metadata; every publishable `@orbit-ai/*` package with a build script has `prepack`. |
| 6. Implement artifact verifier | `scripts/verify-package-artifacts.mjs` | `node --test scripts/release-workflow.test.mjs`; `node scripts/verify-package-artifacts.mjs`; `pnpm release:verify-artifacts` | Pass | Verifier checks metadata, README/LICENSE, string/object bins, invalid declared bins, exports, entrypoints, ordered literal/glob/negated files allowlist coverage, rejects artifact paths outside the package root, private/non-orbit skips, and path-aware JSON parse failures. |
| 7. Implement release dry-run diagnostics | `scripts/release-dry-run.mjs` | `node --test scripts/release-workflow.test.mjs`; `node scripts/release-dry-run.mjs` | Pass | Dry run completed for all public packages with `--dry-run --ignore-scripts --no-git-checks --tag alpha --access public`; tests prove error/signal/status handling. |
| 8. Docs and env drift | `CONTRIBUTING.md`, `docs/releasing.md`, `README.md`, `.env.example` | `rg -n 'security@orbit-ai\.dev|ORBIT_API_BASE_URL|alpha\.N\+1' CONTRIBUTING.md docs/releasing.md README.md .env.example` | Pass | No matches; docs include create-orbit-app in the fixed group, use valid alpha semver examples, point security reports at GitHub Private Vulnerability Reporting, and remove stale package-layout text that treated current packages as planned. |
| 9. Changeset | `.changeset/plan-b-codex-followups.md` | `pnpm changeset status` | Pass | Status lists patch bumps for exactly `@orbit-ai/api`, `@orbit-ai/cli`, `@orbit-ai/core`, `@orbit-ai/create-orbit-app`, `@orbit-ai/demo-seed`, `@orbit-ai/integrations`, `@orbit-ai/mcp`, and `@orbit-ai/sdk`; no `@orbit-ai/e2e`. |
| 10. Tarball smoke | no source file beyond Task 5 | `pnpm --dir packages/create-orbit-app pack --pack-destination "$tmp_pack"` plus tarball assertions | Pass | Tarball includes `package/LICENSE`, `package/README.md`, `package/dist/index.js`, `package/bin/create-orbit-app.js`, and `package/templates/...`; manifest name and license are correct. |
| 11. Final verification | no additional source files | `pnpm -r build`; `pnpm -r typecheck`; `pnpm -r test`; `pnpm -r lint`; release-specific commands | Pass | Build, typecheck, lint, workspace tests, release workflow tests, artifact verification, dry run, tarball smoke, and Changesets status passed. |
| 12. Plan/execution concordance review | `PLAN-B-EXECUTION-LEDGER.md` | `git diff --name-only origin/main..HEAD`; `node --test scripts/release-workflow.test.mjs`; stale-pattern search; subagent scope review | Pass | Net branch diff is limited to Plan B files; no `docs/security/` files or `pnpm-lock.yaml` changes remain in the branch diff after rebasing onto `origin/main`. |

## Changed Files Mapped To Plan Tasks

| File | Task |
|---|---|
| `.changeset/config.json` | 4 |
| `.changeset/plan-b-codex-followups.md` | 9 |
| `.env.example` | 8 |
| `.github/workflows/ci.yml` | 4 |
| `.github/workflows/release.yml` | 4 |
| `CONTRIBUTING.md` | 8 |
| `README.md` | 8 |
| `docs/releasing.md` | 8 |
| `packages/api/package.json` | 5 |
| `packages/cli/package.json` | 5 |
| `packages/core/package.json` | 5 |
| `packages/create-orbit-app/package.json` | 5 |
| `packages/integrations/package.json` | 5 |
| `packages/mcp/package.json` | 5 |
| `packages/sdk/package.json` | 5 |
| `scripts/release-dry-run.mjs` | 7 |
| `scripts/release-workflow.test.mjs` | 1, 2, 3, 4, 5, 6, 7 |
| `scripts/verify-package-artifacts.mjs` | 6 |
| `PLAN-B-EXECUTION-LEDGER.md` | 12 |

## Extra Scope

No source files outside the Codex Plan B execution scope were intentionally changed. Existing untracked review/agent artifacts remain outside this execution ledger.

`@orbit-ai/create-orbit-app` received public-package metadata (`keywords`, `author`, `repository`, `homepage`, `bugs`) in addition to the minimum `license` and `prepack` fields. This is intentional package readiness work and is now part of the Codex Plan B contract.

The Claude Code review saw `docs/security/` files and dependency major-version bumps because the original branch was based on an intermediate security/dependency branch while local `main` was stale. The branch has been rebased onto `origin/main`; the net diff now excludes `docs/security/` and `pnpm-lock.yaml`, and package dependency versions match `origin/main`.

`@orbit-ai/create-orbit-app` intentionally keeps both `prepack` and `prepublishOnly`. npm runs `prepublishOnly` before `prepack` during local `npm publish`, so the guard script still needs its build step before it can execute from `dist/`. The release workflow publishes with scripts ignored after using the validated build artifacts.

## Verification Notes

One early artifact verification command was run concurrently with `pnpm -r build` and failed while `dist` directories were being recreated. The same artifact verification commands were rerun serially after build and passed.
