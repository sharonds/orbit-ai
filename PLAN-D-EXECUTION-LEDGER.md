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
| 4. Make Cleanup Failures Observable | Complete | `83ca615` | This commit | Implementation subagent `019dc98c-3d47-7f52-ac86-b7574499f9b4`; reviews `019dc98f-70ea-71d2-9faf-b5c77fa4b43d`, `019dc98f-7235-7313-8bc3-45b382e79f47` |
| 5. Prove Atomic Rollback And Template Symlink Safety | Complete | `75e3075`, `156adac` | This commit | Implementation subagent `019dc991-43af-7d63-bb95-4762c2d22a20`; reviews `019dc993-1692-7562-b9f7-c0d68ea220fa`, `019dc993-172e-7a42-a726-efb33745558c`, re-reviews `019dc994-bfba-7793-a15a-ad4129d4ca3d`, `019dc994-c014-7091-a0bb-55bad16a40f7` |
| 6. Document And Test Exact Alpha Version Pinning | Complete | `36cabb4` | This commit | Implementation subagent `019dc996-8301-7eb0-b5ef-3ed4abe980d4`; package/release review `019dc998-5f81-7e93-9c91-8d40ee7cac4a` |
| 7. Strengthen Package Manager Detection Coverage | Complete | `993a810` | This commit | Implementation subagent `019dc999-9964-7882-aae8-e7225a640842`; code review `019dc99b-34bd-78c2-bae6-b971896cc4ee` |
| 8. Add Packed Tarball Smoke Coverage | Complete | `4667ef7`, `2f260b6`, `aa578a6` | This commit | Implementation subagent `019dc99d-00d0-7df1-9c89-405f30078d93`; reviews `019dc9a2-abff-7732-9dab-bc16658738ca`, `019dc9a2-acb6-7690-b68a-b269b4f1cd24`, re-review `019dc9a5-0203-7903-9e53-dd6e7ad7c768` |
| 9. Update Create-Orbit-App User Documentation | Complete | `25927e8` | This commit | Implementation subagent `019dc9a7-d604-7d52-ac6b-841bfcf9a572`; reviews `019dc9a9-831a-74e2-9523-92f215968ea9`, `019dc9a9-8357-70a0-92d2-c4145ca21b38` |
| 10. Align Release And Repo Documentation With Scoped Package Reality | Complete | `438089a`, `3dce243` | This commit | Implementation subagent `019dc9aa-d5d2-7583-8489-e0988d6902f2`; reviews `019dc9ac-79b2-7ea3-a43e-129e8caf7073`, `019dc9ac-7a1d-7af2-8620-5918d0d4ccbc`, re-review `019dc9ae-5fbd-7a22-ae68-d0a1288f3cd2` |
| 11. Changeset And Package Artifact Readiness | Complete | `15101ab` | This commit | Implementation subagent `019dc9b0-0754-7e02-ad54-a55784722678`; package/release review `019dc9b1-d1cc-7330-a398-d06e1ab8df46` |
| 12. Final Verification, Reviews, And Concordance | Complete | `187e5ed` | This commit | Final reviews `019dc9b6-db8b-7d22-9f17-0d89630c567d`, `019dc9b6-dbcc-73b2-a876-d8c532bfe811`, `019dc9b6-dc35-7f51-bcde-995e366d8ef4`, `019dc9b6-dc69-7532-975e-c7e0ee17784d`; final re-reviews `019dc9be-8a16-7973-9e9a-3c0035869e72`, `019dc9be-8ab6-7190-9948-e552b69e507e`, `019dc9c0-4bb8-7892-b057-8fc46b673c23`, `019dc9c0-4c4a-7261-9e80-cd38b78b2750` |

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

### Task 4 Reviews

Implementation subagent: `019dc98c-3d47-7f52-ac86-b7574499f9b4`

Implementation commit: `83ca615 fix(create-orbit-app): log cleanup failures during scaffold rollback`

Changed files:

- `packages/create-orbit-app/src/copy.ts`
- `packages/create-orbit-app/src/copy.test.ts`
- `packages/create-orbit-app/src/index.ts`
- `packages/create-orbit-app/src/__tests__/index.test.ts`

Focused validation:

