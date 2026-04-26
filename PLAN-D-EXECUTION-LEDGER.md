# Plan D Execution Ledger

Worktree: `/Users/sharonsciammas/orbit-ai/.worktrees/plan-d-followups`
Branch: `codex/plan-d-followups`
Base: `origin/main`
Plan source: `/Users/sharonsciammas/orbit-ai/docs/superpowers/plans/2026-04-26-plan-d-codex-followups.md`
Plan SHA-256: `fe6b8ef3220a8e48ee659e4d6711ca4485e219a3414eba2df11cd88b0b145ef8`

Note: the Plan D execution contract was supplied from the parent workspace path above. That file was untracked in the parent workspace when this worktree was created from `origin/main`, so it is intentionally not present as a tracked file in this fresh worktree. This ledger records the plan source and digest for traceability without touching unrelated untracked parent-workspace files.

## Scope Rules

- Execute Plan D exactly as the execution contract.
- Use one fresh subagent per implementation task.
- Commit implementation files only, then commit ledger-only evidence separately.
- Do not touch unrelated untracked files in the parent workspace.
- Do not update `CLAUDE.md`, `.claude` memory files, or `MEMORY.md`.
- Treat full Orbit E2E as N/A unless shared runtime packages change.
- Plan D E2E is the packed scaffolder smoke plus generated starter proof required by the plan.
- Do not merge without explicit approval.
- Do not merge Plan D until C5 is merged and this branch has been rebased onto fresh `origin/main` with final gates rerun.

## Domain Pass

- `ScaffoldOptions`: parsed user intent from argv; it must not silently accept contradictory flags.
- `TargetDirectory`: absolute directory under the user's current working directory; existing files, symlinks, and non-empty directories are rejected.
- `TemplateSource`: package-owned template directory; template entries are copied with literal placeholder replacement and safe dotfile renames.
- `InstallCommand`: trusted command string supplied by the caller, parsed into executable plus argv and run without a shell.
- `PackageArtifact`: npm tarball containing `bin`, `dist`, `templates`, `README.md`, and `LICENSE` with a bin that can load built `dist/index.js`.
- `GeneratedStarterRuntime`: generated app after dependency install; pre-publish runtime proof uses available local/published packages, while canonical `npx @orbit-ai/create-orbit-app@alpha my-app && cd my-app && npm start` proof is a post-publish release gate.

## Non-Negotiable Invariants

- Never shell out with user-derived paths.
- Never pass `--install-cmd` through a shell.
- Reject `--install-cmd` together with `--no-install`.
- Reject empty or whitespace-only `--install-cmd` at parse time.
- Reject template traversal strings such as `../default`, `/tmp/default`, `default/foo`, `default\foo`, and `./default`.
- Bound install execution with a 5-minute timeout.
- Timeout failures must produce a user-readable timeout message; non-timeout install failures must preserve the original failure.
- Cleanup failures must be visible in stderr; original scaffold/copy/install failure remains primary.
- Copy failure must leave no final target directory and no temporary sibling directory.
- Template symlinks and special files must not be copied or dereferenced.
- Public docs must use `npx @orbit-ai/create-orbit-app@alpha my-app`.
- Generated starter dependency pin remains exact `0.1.0-alpha.x`.
- Package must be packable from a clean checkout and packed bin must run against built `dist`.
- Generated starter runtime proof must be explicit, or recorded as a post-publish release gate if unpublished dependencies block it.
- Codex execution memory is this ledger only.

## Task Table

| Task | Status | Implementation SHA(s) | Ledger SHA | Subagent / Review Evidence |
|---|---|---|---|---|
| 1. Create Worktree And Execution Ledger | Complete | N/A | This commit | Process review subagent `019dc980-596f-7a31-9103-72caae6a37e0`; Critical/High findings fixed before commit |
| 2. Add `--version` And Tighten Option Validation | Complete | `def8680` | This commit | Implementation subagent `019dc982-58e2-7b23-a3e9-5e7d7992869e`; reviews `019dc985-1d85-7bf3-9782-8a11d862367d`, `019dc985-1e03-7881-9917-abc363198cc4`, `019dc985-1ebf-7513-982f-a1bc9bc6be20` |
| 3. Bound Install Execution And Harden Command Parsing | Complete | `78fcf20` | This commit | Implementation subagent `019dc987-6ff5-73e2-8ce7-b76f62d3e99f`; reviews `019dc98a-3c01-76d2-9f67-c8b0c69b0903`, `019dc98a-3c62-7dd1-ad5e-70183958509f` |
| 4. Make Cleanup Failures Observable | Pending | Pending | Pending | Pending |
| 5. Prove Atomic Rollback And Template Symlink Safety | Pending | Pending | Pending | Pending |
| 6. Document And Test Exact Alpha Version Pinning | Pending | Pending | Pending | Pending |
| 7. Strengthen Package Manager Detection Coverage | Pending | Pending | Pending | Pending |
| 8. Add Packed Tarball Smoke Coverage | Pending | Pending | Pending | Pending |
| 9. Update Create-Orbit-App User Documentation | Pending | Pending | Pending | Pending |
| 10. Align Release And Repo Documentation With Scoped Package Reality | Pending | Pending | Pending | Pending |
| 11. Changeset And Package Artifact Readiness | Pending | Pending | Pending | Pending |
| 12. Final Verification, Reviews, And Concordance | Pending | Pending | Pending | Pending |

