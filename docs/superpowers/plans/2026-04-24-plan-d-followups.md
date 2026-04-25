# Plan D Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining test-coverage, error-handling, metadata, security, and package-readiness gaps from the Plan D post-merge review (PR #42 + 3 in-PR review-driven fix commits). Make `@orbit-ai/create-orbit-app` production-ready for `npx @orbit-ai/create-orbit-app@alpha`.

**Architecture:** Single focused PR. No new features. Targeted edits to existing source/tests + one small CLI addition (`--version` flag). Each task is independently revertable.

**Tech Stack:** Same as Plan D — Node 22+ `parseArgs`, `@clack/prompts`, `execa`, `vitest`.

**Branch:** work continues on the current branch (`claude/recursing-almeida-e96c5d`). Do NOT create a new branch or switch branches.

**Test baseline:**
- `pnpm -F @orbit-ai/create-orbit-app test` baseline today = **42 tests** across 8 files. After this plan: **≥56** (+~14-18 across Tasks 2, 4, 6, 7, 8, 9, 10; expected ~60 — record actual).
- `pnpm -r test` baseline = **1796** (per CLAUDE.md). Will grow by the same delta.

**Package-readiness prerequisite alignment:**
- Plan B follow-ups may already add `"license": "MIT"` and a build-before-pack lifecycle script. Do not rely on that implicitly. This plan must verify those fields and add them if still missing.
- `@orbit-ai/create-orbit-app`'s `bin/create-orbit-app.js` imports `../dist/index.js`, so `npm pack`, `pnpm pack`, and `pnpm publish` must not be able to package stale or missing `dist`. Keep `prepublishOnly`, but add a `prepack` build gate aligned with Plan B. Add `prepare` only if Plan B standardized it for publishable packages; otherwise prefer `prepack` to avoid unnecessary build side effects for source installs.
- This plan edits the same `package.json` metadata as Plan B follow-ups. If executed in parallel, expect a small package.json merge conflict and preserve all readiness fields: `license`, `repository`, `homepage`, `bugs`, `bin`, `files`, `prepack`, and `prepublishOnly`.

**Documentation-fix validation (run after editing this plan before implementation):**

```bash
set +e
matches="$(rg -n 'Remove it manually: [r]m -rf|[r]m -rf "\$\{tempPath\}"|[r]m -rf "\$\{targetDir\}"|__(dirname)' \
  docs/superpowers/plans/2026-04-24-plan-d-followups.md)"
rc=$?
set -e
if [ "$rc" -gt 1 ]; then echo "rg failed (rc=$rc)"; exit 1; fi
if [ -n "$matches" ]; then echo "$matches"; exit 1; fi

rg -n 'prepack|license|repository|homepage|bugs|bin|files|publishGuard|no path traversal|never shell out|fileURLToPath' \
  docs/superpowers/plans/2026-04-24-plan-d-followups.md
```

Expected: the first command prints no matches; the second command prints the package-readiness, ESM path-resolution, and security validation guidance added by this plan.

**Pre-resolved executor decisions (do NOT delegate to sub-agents):**
- **Task 7 (--install-cmd + --no-install conflict)**: REJECT the combination with a clear error. Do not silently let one win — surprises the user.
- **Task 9 (version pin policy)**: KEEP exact pin (`"0.1.0-alpha.0"`). Rationale: alpha is volatile; users opting into a specific scaffolder version should get a deterministic dependency set. The reinstall hint already exists for users who need a newer alpha. Document the choice in `version.ts` and add a regression test that locks the format.
- **Task 10 (--install-cmd validation)**: NO allowlist. The flag exists for legitimate use cases (custom registries, monorepo wrappers). Document the trust model in help text + README. Folded into Task 10's docs change.

---

## Cloud Execution Context

> This section is for cloud/remote agents executing this plan without access to the original review conversation.

| Item | Value |
|------|-------|
| **Repository** | `https://github.com/sharonds/orbit-ai` |
| **Branch** | Create from `main`: `git worktree add .worktrees/plan-d-followups main -b fix/plan-d-followups` |
| **Node** | 22+ required |
| **Package manager** | pnpm 9.12.3 |
| **Baseline tests** | 1796 passing — run `pnpm -r test` to verify before starting |
| **Pre-execution** | `pnpm -r build && pnpm -r test && pnpm -r lint` must all pass first |
| **Post-execution** | `pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint` — test count must be ≥ 56 for `@orbit-ai/create-orbit-app` |
| **Package under focus** | `packages/create-orbit-app/` — this plan exclusively targets this package |
| **Security note** | Never shell out with user-derived paths. Use Node `fs` APIs. `--install-cmd` input is trusted (validated at parse time) but never passed through a shell. |

### Coding conventions (apply to every task)
- `catch (err)` — never bare `catch {}`; log before swallowing with `console.error(...)`
- Defensive cast: `err instanceof Error ? err.message : String(err)`
- Tests ship in the same commit as the feature
- `pnpm -r lint` must pass before each commit
- ESM package (`"type": "module"`) — use `fileURLToPath(new URL(..., import.meta.url))` not `__dirname`
- `vi.mock(...)` not `vi.spyOn(...)` for module-level mocking in Vitest ESM tests

---

## Verified current state (as of `main` HEAD)

| Thing | State | Evidence |
|---|---|---|
| `package.json` `license` / `repository` / `homepage` / `bugs` | **Missing or incomplete** | `packages/create-orbit-app/package.json:1-44` must be validated against sibling package metadata before publishing |
| `package.json` build-before-pack lifecycle | **Missing** | `bin/create-orbit-app.js` imports `../dist/index.js`, but package.json currently has only `prepublishOnly`; `npm pack`/`pnpm pack` can include stale or missing `dist` unless `prepack` builds first |
| Atomic-rollback regression test | **Missing** | Smoke test uses `--no-install` and a real template — never hits `walkAndCopy` mid-failure path. Atomicity from commit `1495bca` is unverified by any test. |
| Cleanup failure logging | **Silent** | `copy.ts:30` and `index.ts:101` use `.catch(() => {})` — no log on cleanup failure |
| Install timeout | **None** | `install.ts:42` calls `execa(cmd, args, { cwd, stdio: 'inherit' })` with no `timeout` option — hostile/slow registry hangs indefinitely |
| `install.test.ts:61` tautology | **Present** | `await expect(runInstall(...)).resolves.toBeDefined()` — `runInstall` returns `Promise<PackageManager>` (always defined string). Should assert exact value. |
| `index.test.ts:152` dead assertion | **Present** | `expect(logSpy).toBeDefined()` with comment "avoid unused-var lint complaint" — pure noise |
| `version.ts` wrong-name branch test | **Missing** | `getOrbitVersionFrom` line 33 throws on wrong `name` field but no test covers this branch — corrupt-install error path is untested |
| `--install-cmd` + `--no-install` conflict | **Silently no-install wins** | `parseOptions` accepts both; `runInstall` is only called when `install: true`. No validation, no test, no documentation. |
| `detectPackageManager` malformed UA | **Falls through to `npm`** | `install.ts:5-10` uses `startsWith('pnpm/')` etc. Tests cover known PMs and empty UA. No test for `bun-wasm/0.5.0` or embedded UAs. |
| Version pin policy | **Exact pin, undocumented** | `version.ts` returns raw `pkg.version`; template gets exact `"0.1.0-alpha.0"`. No test locks the format; no comment explains the choice. |
| `--version` flag | **Missing** | `parseOptions` declares `template`, `yes`, `install`, `install-cmd`, `help` — no `version`. Industry-standard `create-*` tools all have it. |