```text
$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/copy.test.ts src/__tests__/index.test.ts
Test Files  2 passed (2)
Tests       19 passed (19)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0
```

Named review lenses:

- Security review subagent `019dc98f-70ea-71d2-9faf-b5c77fa4b43d`: no Critical/High/Medium/Low findings. Reviewer also ran focused tests and typecheck successfully.
- Code review subagent `019dc98f-7235-7313-8bc3-45b382e79f47`: no Critical/High/Medium/Low findings. Reviewer also ran focused tests, typecheck, and `git diff --check 2100bbb..83ca615` successfully.

Result: no unresolved Critical/High/Medium Task 4 findings remain.

### Task 5 Reviews

Implementation subagents:

- `019dc991-43af-7d63-bb95-4762c2d22a20` for initial implementation.
- Parent follow-up fix for Medium review findings.

Implementation commits:

- `75e3075 test(create-orbit-app): prove atomic rollback and template symlink safety`
- `156adac test(create-orbit-app): tighten special-file safety proof`

Changed files:

- `packages/create-orbit-app/src/copy.test.ts`

Focused validation:

```text
$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/copy.test.ts
Test Files  1 passed (1)
Tests       11 passed (11)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/copy.test.ts
Test Files  1 passed (1)
Tests       11 passed (11)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0
```

Named review lenses:

- Filesystem safety review subagent `019dc993-1692-7562-b9f7-c0d68ea220fa`: Medium finding that the special-file read assertion missed one-argument reads. Fixed in `156adac` by checking mock calls by first argument.
- Code review subagent `019dc993-172e-7a42-a726-efb33745558c`: Medium finding that the special-file mock could pass without proving the special Dirent was encountered. Fixed in `156adac` by asserting `specialDirentReturned`.
- Filesystem safety re-review subagent `019dc994-bfba-7793-a15a-ad4129d4ca3d`: no Critical/High/Medium findings after fix. Reviewer also ran copy tests and typecheck successfully.
- Code re-review subagent `019dc994-c014-7091-a0bb-55bad16a40f7`: no Critical/High/Medium findings after fix. Reviewer also ran copy tests, typecheck, and `git diff --check f9e1d60..156adac -- packages/create-orbit-app/src/copy.test.ts` successfully.

Result: no unresolved Critical/High/Medium Task 5 findings remain.

### Task 6 Reviews

Implementation subagent: `019dc996-8301-7eb0-b5ef-3ed4abe980d4`

Implementation commit: `36cabb4 fix(create-orbit-app): document and test exact alpha version pinning`

Changed files:

- `packages/create-orbit-app/src/version.ts`
- `packages/create-orbit-app/src/version.test.ts`
- `packages/create-orbit-app/src/__tests__/smoke.test.ts`

Focused validation:

```text
$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/version.test.ts src/__tests__/smoke.test.ts
Test Files  2 passed (2)
Tests       8 passed (8)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0
```

Named review lenses:

- Package/release review subagent `019dc998-5f81-7e93-9c91-8d40ee7cac4a`: no Critical/High/Medium/Low findings. Reviewer could not run tests because direct `pnpm` was unavailable in its shell; parent validation used `corepack pnpm` and passed.

Result: no unresolved Critical/High/Medium Task 6 findings remain.

### Task 7 Reviews

Implementation subagent: `019dc999-9964-7882-aae8-e7225a640842`

Implementation commit: `993a810 test(create-orbit-app): strengthen package manager detection coverage`

Changed files:

- `packages/create-orbit-app/src/install.ts`
- `packages/create-orbit-app/src/install.test.ts`
- `packages/create-orbit-app/src/__tests__/index.test.ts`

Focused validation:

```text
$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/install.test.ts
Test Files  1 passed (1)
Tests       13 passed (13)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/__tests__/index.test.ts
Test Files  1 passed (1)
Tests       11 passed (11)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0
```

Named review lenses:

- Code review subagent `019dc99b-34bd-78c2-bae6-b971896cc4ee`: no Critical/High/Medium/Low findings. Reviewer also ran full create-orbit-app tests successfully. An initial unsupported `--runInBand` flag failed, then reviewer reran without it successfully.

Deferred finding resolution:

- Task 3 Low security review finding about malformed known-prefix package-manager user agents was resolved in `993a810` by requiring a version digit after known prefixes and testing `pnpm/`, `yarn/`, and `bun/` fallback to `npm`.

Result: no unresolved Critical/High/Medium Task 7 findings remain.

### Task 8 Reviews

Implementation subagent: `019dc99d-00d0-7df1-9c89-405f30078d93`

Implementation commits:

- `4667ef7 test(create-orbit-app): smoke packed scaffolder tarball`
- `2f260b6 test(create-orbit-app): record starter runtime proof gate`
- `aa578a6 test(create-orbit-app): remove fake starter runtime proof`

Changed files:

- `packages/create-orbit-app/src/__tests__/smoke.test.ts`
- `packages/create-orbit-app/src/index.ts`
- `packages/create-orbit-app/src/install.ts`
- `packages/create-orbit-app/src/packageManager.ts`

Focused validation:

```text
$ corepack pnpm -F @orbit-ai/create-orbit-app build
rm -rf dist && tsc
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/__tests__/smoke.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)
Packed tarball smoke test passed.
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0

$ node scripts/verify-package-artifacts.mjs
Package artifact verification passed.
exit 0
```

Pack validation:

```text
$ corepack pnpm --filter @orbit-ai/create-orbit-app pack --pack-destination "$(mktemp -d)"
ERROR Unknown option: 'recursive'
exit 1

$ PATH="<corepack-pnpm-shim>:$PATH" corepack pnpm --dir packages/create-orbit-app pack --pack-destination "$pack_dir"
prepack: pnpm run build
build: rm -rf dist && tsc
created orbit-ai-create-orbit-app-0.1.0-alpha.0.tgz
exit 0
```

Plan D E2E coverage:

- Implemented as a Vitest test in `packages/create-orbit-app/src/__tests__/smoke.test.ts`, because this package already uses Vitest and Task 8 validation targets that test file directly.
- This packed scaffolder smoke is Plan D's E2E coverage. It packs the package, inspects tarball contents/exclusions, extracts the tarball, runs packed `--version`, runs packed `my-app --yes --no-install`, and asserts generated exact `@orbit-ai/*` versions with no placeholders.
- Full Orbit journey E2E remains N/A for Task 8 because no shared runtime packages were changed.

Skipped validation:

- Exact filtered pack command is skipped as an environment/tooling limitation: Corepack pnpm `9.12.3` fails `corepack pnpm --filter @orbit-ai/create-orbit-app pack --pack-destination ...` with `Unknown option: 'recursive'` before lifecycle execution. Replacement evidence is the package-dir pack command above plus the packed smoke test, which both run real `prepack` build and inspect/execute the produced tarball.
- Generated starter runtime proof with dependency install is skipped because exact alpha dependencies are not published: implementation subagent checked `npm view @orbit-ai/core@0.1.0-alpha.0 version --json` and received `E404`; no local registry/tarball install path is available. Required post-publish release gate for Task 10:

```bash
npx @orbit-ai/create-orbit-app@alpha my-app --yes
cd my-app
npm start
```

Named review lenses:

- Package/release review subagent `019dc9a2-abff-7732-9dab-bc16658738ca`: Medium finding that generated starter runtime proof needed an explicit skip/post-publish gate; Low finding that Vitest choice was not recorded. Follow-up `2f260b6` attempted to record the gate in test code.
- Security review subagent `019dc9a2-acb6-7690-b68a-b269b4f1cd24`: no Critical/High/Medium/Low findings. Reviewer also ran full create-orbit-app tests successfully.
- Package/release re-review subagent `019dc9a5-0203-7903-9e53-dd6e7ad7c768`: Medium finding remained because the post-publish runtime proof was a tautological string assertion. Fixed in `aa578a6` by removing the fake assertion and recording the legitimate skip/post-publish gate in this ledger.

Result: no unresolved Critical/High/Medium Task 8 findings remain; generated starter runtime proof is plan-approved skipped validation with Task 10 post-publish gate.

### Task 9 Reviews

Implementation subagent: `019dc9a7-d604-7d52-ac6b-841bfcf9a572`