## Baseline Gate

Baseline started: 2026-04-26

### Precondition Checks

```text
$ git status --short --branch
## codex/plan-d-followups...origin/main

$ git log --oneline -5
8f6291f Execute Plan C follow-ups
68ead05 chore(deps): bump drizzle-orm 0.44.7 → 0.45.2 (CVE GHSA-gpj5-g38j-94v9) (#81)
3ec754c Harden Plan B release pipeline (#80)
de88dcf docs: implementation plans B/C/C.5/D and Codex review for cloud execution
69359e9 docs: add reusable security resources (#78)

$ test -f e2e/src/journeys/15-tenant-isolation.test.ts
exit 0

$ corepack pnpm install
Scope: all 11 workspace projects
Lockfile is up to date, resolution step is skipped
Packages: +392
WARN Failed to create bin at e2e/node_modules/.bin/orbit because packages/cli/dist/index.js did not exist before build.
WARN Failed to create bin at e2e/node_modules/@orbit-ai/cli/dist/index.js because packages/cli/dist/index.js did not exist before build.
Done in 2s
```

### Baseline Commands

```text
$ test -f packages/create-orbit-app/package.json
exit 0
$ test -f packages/create-orbit-app/tsconfig.json
exit 0
$ test -f packages/create-orbit-app/vitest.config.ts
exit 0
$ test -x packages/create-orbit-app/bin/create-orbit-app.js
exit 0
$ test -f packages/create-orbit-app/src/index.ts
exit 0
$ test -f packages/create-orbit-app/src/options.ts
exit 0
$ test -f packages/create-orbit-app/src/prompts.ts
exit 0
$ test -f packages/create-orbit-app/src/copy.ts
exit 0
$ test -f packages/create-orbit-app/src/install.ts
exit 0
$ test -f packages/create-orbit-app/src/version.ts
exit 0
$ test -f packages/create-orbit-app/templates/default/package.json
exit 0
$ test -f packages/create-orbit-app/templates/default/src/index.ts
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app test
@orbit-ai/create-orbit-app vitest run:
Test Files  8 passed (8)
Tests       42 passed (42)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app build
rm -rf dist && tsc
exit 0

$ corepack pnpm -r build
Scope: 10 of 11 workspace projects
Build completed for core, create-orbit-app, api, demo-seed, sdk, integrations, mcp, cli.
exit 0

$ corepack pnpm -r typecheck
Scope: 10 of 11 workspace projects
Typecheck completed for core, create-orbit-app, api, sdk, demo-seed, mcp, integrations, cli, e2e.
exit 0

$ corepack pnpm -r test
Scope: 10 of 11 workspace projects
@orbit-ai/create-orbit-app: 8 files passed, 42 tests passed.
@orbit-ai/core: 60 files passed, 1 skipped; 358 tests passed, 2 skipped.
@orbit-ai/api: 14 files passed, 310 tests passed.
@orbit-ai/demo-seed: 15 files passed, 47 tests passed.
@orbit-ai/sdk: 13 files passed, 232 tests passed.
@orbit-ai/integrations: 37 files passed, 452 tests passed.
@orbit-ai/mcp: 14 files passed, 186 tests passed.
@orbit-ai/cli: 21 files passed, 206 tests passed.
e2e: 19 files passed; 23 tests passed, 3 skipped.
exit 0

$ corepack pnpm -r lint
Scope: 10 of 11 workspace projects
Lint/typecheck completed for create-orbit-app, core, demo-seed, sdk, api, mcp, integrations.
exit 0

$ node scripts/verify-package-artifacts.mjs
Package artifact verification passed.
exit 0

$ node --test scripts/release-workflow.test.mjs
1..37
# tests 37
# pass 37
# fail 0
# duration_ms 1179.721417
exit 0
```