---

## File Structure

```
packages/create-orbit-app/
├── package.json                        # add/verify license, repository, homepage, bugs, prepack, bin/files readiness (Task 1)
├── README.md                           # document --install-cmd trust model (Task 10)
└── src/
    ├── copy.ts                         # log cleanup failure (Task 3)
    ├── copy.test.ts                    # add atomic-rollback regression test (Task 2)
    ├── index.ts                        # log cleanup failure + add --version + reject conflict (Tasks 3, 7, 10)
    ├── __tests__/
    │   └── index.test.ts               # remove dead assertion + add --version test + conflict test (Tasks 5, 7, 10)
    ├── install.ts                      # add timeout (Task 4)
    ├── install.test.ts                 # fix tautology + UA edge cases + timeout test (Tasks 5, 8, 4)
    ├── options.ts                      # reject --install-cmd + --no-install (Task 7)
    ├── options.test.ts                 # add conflict test (Task 7)
    ├── version.ts                      # add policy comment (Task 9)
    └── version.test.ts                 # add wrong-name branch + pin format test (Tasks 6, 9)

.changeset/
└── plan-d-followups.md                 # new (Task 11)
```

No new packages. No new source files. One new changeset file.

---

## Task 1: Add package metadata and pack-readiness gates

**Why:** Every other package in the monorepo has registry metadata; this package must match. More importantly, `bin/create-orbit-app.js` imports `../dist/index.js`, but `prepublishOnly` does not run for every pack path. Without a build-before-pack lifecycle, local or CI `npm pack`/`pnpm pack` can produce a tarball with stale or missing `dist`.

**Files:**
- Modify: `packages/create-orbit-app/package.json`

- [ ] **Step 1: Read sibling package metadata and Plan B lifecycle shape**

```bash
grep -A8 '"license"\|"repository"\|"homepage"\|"bugs"\|"prepack"\|"prepare"\|"prepublishOnly"' packages/core/package.json packages/demo-seed/package.json
cat packages/create-orbit-app/bin/create-orbit-app.js
```

Expected: shows the canonical metadata shape and confirms the bin imports `../dist/index.js`.

- [ ] **Step 2: Add or verify registry metadata**

Edit `packages/create-orbit-app/package.json`. Ensure all of these fields exist and match the sibling package style:

```json
"license": "MIT",
"repository": {
  "type": "git",
  "url": "git+https://github.com/sharonds/orbit-ai.git",
  "directory": "packages/create-orbit-app"
},
"homepage": "https://github.com/sharonds/orbit-ai#readme",
"bugs": {
  "url": "https://github.com/sharonds/orbit-ai/issues"
},
```

- [ ] **Step 3: Add build-before-pack lifecycle**

Keep the existing `prepublishOnly` guard, but add `prepack` so tarball creation builds `dist` before `bin/create-orbit-app.js` can point at it:

```json
"prepack": "pnpm run build",
"prepublishOnly": "pnpm run build && node dist/publishGuard.js"
```

If Plan B already added the exact lifecycle, verify it and leave it unchanged. If Plan B standardized `prepare` for publishable packages, follow that standard; otherwise do not add `prepare` here because `prepack` is the least surprising lifecycle for pack/publish readiness.

- [ ] **Step 4: Validate bin/files/readme/license package readiness**

Run:

```bash
node -e "const p=require('./packages/create-orbit-app/package.json'); for (const k of ['name','version','description','license','bin','files','repository','homepage','bugs','main','types']) if (!p[k]) throw new Error('missing '+k); if (!p.bin['create-orbit-app']) throw new Error('missing create-orbit-app bin'); for (const f of ['bin','dist','templates','README.md','LICENSE']) if (!p.files.includes(f)) throw new Error('files missing '+f); if (!p.scripts.prepack || !p.scripts.prepack.includes('build')) throw new Error('prepack must build dist');"
test -f packages/create-orbit-app/README.md
test -f packages/create-orbit-app/LICENSE
```

Expected: no output. This explicitly validates metadata, license, readme, bin, and package `files` coverage.

- [ ] **Step 5: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/create-orbit-app/package.json','utf8'))"`
Expected: no output (silent success).

- [ ] **Step 6: Commit**

```bash
git add packages/create-orbit-app/package.json
git commit -m "fix(create-orbit-app): add publish metadata and pack readiness gates"
```

---

## Task 2: Add atomic-rollback regression test

**Why:** Commit `1495bca` introduced the temp-dir-then-rename atomicity pattern in `copy.ts`. The smoke test uses `--no-install` and a real template — it never hits the failure path. A regression that breaks the rollback (e.g. forgetting to `rm` the temp dir) would pass all 42 tests.

**Files:**
- Modify: `packages/create-orbit-app/src/copy.test.ts`

- [ ] **Step 1: Read current copy.test.ts and existing test helpers**

Run: `cat packages/create-orbit-app/src/copy.test.ts | head -40`
Identify how the existing tests stub `fs` operations (vitest `vi.spyOn`/`vi.mock`) — match that pattern.

- [ ] **Step 2: Write the regression test using `vi.mock` (NOT `vi.spyOn`)**

**Background — why `vi.spyOn` does not work here:** `copy.ts` line 1 imports `import * as fs from 'node:fs/promises'` and calls `fs.writeFile(...)`. Vitest's ESM module registry caches modules per-import-graph; spying on a separately-imported `fsPromises` namespace in the test file does NOT patch the `fs` binding inside `copy.ts`. The only reliable interception path in Vitest ESM is `vi.mock('node:fs/promises', ...)` at the top of the test file.

Append to `packages/create-orbit-app/src/copy.test.ts`:

```typescript
import { vi } from 'vitest'

// Mock node:fs/promises module-wide so the mock is shared with copy.ts's `fs.*` calls.
// We delegate to the real module for everything except writeFile, which we sabotage on demand.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    writeFile: vi.fn(actual.writeFile), // default to real behavior; tests override per-call
  }
})

it('removes temp directory when walkAndCopy fails midway and leaves no final target', async () => {
  const fsPromises = await import('node:fs/promises')

  // Arrange: a real source directory with 3 files
  const sourceDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'coa-rollback-src-'))
  // Use the real (non-mocked) writeFile via fs.writeFileSync (sync `node:fs` import is unaffected by the mock)
  fs.writeFileSync(path.join(sourceDir, 'a.txt'), 'a')
  fs.writeFileSync(path.join(sourceDir, 'b.txt'), 'b')
  fs.writeFileSync(path.join(sourceDir, 'c.txt'), 'c')

  const parent = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'coa-rollback-tgt-'))
  const targetDir = path.join(parent, 'my-app')

  // Sabotage writeFile on the 2nd call (the first call is the first content file written).
  // Delegate other calls (mkdir, etc. don't use writeFile, but if more writes happen,
  // they must succeed via the real implementation).
  let writeCount = 0
  const writeFileMock = vi.mocked(fsPromises.writeFile)
  const realWriteFile = (await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')).writeFile
  writeFileMock.mockImplementation(async (file, data, options) => {
    writeCount += 1
    if (writeCount === 2) throw new Error('SIMULATED disk full')
    return realWriteFile(file, data, options)
  })

  try {
    await expect(
      copyTemplate({ sourceDir, targetDir, replacements: {} }),
    ).rejects.toThrow(/SIMULATED disk full/)

    // Atomicity guarantee 1: final target must NOT exist.
    expect(fs.existsSync(targetDir)).toBe(false)

    // Atomicity guarantee 2: temp dir must NOT linger. Temp dirs are siblings of `targetDir`
    // in `parent`, named `.${basename(targetDir)}-XXXXXX` (per `prepareTargetDirectory`).
    const parentEntries = fs.readdirSync(parent)
    const stragglers = parentEntries.filter(name => name.startsWith('.my-app-'))
    expect(stragglers, `temp dir(s) leaked: ${stragglers.join(', ')}`).toHaveLength(0)
  } finally {
    writeFileMock.mockReset()
    fs.rmSync(sourceDir, { recursive: true, force: true })
    fs.rmSync(parent, { recursive: true, force: true })
  }
})
```

Imports to add at the top of `copy.test.ts` (verify which are already present first via `head -10 packages/create-orbit-app/src/copy.test.ts`):
- `import { vi } from 'vitest'` — likely missing
- `import * as fs from 'node:fs'` — likely already present (sync API used in existing tests)
- `import * as os from 'node:os'` — verify
- `import * as path from 'node:path'` — likely already present

`fs` here is the synchronous `node:fs` namespace, which is NOT mocked by the `vi.mock('node:fs/promises', ...)` call above — `node:fs` and `node:fs/promises` are different modules.

- [ ] **Step 3: Run the test to verify it FAILS first (TDD)**

Wait — the test should PASS today because the atomicity logic IS in place. The point of this test is to LOCK IN that behavior so future regressions get caught. Run:

```bash
pnpm --filter @orbit-ai/create-orbit-app test src/copy.test.ts
```

Expected: passes. If it fails, the atomicity logic in `copy.ts` is broken and Plan D shipped a regression — investigate.

- [ ] **Step 4: Commit**

```bash
git add packages/create-orbit-app/src/copy.test.ts
git commit -m "test(create-orbit-app): lock in atomic-rollback guarantee for failed scaffolds"
```

---

## Task 3: Log cleanup failures in `copy.ts` and `index.ts`

**Why:** `copy.ts:30` and `index.ts:101` use `.catch(() => {})` — silent swallow. Even if intentional, it loses signal: a user whose cleanup fails (antivirus race, read-only parent) sees "Failed to scaffold project" but no hint that a partial directory survived. Replace with logged catches that report the path but never print copy-pastable shell cleanup commands for user/template-derived paths.

**Security rule:** Cleanup must use Node `fs.rm`/`rm` APIs directly. Never shell out with a path derived from project name, template name, cwd, or temp directory state. For temp directories, validate the path remains under the expected `mkdtemp` parent before attempting or recommending cleanup.

**Files:**
- Modify: `packages/create-orbit-app/src/copy.ts`
- Modify: `packages/create-orbit-app/src/index.ts`

- [ ] **Step 1: Replace `copy.ts:30` silent catch with logged catch**

Current code (`copy.ts:25-31`):
```typescript
export async function copyTemplate(input: CopyTemplateInput): Promise<void> {
  const tempTarget = await prepareTargetDirectory(input.targetDir)
  try {
    await walkAndCopy(input.sourceDir, tempTarget, input.replacements)
    await commitTargetDirectory(tempTarget, input.targetDir)
  } catch (err) {
    await fs.rm(tempTarget, { recursive: true, force: true }).catch(() => {})
    throw err
  }
}
```

Replace the catch block and add the helper shown below near the private directory helpers:

```typescript
function isChildPath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}
```

Then use it in cleanup:
```typescript
  } catch (err) {
    const expectedParent = path.dirname(input.targetDir)
    if (!isChildPath(expectedParent, tempTarget)) {
      console.error(
        `Warning: scaffold failed and skipped automatic temp cleanup because ${tempTarget} ` +
        `is outside the expected parent ${expectedParent}.`,
      )
      throw err
    }

    await fs.rm(tempTarget, { recursive: true, force: true }).catch((cleanupErr) => {
      const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
      console.error(
        `Warning: scaffold failed and temp directory ${tempTarget} could not be removed automatically. ` +
        `Inspect that path and remove it with a trusted file manager or a small Node fs.rm script after verifying it is under ${expectedParent}. ` +
        `Never shell out with user- or template-derived paths. Cause: ${msg}`,
      )
    })
    throw err
  }
```

- [ ] **Step 2: Replace `index.ts:101` silent catch with logged catch**

Verified: `index.ts:66` declares `const targetDir = path.resolve(...)`; line 101 calls `rm(targetDir, ...).catch(() => {})`. Replace the silent catch. Do not include a recursive shell-delete command in the message; `targetDir` includes user-controlled project-name input.

```typescript
await rm(targetDir, { recursive: true, force: true }).catch((cleanupErr) => {
  const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
  console.error(
    `Warning: scaffold failed and partial directory ${targetDir} could not be removed automatically. ` +
    `Inspect that path and remove it manually only after verifying it is the scaffold directory you intended to delete. ` +
    `Never shell out with user- or template-derived paths. Cause: ${msg}`,
  )
})
```

- [ ] **Step 3: Verify cleanup messages have no shell footguns**

```bash
set +e
matches="$(rg -n 'Remove it manually: [r]m -rf|[r]m -rf "\$\{tempPath\}"|[r]m -rf "\$\{targetDir\}"' packages/create-orbit-app/src)"
rc=$?
set -e
if [ "$rc" -gt 1 ]; then echo "rg failed (rc=$rc)"; exit 1; fi
if [ -n "$matches" ]; then echo "$matches"; exit 1; fi
```

