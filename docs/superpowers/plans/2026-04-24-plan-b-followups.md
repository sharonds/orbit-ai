# Plan B Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all HIGH/MEDIUM/LOW findings from the Plan B post-merge review (PRs #43, #60, #61, #64, #72) before attempting the first `0.1.0-alpha.1` publish.

**Architecture:** Single focused PR. No architectural change — narrow fixes to: (1) package metadata required for npm, (2) the pre-publish artifact verifier, (3) release/CI workflow safety rails including the alpha E2E launch gate, (4) Changesets/provenance consistency for private packages, (5) maintainer docs that drift from code, (6) a latent signal-handling gap in the dry-run script. Each task is independently revertable. No migration or refactor.

**Tech Stack:** Same as Plan B — Changesets, GitHub Actions, pnpm workspaces, `node:test` for the workflow regression tests, Node 22+.

**Related:** [Plan B](./2026-04-23-plan-b-publish-pipeline.md) · review findings captured in conversation audit 2026-04-24 · blocks issue #47 (first real publish) but does NOT unblock it (that's a repo-settings step).

**Branch:** work continues on the current branch (`claude/recursing-almeida-e96c5d`). Do NOT create a new branch or switch branches.

**Test baseline resolution:**
- `pnpm -r test` stays at **1796** (this runs per-package Vitest suites only; never picks up `scripts/release-workflow.test.mjs`).
- Root `pnpm test` runs `pnpm test:release-workflow && turbo run test` (see `package.json:16`). The `node --test` suite count grows from 2 → 16 (+7 from Task 2, +1 from Task 5, +2 from Task 5.5, +1 from Task 6 regex test, +2 from Task 7 spawn/signal tests, +1 from Task 8 prepack test — minus overlap if any).
- CLAUDE.md baseline tracks `pnpm -r test` — **do not change** 1796. Record the new `node --test` count as a separate line in CLAUDE.md's Pre-PR Checklist.

**Out of scope (deferred to separate plans):**
- Migration to npm Trusted Publishing (OIDC, no `NPM_TOKEN`) — GA milestone.
- Splitting `contents: write` out of the publish job — requires Trusted Publishing first.
- Adding `pnpm audit --prod --audit-level=high` to validate — needs a triage pass for the 17 open Dependabot findings first.
- Replacing negative-glob `files` entries with literal allowlist + tarball-contents assertion — needs pack-diff tooling.

---

## Verified current state (as of `main` HEAD `944b807`)

| Thing | State | Evidence |
|---|---|---|
| `@orbit-ai/create-orbit-app` `license` field | **Missing** | `packages/create-orbit-app/package.json` has no `"license"` key; every other publishable package does |
| `verify-package-artifacts.mjs` string-`bin` handling | **Broken for string `bin`** | `scripts/verify-package-artifacts.mjs:29` uses `Object.values(manifest.bin ?? {})` — iterates string chars when `bin` is a string |
| `verify-package-artifacts.mjs` license coverage | **Absent** | Script does not assert `manifest.license` nor `LICENSE` file existence |
| `CONTRIBUTING.md` security contact | **Unowned domain** | `CONTRIBUTING.md:10` → `security@orbit-ai.dev`; `SECURITY.md` uses GitHub PVR |
| `docs/releasing.md` command name | **NOT drift (correction)** | Initial audit flagged this as drift, but `package.json:14` defines `"release:verify-artifacts": "node scripts/verify-package-artifacts.mjs"`. The doc is correct. No fix needed. |
| `docs/releasing.md` version placeholders | **Invalid semver** | `releasing.md:144,152` use `0.1.0-alpha.N+1` (`+` is build-metadata delimiter) |
| `release.yml` public-repo precondition | **Missing** | Publish step sets `NPM_CONFIG_PROVENANCE=true` but nothing asserts repo is public |
| `release.yml` alpha E2E publish gate | **Not enforced** | Validate job runs `pnpm -r --filter '!@orbit-ai/e2e' test`; `e2e/README.md` says all 14 journeys are the publish gate for alpha.1 |
| Changesets private `@orbit-ai/e2e` handling | **Inconsistent with provenance guard** | `pnpm changeset status` currently includes private `@orbit-ai/e2e`, but `.changeset/config.json` does not ignore it; release PR provenance guard only allows `packages/*/package.json`, not `e2e/package.json` |
| CI `e2e-scope` path filter | **Incomplete** | `ci.yml:43,49` regex omits `packages/demo-seed/`, `packages/create-orbit-app/`, and `pnpm-lock.yaml` |
| `scripts/release-dry-run.mjs` signal handling | **Silent on SIGTERM** | `release-dry-run.mjs:41` ignores `result.error` and `result.signal` |
| `prepack` hooks on publishable packages | **1/8** | Only `packages/demo-seed/package.json:41` has `prepack`. `create-orbit-app` has `prepublishOnly` |
| Root `README.md` / `.env.example` env var name | **Stale** | `README.md:151` + `.env.example:44` still reference `ORBIT_API_BASE_URL`; code uses `ORBIT_BASE_URL` |

---

## File Structure

```
packages/create-orbit-app/package.json    # modify: add "license": "MIT"
packages/*/package.json                   # modify: add "prepack" to 7 packages missing it

scripts/verify-package-artifacts.mjs      # modify: normalize bin, assert package readiness metadata + README/LICENSE
scripts/release-workflow.test.mjs         # modify: add tests for the new release/package assertions
scripts/release-dry-run.mjs               # modify: handle result.error + result.signal

.github/workflows/release.yml             # modify: add public-repo precondition step
.github/workflows/ci.yml                  # modify: extend e2e-scope path filter
.changeset/config.json                    # modify: ignore private @orbit-ai/e2e package

CONTRIBUTING.md                           # modify: security contact → SECURITY.md
docs/releasing.md                         # modify: command name + semver placeholders
README.md                                 # modify: ORBIT_API_BASE_URL → ORBIT_BASE_URL
.env.example                              # modify: ORBIT_API_BASE_URL → ORBIT_BASE_URL
```

No new files. Every change is localized.

---

## Cloud Execution Context

> This section is for cloud/remote agents executing this plan without access to the original review conversation.

| Item | Value |
|------|-------|
| **Repository** | `https://github.com/sharonds/orbit-ai` |
| **Branch** | Create from `main`: `git worktree add .worktrees/plan-b-followups main -b fix/plan-b-followups` |
| **Node** | 22+ required |
| **Package manager** | pnpm 9.12.3 |
| **Baseline tests** | 1796 passing — run `pnpm -r test` to verify before starting |
| **Pre-execution** | `pnpm -r build && pnpm -r test && pnpm -r lint` must all pass first |
| **Post-execution** | `pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint` — test count ≥ 1796 |

### Coding conventions (apply to every task)
- `catch (err)` — never bare `catch {}`; log before swallowing with `console.error(...)`
- Defensive cast: `err instanceof Error ? err.message : String(err)`
- Tests ship in the same commit as the feature — never in a separate pass
- `pnpm -r lint` must pass before each commit
- Zod v4: `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`

---

## Task 1: Add `license` field to `@orbit-ai/create-orbit-app`

**Why:** Missing `license` in `package.json` makes npm metadata report `UNLICENSED` even though the LICENSE file ships. SCA scanners (Socket, Snyk) flag as a risk; `npm view @orbit-ai/create-orbit-app license` returns undefined. Simple one-line fix; HIGH severity because it affects the first public release metadata.

**Files:**
- Modify: `packages/create-orbit-app/package.json`

- [ ] **Step 1: Read the current manifest to see where `license` should go**

Run: `cat packages/create-orbit-app/package.json | head -20`
Expected: current fields `name`, `version`, `description`, `type`, `bin`, `files`, no `license`.

- [ ] **Step 2: Add `"license": "MIT"` alongside `"description"`**

Edit `packages/create-orbit-app/package.json`. After the `"description"` line (and before `"type"`), add:

```json
"license": "MIT",
```

