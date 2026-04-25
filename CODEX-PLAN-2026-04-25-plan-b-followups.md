# Plan B Follow-ups — Codex Execution Plan

Date: 2026-04-25

Executor target: Codex in `/Users/sharonsciammas/orbit-ai`.

Source material:

- Claude-authored Plan B follow-up: `.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-b-followups.md`
- Consolidated review: `REVIEW-2026-04-25-plans-b-c-c5-d-followups.md`
- Current repository files listed below.

This is not a copy of the Claude plan. It is the Codex execution contract for Plan B, based on current repo state. Execute this plan, not the Claude worktree plan.

## Goal

Make the alpha publish pipeline truthful and package-ready before the first `0.1.0-alpha.1` publish.

This plan covers release workflow gates, Changesets behavior, package artifact verification, create-orbit-app package metadata/build readiness, release dry-run diagnostics, CI E2E path triggers, release docs, and a changeset.

## Codex Execution Rules

- Do not switch branches or create commits unless the user explicitly asks.
- Do not edit `.claude/worktrees/**` during implementation.
- Do not update test-count documentation from assumptions. Update counts only from fresh command output.
- Preserve unrelated user changes in the working tree.
- Use `apply_patch` for manual edits.
- Use subagents for bounded review and validation, not for overlapping edits.
- Before claiming any task is complete, run the task’s verification command and record evidence.

## Subagent Model

Use subagents in three places:

1. **Before implementation**: independent explorers validate current state.
   - Release/Changesets/CI explorer.
   - Package-artifact/docs explorer.
2. **After implementation, before final verification**: reviewers validate that execution matches this plan.
   - Release workflow reviewer: `.github/workflows/**`, `.changeset/config.json`, `scripts/release-workflow.test.mjs`.
   - Package readiness reviewer: `packages/*/package.json`, `scripts/verify-package-artifacts.mjs`, `scripts/release-dry-run.mjs`, docs.
3. **Final cross-check**: one reviewer compares implementation diff to the coverage matrix in this file and reports missing tasks, extra scope, and missing verification.

Subagents must return findings with file/line evidence and must not edit files unless explicitly assigned a non-overlapping write scope.

## Preflight

Run before any implementation:

```bash
git status --short
pnpm --version
node --version
node --test scripts/release-workflow.test.mjs
node scripts/verify-package-artifacts.mjs
pnpm changeset status
```

Expected current-state facts:

- `scripts/release-workflow.test.mjs` has 2 tests.
- `node scripts/verify-package-artifacts.mjs` currently passes despite missing create-orbit-app license metadata.
- `pnpm changeset status` may list private `@orbit-ai/e2e`; after this plan it must not.

Stop if:

- the working tree contains unrelated edits in files this plan must modify and the ownership is unclear;
- `pnpm install` or workspace dependencies are missing;
- current file contents already include the intended fix and tests, because the task list must be adjusted instead of reapplying stale changes.

## Current Evidence

Release workflow:

- `.github/workflows/release.yml:61-65` runs release workflow tests, then `pnpm -r --filter '!@orbit-ai/e2e' test`; there is no dedicated E2E release gate.
- `.github/workflows/release.yml:203` allows generated release PR files under packages/changelogs/changesets only; it does not allow `e2e/package.json`.
- `.github/workflows/release.yml:244-245` verifies package artifacts before publish.
- `.github/workflows/release.yml:258-261` publishes with lifecycle scripts disabled and provenance enabled.

CI workflow:

- `.github/workflows/ci.yml:43` SQLite E2E trigger only covers selected package `src/` paths, `e2e/`, and quickstart.
- `.github/workflows/ci.yml:49` Postgres E2E trigger only covers `core|api|sdk/src` and selected E2E journeys.

Changesets:

- `.changeset/config.json:5-15` fixed group includes all public `@orbit-ai/*` packages, including `@orbit-ai/create-orbit-app`.
- `.changeset/config.json:21` ignores only `orbit-ai-nodejs-quickstart`, not private `@orbit-ai/e2e`.

Package readiness:

- `packages/create-orbit-app/package.json:2-5` has no `license`.
- `packages/create-orbit-app/package.json:21-24` has `build` and `prepublishOnly`, but no `prepack`.
- `packages/create-orbit-app/bin/create-orbit-app.js` imports `../dist/index.js`, so pack paths need a fresh `dist`.

Verifier/dry-run:

- `scripts/verify-package-artifacts.mjs:13-14` parses package JSON without path-aware diagnostics.
- `scripts/verify-package-artifacts.mjs:16-18` skips private/non-`@orbit-ai` packages.
- `scripts/verify-package-artifacts.mjs:30` assumes `manifest.bin` is an object.
- `scripts/verify-package-artifacts.mjs` checks entrypoint files only; it does not assert `license`, `README.md`, `LICENSE`, or `files`.
- `scripts/release-dry-run.mjs:13-15` parses package JSON without path-aware diagnostics.
- `scripts/release-dry-run.mjs:40-41` checks only non-zero status; it does not report spawn errors or signals distinctly.

Docs:

- `CONTRIBUTING.md:10-11` points security issues at `security@orbit-ai.dev`, while `SECURITY.md:17-20` uses GitHub Private Vulnerability Reporting.
- `docs/releasing.md:144-152` uses invalid `0.1.0-alpha.N+1` examples.
- `README.md:149-152` uses `ORBIT_API_BASE_URL`; `.env.example:43-44` uses the same stale variable. Code uses `ORBIT_BASE_URL`.

## Task 1 — Release-Workflow Regression Tests First

Files:

- Modify `scripts/release-workflow.test.mjs`.

Add tests before workflow edits so the red phase proves the missing gates:

- Release validate runs `pnpm --filter @orbit-ai/e2e test` before the generic `pnpm -r --filter '!@orbit-ai/e2e' test`.
- Publish has a public-repository provenance precondition before package verification/publish.
- Changesets config ignores private `@orbit-ai/e2e`.
- CI SQLite E2E filter matches release-sensitive paths: `packages/demo-seed/`, `packages/create-orbit-app/`, `pnpm-lock.yaml`, `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `scripts/release-workflow.test.mjs`, `scripts/release-dry-run.mjs`, `scripts/verify-package-artifacts.mjs`, `.changeset/*.md`.
- CI Postgres E2E filter matches `packages/core/`, `packages/api/`, `packages/sdk/`, `e2e/src/harness/`, selected journey paths plus shared journey helpers, `pnpm-lock.yaml`, and workflow/script paths that can change release behavior.

Run:

```bash
node --test scripts/release-workflow.test.mjs
```

Expected before implementation: new tests fail for missing release E2E gate, missing public repo check, missing `@orbit-ai/e2e` ignore, and incomplete CI filters.

Stop if existing tests fail before adding new tests.

## Task 2 — Package Verifier Regression Tests First

Files:

- Modify `scripts/release-workflow.test.mjs`.

Add fixture-based tests that execute `scripts/verify-package-artifacts.mjs` from a temporary repository root:

- accepts object-form and string-form `bin`;
- fails invalid object-form `bin` values;
- fails missing `license`;
- fails missing `README.md`;
- fails missing `LICENSE`;
- fails empty or missing `files` for publishable packages;
- fails when declared publish artifacts exist on disk but are omitted from the package `files` allowlist;
- skips private packages regardless of missing metadata;
- accumulates multiple failures in one run;
- reports package JSON parse failures with the manifest path.

Run:

```bash
node --test scripts/release-workflow.test.mjs
```

Expected before implementation: verifier tests fail except skip-private cases that already pass.

## Task 3 — Dry-Run Diagnostics Regression Tests First

Files:

- Modify `scripts/release-workflow.test.mjs`.

Add tests for `scripts/release-dry-run.mjs` using an injected fake `pnpm` in `PATH`:

- spawn failure or missing executable exits non-zero and prints a diagnostic containing the package name;
- signal termination exits non-zero and prints the signal;
- non-zero status prints package name and status;
- malformed package JSON reports the manifest path.

Run:

```bash
node --test scripts/release-workflow.test.mjs
```

Expected before implementation: new dry-run diagnostics tests fail.

## Task 4 — Implement Release Workflow, Changesets, and CI Gates

Files:

- Modify `.github/workflows/release.yml`.
- Modify `.github/workflows/ci.yml`.
- Modify `.changeset/config.json`.

Changes:

- In `release.yml`, raise `validate.timeout-minutes` from `20` to `40` if adding E2E makes timing risky.
- Insert `Test launch-gate E2E journeys` after `Test release workflow` and before generic package tests:

```yaml
      - name: Test launch-gate E2E journeys
        run: pnpm --filter @orbit-ai/e2e test
```

- Keep the generic package test exclusion; it is now truthful because E2E already ran.
- Add a public repository precondition in `publish` after built artifacts download and before `Verify package artifacts`:

```yaml
      - name: Verify repository is public for npm provenance
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          is_private="$(gh api "/repos/${GITHUB_REPOSITORY}" --jq '.private')"
          if [ "$is_private" != "false" ]; then
            echo "ERROR: npm provenance requires a public GitHub repository."
            exit 1
          fi
```

- In `.changeset/config.json`, change ignore to:

```json
"ignore": ["orbit-ai-nodejs-quickstart", "@orbit-ai/e2e"]
```

- In `ci.yml`, expand E2E trigger regexes. Prefer over-triggering on release-sensitive files to under-triggering:

SQLite should match:

```text
packages/(core|api|sdk|cli|mcp|integrations|demo-seed|create-orbit-app)/
e2e/
examples/nodejs-quickstart/
pnpm-lock.yaml
.github/workflows/(ci|release).yml
scripts/(release-workflow.test|release-dry-run|verify-package-artifacts).mjs
.changeset/
```

Postgres should match:

```text
packages/(core|api|sdk)/
e2e/src/harness/
e2e/src/journeys/(_|02|03|04|05|06|07|08|09|10|11)
pnpm-lock.yaml
.github/workflows/(ci|release).yml
scripts/(release-workflow.test|release-dry-run|verify-package-artifacts).mjs
.changeset/
```

Run:

```bash
node --test scripts/release-workflow.test.mjs
pnpm changeset status
```

Expected after implementation:

- release/CI/Changesets tests pass;
- `pnpm changeset status` does not list private `@orbit-ai/e2e`.

## Task 5 — Implement Package Metadata and Build-Before-Pack

Files:

- Modify `packages/create-orbit-app/package.json`.
- Modify other public `packages/*/package.json` files only for `prepack` if they have a `build` script and are publishable.

Changes:

- Add `"license": "MIT"` to `@orbit-ai/create-orbit-app`.
- Add public-package metadata to `@orbit-ai/create-orbit-app`: `keywords`, `author`, `repository`, `homepage`, and `bugs`.
- Add `"prepack": "pnpm run build"` to all publishable `@orbit-ai/*` packages with a `build` script that do not already have it.
- Keep `@orbit-ai/create-orbit-app` `prepublishOnly`; do not replace it.

Run:

```bash
node -e "const p=require('./packages/create-orbit-app/package.json'); for (const k of ['name','version','description','license','bin','files','main','types']) if (!p[k]) throw new Error('missing '+k); if (!p.scripts.prepack) throw new Error('missing prepack')"
for pkg in packages/*/package.json; do node - "$pkg" <<'NODE'
const manifestPath = process.argv[2]
const p = require('./' + manifestPath)
if (!p.private && p.name?.startsWith('@orbit-ai/') && p.scripts?.build && !p.scripts?.prepack) {
  throw new Error(`${p.name} missing prepack`)
}
NODE
done
```

Expected: no output.

Stop if a publishable package lacks a `build` script; do not invent one without reading the package.

## Task 6 — Implement Artifact Verifier

Files:

- Modify `scripts/verify-package-artifacts.mjs`.

Changes:

- Add a `readManifest(manifestPath)` helper that wraps JSON parse errors with the file path.
- Keep skipping private packages and packages whose names do not start with `@orbit-ai/`.
- Assert for each publishable package:
  - non-empty `name`, `version`, `description`, `license`;
  - `files` is a non-empty array;
  - `README.md` exists;
  - `LICENSE` exists;
  - declared `main`, `types`, `exports`, and `bin` files exist.
- Assert the package `files` allowlist can include the declared publish files:
  - `main`, `types`, exported files, and bin files must be under a listed positive directory/file entry such as `dist`, `bin`, `README.md`, or `LICENSE`;
  - ignore negative entries such as `!dist/**/*.test.*` for this allowlist-presence check;
  - this is still a static guard, so Task 10 performs a real tarball smoke for `@orbit-ai/create-orbit-app`.
- Normalize `bin`:
  - string form means one bin file;
  - object form means all object values, and every object value must be a non-empty string;
  - other forms produce a failure.
- Accumulate all failures before exiting, including manifest parse failures across package directories.

Run:

```bash
node --test scripts/release-workflow.test.mjs
node scripts/verify-package-artifacts.mjs
pnpm release:verify-artifacts
```

Expected: all pass after Task 5 and Task 6.

## Task 7 — Implement Release Dry-Run Diagnostics

Files:

- Modify `scripts/release-dry-run.mjs`.

Changes:

- Add path-aware manifest parsing.
- After `spawnSync`, handle these separately:
  - `result.error`: print package name and error message, exit `1`;
  - `result.signal`: print package name and signal, exit `1`;
  - non-zero `result.status`: print package name and status, exit that status or `1`.
- Keep `pnpm publish --dry-run --ignore-scripts --no-git-checks --tag alpha --access public`.

Run:

```bash
node --test scripts/release-workflow.test.mjs
node scripts/release-dry-run.mjs
```

Expected: release-workflow tests pass; dry run exits 0 only if packages are ready.

## Task 8 — Docs and Env Drift

Files:

- Modify `CONTRIBUTING.md`.
- Modify `docs/releasing.md`.
- Modify `README.md`.
- Modify `.env.example`.

Changes:

- `CONTRIBUTING.md`: replace `security@orbit-ai.dev` with a reference to GitHub Private Vulnerability Reporting in `SECURITY.md`.
- `CONTRIBUTING.md`: remove stale package-layout text that says `cli`, `mcp`, and `integrations` are planned but not in the repo; list the current public package layout instead.
- `docs/releasing.md`: include `@orbit-ai/create-orbit-app` in fixed group examples where package lists are enumerated.
- `docs/releasing.md`: replace invalid `0.1.0-alpha.N+1` examples with valid semver examples such as `0.1.0-alpha.7` to `0.1.0-alpha.8`.
- `docs/releasing.md`: clarify dry-run verifies package readiness metadata and entrypoints.
- `README.md` and `.env.example`: replace `ORBIT_API_BASE_URL` with `ORBIT_BASE_URL`.

Run:

```bash
rg -n 'security@orbit-ai\.dev|ORBIT_API_BASE_URL|alpha\.N\+1' CONTRIBUTING.md docs/releasing.md README.md .env.example
```

Expected: no matches.

## Task 9 — Changeset

Files:

- Create `.changeset/plan-b-codex-followups.md`.

Use the scoped package name:

```markdown
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
```

Run:

```bash
pnpm changeset status
```

Expected: 8 public fixed-group packages only; no private `@orbit-ai/e2e`.

## Task 10 — Tarball Smoke

Run after build:

```bash
pnpm --filter @orbit-ai/create-orbit-app build
tmp_pack="$(mktemp -d)"
pnpm --dir packages/create-orbit-app pack --pack-destination "$tmp_pack"
tarball="$(find "$tmp_pack" -name 'orbit-ai-create-orbit-app-*.tgz' -print -quit)"
test -n "$tarball"
tar -tzf "$tarball" | sort | tee "$tmp_pack/contents.txt"
tar -xOf "$tarball" package/package.json | node -e "let s=''; process.stdin.on('data', c => s += c); process.stdin.on('end', () => { const m = JSON.parse(s); if (m.name !== '@orbit-ai/create-orbit-app') throw new Error('wrong package'); if (m.license !== 'MIT') throw new Error('missing license') })"
grep -Fx 'package/LICENSE' "$tmp_pack/contents.txt"
grep -Fx 'package/README.md' "$tmp_pack/contents.txt"
grep -Fx 'package/dist/index.js' "$tmp_pack/contents.txt"
grep -Fx 'package/bin/create-orbit-app.js' "$tmp_pack/contents.txt"
grep -q '^package/templates/' "$tmp_pack/contents.txt"
rm -rf "$tmp_pack"
```

Expected: all commands pass. Do not use `pnpm pack --dry-run`; this pnpm version does not support it.

## Task 11 — Final Verification

Run:

```bash
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
node --test scripts/release-workflow.test.mjs
node scripts/verify-package-artifacts.mjs
pnpm release:verify-artifacts
node scripts/release-dry-run.mjs
pnpm changeset status
```

If full `pnpm -r test` or `node scripts/release-dry-run.mjs` is too expensive or blocked by environment, record the exact command, failure/blocker, and narrower commands that were run. Do not mark the plan complete without a clear blocked-state note.

## Task 12 — Plan/Execution Concordance Review

Create or update `PLAN-B-EXECUTION-LEDGER.md` with a table:

| Plan task | Files changed | Verification command | Result | Evidence |
|---|---|---|---|---|

Every task in this plan must have a row. Every modified file must map back to a plan task. Any file changed outside this plan must be listed under "Extra scope" with an explanation.

Then run these checks:

```bash
git diff --name-only
node --test scripts/release-workflow.test.mjs
rg -n '^"create-orbit-app": patch|pnpm --filter create-orbit-app pack --dry-run|ORBIT_API_BASE_URL|security@orbit-ai\.dev|alpha\.N\+1' . \
  --glob '!CODEX-PLAN-2026-04-25-plan-b-followups.md' \
  --glob '!REVIEW-*.md' \
  --glob '!PLAN-B-EXECUTION-LEDGER.md' \
  --glob '!.claude/worktrees/**' \
  --glob '!.worktrees/**' \
  --glob '!node_modules/**'