Implementation commit: `25927e8 docs(create-orbit-app): document scoped alpha usage and install command trust`

Changed files:

- `packages/create-orbit-app/README.md`
- `packages/create-orbit-app/CHANGELOG.md`

Focused validation:

```text
$ rg -n 'npx create-orbit-app|root scope|--version|--install-cmd|@orbit-ai/create-orbit-app@alpha' packages/create-orbit-app/README.md packages/create-orbit-app/CHANGELOG.md
Only scoped alpha examples, --version, and --install-cmd documentation matched.
No unscoped `npx create-orbit-app` or `root scope` match appeared.
exit 0
```

Named review lenses:

- Docs review subagent `019dc9a9-831a-74e2-9523-92f215968ea9`: no Critical/High/Medium findings. Low finding claimed a missing changelog hardening note but referenced the root `CHANGELOG.md`; the package changelog entry exists in the Task 9 diff.
- Security docs review subagent `019dc9a9-8357-70a0-92d2-c4145ca21b38`: no Critical/High/Medium/Low findings; confirmed install-command trust/no-shell docs and scoped alpha usage.

Result: no unresolved Critical/High/Medium Task 9 findings remain.

### Task 10 Reviews

Implementation subagent: `019dc9aa-d5d2-7583-8489-e0988d6902f2`

Implementation commits:

- `438089a docs(release): align alpha scaffolder package scope`
- `3dce243 docs(release): fix alpha package count and demo seed usage`

Changed files:

- `docs/product/release-definition-v2.md`
- `packages/demo-seed/README.md`

Focused validation:

```text
$ rg -n 'npx create-orbit-app|plus `create-orbit-app` under root scope|create-orbit-app\) — \*\*current state' docs/product/release-definition-v2.md README.md llms.txt packages/*/README.md
No matches.
exit 1 (expected for no matches)
```

Named review lenses:

- Docs review subagent `019dc9ac-79b2-7ea3-a43e-129e8caf7073`: no Critical/High/Medium/Low findings; confirmed scoped post-publish sanity command and README count.
- Package/release review subagent `019dc9ac-7a1d-7af2-8620-5918d0d4ccbc`: Medium finding that alpha package count still said 6; Low finding that demo-seed README still said starter was not wired. Fixed in `3dce243`.
- Package/release re-review subagent `019dc9ae-5fbd-7a22-ae68-d0a1288f3cd2`: no remaining Critical/High/Medium findings; confirmed all 8 package READMEs present and package metadata matches `@orbit-ai/create-orbit-app`.

Result: no unresolved Critical/High/Medium Task 10 findings remain.

### Task 11 Reviews

Implementation subagent: `019dc9b0-0754-7e02-ad54-a55784722678`

Implementation commit: `15101ab changeset: record create-orbit-app follow-up hardening`

Changed files:

- `.changeset/plan-d-create-orbit-app-readiness.md`
- `scripts/release-workflow.test.mjs`

Focused validation:

```text
$ node scripts/verify-package-artifacts.mjs
Package artifact verification passed.
exit 0

$ node --test scripts/release-workflow.test.mjs
1..39
# tests 39
# pass 39
# fail 0
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app test -- src/publishGuard.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)
exit 0
```

Package/release verification:

- Patch changeset added for `@orbit-ai/create-orbit-app`.
- Package metadata was verify-only; no manifest drift required edits.
- `.changeset/config.json` fixed group covers `@orbit-ai/create-orbit-app`.
- `publishGuard` fail-closed behavior remains covered by `packages/create-orbit-app/src/publishGuard.test.ts`.
- CI publish uses `NPM_CONFIG_IGNORE_SCRIPTS: "true"` and relies on built artifacts plus `scripts/verify-package-artifacts.mjs`, not lifecycle scripts.
- No `CLAUDE.md`, `.claude`, or `MEMORY.md` changes.

Named review lenses:

- Package/release review subagent `019dc9b1-d1cc-7330-a398-d06e1ab8df46`: no Critical/High/Medium findings. Low finding: fail-closed guard assertion is in `publishGuard.test.ts`, not `release-workflow.test.mjs`. Decision: keep; Task 11 validation requires `publishGuard.test.ts`, and it passed with fail-closed coverage.