So the top of the file reads:

```json
{
  "name": "@orbit-ai/create-orbit-app",
  "version": "0.1.0-alpha.0",
  "description": "Scaffolder for Orbit AI starter apps (npx @orbit-ai/create-orbit-app).",
  "license": "MIT",
  "type": "module",
  ...
}
```

(Read the file first to match the exact existing field order; insert `license` right after `description`.)

- [ ] **Step 3: Verify**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('packages/create-orbit-app/package.json','utf8')).license)"`
Expected: `MIT`

- [ ] **Step 4: Commit**

```bash
git add packages/create-orbit-app/package.json
git commit -m "fix(create-orbit-app): declare MIT license in package.json"
```

---

## Task 2: Harden `verify-package-artifacts.mjs` — bin normalization + package readiness assertions

**Why:** Two defects. (1) `Object.values(manifest.bin ?? {})` iterates a string as an array of chars when `bin` is the shorthand string form, then asks for 1-char files and fails publish. Latent today (all our bins are objects) but becomes a publish-gate crash the first time someone uses shorthand. (2) The verifier should have caught Task 1's missing `license` and should fail packages that are not npm-ready even when entrypoint files exist. Extending the script to assert package metadata (`name`, `version`, `description`, `license`, non-empty `files`) plus `README.md`/`LICENSE` gives us automated coverage so the next Plan D/E package can't regress.

**Files:**
- Modify: `scripts/verify-package-artifacts.mjs`
- Modify: `scripts/release-workflow.test.mjs` (in Task 3)

- [ ] **Step 1: Write failing tests for the new assertions**

Before editing the verifier, add tests to `scripts/release-workflow.test.mjs` that exercise the logic end-to-end against temp fixtures. We'll use the existing `node:test` harness.

Append to `scripts/release-workflow.test.mjs`:

```javascript
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

function makeFixture({ manifest, files = {}, includeLicense = true, includeReadme = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'orbit-verify-'))
  const pkgDir = join(root, 'packages', 'fixture')
  mkdirSync(pkgDir, { recursive: true })
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(manifest, null, 2))
  if (includeLicense) writeFileSync(join(pkgDir, 'LICENSE'), 'MIT fixture')
  if (includeReadme) writeFileSync(join(pkgDir, 'README.md'), '# Fixture')
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(pkgDir, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
  }
  return { root, pkgDir }
}

const VERIFIER_PATH = fileURLToPath(new URL('./verify-package-artifacts.mjs', import.meta.url))

function runVerifier(root) {
  return spawnSync(process.execPath, [VERIFIER_PATH], {
    cwd: root,
    encoding: 'utf8',
  })
}

test('verifier accepts string-form bin entries', () => {
  const { root } = makeFixture({
    manifest: {
      name: '@orbit-ai/fixture',
      version: '0.0.0',
      description: 'Fixture package',
      license: 'MIT',
      files: ['dist'],
      main: 'dist/index.js',
      bin: 'dist/cli.js',
    },
    files: { 'dist/index.js': '', 'dist/cli.js': '' },
  })
  try {
    const result = runVerifier(root)
    assert.equal(result.status, 0, `stderr:\n${result.stderr}\nstdout:\n${result.stdout}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verifier fails when license field is missing', () => {
  const { root } = makeFixture({
    manifest: {
      name: '@orbit-ai/fixture',
      version: '0.0.0',
      main: 'dist/index.js',
    },
    files: { 'dist/index.js': '' },
  })
  try {
    const result = runVerifier(root)
    assert.notEqual(result.status, 0)
    assert.match(result.stdout + result.stderr, /license/i)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verifier fails when LICENSE file is missing', () => {
  const { root } = makeFixture({
    manifest: {
      name: '@orbit-ai/fixture',
      version: '0.0.0',
      license: 'MIT',
      main: 'dist/index.js',
    },
    files: { 'dist/index.js': '' },
    includeLicense: false,
  })
  try {
    const result = runVerifier(root)
    assert.notEqual(result.status, 0)
    assert.match(result.stdout + result.stderr, /LICENSE/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verifier fails when publishable package readiness metadata is incomplete', () => {
  const { root } = makeFixture({
    manifest: {
      name: '@orbit-ai/fixture',
      version: '0.0.0',
      type: 'module',
      main: 'dist/index.js',
      license: 'MIT',
      files: [],
    },
    files: { 'dist/index.js': '' },
  })
  try {
    const result = runVerifier(root)
    const output = result.stdout + result.stderr
    assert.notEqual(result.status, 0)
    assert.match(output, /description/i, 'expected missing description failure')
    assert.match(output, /files/i, 'expected empty files array failure')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verifier skips private packages regardless of license state', () => {
  const { root } = makeFixture({
    manifest: {
      name: '@orbit-ai/fixture',
      version: '0.0.0',
      private: true,
    },
    includeLicense: false,
  })
  try {
    const result = runVerifier(root)
    assert.equal(result.status, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verifier accumulates multiple failures in one run (no early continue)', () => {
  // Package missing BOTH license and a declared main file — both should be reported.
  const { root } = makeFixture({
    manifest: {
      name: '@orbit-ai/fixture',
      version: '0.0.0',
      main: 'dist/index.js',
    },
    files: {},  // no dist/index.js either
    includeLicense: false,
  })
  try {
    const result = runVerifier(root)
    assert.notEqual(result.status, 0)
    const output = result.stdout + result.stderr
    assert.match(output, /license/i, 'expected license failure')
    assert.match(output, /(dist\/index\.js|LICENSE)/, 'expected file-missing failure')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verifier ignores packages whose name does not start with @orbit-ai/', () => {
  const { root } = makeFixture({
    manifest: {
      name: 'unrelated-pkg',
      version: '0.0.0',
      main: 'dist/index.js',
    },
    includeLicense: false,
  })
  try {
    const result = runVerifier(root)
    assert.equal(result.status, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
```

Notes:
- `runVerifier` spawns the real script via `process.execPath` with `cwd: root`. The script uses `process.cwd()` to locate `packages/*` (verified: `scripts/verify-package-artifacts.mjs:4`), so `cwd: root` correctly scopes discovery to the fixture.
- `fileURLToPath` is used instead of `scriptUrl.pathname` for cross-platform correctness (Windows URL paths have a leading `/`).
- The "accumulates multiple failures" test is the key ordering test — it proves the new license check does NOT early-`continue` past other assertions (see Task 2 Step 4 fall-through instruction).
- The "ignores non-@orbit-ai/" test locks in the existing scope filter so Plan D/E additions can't accidentally widen it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/release-workflow.test.mjs`
Expected: the seven new verifier tests fail/pass in the expected pattern — "verifier accepts string-form bin" fails because the current code treats string as chars; missing-license, missing-LICENSE, and package-readiness tests fail because the verifier doesn't check metadata; skip-private should pass already; accumulate-failures and ignore-non-orbit lock in behavior once the implementation lands.

- [ ] **Step 3: Update `scripts/verify-package-artifacts.mjs` to fix `bin` normalization**

Find the block (around line 29):

```javascript
  for (const binPath of Object.values(manifest.bin ?? {})) {
    requiredFiles.add(binPath)
  }
```

Replace with:

```javascript
  const rawBinEntries = typeof manifest.bin === 'string'
    ? [manifest.bin]
    : Object.values(manifest.bin ?? {})
  // Drop falsy entries (empty strings, null). An empty-string bin would otherwise
  // resolve to the package dir itself and silently pass existsSync.
  for (const binPath of rawBinEntries.filter(Boolean)) {
    requiredFiles.add(binPath)
  }
```

- [ ] **Step 4: Add package-readiness assertions**

Read `scripts/verify-package-artifacts.mjs` fully first. The real guard is combined:

```javascript
if (manifest.private || !manifest.name?.startsWith('@orbit-ai/')) {
  continue
}
```

Add the readiness checks **immediately after** that combined guard, and **before** the `const requiredFiles = new Set()` declaration. Do NOT use `continue` after `failures.push(...)` — the existing file-missing checks accumulate failures through the loop so one run reports all defects. Preserve that pattern:

```javascript
  if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
    failures.push(`${dir}: missing "name" field in package.json`)
  }
  if (typeof manifest.version !== 'string' || manifest.version.trim() === '') {
    failures.push(`${manifest.name}: missing "version" field in package.json`)
  }
  if (typeof manifest.description !== 'string' || manifest.description.trim() === '') {
    failures.push(`${manifest.name}: missing "description" field in package.json`)
  }
  if (typeof manifest.license !== 'string' || manifest.license.trim() === '') {
    failures.push(`${manifest.name}: missing "license" field in package.json`)
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    failures.push(`${manifest.name}: missing non-empty "files" allowlist in package.json`)
  }
  if (!existsSync(join(dir, 'LICENSE'))) {
    failures.push(`${manifest.name}: missing LICENSE file`)
  }
  if (!existsSync(join(dir, 'README.md'))) {
    failures.push(`${manifest.name}: missing README.md file`)
  }
```

Rationale: the test `verifier accumulates multiple failures in one run (no early continue)` in Step 1 asserts this fall-through behavior. A `continue` here would reintroduce the whack-a-mole debugging pattern the verifier was written to avoid.

(`existsSync` and `join` are already imported at the top of the file — `scripts/verify-package-artifacts.mjs:1-2`. Confirm during your read.)

- [ ] **Step 5: Re-run tests**

Run: `node --test scripts/release-workflow.test.mjs`
Expected: all 7 new verifier tests pass. The 2 pre-existing workflow tests still pass.

- [ ] **Step 6: Run the verifier against the real workspace to confirm no regression**

Run: `pnpm -r build && node scripts/verify-package-artifacts.mjs`
Expected: exits 0 (Task 1's commit should already be on this branch since tasks execute in order). If the verifier fails on any package other than those Task 1/8 touched, investigate — this means a pre-existing package-readiness, license, README/LICENSE, files allowlist, or entrypoint defect was masked before. Fix it inline and note in the PR body.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-package-artifacts.mjs scripts/release-workflow.test.mjs
git commit -m "fix(release): verify-package-artifacts normalizes bin and checks package readiness"
```

---

## Task 3: Fix CONTRIBUTING.md security contact

**Why:** `CONTRIBUTING.md:10` tells security reporters to email `security@orbit-ai.dev`. The domain is not owned by the project, and `SECURITY.md` already documents the real channel (GitHub Private Vulnerability Reporting). A researcher following CONTRIBUTING could deliver a zero-day to whoever registers that domain. HIGH severity, one-line fix.

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Read current content**

Run: `sed -n '1,20p' CONTRIBUTING.md`

- [ ] **Step 2: Replace the stale line**

Find line 10 (approximately):
```
- **Security issues** go to `security@orbit-ai.dev` — not a public issue. See
```

Replace with:
```
- **Security issues** — do NOT open a public issue. Use [GitHub Private Vulnerability Reporting](https://github.com/sharonds/orbit-ai/security/advisories/new) or follow the disclosure process in [SECURITY.md](SECURITY.md).
```

Use the Edit tool with enough surrounding context to match the exact existing line (including any continuation on the next line). Read the file first to get the full 2-3 line block if the sentence spans lines.

- [ ] **Step 3: Verify no stale references remain**

Run:
```bash
grep -rn "security@orbit-ai" . --include='*.md' --include='*.MD' --include='*.yml' --include='*.yaml'
rc=$?
if [ "$rc" -eq 1 ]; then
  echo "CLEAN"
elif [ "$rc" -ne 0 ]; then
  echo "grep error (rc=$rc)"; exit 1
fi
```
Expected: `CLEAN`. Any non-zero rc other than 1 (no match) is a real grep error — investigate.

- [ ] **Step 4: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs(security): route reports to SECURITY.md PVR, not unowned email"
```

---

## Task 4: Fix invalid semver placeholders in `docs/releasing.md`

**Why:** Lines 144 and 152 use `0.1.0-alpha.N+1` as a placeholder, but `+` is the semver build-metadata separator — copy/pasting these into real `npm` commands produces invalid version errors. (Earlier audit flagged `pnpm release:verify-artifacts` as drift; it is NOT drift — `package.json:14` defines that script. No change to that line.)

Also add a one-line residual-risk note about the TOCTOU window between Task 5's public-repo check and publish.

**Files:**
- Modify: `docs/releasing.md`

- [ ] **Step 1: Read the current relevant lines**

Run: `sed -n '140,160p' docs/releasing.md`

- [ ] **Step 2: Fix the semver placeholders**

Find both occurrences of `0.1.0-alpha.N+1` (lines 144 and 152) and replace each with `0.1.0-alpha.<next>` (angle-bracket metasyntax is unambiguously a placeholder).

Verify scope before editing:
```bash
grep -cn "alpha.N+1" docs/releasing.md
```
Expected: `2` matches.

Use Edit with `replace_all: true` (the exact string `0.1.0-alpha.N+1` appears only as a placeholder per the grep above). Also change the accompanying `0.1.0-alpha.N` → `0.1.0-alpha.<current>` on line 144 so current/next metasyntax is consistent.

Before (line 144):
```
   npm deprecate "@orbit-ai/api@0.1.0-alpha.N" "Bad alpha release; use 0.1.0-alpha.N+1."
```

After:
```
   npm deprecate "@orbit-ai/api@0.1.0-alpha.<current>" "Bad alpha release; use 0.1.0-alpha.<next>."
```

Do the same shape of change on line 152.

- [ ] **Step 3: Add TOCTOU residual-risk note near the provenance section**

Read `docs/releasing.md` around the "Provenance" or "Secrets" section (grep for `NPM_CONFIG_PROVENANCE` or `provenance`). Add this sentence at the end of that section:

> Residual risk: the publish job's public-repo precondition check (see `.github/workflows/release.yml`) runs seconds before `pnpm release` — an admin who flips the repo private in that window would bypass the gate. Migration to npm Trusted Publishing (tracked separately) removes this window by tying attestation to the workflow run itself.

(If no provenance section exists, append to the Troubleshooting section.)

- [ ] **Step 4: Verify**

```bash
grep -n "alpha.N+1" docs/releasing.md
rc=$?
if [ "$rc" -eq 1 ]; then
  echo "CLEAN"
elif [ "$rc" -ne 0 ]; then
  echo "grep error (rc=$rc)"; exit 1
else
  echo "STILL PRESENT"; exit 1
fi
```
Expected: `CLEAN`.

- [ ] **Step 5: Commit**

```bash
git add docs/releasing.md
git commit -m "docs(release): fix invalid semver placeholders; document TOCTOU residual risk"
```

---

## Task 5: Add public-repo precondition to the publish step

**Why:** `NPM_CONFIG_PROVENANCE=true` requires a public repository. The docs say so, but nothing in the workflow enforces it. If the repo is ever flipped private before a release, the publish either fails deep inside npm with an opaque error or succeeds without provenance (both are bad). A single `gh api` check prevents this.

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Read the publish job to find the insertion point**

Run: `sed -n '230,265p' .github/workflows/release.yml`
Goal: insert a new step *immediately before* the `Verify package artifacts` step and after `Download built package artifacts`. The new step runs first so a private-repo condition aborts before any publish logic executes.

- [ ] **Step 2: Insert the precondition step**

Add this step in the publish job, right before the existing `name: Verify package artifacts` step:

```yaml
      - name: Require repository to be public for provenance
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -o pipefail
          is_private="$(gh api "/repos/${{ github.repository }}" --jq '.private')"
          if [ "$is_private" != "false" ]; then
            echo "Refusing to publish: repository is not public. Provenance (NPM_CONFIG_PROVENANCE=true) requires a public repository."
            exit 1
          fi
```

Match the indentation of the neighboring `- name: Verify package artifacts` step exactly (6 leading spaces for `- name:` per the existing file). `set -o pipefail` matches the style of the existing `Verify generated release pull request provenance` step — deliberately not `set -euo pipefail` for consistency. The `[ "" != "false" ]` path (gh api failure → empty string) still exits 1, which is the correct fail-closed behavior.

- [ ] **Step 3: Extend the regression test**

Append to `scripts/release-workflow.test.mjs`. Anchor on the `- name:` YAML structure so a comment or doc string containing the phrase cannot satisfy the assertion:

```javascript
test('publish job requires the repository to be public before running', () => {
  // Anchor on the actual step header (6-space indent + "- name: ") so a code comment
  // or doc string containing these phrases cannot fool the ordering check.
  const stepHeader = /^      - name: Require repository to be public for provenance$/m
  const verifyHeader = /^      - name: Verify package artifacts$/m
  const publishHeader = /^      - name: Publish packages$/m

  const preconditionMatch = workflow.match(stepHeader)
  const verifyMatch = workflow.match(verifyHeader)
  const publishMatch = workflow.match(publishHeader)

  assert.ok(preconditionMatch, 'missing public-repo precondition step (as a YAML step header)')
  assert.ok(verifyMatch, 'missing verify step header')
  assert.ok(publishMatch, 'missing publish step header')
  assert.ok(preconditionMatch.index < verifyMatch.index, 'precondition must run before verification')
  assert.ok(verifyMatch.index < publishMatch.index, 'verification must run before publish')
})
```

- [ ] **Step 4: Run tests**

Run: `node --test scripts/release-workflow.test.mjs`
Expected: all tests pass, including the new one.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml scripts/release-workflow.test.mjs
git commit -m "ci(release): abort publish if repository is private (provenance gate)"
```

---

## Task 5.5: Make the alpha E2E publish gate and Changesets provenance truthful

**Why:** `e2e/README.md` says all 14 journeys are the publish gate for `0.1.0-alpha.1`, but `.github/workflows/release.yml` currently runs `pnpm -r --filter '!@orbit-ai/e2e' test` and therefore excludes the package that owns those journeys. Separately, Changesets currently sees private `@orbit-ai/e2e`, while the publish job's provenance guard rejects release PR files outside `packages/*/package.json` and the fixed generated files. Preferred fix: keep the private E2E package out of Changesets entirely, and add an explicit release validate step that runs the launch-gate journeys before any version or publish job can proceed.

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `.changeset/config.json`
- Modify: `scripts/release-workflow.test.mjs`

- [ ] **Step 1: Read the release validate job and Changesets config**

```bash
sed -n '35,75p' .github/workflows/release.yml
cat .changeset/config.json
```

Expected: validate currently has `Test release workflow`, then `Test` with `--filter '!@orbit-ai/e2e'`; `.changeset/config.json` does not ignore `@orbit-ai/e2e`.

- [ ] **Step 2: Add the launch-gate E2E step to release validate**

In `.github/workflows/release.yml`, insert this step after `Test release workflow` and before the existing `Test` step:

```yaml
      - name: Test launch-gate E2E journeys
        run: pnpm --filter @orbit-ai/e2e test
```

Keep the existing `Test` step as `pnpm -r --filter '!@orbit-ai/e2e' test`. After this change that exclusion is truthful: the general package-test sweep excludes E2E only because the dedicated launch-gate step has already run all 14 E2E journeys.

If this pushes the validate job close to the current `timeout-minutes: 20`, increase the validate timeout to `40`. Do not shrink test coverage to make the timeout pass.

- [ ] **Step 3: Ignore private `@orbit-ai/e2e` in Changesets**

Edit `.changeset/config.json` and add `@orbit-ai/e2e` to the `ignore` array:

```json
"ignore": ["orbit-ai-nodejs-quickstart", "@orbit-ai/e2e"]
```

Do **not** add `e2e/package.json` to the release PR provenance allowlist. The private test package should not be versioned or published, so release PRs should not touch it. If `pnpm changeset status` still reports `@orbit-ai/e2e` after this change, stop and investigate the Changesets config before continuing.

- [ ] **Step 4: Add release-workflow regression tests**

Append to `scripts/release-workflow.test.mjs`:

```javascript
test('release validate runs the launch-gate e2e journeys before publish can proceed', () => {
  const e2eStep = /^      - name: Test launch-gate E2E journeys$/m
  const packageTestStep = /^      - name: Test$/m
  const versionJob = /^  version:$/m
  const publishJob = /^  publish:$/m

  const e2eMatch = workflow.match(e2eStep)
  const packageTestMatch = workflow.match(packageTestStep)
  const versionMatch = workflow.match(versionJob)
  const publishMatch = workflow.match(publishJob)

  assert.ok(e2eMatch, 'release validate must include the alpha launch-gate E2E step')
  assert.match(workflow, /pnpm --filter @orbit-ai\/e2e test/)
  assert.match(workflow, /pnpm -r --filter '!@orbit-ai\/e2e' test/)
  assert.ok(packageTestMatch, 'release validate must still run the package test sweep')
  assert.ok(versionMatch, 'missing version job')
  assert.ok(publishMatch, 'missing publish job')
  assert.ok(e2eMatch.index < packageTestMatch.index, 'E2E launch gate should run before the generic package test sweep')
  assert.ok(packageTestMatch.index < versionMatch.index, 'all validate tests must be in the validate job before versioning')
  assert.ok(versionMatch.index < publishMatch.index, 'publish job must remain after version job')
})

test('changesets ignores private e2e so release PR provenance stays consistent', () => {
  const config = JSON.parse(_readFileSyncCi(new URL('../.changeset/config.json', import.meta.url), 'utf8'))
  assert.ok(config.ignore.includes('@orbit-ai/e2e'), 'private @orbit-ai/e2e must not be versioned by Changesets')
  assert.ok(config.ignore.includes('orbit-ai-nodejs-quickstart'), 'keep existing quickstart ignore entry')
})
```

> ⚠️ **Import required for Task 5.5:** If Task 6 has not yet been applied, add this import at the top of `scripts/release-workflow.test.mjs` before running Step 4:
> ```js
> import { readFileSync as _readFileSyncCi } from 'node:fs';
> ```
> If Task 6 has already been applied this import already exists — do not add it twice.

- [ ] **Step 5: Verify release workflow tests and Changesets status**

```bash
node --test scripts/release-workflow.test.mjs
pnpm changeset status
```

Expected: release workflow tests pass. `pnpm changeset status` does not list `@orbit-ai/e2e` and does not propose or require `e2e/package.json`.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/release.yml .changeset/config.json scripts/release-workflow.test.mjs
git commit -m "ci(release): enforce e2e launch gate before alpha publish"
```

---

## Task 6: Extend CI `e2e-scope` path filter

**Why:** `ci.yml:43,49` regex misses `packages/demo-seed/` and `packages/create-orbit-app/` (both ship and can break journeys) and `pnpm-lock.yaml` (dependency bumps). Push-to-main backstops this, but a buggy PR touching only those paths merges with no E2E signal. Extend the regex.

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read the e2e-scope step**

Run: `sed -n '35,60p' .github/workflows/ci.yml`

- [ ] **Step 2: Extend both regex patterns**

Edit `.github/workflows/ci.yml`. Locate the two `grep -E` lines inside the `e2e-scope` step.

Before (SQLite trigger):
```bash
if printf '%s\n' "$changed_files" | grep -E '^(packages/(core|api|sdk|cli|mcp|integrations)/src/|e2e/|examples/nodejs-quickstart/)'; then
```

After:
```bash
if printf '%s\n' "$changed_files" | grep -E '^(packages/(core|api|sdk|cli|mcp|integrations|demo-seed|create-orbit-app)/|e2e/|examples/nodejs-quickstart/|pnpm-lock\.yaml$|\.github/workflows/(ci|release)\.yml$)'; then
```

Notes:
- Removed `/src/` constraint on the packages alternation — a dependency bump in `packages/core/package.json` now triggers SQLite E2E.
- Added `pnpm-lock.yaml` (root lockfile) and the two workflow files themselves.

Before (Postgres trigger):
```bash
if printf '%s\n' "$changed_files" | grep -E '^(packages/(core|api|sdk)/src/|e2e/src/(harness|journeys/(02|03|04|05|06|07|08|09|10|11))/)'; then
```

After:
```bash
if printf '%s\n' "$changed_files" | grep -E '^(packages/(core|api|sdk)/|e2e/src/(harness|journeys/(02|03|04|05|06|07|08|09|10|11))/|pnpm-lock\.yaml$)'; then
```

(`demo-seed` / `create-orbit-app` intentionally excluded from the Postgres matrix — they don't affect Postgres-specific journeys 02–11; SQLite suite covers them.)

Note: removing `/src/` means a doc-only change under `packages/core/README.md` now triggers both SQLite and Postgres E2E (≈25 min). Intentional — we err toward over-testing on changes to the core packages rather than under-testing.

- [ ] **Step 3: Verify the regex parses**

Run (uses Python for regex validation since these are ERE, not PCRE):
```bash
echo "packages/demo-seed/README.md" | grep -E '^(packages/(core|api|sdk|cli|mcp|integrations|demo-seed|create-orbit-app)/|e2e/|examples/nodejs-quickstart/|pnpm-lock\.yaml$|\.github/workflows/(ci|release)\.yml$)' && echo OK
echo "pnpm-lock.yaml" | grep -E '^(packages/(core|api|sdk|cli|mcp|integrations|demo-seed|create-orbit-app)/|e2e/|examples/nodejs-quickstart/|pnpm-lock\.yaml$|\.github/workflows/(ci|release)\.yml$)' && echo OK
echo "docs/releasing.md" | grep -E '^(packages/(core|api|sdk|cli|mcp|integrations|demo-seed|create-orbit-app)/|e2e/|examples/nodejs-quickstart/|pnpm-lock\.yaml$|\.github/workflows/(ci|release)\.yml$)' || echo SKIPPED-DOCS
```
Expected: first two print `OK`, third prints `SKIPPED-DOCS`.

- [ ] **Step 4: Add a regression test for the path filter**

Append to `scripts/release-workflow.test.mjs`:

```javascript
import { readFileSync as _readFileSyncCi } from 'node:fs'

test('ci e2e-scope regex matches demo-seed, create-orbit-app, and lockfile', () => {
  const ciWorkflow = _readFileSyncCi(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

  // Pull out both grep -E ERE patterns from the e2e-scope step. They're the only two
  // single-quoted multi-alternation regexes in the file at the time of writing.
  const patterns = [...ciWorkflow.matchAll(/grep -E '(\^\([^']+\))'/g)].map(m => m[1])
  assert.equal(patterns.length, 2, `expected 2 grep -E patterns, got ${patterns.length}`)
  const [sqlitePattern, postgresPattern] = patterns.map(p => new RegExp(p.replace(/\\\./g, '\\.')))

  // SQLite filter: must match demo-seed, create-orbit-app, lockfile, workflow self.
  for (const path of [
    'packages/demo-seed/README.md',
    'packages/create-orbit-app/package.json',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml',
    'packages/core/src/index.ts',
  ]) {
    assert.match(path, sqlitePattern, `sqlite filter should match ${path}`)
  }
  // SQLite filter: must NOT match doc-only repo-root changes.
  for (const path of ['docs/releasing.md', 'README.md', 'AGENTS.MD']) {
    assert.doesNotMatch(path, sqlitePattern, `sqlite filter should NOT match ${path}`)
  }

  // Postgres filter: must match core/api/sdk + lockfile; NOT demo-seed / create-orbit-app.
  assert.match('packages/core/src/index.ts', postgresPattern)
  assert.match('pnpm-lock.yaml', postgresPattern)
  assert.doesNotMatch('packages/demo-seed/src/index.ts', postgresPattern)
  assert.doesNotMatch('packages/create-orbit-app/src/index.ts', postgresPattern)
})
```

Run: `node --test scripts/release-workflow.test.mjs`
Expected: the new test passes alongside the existing suite.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml scripts/release-workflow.test.mjs
git commit -m "ci: expand e2e-scope to cover demo-seed, create-orbit-app, lockfile, workflows"
```

---

## Task 7: Harden `scripts/release-dry-run.mjs` signal handling

**Why:** Line 41 inspects `result.status !== 0` but ignores `result.error` (spawn failure) and `result.signal` (killed by signal — `status` is then `null`). A SIGTERM from CI timeout exits 1 with no context; a spawn error logs nothing. Small but real silent-failure surface.

**Files:**
- Modify: `scripts/release-dry-run.mjs`

- [ ] **Step 1: Read the current error-handling block**

Run: `sed -n '30,50p' scripts/release-dry-run.mjs`

- [ ] **Step 2: Replace the bare status check**

Before changing result handling, make the pnpm binary injectable for tests:

```javascript
const pnpmBin = process.env.ORBIT_RELEASE_DRY_RUN_PNPM_BIN ?? 'pnpm'
```

Use `pnpmBin` in the `spawnSync(...)` call instead of the hardcoded `'pnpm'`. This keeps normal behavior unchanged while allowing the regression tests below to simulate spawn errors and signal termination without running a real publish.

Find the block:
```javascript
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
```

Replace with:
```javascript
  if (result.error) {
    console.error(`${pnpmBin} publish --dry-run failed to spawn for ${manifest.name}:`, result.error)
    process.exit(1)
  }
  if (result.signal) {
    console.error(`${pnpmBin} publish --dry-run for ${manifest.name} was killed by signal ${result.signal}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`${pnpmBin} publish --dry-run for ${manifest.name} exited with status ${result.status}`)
    process.exit(result.status)
  }
```

- [ ] **Step 3: Wrap the outer `JSON.parse` in both scripts with a diagnostic catch**

Both `scripts/release-dry-run.mjs` and `scripts/verify-package-artifacts.mjs` read package manifests with a bare `JSON.parse(readFileSync(...))`. A corrupt `package.json` dies with an unhelpful `SyntaxError`. Wrap the parse call per script so the failing path is identifiable.

In each script, find the `JSON.parse(readFileSync(...))` on a `package.json` and replace with:
```javascript
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`Failed to parse ${manifestPath}:`, err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
```

(Adjust variable names — `manifestPath` — to match each script's existing local variable. Do NOT rename the outer `manifest` variable; code later in the loop uses it.)

- [ ] **Step 4: Smoke-test the script still runs**

Run: `pnpm -r build && node scripts/release-dry-run.mjs`
Expected: runs `pnpm publish --dry-run --ignore-scripts` per publishable package. Exits 0 when everything is in order. (Treat non-zero exit as signal to inspect — do not suppress. `pnpm -r build` first because the dry-run may reject packages without `dist/`.)

- [ ] **Step 5: Add regression tests for spawn errors and signal handling**

Append to `scripts/release-workflow.test.mjs`:

```javascript
import { chmodSync } from 'node:fs'

const DRY_RUN_PATH = fileURLToPath(new URL('../scripts/release-dry-run.mjs', import.meta.url))

test('release-dry-run exits non-zero and reports spawn errors', () => {
  const result = spawnSync(process.execPath, [DRY_RUN_PATH], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      ORBIT_RELEASE_DRY_RUN_PNPM_BIN: '/definitely/not/a/pnpm/binary',
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /failed to spawn/)
})

test('release-dry-run exits non-zero and reports signal terminations distinctly from non-zero exit', () => {
  const fakePnpm = join(mkdtempSync(join(tmpdir(), 'orbit-dry-run-')), 'pnpm')
  writeFileSync(fakePnpm, '#!/bin/sh\nkill -TERM $$\n')
  chmodSync(fakePnpm, 0o755)

  const result = spawnSync(process.execPath, [DRY_RUN_PATH], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      ORBIT_RELEASE_DRY_RUN_PNPM_BIN: fakePnpm,
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /killed by signal SIGTERM/)
})

```

Both tests are behavioral: they execute the real script with an injected fake pnpm binary and assert non-zero exit plus diagnostics. Reuses `mkdtempSync`, `tmpdir`, `join`, `writeFileSync`, `spawnSync`, and `fileURLToPath` from earlier tests. If tasks execute out of order, import them locally.

- [ ] **Step 6: Commit**

```bash
git add scripts/release-dry-run.mjs scripts/verify-package-artifacts.mjs scripts/release-workflow.test.mjs
git commit -m "fix(release): log spawn errors, signal termination, and manifest parse failures"
```

---

## Task 8: Add `prepack` build hook to all publishable packages

**Why:** Today only `packages/demo-seed` has `prepack`; `create-orbit-app` has `prepublishOnly`. If an operator runs `pnpm pack` locally (per the emergency-publish runbook) without a prior build, `@orbit-ai/create-orbit-app` can produce a stale or broken tarball: its `bin/create-orbit-app.js` imports `../dist/index.js`, but `prepublishOnly` does not protect plain pack workflows. Defense in depth — the CI pipeline is fine because it builds explicitly, but the local emergency path is not. The `NPM_CONFIG_IGNORE_SCRIPTS=true` env in CI's publish step means these hooks do NOT run under CI credentials; they are only a local-safety net.

**Files:**
- Modify: `packages/api/package.json`
- Modify: `packages/cli/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/integrations/package.json`
- Modify: `packages/mcp/package.json`
- Modify: `packages/sdk/package.json`
- Modify: `packages/create-orbit-app/package.json`

(`packages/demo-seed` already has it.)

Note on `create-orbit-app`: it already has `prepublishOnly: "pnpm run build && node dist/publishGuard.js"`. Keep that hook — `prepack` runs the build only, `prepublishOnly` runs the publish guard. Both fire on `pnpm publish` (pnpm runs `prepack` then `prepublishOnly`), which means a local publish rebuilds twice — that's acceptable. Do NOT remove `prepublishOnly`.

- [ ] **Step 1: Confirm each package has a `build` script**

Run:
```bash
for pkg in api cli core integrations mcp sdk create-orbit-app; do
  echo "=== $pkg ==="
  node -e "console.log(JSON.parse(require('fs').readFileSync('packages/$pkg/package.json','utf8')).scripts?.build ?? 'NO BUILD SCRIPT')"
done
```
Expected: every package prints a real build command. If any prints `NO BUILD SCRIPT`, STOP — adding `prepack` without a build target breaks `pnpm pack` for that package. Read that package's `package.json` and decide how to build it; if it's genuinely build-less, skip `prepack` for it and note in the commit message.

- [ ] **Step 2: Add `prepack` to each package's `scripts` block**

For each of the 7 packages, open `packages/<pkg>/package.json` and add inside the `"scripts"` block:

```json
"prepack": "pnpm run build"
```

Place it adjacent to the existing `"build"` entry to keep related scripts grouped. Use Edit tool per package — these files have different structure so a `replace_all` pattern match won't work cleanly.

- [ ] **Step 3: Verify each package's prepack resolves**

```bash
for pkg in api cli core integrations mcp sdk create-orbit-app demo-seed; do
  echo "=== $pkg ==="
  node -e "console.log(JSON.parse(require('fs').readFileSync('packages/$pkg/package.json','utf8')).scripts?.prepack ?? 'MISSING')"
done
```
Expected: every package prints `pnpm run build` (or equivalent). `demo-seed` already had it — confirm unchanged.

- [ ] **Step 4: Smoke-test `@orbit-ai/create-orbit-app` pack output**

Run:
```bash
rm -rf /tmp/orbit-pack-smoke
mkdir -p /tmp/orbit-pack-smoke
pnpm --filter @orbit-ai/create-orbit-app pack --pack-destination /tmp/orbit-pack-smoke
tarball="$(find /tmp/orbit-pack-smoke -name 'orbit-ai-create-orbit-app-*.tgz' -print -quit)"
test -n "$tarball"
tar -tzf "$tarball" | sort | tee /tmp/orbit-pack-smoke/create-orbit-app.contents
tar -xOf "$tarball" package/package.json | node -e "let s=''; process.stdin.on('data', c => s += c); process.stdin.on('end', () => { const m = JSON.parse(s); if (m.name !== '@orbit-ai/create-orbit-app' || m.license !== 'MIT') process.exit(1) })"
grep -Fx 'package/LICENSE' /tmp/orbit-pack-smoke/create-orbit-app.contents
grep -Fx 'package/README.md' /tmp/orbit-pack-smoke/create-orbit-app.contents
grep -Fx 'package/dist/index.js' /tmp/orbit-pack-smoke/create-orbit-app.contents
grep -Fx 'package/bin/create-orbit-app.js' /tmp/orbit-pack-smoke/create-orbit-app.contents
grep -q '^package/templates/' /tmp/orbit-pack-smoke/create-orbit-app.contents
```
Expected: pack succeeds, `prepack` builds before the tarball is created, metadata reports `@orbit-ai/create-orbit-app` with `license: MIT`, and the tarball contains `LICENSE`, `README.md`, `dist/index.js`, the bin wrapper, and templates. This replaces the invalid `pnpm pack --dry-run` pattern; if a dry run is specifically needed, use `npm pack --dry-run` inside `packages/create-orbit-app` and treat it as informational only.

- [ ] **Step 5: Add a regression test asserting every publishable package has `prepack`**

Append to `scripts/release-workflow.test.mjs`:

```javascript
import { readdirSync, readFileSync as _readFileSyncPrepack } from 'node:fs'

test('every publishable package declares a prepack build hook', () => {
  const packagesDir = fileURLToPath(new URL('../packages/', import.meta.url))
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(packagesDir, entry.name, 'package.json')
    let manifest
    try {
      manifest = JSON.parse(_readFileSyncPrepack(manifestPath, 'utf8'))
    } catch (err) {
      throw new Error(`Failed to parse ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (manifest.private) continue
    if (!manifest.name?.startsWith('@orbit-ai/')) continue
    assert.ok(manifest.scripts?.prepack, `${manifest.name} must declare scripts.prepack`)
    assert.ok(manifest.scripts?.build, `${manifest.name} must declare scripts.build (referenced by prepack)`)
  }
})
```

(Imports `join` / `fileURLToPath` already used in earlier tests. If they're not in scope when Task 8 executes standalone, add them locally.)

Run: `node --test scripts/release-workflow.test.mjs`
Expected: new test passes for all 8 publishable packages.

- [ ] **Step 6: Commit**

```bash
git add packages/*/package.json scripts/release-workflow.test.mjs
git commit -m "chore(release): add prepack build hook to every publishable package"
```

---

## Task 9: Fix stale `ORBIT_API_BASE_URL` references

**Why:** PR #61 renamed `ORBIT_API_BASE_URL` → `ORBIT_BASE_URL` across package READMEs and `AGENTS.MD`, but missed the two most visible surfaces: the root `README.md` (line 151) and `.env.example` (line 44). Both now contradict the code (`packages/cli/src/config/resolve-context.ts` uses `ORBIT_BASE_URL`). New users hit the wrong env var on first run.

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Verify current state**

Run: `grep -n "ORBIT_API_BASE_URL\|ORBIT_BASE_URL" README.md .env.example`
Expected: 1 match in each using the old name.

- [ ] **Step 2: Replace in `README.md:151`**

Read the surrounding lines first (Read tool with offset ~145, limit ~15) to get exact context. Then Edit to change `ORBIT_API_BASE_URL` → `ORBIT_BASE_URL` in the SDK quickstart snippet.

- [ ] **Step 3: Replace in `.env.example:44`**

Edit `.env.example` — change the `# ORBIT_API_BASE_URL=...` line to `# ORBIT_BASE_URL=...`.

- [ ] **Step 4: Verify no stale references remain anywhere**

```bash
matches="$(grep -rn "ORBIT_API_BASE_URL" . --include='*.md' --include='*.MD' --include='*.ts' --include='*.mjs' --include='.env*' | grep -v node_modules || true)"
if [ -z "$matches" ]; then
  echo "CLEAN"
else
  echo "REMAINING REFERENCES:"
  echo "$matches"
  # CHANGELOG entries that describe the rename are acceptable; anything else must be fixed.
  non_changelog="$(echo "$matches" | grep -v CHANGELOG || true)"
  if [ -n "$non_changelog" ]; then
    echo "Non-changelog references found — fix before committing."
    exit 1
  fi
fi
```
Expected: `CLEAN`, or only matches in `CHANGELOG.md` entries describing the rename.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example
git commit -m "docs: rename ORBIT_API_BASE_URL to ORBIT_BASE_URL in root README + env example"
```

---

## Task 9.5: Generate the changeset

**Why:** Tasks 1 and 8 modified publishable `package.json` files. The repo's CI guard (`ci.yml` Verify-no-manual-version-bumps step) does NOT block on changesets in alpha pre-mode, but the release workflow relies on Changesets to drive version bumps. Without a changeset file, the eventual `changeset-release/main` PR won't carry this PR's hardening under any package's history.

**Files:**
- Create: `.changeset/plan-b-followups.md`
- Verify: `.changeset/config.json` already ignores `@orbit-ai/e2e` from Task 5.5

- [ ] **Step 1: Confirm pre-release mode**

Run: `cat .changeset/pre.json | head -5`
Expected: `"mode": "pre"`, `"tag": "alpha"`.

- [ ] **Step 2: Write the changeset file directly**

(Interactive `pnpm changeset` doesn't work in a sub-agent session. Write the file directly with deterministic content.)

Create `.changeset/plan-b-followups.md` with:

```markdown
---
"@orbit-ai/api": patch
"@orbit-ai/cli": patch
"@orbit-ai/core": patch
"@orbit-ai/demo-seed": patch
"@orbit-ai/integrations": patch
"@orbit-ai/mcp": patch
"@orbit-ai/sdk": patch
"@orbit-ai/create-orbit-app": patch
---

Internal packaging hardening — no API change. Closes post-merge Plan B review findings:

- Add `"license": "MIT"` to `@orbit-ai/create-orbit-app` (was publishing as UNLICENSED).
- Harden `scripts/verify-package-artifacts.mjs` — normalize string-form `bin`; assert package-readiness metadata including `license`, non-empty `files`, `README.md`, and `LICENSE`; wrap outer `JSON.parse` in a diagnostic try/catch.
- Add `prepack: "pnpm run build"` to every publishable package for local-publish safety.
- Add public-repo precondition to `.github/workflows/release.yml` publish step.
- Add release validate coverage for the private `@orbit-ai/e2e` launch-gate journeys and ignore that package in Changesets.
- Extend CI `e2e-scope` path filter to cover `demo-seed`, `create-orbit-app`, `pnpm-lock.yaml`, and the workflows themselves.
- Harden `scripts/release-dry-run.mjs` with spawn-error, signal, and parse-failure logging.
- Docs: fix invalid semver placeholders in `docs/releasing.md`; document TOCTOU residual risk; route security reports through SECURITY.md; rename stale `ORBIT_API_BASE_URL` → `ORBIT_BASE_URL` in root `README.md` and `.env.example`.
```

- [ ] **Step 3: Verify changeset status**

Run: `pnpm changeset status`
Expected: shows 8 public `@orbit-ai/*` packages bumping patch, including `@orbit-ai/create-orbit-app`. It must not list private `@orbit-ai/e2e`; if it does, stop and fix `.changeset/config.json` before continuing.

- [ ] **Step 4: Commit**

```bash
git add .changeset/plan-b-followups.md
git commit -m "chore(release): add changeset for Plan B follow-ups"
```

---

## Task 10: Pre-PR verification

- [ ] **Step 1: Full build + test + lint cycle**

```bash
pnpm --filter @orbit-ai/core build  # run first if core/src changed — no change expected this plan but cheap
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
```
Expected: all green. Test baseline `pnpm -r test` stays at **1796** (new tests live in `scripts/release-workflow.test.mjs` under `node --test`, not per-package Vitest).

**Recovery note:** if any command fails, do NOT proceed. Identify the task that introduced the regression via `git log --oneline claude/recursing-almeida-e96c5d...main`. Revert the offending commit with `git revert <sha>` or amend it; do not cherry-forward through broken state.

- [ ] **Step 2: Run the release-workflow test directly**

Run: `node --test scripts/release-workflow.test.mjs`
Expected: all tests pass. Count should be:
- 2 original tests (artifact-path, verify-then-publish ordering)
- +7 from Task 2 (string-bin, missing license, missing LICENSE, package-readiness metadata, skip-private, accumulate-failures, ignore-non-orbit)
- +1 from Task 5 (public-repo precondition ordering)
- +2 from Task 5.5 (release launch-gate E2E step, private `@orbit-ai/e2e` ignored by Changesets)
- +1 from Task 6 (CI path-filter regex)
- +2 from Task 7 (dry-run spawn-error and signal handling)
- +1 from Task 8 (every publishable package has `prepack`)

= **16 tests total**. Record this number in CLAUDE.md's Pre-PR Checklist as "`scripts/release-workflow.test.mjs`: 16 tests".

- [ ] **Step 3: Run the package-artifact verifier against the workspace**

```bash
pnpm -r build
node scripts/verify-package-artifacts.mjs
```
Also verify the script alias still works (`release:verify-artifacts` in `package.json:14`):
```bash
pnpm release:verify-artifacts
```
Expected: both exit 0. If either complains about any package's readiness metadata, `license`, `README.md`, `LICENSE`, `files` allowlist, or entrypoints, that's a real pre-existing issue this plan didn't catch — inspect and fix before proceeding.

- [ ] **Step 4: Dry-run the release end-to-end**

```bash
node scripts/release-dry-run.mjs
```
Expected: runs `pnpm publish --dry-run --ignore-scripts` per publishable package, exits 0, and reports spawn errors/signals distinctly if pnpm cannot complete. This intentionally does **not** exercise lifecycle hooks because the publish path runs with `--ignore-scripts`; the next pack smoke test covers `prepack`.

- [ ] **Step 5: Spot-check one package's pack output**

```bash
rm -rf /tmp/orbit-pack-smoke
mkdir -p /tmp/orbit-pack-smoke
pnpm --filter @orbit-ai/create-orbit-app pack --pack-destination /tmp/orbit-pack-smoke
tarball="$(find /tmp/orbit-pack-smoke -name 'orbit-ai-create-orbit-app-*.tgz' -print -quit)"
test -n "$tarball"
tar -tzf "$tarball" | sort | tee /tmp/orbit-pack-smoke/create-orbit-app.contents
tar -xOf "$tarball" package/package.json | node -e "let s=''; process.stdin.on('data', c => s += c); process.stdin.on('end', () => { const m = JSON.parse(s); if (m.name !== '@orbit-ai/create-orbit-app' || m.license !== 'MIT') process.exit(1) })"
grep -Fx 'package/LICENSE' /tmp/orbit-pack-smoke/create-orbit-app.contents
grep -Fx 'package/README.md' /tmp/orbit-pack-smoke/create-orbit-app.contents
grep -Fx 'package/dist/index.js' /tmp/orbit-pack-smoke/create-orbit-app.contents
grep -Fx 'package/bin/create-orbit-app.js' /tmp/orbit-pack-smoke/create-orbit-app.contents
grep -q '^package/templates/' /tmp/orbit-pack-smoke/create-orbit-app.contents
```
Expected: pack succeeds using the scoped package, lifecycle hooks build `dist/`, package metadata shows `license: MIT`, and tarball contents include `LICENSE`, `README.md`, `dist/index.js`, the bin wrapper, and templates. Do not use `pnpm pack --dry-run`; this repo's pnpm version does not support that flag.

- [ ] **Step 6: Confirm changesets status**

```bash
pnpm changeset status
```
Expected: reports 8 public packages bumping patch from the `.changeset/plan-b-followups.md` file created in Task 9.5. It must not report private `@orbit-ai/e2e`. No errors about unreleased workspace dependencies.

- [ ] **Step 7: Confirm no stale references remain**

```bash
matches="$(grep -rn "security@orbit-ai\|ORBIT_API_BASE_URL\|alpha.N+1" . \
  --include='*.md' --include='*.MD' --include='*.ts' --include='*.mjs' --include='*.yml' --include='*.yaml' --include='.env*' \
  | grep -v node_modules | grep -v CHANGELOG || true)"
if [ -z "$matches" ]; then
  echo "CLEAN"
else
  echo "STALE REFERENCES:"
  echo "$matches"
  exit 1
fi
```
Expected: `CLEAN`. Note: `release:verify-artifacts` is NOT in this grep — it is a real script and should remain.

- [ ] **Step 8: Run Orbit trigger skills**

None apply per this plan:
- `orbit-schema-change` — N/A (no schema change)
- `orbit-api-sdk-parity` — N/A
- `orbit-tenant-safety-review` — N/A
- `orbit-core-slice-review` — N/A (infra fixes, not a slice)

- [ ] **Step 9: Run `superpowers:requesting-code-review`**

Targeted at the diff on this branch. Confirm zero MEDIUM+ findings before opening the PR.

- [ ] **Step 10: Run `pr-review-toolkit:review-pr`**

Focus agents for this PR: `silent-failure-hunter` (release-dry-run.mjs signal handling, verifier failure modes + outer JSON.parse), `pr-test-analyzer` (verify the 14 added workflow tests exercise the new paths), `type-design-analyzer` (N/A — no new types).

---

## Task 11: Wrap-up

- [ ] **Step 1: Run `orbit-plan-wrap-up` skill**

Should update:
- `CLAUDE.md` Pre-PR Checklist: `pnpm -r test` baseline **stays 1796** (not affected by `node --test` additions). Add a new line under the baseline: `scripts/release-workflow.test.mjs: 16 tests` (via `node --test` or `pnpm test:release-workflow`).
- `CHANGELOG.md` is NOT updated directly by this plan — Changesets generates it on the `changeset-release/main` PR. The changeset created in Task 9.5 is the source of truth.

- [ ] **Step 2: Update auto-memory**

Add a new memory file and update `MEMORY.md` pointer:

File: `/Users/sharonsciammas/.claude/projects/-Users-sharonsciammas-orbit-ai/memory/project_plan_b_followups.md`

```markdown
---
name: Plan B Follow-ups
description: 2026-04-24 single-PR cleanup after Plan B review — fixes create-orbit-app license, verifier bin/readiness assertions, release E2E gate, security contact, runbook drift, E2E path filter, dry-run signals, prepack hooks
type: project
---

Plan: `docs/superpowers/plans/2026-04-24-plan-b-followups.md`.
Closes HIGH/MEDIUM/LOW findings from the Plan B post-merge audit (PRs #43, #60, #61, #64, #72).

Deferred to separate plans:
- npm Trusted Publishing migration (GA milestone)
- `pnpm audit` in validate (pending triage of 17 open Dependabot findings)
- Negative-glob `files` → literal allowlist (needs pack-diff tooling)

Does NOT unblock issue #47 (first real publish) — that's a repo-settings operational step.
```

Update `MEMORY.md` to add one line near the "Project Status" entry:

```markdown
- [Plan B Follow-ups](project_plan_b_followups.md) — 2026-04-24 single-PR cleanup closing HIGH/MEDIUM review findings before first real publish
```

- [ ] **Step 3: Open the PR via `superpowers:finishing-a-development-branch`**

Target: `main`. Title: `fix: close Plan B post-merge review findings`. Body should link back to this plan file and enumerate the 10 fixes with their severity.

- [ ] **Step 4: After PR is open — run `code-review:code-review`**

Posts the structured GitHub review comment.

---

## Self-Review Checklist

- [ ] Every HIGH finding from the audit has a task (Task 1: license, Task 2: verifier package readiness + bin, Task 3: security contact, Task 5.5: release E2E launch gate)
- [ ] Every MEDIUM finding has a task (Task 2: string-bin normalize, Task 4: semver placeholders + TOCTOU note, Task 5: public-repo gate, Task 5.5: private `@orbit-ai/e2e` Changesets/provenance consistency, Task 6: CI path filter, Task 7 Step 3: outer JSON.parse)
- [ ] Every LOW finding has a task (Task 7: dry-run signals, Task 8: prepack, Task 9: env var rename)
- [ ] Deferred items are called out explicitly at the top of the plan with reasoning
- [ ] Each task commits independently — reverting any single task doesn't break the others
- [ ] Task 2 uses TDD (fail → implement → pass) — new verifier assertions have test coverage AND an accumulate-failures test that locks in the no-early-`continue` invariant
- [ ] Task 5 regression test anchors on `^      - name:` multiline — cannot be satisfied by a YAML comment containing the phrase
- [ ] Task 5.5 release tests prove validate runs `@orbit-ai/e2e` explicitly and Changesets ignores private `@orbit-ai/e2e`
- [ ] Task 6 adds a regex regression test that exercises positive + negative path fixtures against both SQLite and Postgres filters
- [ ] Task 7 adds behavioral regression tests that lock in non-zero exit + diagnostics for spawn errors and signal termination
- [ ] Task 8 adds a regression test that iterates every publishable package asserting `prepack` + `build` scripts exist
- [ ] Task 8 has a pre-flight check that every package has a `build` script before adding `prepack`
- [ ] Task 9.5 generates the changeset file explicitly (no interactive `pnpm changeset`)
- [ ] Task 10 pre-PR verification runs `pnpm changeset status`, a valid `pnpm pack --pack-destination` tarball spot-check for `@orbit-ai/create-orbit-app`, AND `pnpm release:verify-artifacts` alias (proves the script mapping still works)
- [ ] Task 10 has a recovery note for mid-verification failures
- [ ] `pnpm -r lint` is in the pre-PR verification
- [ ] Branch instruction is in the preamble (stay on current branch)
- [ ] Test baseline resolution is explicit in the preamble (`pnpm -r test` stays 1796; `node --test` suite grows 2 → 16)
- [ ] `|| echo "CLEAN"` silent-failure pattern replaced with explicit rc handling in Tasks 3, 4, 9, 10
- [ ] Memory update + plan wrap-up are in Task 11, not bolted onto earlier tasks
- [ ] Orbit trigger skills (`orbit-*-review`) are explicitly declared N/A with reason
- [ ] No silent failures introduced — dry-run script now logs before any non-zero exit (per the repo convention: "always log before swallowing")

## Known Unknowns Surfaced to Executor

1. **Build script absence in any package** (Task 8 Step 1) — if any `packages/*/package.json` lacks a `build` script, skip `prepack` for that one and call it out in the commit message. Don't invent a build command.
2. **Existing package readiness in workspace** — Task 2 Step 6 runs the verifier against the real workspace after adding readiness assertions. If any package beyond `@orbit-ai/create-orbit-app` is missing license, README/LICENSE, non-empty `files`, or required metadata, the verifier will flag it. Fix those too (they would have been shipped broken) and mention in the PR body.
3. **`.env.example` / `README.md` / `CONTRIBUTING.md` line number drift** — if other unrelated changes landed on main between audit and execution, exact line numbers may differ. Use `grep` or `Read` to locate the target text, not a hardcoded line number.
4. **Stale env var in user environments** (follow-up, NOT in this plan) — renaming `ORBIT_API_BASE_URL` → `ORBIT_BASE_URL` in the docs does not rescue users who already configured the old name. No code asserts rejection of unknown env vars. File a separate issue to add a startup warning for the old name.