## Review Evidence

### Task 1 Process Review

Subagent: `019dc980-596f-7a31-9103-72caae6a37e0`

Findings:

- Critical: ledger had not yet been committed. Fix: commit this ledger after recording review evidence.
- High: ledger used a relative plan path not present in the fresh worktree. Fix: record the absolute supplied plan source and SHA-256 digest, while leaving the parent workspace untracked file untouched.
- High: Task 1 status and review evidence were still pending. Fix: mark Task 1 complete and record review findings/fixes here.

Result: no unresolved Critical/High/Medium Task 1 process findings remain before ledger commit.

### Task 2 Reviews

Implementation subagent: `019dc982-58e2-7b23-a3e9-5e7d7992869e`

Implementation commit: `def8680 feat(create-orbit-app): add version flag and option conflict checks`

Changed files:

- `packages/create-orbit-app/src/options.ts`
- `packages/create-orbit-app/src/index.ts`
- `packages/create-orbit-app/src/options.test.ts`
- `packages/create-orbit-app/src/prompts.test.ts`
- `packages/create-orbit-app/src/__tests__/index.test.ts`

Focused validation:

```text
$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/options.test.ts src/prompts.test.ts src/__tests__/index.test.ts
Test Files  3 passed (3)
Tests       30 passed (30)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0
```

Named review lenses:

- Code review subagent `019dc985-1d85-7bf3-9782-8a11d862367d`: no Critical/High/Medium/Low findings. Reviewer also ran full create-orbit-app tests and typecheck successfully.
- Package UX review subagent `019dc985-1e03-7881-9917-abc363198cc4`: no Critical/High/Medium findings. Low finding: `--help` and `--version` are parsed after semantic validation, so combinations with conflicting install flags exit 2 instead of printing metadata. Decision: defer; Low severity and not required by Task 2 contract.
- Security review subagent `019dc985-1ebf-7513-982f-a1bc9bc6be20`: no Critical/High/Medium/Low findings. Reviewer also ran full create-orbit-app tests successfully.

Result: no unresolved Critical/High/Medium Task 2 findings remain.

### Task 3 Reviews

Implementation subagent: `019dc987-6ff5-73e2-8ce7-b76f62d3e99f`

Implementation commit: `78fcf20 fix(create-orbit-app): bound install execution and command parsing`

Changed files:

- `packages/create-orbit-app/src/install.ts`
- `packages/create-orbit-app/src/install.test.ts`
- `packages/create-orbit-app/src/install.timeout.test.ts`

Focused validation:

```text
$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/install.test.ts src/install.timeout.test.ts
Test Files  2 passed (2)
Tests       16 passed (16)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0
```

Named review lenses:

- Security review subagent `019dc98a-3c01-76d2-9f67-c8b0c69b0903`: no Critical/High/Medium findings. Low finding: malformed known-prefix user agents such as `pnpm/` still resolve to that package manager. Decision: defer to Task 7, which explicitly owns stronger package-manager detection coverage.
- Code review subagent `019dc98a-3c62-7dd1-ad5e-70183958509f`: no Critical/High/Medium/Low findings. Reviewer also ran full create-orbit-app tests and typecheck successfully.

Result: no unresolved Critical/High/Medium Task 3 findings remain.

## Deferred Items And Skipped Validation

- Task 3 Low security review finding about malformed known-prefix package-manager user agents is deferred to Task 7, which owns package-manager detection coverage.

## Plan Drift Log

None yet.

## Final Concordance

Pending. Must map every file from `git diff --name-only origin/main...HEAD` to a Plan D task before PR.

## Acceptance Checklist

- [ ] Worktree starts from `origin/main`.
- [ ] `PLAN-D-EXECUTION-LEDGER.md` final concordance complete.
- [ ] Every changed file mapped to a task.
- [ ] All task focused validations complete or explicitly skipped with replacement.
- [ ] Final focused gates complete.
- [ ] Final repo-level gates complete.
- [ ] Final code review has no unresolved Critical/High/Medium findings.
- [ ] Final security review has no unresolved Critical/High/Medium findings.
- [ ] Final package/release review has no unresolved Critical/High/Medium findings.
- [ ] Final plan-vs-execution review has no unresolved Critical/High/Medium findings.
- [ ] Orbit schema/API/tenant reviews recorded as N/A unless shared runtime packages changed.
- [ ] C5 merge/rebase blocker recorded before merge.