Result: no unresolved Critical/High/Medium Task 11 findings remain.

### Task 12 Final Verification And Reviews

Implementation/final-fix commit:

- `187e5ed fix(create-orbit-app): address final release review findings`

Final focused gates after final review fixes:

```text
$ corepack pnpm -F @orbit-ai/create-orbit-app test
Test Files  14 passed (14)
Tests       70 passed (70)
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app typecheck
tsc -p tsconfig.json --noEmit
exit 0

$ corepack pnpm -F @orbit-ai/create-orbit-app build
rm -rf dist && tsc
exit 0

$ node scripts/verify-package-artifacts.mjs
Package artifact verification passed.
exit 0

$ node --test scripts/release-workflow.test.mjs
1..39
# tests 39
# pass 39
# fail 0
exit 0
```

Final security grep:

```text
$ rg -n "shell:\\s*true|exec\\(|spawn\\([^,]+,[^,]+,\\s*\\{[^}]*shell|npx create-orbit-app|root scope|CLAUDE|MEMORY|\\.claude" packages/create-orbit-app docs/product/release-definition-v2.md docs/releasing.md packages/demo-seed/README.md scripts/release-workflow.test.mjs .changeset/plan-d-create-orbit-app-readiness.md
No matches.
exit 1 (expected for no matches)
```

Final repo-level gates after final review fixes:

```text
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
create-orbit-app: 70 tests passed.
core: 358 passed, 2 skipped.
api: 310 passed.
demo-seed: 47 passed.
sdk: 232 passed.
integrations: 452 passed.
mcp: 186 passed.
cli: 206 passed.
e2e: 19 files passed; 23 passed, 3 skipped.
exit 0

$ corepack pnpm -r lint
Scope: 10 of 11 workspace projects
Lint/typecheck completed for create-orbit-app, core, demo-seed, sdk, api, mcp, integrations.
exit 0

$ git diff --check
exit 0
```

Final named review lenses:

- Code review subagent `019dc9b6-db8b-7d22-9f17-0d89630c567d`: Medium finding that `index.test.ts` hardcoded `0.1.0-alpha.0`; fixed in `187e5ed` by reading the package version from `package.json`. Low finding about release-workflow assertion scope also fixed in `187e5ed`.
- Security review subagent `019dc9b6-dbcc-73b2-a876-d8c532bfe811`: Medium finding that release definition security wording was too broad; fixed in `187e5ed` by scoping the statement to scaffold-copy behavior and leaving install-time dependency/lifecycle behavior as trusted package-manager behavior covered by post-publish sanity.
- Package/release review subagent `019dc9b6-dc35-7f51-bcde-995e366d8ef4`: Medium finding that `docs/releasing.md` lacked the post-publish generated starter proof; fixed in `187e5ed` by adding the `npx @orbit-ai/create-orbit-app@alpha my-app --yes && cd my-app && npm start` release step and required real-row output.
- Plan-vs-execution review subagent `019dc9b6-dc69-7532-975e-c7e0ee17784d`: High finding that final concordance and Task 12 ledger evidence were pending; fixed in this ledger update before the ledger-only evidence commit.

Final re-review lenses:

- Code re-review subagent `019dc9be-8a16-7973-9e9a-3c0035869e72`: no unresolved Critical/High/Medium findings; verified hardcoded-version fix and passed release-workflow plus create-orbit-app tests.
- Security re-review subagent `019dc9be-8ab6-7190-9948-e552b69e507e`: no unresolved Critical/High/Medium findings; verified no-shell install execution, timeout, option conflicts, path/template handling, symlink/special-file skipping, cleanup visibility, forbidden files untouched, and scoped release-definition wording.
- Package/release re-review subagent `019dc9c0-4bb8-7892-b057-8fc46b673c23`: no unresolved Critical/High/Medium findings; verified `docs/releasing.md` post-publish generated starter proof and reran release-workflow, create-orbit-app tests/typecheck, and artifact verification.
- Process/concordance re-review subagent `019dc9c0-4c4a-7261-9e80-cd38b78b2750`: High finding that the completed Task 12 ledger was still uncommitted. Fix: this ledger-only commit records final Task 12 evidence and concordance. The same review confirmed every changed file maps to a task, skipped validation is justified, forbidden files are untouched, and the C5/rebase blocker is recorded.