Expected: no matches.

- [ ] **Step 4: Verify build + tests still pass**

```bash
pnpm --filter @orbit-ai/create-orbit-app build
pnpm --filter @orbit-ai/create-orbit-app test
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/create-orbit-app/src/copy.ts packages/create-orbit-app/src/index.ts
git commit -m "fix(create-orbit-app): log cleanup failures instead of silently swallowing"
```

---

## Task 4: Add install timeout

**Why:** `install.ts:42` calls `execa` with no `timeout` option. A hostile or slow registry hangs the scaffolder indefinitely with no feedback. 5-minute default is generous for a first install; user can override via `--install-cmd` if they need longer.

**Files:**
- Modify: `packages/create-orbit-app/src/install.ts`
- Modify: `packages/create-orbit-app/src/install.test.ts`

- [ ] **Step 1: Add `timeout` to the execa call**

Find `install.ts:42`:
```typescript
  await execa(cmd, args, { cwd: input.cwd, stdio: 'inherit' })
```

Replace with:
```typescript
  try {
    await execa(cmd, args, { cwd: input.cwd, stdio: 'inherit', timeout: 300_000 })
  } catch (err) {
    // execa surfaces a timeout via err.timedOut === true (execa v9). Re-throw with
    // a clearer message so callers can suggest manual recovery.
    if (err && typeof err === 'object' && (err as { timedOut?: boolean }).timedOut) {
      throw new Error(
        `Install command "${cmd} ${args.join(' ')}" timed out after 5 minutes. ` +
        `Try running it manually in the project directory, or pass --install-cmd ` +
        `to use a different package manager. Cause: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      )
    }
    throw err
  }
```

- [ ] **Step 2: Add a regression test for the timeout-error mapping branch**

The new branch in Step 1 catches `err.timedOut === true` and rethrows with a user-readable message. We must test the mapping itself, not just the happy path (which is already covered by the existing test at `install.test.ts:57-65`).

Use `vi.mock('execa', ...)` to inject a `timedOut` error. Append to `packages/create-orbit-app/src/install.test.ts`:

```typescript
import { vi } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