```

Expected:

- `git diff --name-only` contains only files named in this plan plus `.changeset/plan-b-codex-followups.md` and `PLAN-B-EXECUTION-LEDGER.md`.
- release-workflow tests pass.
- stale-pattern search has no actionable matches. Exclude the Codex plan, historical review reports, `.claude/worktrees/**`, `.worktrees/**`, `node_modules/**`, and generated/cache directories so the command does not match its own evidence text.

Subagent final review must answer:

1. Did implementation cover every task?
2. Did tests prove every new behavior?
3. Did execution add extra scope?
4. Are there any stale Claude-specific assumptions left?
5. Is the release gate now truthful for exact publish SHA?

## Coverage Matrix

| Original Plan B finding | Codex task | Proof required |
|---|---:|---|
| Missing create-orbit-app license | 5 | package metadata node check; verifier; tarball package.json |
| Verifier only checks entrypoints | 2, 6 | fixture tests; `node scripts/verify-package-artifacts.mjs` |
| String-form `bin` broken | 2, 6 | fixture test accepts string-form bin |
| Release skips E2E gate | 1, 4 | workflow test verifies E2E before version/publish |
| Changesets includes private E2E | 1, 4, 9 | config test; `pnpm changeset status` |
| Public repo provenance precondition missing | 1, 4 | workflow ordering test |
| CI path filters too narrow | 1, 4 | regex fixture test |
| Dry-run ignores spawn/signal errors | 3, 7 | fake pnpm tests |
| Stale/missing `dist` pack risk | 5, 10 | `prepack`; tarball smoke |
| Docs/env drift | 8 | stale-pattern search |
| Plan/execution mismatch risk | 12 | ledger plus final subagent review |

## Dropped From Claude Plan

- Claude worktree and branch instructions.
- Per-task `git commit` requirements. Codex will not commit unless asked.
- Assumed test-count updates in `CLAUDE.md`. Counts must come from fresh command output and should be updated only if the repo still uses that checklist for current execution.
- Interactive `pnpm changeset`; write the deterministic changeset file instead.
- Any `pnpm pack --dry-run` command.

## Completion Criteria

Plan B is complete only when:

- every task in the coverage matrix has implementation evidence;
- all planned verification commands have fresh results or explicit blocker notes;
- the execution ledger maps every changed file to a task;
- final subagent review finds no missing plan coverage, missing tests, or extra scope;
- the user has the final changed-file list and verification summary.