Plan D E2E:

- Packed scaffolder smoke passed in `packages/create-orbit-app/src/__tests__/smoke.test.ts` as part of `corepack pnpm -F @orbit-ai/create-orbit-app test`.
- Generated starter runtime proof remains the documented post-publish release gate because exact `@orbit-ai/*@0.1.0-alpha.0` packages are not published yet.
- Full Orbit E2E remains N/A under the Plan D contract because no shared runtime packages changed. It also passed as part of repo-level `corepack pnpm -r test`, but it is supporting evidence rather than Plan D's required E2E.

Orbit schema/API/tenant review lenses:

- N/A: no core schema, API route, SDK transport, MCP runtime, CLI runtime, adapter, auth, tenant-isolation, or shared runtime package changes were made. Tenant-isolation E2E still passed during repo-level tests.

Result: no unresolved Critical/High/Medium Task 12 findings remain before ledger-only evidence commit.

## Deferred Items And Skipped Validation

- Task 3 Low security review finding about malformed known-prefix package-manager user agents was deferred to Task 7 and resolved in `993a810`.
- Task 8 exact filtered pack command skipped because Corepack pnpm `9.12.3` fails with `Unknown option: 'recursive'`; replacement evidence is package-dir pack plus packed smoke test.
- Task 8 generated starter runtime proof skipped because exact alpha runtime packages are not published (`npm view @orbit-ai/core@0.1.0-alpha.0` returned `E404`); Task 10 must retain the post-publish sanity command.

## Plan Drift Log

- `docs/releasing.md` was outside the initial Task 10 file ownership map. KEEP decision: final package/release review found a Medium release-process gap, and this file is the canonical release checklist needed to operationalize the Task 8/10 post-publish generated starter proof.

## Final Concordance

Every changed file from `git diff --name-only origin/main...HEAD` maps to Plan D as follows:

- `.changeset/plan-d-create-orbit-app-readiness.md` -> Task 11.
- `PLAN-D-EXECUTION-LEDGER.md` -> Tasks 1-12 execution evidence, review evidence, skipped-validation rationale, and final concordance.
- `docs/product/release-definition-v2.md` -> Task 10 scoped release documentation; Task 12 security wording fix.
- `docs/releasing.md` -> Task 12 package/release Medium fix for post-publish generated starter proof.
- `packages/create-orbit-app/CHANGELOG.md` -> Task 9 user-facing package documentation.
- `packages/create-orbit-app/README.md` -> Task 9 user-facing package documentation.
- `packages/create-orbit-app/src/__tests__/index.test.ts` -> Tasks 2 and 4 CLI behavior coverage; Task 7 package-manager behavior coverage; Task 12 hardcoded-version fix.
- `packages/create-orbit-app/src/__tests__/smoke.test.ts` -> Tasks 6 and 8 exact version and packed scaffolder smoke coverage.
- `packages/create-orbit-app/src/copy.test.ts` -> Tasks 4 and 5 cleanup, rollback, symlink, and special-file safety coverage.
- `packages/create-orbit-app/src/copy.ts` -> Task 4 cleanup-failure observability.
- `packages/create-orbit-app/src/index.ts` -> Tasks 2, 4, and 8 CLI version/conflict handling, cleanup reporting, and packed runtime lazy dependency loading.
- `packages/create-orbit-app/src/install.test.ts` -> Tasks 3 and 7 install command parsing, timeout, and package-manager detection coverage.
- `packages/create-orbit-app/src/install.timeout.test.ts` -> Task 3 install timeout coverage.
- `packages/create-orbit-app/src/install.ts` -> Tasks 3, 7, and 8 no-shell install execution, timeout handling, package-manager detection, and packed runtime lazy dependency loading.
- `packages/create-orbit-app/src/options.test.ts` -> Task 2 option validation coverage.
- `packages/create-orbit-app/src/options.ts` -> Task 2 option validation.
- `packages/create-orbit-app/src/packageManager.ts` -> Task 8 packed-runtime dependency split.
- `packages/create-orbit-app/src/prompts.test.ts` -> Task 2 prompt/default option coverage.
- `packages/create-orbit-app/src/version.test.ts` -> Task 6 exact alpha pinning coverage.
- `packages/create-orbit-app/src/version.ts` -> Task 6 exact alpha pinning documentation and behavior.
- `packages/demo-seed/README.md` -> Task 10 demo-seed/starter release documentation alignment.
- `scripts/release-workflow.test.mjs` -> Task 11 package artifact readiness checks; Task 12 final code-review assertion-scope fix.