describe('runInstall timeout error mapping', () => {
  it('wraps a timedOut execa error with a user-readable timeout message', async () => {
    const { execa } = await import('execa')
    const timeoutErr = Object.assign(new Error('Command timed out after 300000 milliseconds'), {
      timedOut: true,
      command: 'npm install',
    })
    vi.mocked(execa).mockRejectedValueOnce(timeoutErr)

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-install-timeout-'))
    try {
      await expect(runInstall({ cwd, packageManager: 'npm' })).rejects.toThrow(
        /timed out after 5 minutes/i,
      )
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('rethrows non-timeout execa errors unchanged (no false-positive timeout wrap)', async () => {
    const { execa } = await import('execa')
    const otherErr = Object.assign(new Error('ENOENT: command not found'), {
      timedOut: false,
      code: 'ENOENT',
    })
    vi.mocked(execa).mockRejectedValueOnce(otherErr)

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-install-noterror-'))
    try {
      await expect(runInstall({ cwd, packageManager: 'npm' })).rejects.toThrow(
        /ENOENT/,
      )
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })
})
```

Note: `vi.mock('execa', ...)` is hoisted to the top of the test file by Vitest. If existing tests in `install.test.ts` rely on the real `execa` (e.g. the existing `customCmd: 'node ${script}'` happy-path test at line 57), they will break under the mock. Two options:
- **(a)** Move the new tests to a SEPARATE file `install.timeout.test.ts` — keeps the mock scoped.
- **(b)** Inside the `vi.mock` factory, conditionally return real execa for non-timeout calls.

**Pre-resolved: use option (a)** — create `packages/create-orbit-app/src/install.timeout.test.ts`. Cleaner; no risk of cross-test contamination.

The file should mirror the imports of `install.test.ts` (vi, fs, os, path) plus `import { runInstall } from './install.js'`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @orbit-ai/create-orbit-app test src/install.test.ts`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/create-orbit-app/src/install.ts packages/create-orbit-app/src/install.test.ts packages/create-orbit-app/src/install.timeout.test.ts
git commit -m "fix(create-orbit-app): 5-minute install timeout with clear error message"
```

---

## Task 5: Fix test tautologies

**Why:** Two assertions provide no signal:
- `install.test.ts:61` — `.resolves.toBeDefined()` on `runInstall` which always returns a defined `PackageManager` string
- `__tests__/index.test.ts:152` — `expect(logSpy).toBeDefined()` purely to silence an unused-var lint warning

**Files:**
- Modify: `packages/create-orbit-app/src/install.test.ts`
- Modify: `packages/create-orbit-app/src/__tests__/index.test.ts`

- [ ] **Step 1: Fix `install.test.ts:61`**

Find:
```typescript
await expect(runInstall({ cwd, customCmd: `node ${script}` })).resolves.toBeDefined()
```

Replace with:
```typescript
await expect(
  runInstall({ cwd, customCmd: `node ${script}`, packageManager: 'npm' }),
).resolves.toBe('npm')
```

**Why pin `packageManager: 'npm'`:** `inferPackageManagerFromCommand('node ${script}')` returns `undefined` (`node` is not a recognized PM), so `runInstall` falls back to `input.packageManager ?? detectPackageManager(process.env)`. In a test invoked via `pnpm test`, `process.env.npm_config_user_agent` starts with `pnpm/`, so `detectPackageManager` returns `'pnpm'` — the assertion `.toBe('npm')` would fail. Passing `packageManager: 'npm'` explicitly makes the test environment-independent.

- [ ] **Step 2: Fix `__tests__/index.test.ts:152`**

Find:
```typescript
// Avoid an unused-var lint complaint from strict tsc settings.
expect(logSpy).toBeDefined()
```

**Pre-resolved decision: use option (b) with this exact assertion** (`logSpy` IS legitimately used because `printNextSteps` calls `console.log('  cd ${projectName}')` at `index.ts:137`):

```typescript
expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cd my-app'))
```

This proves `printNextSteps` ran AND that `cd my-app` reached the user's terminal. Drop the comment about lint.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @orbit-ai/create-orbit-app test
```
Expected: passes; assertion count grows by 0 (replacements, not additions).

- [ ] **Step 4: Commit**

```bash
git add packages/create-orbit-app/src/install.test.ts packages/create-orbit-app/src/__tests__/index.test.ts
git commit -m "test(create-orbit-app): replace tautological assertions with behavioral checks"
```

---

## Task 6: Add `version.ts` wrong-name branch test

**Why:** `version.ts:33` throws `unexpected package.json at ${pkgPath}` when `pkg.name !== '@orbit-ai/create-orbit-app'` or `pkg.version` is missing. This is the "corrupt install" error path — the most user-visible failure mode for `npx`-distributed tools. No test covers it.

**Files:**
- Modify: `packages/create-orbit-app/src/version.test.ts`

- [ ] **Step 1: Read existing version.test.ts**

Run: `cat packages/create-orbit-app/src/version.test.ts`

Verified state: the file currently imports ONLY `describe, it, expect` from vitest plus `getOrbitVersion, getOrbitVersionFrom` from `./version.js`. None of `fs`, `path`, `os` are imported. They must be added.

- [ ] **Step 2: Add the 3 new imports + 2 new tests (use sync `fs` APIs to match `copy.test.ts` style)**

At the top of `packages/create-orbit-app/src/version.test.ts`, add:
```typescript
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
```

Append the tests (sync APIs throughout — matches the existing repo pattern in `copy.test.ts` and avoids unnecessary async overhead since `getOrbitVersionFrom` itself is sync):

```typescript
it('throws "unexpected package.json" when name does not match', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-version-wrongname-'))
  try {
    const badPkg = path.join(dir, 'package.json')
    fs.writeFileSync(badPkg, JSON.stringify({ name: 'something-else', version: '1.0.0' }))
    expect(() => getOrbitVersionFrom(badPkg)).toThrow(/unexpected package\.json/i)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

it('throws "unexpected package.json" when version is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-version-noversion-'))
  try {
    const badPkg = path.join(dir, 'package.json')
    fs.writeFileSync(badPkg, JSON.stringify({ name: '@orbit-ai/create-orbit-app' }))
    expect(() => getOrbitVersionFrom(badPkg)).toThrow(/unexpected package\.json/i)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @orbit-ai/create-orbit-app test src/version.test.ts
```
Expected: passes; test count grows by 2.

- [ ] **Step 4: Commit**

```bash
git add packages/create-orbit-app/src/version.test.ts
git commit -m "test(create-orbit-app): cover getOrbitVersionFrom wrong-name + missing-version branches"
```

---

## Task 7: Reject `--install-cmd` + `--no-install` conflict

**Why:** Today both can be set; `--no-install` silently wins (`runInstall` is not called). Users passing both expect either an error or the documented winner — neither happens. Pre-resolved decision: REJECT with a clear error.

**Files:**
- Modify: `packages/create-orbit-app/src/options.ts`
- Modify: `packages/create-orbit-app/src/options.test.ts`

- [ ] **Step 1: Add validation to `parseOptions`**

Verified insertion point: in `packages/create-orbit-app/src/options.ts`, the template validation ends at line 44 (`}`); the `result` construction begins at line 45 (`const result: Options = {`). Insert the new validation between them — after line 44, before line 45.

```typescript
  if (values['install-cmd'] !== undefined && values.install === false) {
    throw new Error(
      `--install-cmd '${values['install-cmd'] as string}' is incompatible with --no-install. Choose one: pass --install-cmd to override the install command, or --no-install to skip installation entirely.`,
    )
  }
```

(Error message format matches the existing template-validation style at line 43, which uses backtick interpolation with the offending value.)

- [ ] **Step 2: Add a test for the rejection**

Append to `packages/create-orbit-app/src/options.test.ts`:

```typescript
it('rejects --install-cmd combined with --no-install', () => {
  expect(() =>
    parseOptions(['my-app', '--install-cmd', 'pnpm install', '--no-install']),
  ).toThrow(/incompatible/i)
})

it('accepts --install-cmd alone', () => {
  const opts = parseOptions(['my-app', '--install-cmd', 'pnpm install'])
  expect(opts.installCmd).toBe('pnpm install')
  expect(opts.install).toBe(true)
})

it('accepts --no-install alone', () => {
  const opts = parseOptions(['my-app', '--no-install'])
  expect(opts.installCmd).toBeUndefined()
  expect(opts.install).toBe(false)
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @orbit-ai/create-orbit-app test src/options.test.ts
```
Expected: passes; test count grows by 3.

- [ ] **Step 4: Commit**

```bash
git add packages/create-orbit-app/src/options.ts packages/create-orbit-app/src/options.test.ts
git commit -m "fix(create-orbit-app): reject --install-cmd + --no-install conflict with clear error"
```

---

## Task 8: Add `detectPackageManager` malformed-UA tests

**Why:** `install.ts:5-10` uses `startsWith` checks on `npm_config_user_agent`. An unrecognized UA falls through to `npm`. No test covers `bun-wasm/0.5.0`, embedded UAs (`some-wrapper/1.0 npm/9.0.0`), or completely garbage strings. These are the cases where a future `startsWith` change breaks things silently.

**Files:**
- Modify: `packages/create-orbit-app/src/install.test.ts`

- [ ] **Step 1: Append edge-case tests**

```typescript
describe('detectPackageManager edge cases', () => {
  it('falls back to npm for unrecognized package manager (e.g. bun-wasm)', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'bun-wasm/0.5.0' })).toBe('npm')
  })

  it('falls back to npm when UA contains a known prefix mid-string (no false-positive match)', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'some-wrapper/1.0 npm/9.0.0' })).toBe('npm')
  })

  it('falls back to npm for empty string', () => {
    expect(detectPackageManager({ npm_config_user_agent: '' })).toBe('npm')
  })

  it('falls back to npm for missing env var', () => {
    expect(detectPackageManager({})).toBe('npm')
  })

  it('detects pnpm when UA starts with pnpm/', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'pnpm/9.12.3 npm/? node/v22.0.0' })).toBe('pnpm')
  })
})
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @orbit-ai/create-orbit-app test src/install.test.ts
```
Expected: passes; test count grows by 5.

- [ ] **Step 3: Commit**

```bash
git add packages/create-orbit-app/src/install.test.ts
git commit -m "test(create-orbit-app): cover detectPackageManager unrecognized + embedded UA cases"
```

---

## Task 9: Document and lock the version-pin policy

**Why:** `version.ts` returns the raw `pkg.version` and the template substitutes it into dependent `package.json` exact (no caret, no dist-tag). For an alpha that's not yet on npm, this is invisible. Once published, every app scaffolded from `0.1.0-alpha.0` stays pinned to alpha.0 even after newer alphas ship. The reinstall hint already addresses this for users — but no test locks the format.

Pre-resolved decision: KEEP exact pin. Document it. Add a regression test that fails if anyone changes `version.ts` to emit a caret/range.

**Files:**
- Modify: `packages/create-orbit-app/src/version.ts`
- Modify: `packages/create-orbit-app/src/version.test.ts`

- [ ] **Step 1: Add a policy comment to `version.ts`**

Find `getOrbitVersion()` in `version.ts:15`. Insert a JSDoc paragraph above it (extending the existing comment):

```typescript
/**
 * Read our own package.json to get the pinned orbit version.
 * Works from both src/version.ts (tests) and dist/version.js (runtime) —
 * both live exactly one level below the package root.
 *
 * Version-pin policy: the returned string is substituted into the scaffolded app's
 * package.json EXACTLY (no caret, no dist-tag). Users who want a newer alpha must
 * re-run create-orbit-app via `npx @orbit-ai/create-orbit-app@alpha`. The reinstall
 * hint in getOrbitVersionFrom's error path covers users on a corrupt install.
 *
 * If this policy is ever changed (e.g. to emit "alpha" dist-tag or "^0.1.0-alpha"),
 * update version.test.ts's pin-format regression test accordingly.
 */
export function getOrbitVersion(): string {
```

- [ ] **Step 2: Add a regression test that locks the format AND identity**

At the top of `version.test.ts`, add this import alongside the `fs`/`path` imports from Task 6:

```typescript
import { fileURLToPath } from 'node:url'
```

Append to `version.test.ts`:

```typescript
it('returns version as exact semver string with no caret/range/dist-tag', () => {
  // The version-pin policy is documented in version.ts. If this test fails because
  // someone changed version.ts to emit a caret or dist-tag, update the policy
  // comment AND this test together — do not silently change behavior.
  const version = getOrbitVersion()
  expect(version, `version should be exact semver, got: ${version}`).toMatch(
    /^\d+\.\d+\.\d+(-[a-z0-9.]+)?(\+[a-z0-9.]+)?$/i,
  )
  expect(version.startsWith('^'), 'pin policy: no caret').toBe(false)
  expect(version.startsWith('~'), 'pin policy: no tilde').toBe(false)
  expect(version, 'pin policy: no dist-tag').not.toBe('alpha')
  expect(version, 'pin policy: no dist-tag').not.toBe('latest')
})

it('returned version equals the package.json version field (identity check)', () => {
  // Format check above is necessary but insufficient — a stale cached or
  // hard-coded version string could pass format checks while drifting from
  // the actual package.json. This identity check catches that.
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
  const pkgVersion = (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string }).version
  expect(getOrbitVersion(), 'getOrbitVersion must return package.json version verbatim').toBe(pkgVersion)
})
```

Note: `packages/create-orbit-app/package.json` declares `"type": "module"`, so tests must not use the CommonJS dirname global. Use the repo's existing ESM pattern: `fileURLToPath(new URL(..., import.meta.url))`.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @orbit-ai/create-orbit-app test src/version.test.ts
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/create-orbit-app/src/version.ts packages/create-orbit-app/src/version.test.ts
git commit -m "docs(create-orbit-app): document exact-pin version policy + regression test"
```

---

## Task 10: Add `--version` flag

**Why:** Industry-standard `create-*` tools all have it. Users in CI / troubleshooting need to confirm which scaffolder version ran. Trivial addition.

**Files:**
- Modify: `packages/create-orbit-app/src/options.ts` — add `version` flag declaration
- Modify: `packages/create-orbit-app/src/index.ts` — handle the flag in `run()`
- Modify: `packages/create-orbit-app/src/options.test.ts` — test parsing
- Modify: `packages/create-orbit-app/src/__tests__/index.test.ts` — test execution
- Modify: `packages/create-orbit-app/README.md` — document `--install-cmd` trust model + `--version`

- [ ] **Step 1: Add `version` to `parseOptions`**

In `options.ts`, in the `Options` interface and the `parseArgs` options block, add:

```typescript
// In Options interface:
readonly version: boolean

// In parseArgs options:
version: { type: 'boolean', default: false, short: 'v' },

// In result construction:
version: Boolean(values.version),
```

- [ ] **Step 2: Handle `--version` in `index.ts run()`**

Find where `--help` is handled. Add a sibling block:

```typescript
if (opts.version) {
  console.log(getOrbitVersion())
  return
}
```

(Import `getOrbitVersion` from `./version.js` if not already imported.)

Place this BEFORE any prompts, file operations, or installs — `--version` should exit immediately and silently (just print the version).

- [ ] **Step 3: Add tests**

In `options.test.ts`:
```typescript
it('parses --version short flag (-v)', () => {
  expect(parseOptions(['-v']).version).toBe(true)
})

it('parses --version long flag', () => {
  expect(parseOptions(['--version']).version).toBe(true)
})
```

In `__tests__/index.test.ts`:
```typescript
it('--version prints the version and exits without scaffolding', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    await run(['--version'])
    const printed = logSpy.mock.calls.map(c => String(c[0])).join('')
    expect(printed).toMatch(/^\d+\.\d+\.\d+/)
  } finally {
    logSpy.mockRestore()
  }
})
```

- [ ] **Step 4: Update README**

Read `packages/create-orbit-app/README.md`. Add to the usage / flags section:

```markdown
- `--version`, `-v` — Print the create-orbit-app version and exit.

## A note on `--install-cmd`

`--install-cmd "<cmd>"` runs the given command verbatim in the scaffolded directory after the template is copied. The command is executed via `execa` with `shell: false` (no shell injection), but the binary path is trusted as-is. Use this flag for custom registries or monorepo wrappers; do not pass user-controlled strings from external scripts.
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @orbit-ai/create-orbit-app build
pnpm --filter @orbit-ai/create-orbit-app test
```
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add packages/create-orbit-app/src/options.ts packages/create-orbit-app/src/index.ts \
        packages/create-orbit-app/src/options.test.ts packages/create-orbit-app/src/__tests__/index.test.ts \
        packages/create-orbit-app/README.md
git commit -m "feat(create-orbit-app): add --version flag; document --install-cmd trust model"
```

---

## Task 11: Generate the changeset

**Why:** Tasks 1, 3, 4, 7, 9, 10 modify the publishable `@orbit-ai/create-orbit-app` source. Add a changeset.

**Files:**
- Create: `.changeset/plan-d-followups.md`

- [ ] **Step 1: Confirm pre-release mode**

Run: `cat .changeset/pre.json | head -5`
Expected: `"mode": "pre"`, `"tag": "alpha"`.

- [ ] **Step 2: Write the changeset file**

Create `.changeset/plan-d-followups.md`:

```markdown
---
"@orbit-ai/create-orbit-app": patch
---

Plan D follow-ups — close test coverage, error-handling, and metadata gaps:

- Add/verify `license`, `repository`, `homepage`, `bugs`, `bin`, `files`, README, and LICENSE package readiness.
- Add `prepack` build-before-pack gate so the CLI bin cannot pack stale/missing `dist`.
- Log cleanup failures instead of silently swallowing — user gets a manual-recovery hint when partial scaffold can't be removed, without copy-pastable shell cleanup commands.
- 5-minute install timeout with clear error message; user can override via `--install-cmd`.
- Reject `--install-cmd` combined with `--no-install` instead of silently picking one.
- Add `--version` / `-v` flag.
- Document version-pin policy (exact pin, not caret/range/dist-tag) + regression test.
- Document `--install-cmd` trust model in README.
- Test additions: atomic-rollback regression, version.ts wrong-name branch, install.test.ts UA edge cases, options.test.ts conflict-rejection.

No public API changes; users on `0.1.0-alpha.0` will see fixes when they re-run via `npx @orbit-ai/create-orbit-app@alpha`.
```

- [ ] **Step 3: Verify**

Run: `pnpm changeset status`
Expected: shows `@orbit-ai/create-orbit-app` patch bump.

- [ ] **Step 4: Commit**

```bash
git add .changeset/plan-d-followups.md
git commit -m "chore(release): add changeset for Plan D follow-ups"
```

---

## Task 12: Pre-PR verification

- [ ] **Step 1: Full build + test + lint cycle**

```bash
pnpm --filter @orbit-ai/create-orbit-app build
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
```
Expected: all green.
- `pnpm -F @orbit-ai/create-orbit-app test` should report **≥56 tests** (42 baseline + ~14 from Tasks 2/4/5/6/7/8/9/10).
  - Per-task net adds: Task 2 +1, Task 4 +2 (timeout-error mapping in new file `install.timeout.test.ts`), Task 5 +0 (replacements), Task 6 +2, Task 7 +3, Task 8 +5, Task 9 +2, Task 10 +3 = **+18 tests; new total ≈ 60**.
  - **Record the actual number** for Task 13.
- `pnpm -r test` baseline grows by the same delta.

**Recovery note:** if any command fails, do NOT proceed. Identify the breaking task via `git log --oneline` and revert / amend.

- [ ] **Step 2: Smoke-test the published-style install**

```bash
pnpm --filter @orbit-ai/create-orbit-app build
smoke_dir="$(mktemp -d "${TMPDIR:-/tmp}/cox-smoke.XXXXXX")"
cd "$smoke_dir"
node /Users/sharonsciammas/orbit-ai/.claude/worktrees/recursing-almeida-e96c5d/packages/create-orbit-app/bin/create-orbit-app.js my-app --yes --no-install
ls my-app/
cat my-app/package.json | head -15
cd /Users/sharonsciammas/orbit-ai/.claude/worktrees/recursing-almeida-e96c5d
SMOKE_DIR="$smoke_dir" node -e "require('fs').rmSync(process.env.SMOKE_DIR, { recursive: true, force: true })"
```

Expected: `my-app/` exists; `package.json` shows `"@orbit-ai/core": "0.1.0-alpha.0"` (or current version); no `__APP_NAME__` or `__ORBIT_VERSION__` placeholders remain.

- [ ] **Step 3: Smoke-test --version**

```bash
node packages/create-orbit-app/bin/create-orbit-app.js --version
node packages/create-orbit-app/bin/create-orbit-app.js -v
```
Expected: prints `0.1.0-alpha.0` and exits 0.

- [ ] **Step 4: Confirm Task 5's tautologies were removed (scoped to the two files Task 5 touched)**

```bash
set +e
# Scope strictly to the 2 files Task 5 modified, so legitimate toBeDefined()
# uses elsewhere don't false-positive.
matches="$(grep -n "toBeDefined()" \
  packages/create-orbit-app/src/install.test.ts \
  packages/create-orbit-app/src/__tests__/index.test.ts)"
rc=$?
set -e

if [ "$rc" -gt 1 ]; then echo "grep failed (rc=$rc)"; exit 1; fi
if [ -n "$matches" ]; then
  echo "STALE TAUTOLOGIES (Task 5 should have replaced these):"
  echo "$matches"
  exit 1
fi
echo "CLEAN"
```

(The earlier `__stripe_api_key__` pattern was incorrect — that string lives in `packages/integrations/`, never in `create-orbit-app/`. Removed to avoid dead verification that always passes regardless of Task 5's outcome.)

- [ ] **Step 5: Run security/package-readiness validation**

Validate the CLI inputs and template-copying path boundaries before opening the PR:

```bash
set +e
matches="$(rg -n 'shell:\s*true|exec\(|[r]m -rf "\$\{|Remove it manually: [r]m -rf' packages/create-orbit-app/src packages/create-orbit-app/bin)"
rc=$?
set -e
if [ "$rc" -gt 1 ]; then echo "rg failed (rc=$rc)"; exit 1; fi
if [ -n "$matches" ]; then echo "$matches"; exit 1; fi

pnpm --filter @orbit-ai/create-orbit-app test src/options.test.ts src/copy.test.ts src/__tests__/index.test.ts
node -e "const p=require('./packages/create-orbit-app/package.json'); for (const k of ['license','repository','homepage','bugs','bin','files']) if (!p[k]) throw new Error('missing '+k); if (!p.scripts.prepack || !p.scripts.prepack.includes('build')) throw new Error('missing build-before-pack prepack');"
```

Expected:
- `rg` prints no matches. There must be no shell execution with untrusted paths and no copy-pastable shell cleanup hints.
- `options.test.ts` covers argv/input validation, including rejecting `--install-cmd` + `--no-install` and any template-name traversal cases present in the suite. If the suite does not already cover path traversal in template names, add tests rejecting `../`, absolute paths, and path separators before opening the PR.
- `copy.test.ts` covers atomic template copying and cleanup.
- `index.test.ts` covers `--version` early exit before prompts, file writes, or installs.
- There are no HTTP request bodies in this package; request-body validation is N/A. The applicable inputs are CLI argv values, template names, package/project names, environment variables, and package metadata.

- [ ] **Step 6: Run Orbit trigger skills**

- `orbit-schema-change` — N/A
- `orbit-api-sdk-parity` — N/A
- `orbit-tenant-safety-review` — N/A (no tenant-data code)
- `orbit-core-slice-review` — N/A

- [ ] **Step 7: Run `superpowers:requesting-code-review`**

Targeted at the diff. Confirm zero MEDIUM+ findings.

- [ ] **Step 8: Run `pr-review-toolkit:review-pr`**

Focus agents: `silent-failure-hunter` (Task 3 cleanup logging, Task 4 timeout error mapping), `pr-test-analyzer` (Tasks 2/5/6/7/8/10 test additions).

---

## Task 13: Wrap-up

- [ ] **Step 1: Run `orbit-plan-wrap-up` skill**

Updates:
- `CLAUDE.md` Pre-PR Checklist: `pnpm -r test` baseline grows. Take the actual number from Task 12 Step 1 and update CLAUDE.md.
- `CLAUDE.md`: also update `packages/create-orbit-app` test count line if tracked.
- `CHANGELOG.md` is auto-generated by Changesets via Task 11 — no direct edit.

- [ ] **Step 2: Update auto-memory**

Create `/Users/sharonsciammas/.claude/projects/-Users-sharonsciammas-orbit-ai/memory/project_plan_d_followups.md`:

```markdown
---
name: Plan D Follow-ups
description: 2026-04-24 single-PR cleanup after Plan D review — add publish metadata, log cleanup failures, install timeout, --version flag, atomic-rollback regression test, version-pin policy lock
type: project
---

Plan: `docs/superpowers/plans/2026-04-24-plan-d-followups.md`.
Closes test-coverage, error-handling, and metadata findings from the Plan D audit (PR #42 + 3 in-PR review-driven fix commits).

Key changes:
- package.json: add/verify license, repository, homepage, bugs, bin/files/readme/license readiness, and prepack build-before-pack lifecycle.
- copy.ts + index.ts: log cleanup failures instead of silent .catch(()=>{}), without shell cleanup hints for derived paths.
- install.ts: 5-minute install timeout with clear error.
- options.ts: reject --install-cmd + --no-install conflict.
- version.ts: document exact-pin policy + regression test.
- index.ts: add --version / -v flag.
- README: document --install-cmd trust model.
- Tests: atomic-rollback regression, version wrong-name branch, install UA edge cases, options conflict, --version coverage.

Prerequisites:
- Plan B follow-ups may also edit `"license": "MIT"` and `"prepack"` in create-orbit-app/package.json. Preserve both if already present; add them here if still missing.

Deferred to separate plans / out of scope:
- `validate-npm-package-name` — current ad-hoc regex is acceptable for alpha.
- Single-template selection prompt UX — cosmetic; can wait until 2nd template ships.
- Real-API smoke test of the scaffolded app's `npm start` — requires post-publish gate.
```

Update `MEMORY.md` index — add one line:

```markdown
- [Plan D Follow-ups](project_plan_d_followups.md) — 2026-04-24 single-PR cleanup closing Plan D test/error-handling/metadata findings; pairs with Plan B follow-ups for publish-readiness
```

- [ ] **Step 3: Open the PR**

Use `superpowers:finishing-a-development-branch`. Title: `fix: close Plan D post-merge review findings`. Body links this plan + enumerates the 10 fixes with their severity.

- [ ] **Step 4: Run `code-review:code-review` after PR is open**

---

## Self-Review Checklist

- [ ] Every CRITICAL finding from Plan D audit has either a task here OR a cross-reference to Plan B follow-ups (B1 license → Task 1 verifies/adds; B2 prepack → Task 1 verifies/adds; B3 metadata → Task 1)
- [ ] Every HIGH finding has a task (H1 atomic-rollback test → Task 2; H2 silent cleanup → Task 3; H3 install timeout → Task 4; H4 process gates — addressed in this plan's Task 12 by mandating the gates)
- [ ] Every MEDIUM finding has a task (M1 tautologies → Task 5; M2 version wrong-name → Task 6; M3 conflict → Task 7; M4 UA edge cases → Task 8; M5 version pin → Task 9; M6 human review — N/A, process not code; M7 install-cmd validation → Task 10 docs)
- [ ] LOW items L1 (validate-npm-package-name), L2 (single template), L4 (spinner), L5 (cancel cleanup) explicitly deferred in memory + plan
- [ ] L3 (--version flag) → Task 10
- [ ] Each task commits independently
- [ ] Task 2 uses `vi.mock('node:fs/promises', ...)` (NOT `vi.spyOn`) so the mock is shared with `copy.ts`'s `fs.*` calls under Vitest ESM
- [ ] Task 5 fixes BOTH tautology sites (install + index)
- [ ] Task 4 timeout test exercises the `timedOut` error-mapping branch (mock-based), not just the happy path. Lives in separate file `install.timeout.test.ts` to avoid mocking `execa` for other tests.
- [ ] Task 5 Step 1 pins `packageManager: 'npm'` to make the assertion env-independent (avoids `pnpm test` returning `'pnpm'`)
- [ ] Task 5 Step 2 has explicit assertion (`expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cd my-app'))`); no "(a) vs (b)" delegation
- [ ] Task 6 specifies all 3 missing imports (`fs`, `os`, `path`) since `version.test.ts` has none of them
- [ ] Task 7 has explicit pre-resolved decision (REJECT) in preamble; no "decide path A vs B" delegation
- [ ] Task 7 insertion point pinned to "after line 44, before line 45" (NOT "around line 50-55" which would land inside the result object literal)
- [ ] Task 9 includes BOTH format check AND identity check (`expect(version).toBe(pkgVersion)`)
- [ ] Task 9 identity test uses `fileURLToPath(new URL('../package.json', import.meta.url))`; no CommonJS dirname global in ESM tests
- [ ] Task 9 has explicit pre-resolved decision (KEEP exact pin) in preamble
- [ ] Task 10 trust-model documentation is in README, not buried in code comments
- [ ] Task 12 security validation confirms no template/package path traversal, no shell execution with untrusted paths, and no copy-pastable shell cleanup commands
- [ ] Package readiness validation covers metadata/license/readme/bin/files and build-before-pack (`prepack`) for `@orbit-ai/create-orbit-app`
- [ ] Pre-PR verification (Task 12) mandates `pr-review-toolkit:review-pr` and `superpowers:requesting-code-review` — addresses Plan D's H4 process violation
- [ ] Branch instruction in preamble (stay on current branch)
- [ ] Test baseline resolution explicit (≥56 e2e for create-orbit-app, expected ~60; `pnpm -r test` grows by same delta)
- [ ] Task 12 Step 4 grep is correctly scoped to the 2 files Task 5 touched (NOT a broad scan that produces false positives, NOT the irrelevant `__stripe_api_key__` from another package)
- [ ] All grep verifications use explicit rc handling (no `|| true` silent swallow)
- [ ] Memory update + plan wrap-up are in Task 13
- [ ] Plan B follow-ups package-readiness overlap called out clearly in preamble; this plan still verifies/adds required fields if missing

## Known Unknowns Surfaced to Executor

(Most earlier unknowns were pre-resolved by reading the codebase before plan finalization.)

1. **`getOrbitVersion` import in `index.ts`** (Task 10 Step 2) — verified imported at `index.ts:9`. No action needed.
2. **`run()` early-exit pattern for `--help`** (Task 10 Step 2) — verified at `index.ts:39-42`. Match the same shape for `--version`.
3. **`vi.mock` interaction with the existing `runInstall` happy-path test** (Task 4) — pre-resolved to put new tests in a separate `install.timeout.test.ts` file to avoid mock cross-contamination.
4. **Snapshot of test count after merge** — expected ~+18 new tests (Task 2: 1, Task 4: 2, Task 5: 0 net, Task 6: 2, Task 7: 3, Task 8: 5, Task 9: 2, Task 10: 3). Baseline 42 → **~60**. Confirm actual in Task 12 Step 1.
5. **ESM path resolution in `version.test.ts`** (Task 9 identity test) — package is ESM (`"type": "module"`), so use `fileURLToPath(new URL('../package.json', import.meta.url))`; do not use the CommonJS dirname global.