Final branch diff:

```text
.changeset/plan-d-create-orbit-app-readiness.md
PLAN-D-EXECUTION-LEDGER.md
docs/product/release-definition-v2.md
docs/releasing.md
packages/create-orbit-app/CHANGELOG.md
packages/create-orbit-app/README.md
packages/create-orbit-app/src/__tests__/index.test.ts
packages/create-orbit-app/src/__tests__/smoke.test.ts
packages/create-orbit-app/src/copy.test.ts
packages/create-orbit-app/src/copy.ts
packages/create-orbit-app/src/index.ts
packages/create-orbit-app/src/install.test.ts
packages/create-orbit-app/src/install.timeout.test.ts
packages/create-orbit-app/src/install.ts
packages/create-orbit-app/src/options.test.ts
packages/create-orbit-app/src/options.ts
packages/create-orbit-app/src/packageManager.ts
packages/create-orbit-app/src/prompts.test.ts
packages/create-orbit-app/src/version.test.ts
packages/create-orbit-app/src/version.ts
packages/demo-seed/README.md
scripts/release-workflow.test.mjs
```

Final branch commits:

```text
187e5ed fix(create-orbit-app): address final release review findings
6bdfbdc docs: record Plan D task 11 evidence
15101ab changeset: record create-orbit-app follow-up hardening
321f9a6 docs: record Plan D task 10 evidence
3dce243 docs(release): fix alpha package count and demo seed usage
438089a docs(release): align alpha scaffolder package scope
9b9551e docs: record Plan D task 9 evidence
25927e8 docs(create-orbit-app): document scoped alpha usage and install command trust
093ce22 docs: record Plan D task 8 evidence
aa578a6 test(create-orbit-app): remove fake starter runtime proof
2f260b6 test(create-orbit-app): record starter runtime proof gate
4667ef7 test(create-orbit-app): smoke packed scaffolder tarball
aae257b docs: record Plan D task 7 evidence
993a810 test(create-orbit-app): strengthen package manager detection coverage
c459af2 docs: record Plan D task 6 evidence
36cabb4 fix(create-orbit-app): document and test exact alpha version pinning
7874596 docs: record Plan D task 5 evidence
156adac test(create-orbit-app): tighten special-file safety proof
75e3075 test(create-orbit-app): prove atomic rollback and template symlink safety
f9e1d60 docs: record Plan D task 4 evidence
83ca615 fix(create-orbit-app): log cleanup failures during scaffold rollback
2100bbb docs: record Plan D task 3 evidence
78fcf20 fix(create-orbit-app): bound install execution and command parsing
1c84287 docs: record Plan D task 2 evidence
def8680 feat(create-orbit-app): add version flag and option conflict checks
f9525ad docs: start Plan D execution ledger
```

## Acceptance Checklist

- [x] Worktree starts from `origin/main`.
- [x] `PLAN-D-EXECUTION-LEDGER.md` final concordance complete.
- [x] Every changed file mapped to a task.
- [x] All task focused validations complete or explicitly skipped with replacement.
- [x] Final focused gates complete.
- [x] Final repo-level gates complete.
- [x] Final code review has no unresolved Critical/High/Medium findings.
- [x] Final security review has no unresolved Critical/High/Medium findings.
- [x] Final package/release review has no unresolved Critical/High/Medium findings.
- [x] Final plan-vs-execution review has no unresolved Critical/High/Medium findings.
- [x] Orbit schema/API/tenant reviews recorded as N/A unless shared runtime packages changed.
- [x] C5 merge/rebase blocker recorded before merge: do not merge or PR-merge this branch until C5 is merged, this branch is rebased onto fresh `origin/main`, and final focused/repo-level gates are rerun.
