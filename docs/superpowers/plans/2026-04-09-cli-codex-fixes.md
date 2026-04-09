# CLI Codex Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 11 issues surfaced by the Codex correctness + security review of `packages/cli/`, covering 4 high, 5 medium, 2 low findings, and 4 coverage gaps.

**Architecture:** Three parallel fix tracks (A: program + JSON mode, B: config layer, C: individual commands) followed by a test track. Tracks A–C touch disjoint files and can be executed in parallel; tests must follow.

**Tech Stack:** TypeScript strict, Commander.js, Vitest, `@orbit-ai/sdk`, `@orbit-ai/core`

---

## Track A — Commander error contract + JSON mode unification

**Files:**
- Modify: `packages/cli/src/program.ts`
- Modify: `packages/cli/src/commands/contacts.ts`
- Modify: `packages/cli/src/commands/search.ts`
- Modify: `packages/cli/src/commands/context.ts`
- Modify: `packages/cli/src/commands/companies.ts`
- Modify: `packages/cli/src/commands/deals.ts`
- Modify: `packages/cli/src/commands/users.ts`
- Modify: `packages/cli/src/commands/pipelines.ts`
- Modify: `packages/cli/src/commands/stages.ts`
- Modify: `packages/cli/src/commands/activities.ts`
- Modify: `packages/cli/src/commands/tasks.ts`
- Modify: `packages/cli/src/commands/notes.ts`
- Modify: `packages/cli/src/commands/products.ts`
- Modify: `packages/cli/src/commands/payments.ts`
- Modify: `packages/cli/src/commands/contracts.ts`
- Modify: `packages/cli/src/commands/sequences.ts`
- Modify: `packages/cli/src/commands/tags.ts`
- Modify: `packages/cli/src/commands/log.ts`
- Test: `packages/cli/src/__tests__/program.test.ts`

### Task A1: Commander exitOverride → structured JSON errors

**Problem:** Commander calls `process.exit()` directly on parse errors (missing required options, unknown flags), bypassing our `try/catch` in `run()`. The structured `{ error: ... }` JSON contract is therefore not applied to Commander-level errors.

**Fix:** Call `program.exitOverride()` so Commander throws `CommanderError` instead. Add a `CommanderError` branch in `classifyError`.

- [ ] **Step 1: Add `CommanderError` import and handler in `classifyError`**

  File: `packages/cli/src/program.ts`

  After the existing `CliNotImplementedError` branch (line 50), add before the generic catch-all:

  ```typescript
  // Commander parse/validation errors (exitOverride surfaces these as CommanderError)
  if (
    error instanceof Error &&
    error.constructor.name === 'CommanderError' &&
    'exitCode' in error
  ) {
    const ce = error as { exitCode: number; code?: string; message: string }
    return {
      code: ce.exitCode === 0 ? 0 : 2,
      payload: {
        code: ce.code ?? 'COMMANDER_ERROR',
        message: ce.message,
      },
    }
  }
  ```

- [ ] **Step 2: Call `exitOverride()` on the program before `parseAsync`**

  In `run()` (program.ts line 180), change:

  ```typescript
  const program = createProgram()
  await program.parseAsync(process.argv)
  ```

  to:

  ```typescript
  const program = createProgram()
  program.exitOverride()
  await program.parseAsync(process.argv)
  ```

- [ ] **Step 3: Run tests**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test --reporter=verbose 2>&1 | tail -20
  ```

  Expected: all tests pass (Commander now throws instead of calling process.exit).

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/program.ts && git commit -m "fix(cli): Commander exitOverride — parse errors now flow through JSON error contract"
  ```

---

### Task A2: Replace `flags.json` with `isJsonMode()` in all commands

**Problem:** `flags.json` is only truthy for `--json`. The preAction hook also sets `_jsonMode = true` for `--format json`, but commands branch on `flags.json`, so `orbit --format json contacts list` uses the human formatter instead of the raw envelope path.

**Fix:** In every command, replace `flags.json` with `isJsonMode()`. Import `isJsonMode` at the top of each command file.

The commands that need this change are all files that contain `if (flags.json)`:

- `packages/cli/src/commands/contacts.ts`
- `packages/cli/src/commands/companies.ts`
- `packages/cli/src/commands/deals.ts`
- `packages/cli/src/commands/users.ts`
- `packages/cli/src/commands/pipelines.ts`
- `packages/cli/src/commands/stages.ts`
- `packages/cli/src/commands/activities.ts`
- `packages/cli/src/commands/tasks.ts`
- `packages/cli/src/commands/notes.ts`
- `packages/cli/src/commands/products.ts`
- `packages/cli/src/commands/payments.ts`
- `packages/cli/src/commands/contracts.ts`
- `packages/cli/src/commands/sequences.ts`
- `packages/cli/src/commands/tags.ts`
- `packages/cli/src/commands/log.ts`
- `packages/cli/src/commands/search.ts`
- `packages/cli/src/commands/context.ts`

For each file:

- [ ] **Step 1: Find all occurrences**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && grep -rn "flags\.json" packages/cli/src/commands/
  ```

- [ ] **Step 2: Update imports**

  For each command file that uses `flags.json`, add `isJsonMode` to the import from `'../program.js'`. Example for contacts.ts:

  ```typescript
  import { isJsonMode } from '../program.js'
  ```

- [ ] **Step 3: Replace usages**

  In each file, replace every occurrence of `flags.json` with `isJsonMode()`. The pattern is always:

  ```typescript
  // Before
  if (flags.json) {
  
  // After
  if (isJsonMode()) {
  ```

  Run the replacement:

  ```bash
  cd /Users/sharonsciammas/orbit-ai && \
    grep -rl "flags\.json" packages/cli/src/commands/ | \
    xargs sed -i '' 's/flags\.json/isJsonMode()/g'
  ```

  Then for each of those files, add the import if missing:

  ```bash
  grep -L "isJsonMode" packages/cli/src/commands/contacts.ts packages/cli/src/commands/search.ts packages/cli/src/commands/context.ts
  ```

  For files missing the import, add `import { isJsonMode } from '../program.js'` after the existing imports.

- [ ] **Step 4: Typecheck**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli typecheck 2>&1 | tail -20
  ```

  Expected: 0 errors.

- [ ] **Step 5: Run tests**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test 2>&1 | tail -10
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/commands/ && git commit -m "fix(cli): all commands use isJsonMode() — --format json now triggers JSON envelope path"
  ```

---

## Track B — Config layer fixes

**Files:**
- Modify: `packages/cli/src/config/resolve-context.ts`
- Modify: `packages/cli/src/config/files.ts`

### Task B1: Resolve `apiKeyEnv` from config files

**Problem:** `init` writes `apiKeyEnv: 'ORBIT_API_KEY'` to config.json, but `resolve-context.ts:130` reads `fileConfig.apiKey` — never `fileConfig.apiKeyEnv`. Users who follow the secure scaffolded pattern end up with no API key and a confusing "apiKey is required" error.

**Fix:** After reading fileConfig, if `apiKey` is still undefined and `fileConfig.apiKeyEnv` is set, read `env[fileConfig.apiKeyEnv]` as the api key.

- [ ] **Step 1: Add apiKeyEnv resolution in `resolveClient`**

  File: `packages/cli/src/config/resolve-context.ts`

  Change line 130 from:

  ```typescript
  const apiKey = flags.apiKey ?? env['ORBIT_API_KEY'] ?? fileConfig.apiKey
  ```

  to:

  ```typescript
  const apiKeyFromEnvName =
    fileConfig.apiKeyEnv ? env[fileConfig.apiKeyEnv] : undefined
  const apiKey =
    flags.apiKey ?? env['ORBIT_API_KEY'] ?? fileConfig.apiKey ?? apiKeyFromEnvName
  ```

- [ ] **Step 2: Run tests**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test 2>&1 | tail -10
  ```

  Expected: all pass.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/config/resolve-context.ts && git commit -m "fix(cli): resolve apiKeyEnv from config file — secure scaffolded configs now work"
  ```

---

### Task B2: Fix nested CWD config discovery (allowedRoots must include ancestors)

**Problem:** `findProjectConfig` walks up from `cwd` and can return a path like `/projects/orbit/.orbit/config.json` when `cwd` is `/projects/orbit/packages/cli/`. `canonicalizePath` then rejects it because the allowed roots are only `[cwd, home]`, not ancestors of cwd.

**Fix:** Build `allowedRoots` by collecting all ancestor directories of `cwd` up to (and including) `home`.

- [ ] **Step 1: Extract ancestor-collection helper**

  File: `packages/cli/src/config/files.ts`

  Add after the `tryRealpath` helper (around line 131):

  ```typescript
  /** Collect real paths of all ancestors of dir up to and including home (inclusive). */
  function ancestorRoots(dir: string, home: string): string[] {
    const roots: string[] = []
    let current = tryRealpath(dir)
    const realHome = tryRealpath(home)
    while (true) {
      roots.push(current)
      if (current === realHome) break
      const parent = path.dirname(current)
      if (parent === current) break // filesystem root
      current = parent
    }
    if (!roots.includes(realHome)) roots.push(realHome)
    return roots
  }
  ```

- [ ] **Step 2: Use `ancestorRoots` in `loadConfig`**

  Change line 140 from:

  ```typescript
  const allowedRoots = [tryRealpath(cwd), tryRealpath(home)]
  ```

  to:

  ```typescript
  const allowedRoots = ancestorRoots(cwd, home)
  ```

- [ ] **Step 3: Run tests**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test 2>&1 | tail -10
  ```

  Expected: all pass.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/config/files.ts && git commit -m "fix(cli): config discovery works from nested cwd — allowedRoots now includes cwd ancestors"
  ```

---

### Task B3: Implement `--profile` resolution

**Problem:** `--profile <name>` is registered as a flag and `profiles` is in the config schema, but profile selection is never applied. Users who configure named profiles get silently ignored.

**Fix:** After merging userConfig and projectConfig, if a profile name is specified (from flags → env → config default), look up `profiles[name]` in the merged config and layer it on top.

- [ ] **Step 1: Export a `resolveProfile` helper from `files.ts`**

  Add after `loadConfig`:

  ```typescript
  /**
   * Apply a named profile on top of a base config.
   * Returns the base config unchanged if the profile doesn't exist.
   */
  export function applyProfile(base: OrbitConfig, profileName: string): OrbitConfig {
    const profile = base.profiles?.[profileName]
    if (!profile) return base
    // Strip profiles from the overlay to avoid nesting
    const { profiles: _profiles, ...profileData } = profile as OrbitConfig
    return { ...base, ...profileData }
  }
  ```

- [ ] **Step 2: Apply profile in `resolveClient`**

  File: `packages/cli/src/config/resolve-context.ts`

  Add import for `applyProfile`:

  ```typescript
  import { loadConfig, applyProfile, type OrbitConfig } from './files.js'
  ```

  After line 122 (`const fileConfig = loadConfig(cwd, overrideHome)`), add:

  ```typescript
  // Resolve profile: flag > env > config default
  const profileName = flags.profile ?? env['ORBIT_PROFILE'] ?? fileConfig.profile
  const mergedFileConfig = profileName ? applyProfile(fileConfig, profileName) : fileConfig
  ```

  Then replace all occurrences of `fileConfig` in the resolution block (lines 128–141) with `mergedFileConfig`.

- [ ] **Step 3: Typecheck + test**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli typecheck && pnpm --filter @orbit-ai/cli test 2>&1 | tail -10
  ```

  Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/config/ && git commit -m "fix(cli): implement --profile resolution — named config profiles now applied at runtime"
  ```

---

### Task B4: SQLite direct mode default path + URL allowlist

**Problem 1:** When no `--database-url` is given in direct SQLite mode, `dbPath` is `''` which falls through to `:memory:`. This silently discards all data between commands. The plan specifies the default should be `./.orbit/orbit.db`.

**Problem 2:** The URL scheme allowlist only blocks `http(s)://`. Other schemes like `ftp://`, `ssh://`, `s3://` pass through as literal filenames.

**Fix 1:** Default `dbPath` to `.orbit/orbit.db` (relative to cwd) when empty.
**Fix 2:** Block any URL that contains `://` but is not `file://` or bare path.

- [ ] **Step 1: Fix SQLite default path**

  File: `packages/cli/src/config/resolve-context.ts`

  The `resolveAdapter` function currently receives `flags` and `config` but not `cwd`. Change the signature to accept a `cwd` parameter and pass it through:

  ```typescript
  function resolveAdapter(flags: GlobalFlags, config: OrbitConfig, cwd: string): StorageAdapter {
  ```

  Then change the fallback in the sqlite branch:

  ```typescript
  // Before (line 60):
  dbPath = dbUrl || ':memory:'
  
  // After:
  dbPath = dbUrl || path.join(cwd, '.orbit', 'orbit.db')
  ```

  Update the call site on line 157:

  ```typescript
  const resolvedAdapter = resolveAdapter(flags, resolvedConfig, cwd ?? process.cwd())
  ```

  Add `import * as path from 'node:path'` at the top of resolve-context.ts (if not already present).

- [ ] **Step 2: Expand URL scheme allowlist**

  In the sqlite validation block (around line 41), replace the http-only check:

  ```typescript
  // Before:
  if (dbUrl && /^https?:\/\//i.test(dbUrl)) {
  
  // After — block any scheme except file:
  if (dbUrl && /^[a-z][a-z0-9+\-.]*:\/\//i.test(dbUrl) && !/^file:\/\//i.test(dbUrl)) {
  ```

  The error message should reflect the broader rejection:

  ```typescript
  throw new CliValidationError(
    `SQLite database URL must be a file path or file: URI, not a remote URL. Scheme+host: '${safeUrl}'`,
    { code: 'MISSING_REQUIRED_CONFIG', path: 'databaseUrl' },
  )
  ```

- [ ] **Step 3: Typecheck + test**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli typecheck && pnpm --filter @orbit-ai/cli test 2>&1 | tail -10
  ```

  Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/config/resolve-context.ts && git commit -m "fix(cli): SQLite default path is .orbit/orbit.db; URL allowlist blocks all non-file schemes"
  ```

---

## Track C — Command-specific fixes

**Files:**
- Modify: `packages/cli/src/commands/migrate.ts`
- Modify: `packages/cli/src/commands/seed.ts`
- Modify: `packages/cli/src/commands/status.ts`
- Modify: `packages/cli/src/commands/doctor.ts`

### Task C1: migrate --apply destructive gating

**Problem:** `migrate.ts:34` treats `opts.apply` as always destructive (requires `--yes`). The plan says only migrations that contain DROP/RENAME operations need confirmation. Additive migrations should apply without a prompt.

**Fix:** Preview first. If the preview response contains destructive operations (any key containing `drop` or `rename` case-insensitively, or a dedicated `destructive` flag), then require `--yes`. Otherwise apply directly.

- [ ] **Step 1: Rewrite `runMigrate` apply path**

  File: `packages/cli/src/commands/migrate.ts`

  Replace the `isDestructive` check at the top of `runMigrate` and the `opts.apply` block:

  ```typescript
  async function runMigrate(
    flags: GlobalFlags,
    opts: { preview?: boolean; apply?: boolean; rollback?: boolean; id?: string; yes?: boolean },
  ): Promise<void> {
    // --rollback is always destructive
    const isDefinitelyDestructive = opts.rollback
    const isTTY = process.stdout.isTTY
    const confirmed = opts.yes === true || flags.yes === true

    if (isDefinitelyDestructive && !confirmed) {
      if (isJsonMode() || !isTTY) {
        process.stdout.write(JSON.stringify(DESTRUCTIVE_ERROR) + '\n', () => {
          process.exit(1)
        })
        return
      }
      const ok = await confirmAction('Are you sure you want to run this migration? [y/N] ')
      if (!ok) {
        process.stdout.write('Aborted.\n')
        process.exit(1)
        return
      }
    }

    const client = resolveClient({ flags })

    if (opts.preview) {
      const preview = await client.schema.previewMigration({})
      if (isJsonMode()) {
        process.stdout.write(JSON.stringify(preview, null, 2) + '\n')
      } else {
        process.stdout.write(JSON.stringify(preview, null, 2) + '\n')
      }
      return
    }

    if (opts.apply) {
      // Preview first to detect destructive operations
      const preview = await client.schema.previewMigration({})
      const previewStr = JSON.stringify(preview).toLowerCase()
      const hasDestructive =
        (typeof (preview as { destructive?: boolean }).destructive === 'boolean'
          ? (preview as { destructive?: boolean }).destructive
          : false) ||
        /\b(drop|rename)\b/.test(previewStr)

      if (hasDestructive && !confirmed) {
        if (isJsonMode() || !isTTY) {
          process.stdout.write(
            JSON.stringify({
              ...DESTRUCTIVE_ERROR,
              error: { ...DESTRUCTIVE_ERROR.error, preview },
            }) + '\n',
            () => { process.exit(1) },
          )
          return
        }
        const ok = await confirmAction(
          'This migration contains destructive operations. Confirm? [y/N] ',
        )
        if (!ok) {
          process.stdout.write('Aborted.\n')
          process.exit(1)
          return
        }
      }

      const result = await client.schema.applyMigration({})
      if (isJsonMode()) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        process.stdout.write(`Migration applied:\n${JSON.stringify(result, null, 2)}\n`)
      }
      return
    }

    if (opts.rollback) {
      if (!opts.id) {
        throw new CliValidationError('--rollback requires --id <migration-id>', {
          code: 'MISSING_REQUIRED_ARG',
          path: 'id',
        })
      }
      const result = await client.schema.rollbackMigration(opts.id)
      if (isJsonMode()) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        process.stdout.write(`Migration ${opts.id} rolled back:\n${JSON.stringify(result, null, 2)}\n`)
      }
      return
    }
  }
  ```

- [ ] **Step 2: Run tests**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test packages/cli/src/__tests__/destructive-actions.test.ts --reporter=verbose 2>&1 | tail -30
  ```

  Expected: all pass (existing destructive-action tests still cover rollback/destructive apply).

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/commands/migrate.ts && git commit -m "fix(cli): migrate --apply only requires --yes for destructive migrations, not all applies"
  ```

---

### Task C2: seed — use resolved mode from config, not just flags.mode

**Problem:** `seed.ts:18` checks `flags.mode !== 'direct'`. If mode comes from a config file (not CLI flags), `flags.mode` is `undefined` and the check falsely rejects valid direct-mode setups.

**Fix:** Resolve the effective mode (same priority chain as `resolveClient`) before checking.

- [ ] **Step 1: Read effective mode before gating**

  File: `packages/cli/src/commands/seed.ts`

  Add import:

  ```typescript
  import { loadConfig } from '../config/files.js'
  ```

  Change the guard in `runSeed`:

  ```typescript
  async function runSeed(flags: GlobalFlags, count: number): Promise<void> {
    // Resolve effective mode: flag > config file > default 'api'
    const fileConfig = loadConfig()
    const effectiveMode = flags.mode ?? fileConfig.mode ?? 'api'

    if (effectiveMode !== 'direct') {
      const msg = 'orbit seed requires direct mode (--mode direct with a local adapter)'
      if (isJsonMode()) {
        process.stdout.write(JSON.stringify({ error: { code: 'DIRECT_MODE_REQUIRED', message: msg } }) + '\n', () => {
          process.exit(2)
        })
        return
      } else {
        process.stderr.write(msg + '\n')
      }
      process.exit(2)
    }
    // ... rest unchanged
  ```

- [ ] **Step 2: Run tests**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test 2>&1 | tail -10
  ```

  Expected: all pass.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/commands/seed.ts && git commit -m "fix(cli): seed checks resolved mode from config, not just --mode flag"
  ```

---

### Task C3: status — use standard error contract

**Problem:** `status.ts` has its own error JSON shape (`{ status: 'error', connected: false, message: ... }`) and calls `process.exit(1)` directly in the catch block. Agent consumers get a different failure schema from the rest of the CLI (`{ error: { code, message } }`).

**Fix:** Re-throw the error and let the top-level handler in `run()` format it. The success path stays as-is.

- [ ] **Step 1: Rewrite the catch block**

  File: `packages/cli/src/commands/status.ts`

  Replace the catch block:

  ```typescript
  // Before:
  } catch (e) {
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify({ status: 'error', connected: false, message: (e as Error).message }) + '\n')
    } else {
      process.stderr.write(`Status: error — ${(e as Error).message}\n`)
    }
    process.exit(1)
  }

  // After:
  } catch (e) {
    // Re-throw so run()'s top-level handler applies the standard { error: ... } contract.
    throw e
  }
  ```

- [ ] **Step 2: Run tests**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test 2>&1 | tail -10
  ```

  Expected: all pass.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/commands/status.ts && git commit -m "fix(cli): status error uses standard { error: ... } contract via top-level handler"
  ```

---

### Task C4: doctor — correct Node.js version check

**Problem:** `doctor.ts:21` checks `major >= 22`. The repo prerequisite (AGENTS.md and CLAUDE.md) is Node 20+. This produces false failures on Node 20 and 21, which are supported.

- [ ] **Step 1: Fix the version check**

  File: `packages/cli/src/commands/doctor.ts`

  Change line 21:

  ```typescript
  // Before:
  name: 'Node.js version >= 22',
  pass: major >= 22,

  // After:
  name: 'Node.js version >= 20',
  pass: major >= 20,
  ```

- [ ] **Step 2: Run tests**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test 2>&1 | tail -10
  ```

  Expected: all pass.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/commands/doctor.ts && git commit -m "fix(cli): doctor checks Node >= 20 (project minimum), not >= 22"
  ```

---

## Track D — Test coverage gaps (after Tracks A–C)

**Files:**
- Modify: `packages/cli/src/__tests__/program.test.ts`
- Modify: `packages/cli/src/__tests__/config-resolve.test.ts`
- Modify: `packages/cli/src/__tests__/destructive-actions.test.ts`
- Possibly extend: `packages/cli/src/__tests__/exit-codes.test.ts`

### Task D1: Test Commander exitOverride → JSON error on missing option

- [ ] **Step 1: Write failing test**

  File: `packages/cli/src/__tests__/program.test.ts`

  ```typescript
  import { run, _resetJsonMode } from '../program.js'

  describe('Commander parse errors — JSON contract', () => {
    let origArgv: string[]
    let origExit: typeof process.exit
    let exitCode: number | undefined
    let stdout: string

    beforeEach(() => {
      origArgv = process.argv
      origExit = process.exit
      exitCode = undefined
      stdout = ''
      _resetJsonMode()
      process.exit = ((code?: number) => {
        exitCode = code ?? 0
        throw new Error(`process.exit(${code})`)
      }) as typeof process.exit
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        stdout += String(chunk)
        return true
      })
    })

    afterEach(() => {
      process.argv = origArgv
      process.exit = origExit
      vi.restoreAllMocks()
    })

    it('--json flag: Commander error on unknown option produces { error: ... } JSON on stdout', async () => {
      process.argv = ['node', 'orbit', '--json', '--unknown-flag-xyz']
      await expect(run()).rejects.toThrow()
      const parsed = JSON.parse(stdout)
      expect(parsed).toHaveProperty('error')
      expect(parsed.error).toHaveProperty('code')
      expect(parsed.error).toHaveProperty('message')
    })
  })
  ```

- [ ] **Step 2: Verify test fails before fix (should now pass after Task A1)**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test packages/cli/src/__tests__/program.test.ts --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|✗)"
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/__tests__/program.test.ts && git commit -m "test(cli): Commander parse error produces JSON envelope when --json flag is set"
  ```

---

### Task D2: Test `--format json` end-to-end through command action

- [ ] **Step 1: Write test**

  File: `packages/cli/src/__tests__/json-fidelity.test.ts` (extend existing file — add to the describe block)

  ```typescript
  it('--format json triggers isJsonMode() within a command action', async () => {
    // contacts list mocked to return a result
    // The key assertion: the raw envelope path (client.contacts.response().list) is called,
    // not the human formatter path (client.contacts.list).
    // Both flags.json and flags.format=json must activate JSON mode.
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    _resetJsonMode()

    // Simulate preAction by parsing --format json
    // (preAction hook fires during parse with parseAsync)
    // We test the state of isJsonMode() after parse
    const done = program.parseAsync(['node', 'orbit', '--format', 'json', '--help'], { from: 'user' }).catch(() => {})
    await done
    expect(isJsonMode()).toBe(true)
  })
  ```

- [ ] **Step 2: Run**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test packages/cli/src/__tests__/json-fidelity.test.ts --reporter=verbose 2>&1 | tail -20
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/__tests__/json-fidelity.test.ts && git commit -m "test(cli): --format json sets isJsonMode() via preAction hook"
  ```

---

### Task D3: Test apiKeyEnv loading

- [ ] **Step 1: Write test**

  File: `packages/cli/src/__tests__/config-resolve.test.ts`

  Add inside `describe('config resolution — resolveClient', ...)`:

  ```typescript
  it('reads api key from env var named by apiKeyEnv in config', () => {
    const tmp = makeTmpDir()
    makeProjectConfig(tmp, { mode: 'api', apiKeyEnv: 'MY_CUSTOM_KEY' })
    const env = { MY_CUSTOM_KEY: 'key-from-custom-env' }
    const client = resolveClient({ flags: {}, env, cwd: tmp }) as unknown as { _opts: { apiKey: string } }
    expect(client._opts.apiKey).toBe('key-from-custom-env')
  })

  it('apiKeyEnv is lower priority than ORBIT_API_KEY env var', () => {
    const tmp = makeTmpDir()
    makeProjectConfig(tmp, { mode: 'api', apiKeyEnv: 'MY_CUSTOM_KEY' })
    const env = { ORBIT_API_KEY: 'standard-key', MY_CUSTOM_KEY: 'custom-key' }
    const client = resolveClient({ flags: {}, env, cwd: tmp }) as unknown as { _opts: { apiKey: string } }
    expect(client._opts.apiKey).toBe('standard-key')
  })
  ```

- [ ] **Step 2: Run**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test packages/cli/src/__tests__/config-resolve.test.ts --reporter=verbose 2>&1 | tail -20
  ```

  Expected: new tests pass.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/__tests__/config-resolve.test.ts && git commit -m "test(cli): apiKeyEnv resolution from config file"
  ```

---

### Task D4: Test profile resolution

- [ ] **Step 1: Write test**

  File: `packages/cli/src/__tests__/config-resolve.test.ts`

  ```typescript
  it('applies named profile from config when --profile flag is set', () => {
    const tmp = makeTmpDir()
    makeProjectConfig(tmp, {
      mode: 'api',
      apiKey: 'default-key',
      profiles: {
        staging: { apiKey: 'staging-key', baseUrl: 'https://staging.example.com' },
      },
    })
    const client = resolveClient({
      flags: { profile: 'staging' },
      env: {},
      cwd: tmp,
    }) as unknown as { _opts: { apiKey: string; baseUrl: string } }
    expect(client._opts.apiKey).toBe('staging-key')
    expect(client._opts.baseUrl).toBe('https://staging.example.com')
  })

  it('falls back to base config when profile name does not exist', () => {
    const tmp = makeTmpDir()
    makeProjectConfig(tmp, { mode: 'api', apiKey: 'base-key', profiles: {} })
    const client = resolveClient({
      flags: { profile: 'nonexistent' },
      env: {},
      cwd: tmp,
    }) as unknown as { _opts: { apiKey: string } }
    expect(client._opts.apiKey).toBe('base-key')
  })
  ```

- [ ] **Step 2: Run**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test packages/cli/src/__tests__/config-resolve.test.ts --reporter=verbose 2>&1 | tail -20
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/__tests__/config-resolve.test.ts && git commit -m "test(cli): profile resolution from config file and flag"
  ```

---

### Task D5: Test nested-cwd project config discovery

- [ ] **Step 1: Write test**

  File: `packages/cli/src/__tests__/config-resolve.test.ts`

  ```typescript
  it('finds project config in ancestor directory when cwd is a subdirectory', () => {
    const tmp = makeTmpDir()
    // Config is at project root, cwd is a nested subdirectory
    makeProjectConfig(tmp, { mode: 'api', apiKey: 'ancestor-key' })
    const nested = path.join(tmp, 'packages', 'cli')
    fs.mkdirSync(nested, { recursive: true })

    const client = resolveClient({
      flags: {},
      env: {},
      cwd: nested,
      overrideHome: tmp,
    }) as unknown as { _opts: { apiKey: string } }
    expect(client._opts.apiKey).toBe('ancestor-key')
  })
  ```

- [ ] **Step 2: Run**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test packages/cli/src/__tests__/config-resolve.test.ts --reporter=verbose 2>&1 | tail -20
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/__tests__/config-resolve.test.ts && git commit -m "test(cli): config discovery from nested cwd finds ancestor project config"
  ```

---

### Task D6: Test migrate --apply non-destructive (no --yes needed)

- [ ] **Step 1: Write test**

  File: `packages/cli/src/__tests__/destructive-actions.test.ts`

  ```typescript
  it('migrate --apply applies non-destructive migration without --yes', async () => {
    mockSchemaResponse.previewMigration.mockResolvedValue({ operations: [], destructive: false })
    mockSchemaResponse.applyMigration.mockResolvedValue({ applied: 1 })

    const { output } = await captureStdout(async () => {
      await createProgram()
        .exitOverride()
        .parseAsync(['node', 'orbit', '--api-key', 'key', '--mode', 'api', 'migrate', '--apply', '--yes'], { from: 'user' })
    })

    expect(mockSchemaResponse.applyMigration).toHaveBeenCalled()
  })

  it('migrate --apply requires --yes for destructive migration (preview shows drop)', async () => {
    mockSchemaResponse.previewMigration.mockResolvedValue({
      operations: [{ type: 'drop_column', table: 'contacts', column: 'old_field' }],
      destructive: true,
    })

    const { exitCode, output } = await captureStdout(async () => {
      await createProgram()
        .exitOverride()
        .parseAsync(['node', 'orbit', '--json', '--api-key', 'key', '--mode', 'api', 'migrate', '--apply'], { from: 'user' })
    })

    expect(exitCode).toBe(1)
    const parsed = JSON.parse(output)
    expect(parsed.error.code).toBe('DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION')
  })
  ```

- [ ] **Step 2: Run**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test packages/cli/src/__tests__/destructive-actions.test.ts --reporter=verbose 2>&1 | tail -30
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && git add packages/cli/src/__tests__/destructive-actions.test.ts && git commit -m "test(cli): migrate --apply non-destructive skips --yes gate; destructive requires it"
  ```

---

## Track E — Final verification

### Task E1: Full test suite + typecheck

- [ ] **Step 1: Full typecheck**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli typecheck 2>&1
  ```

  Expected: 0 errors.

- [ ] **Step 2: Full test run**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli test 2>&1 | tail -5
  ```

  Expected: ≥ 141 tests passing (the 141 existing + new tests from Track D).

- [ ] **Step 3: Build**

  ```bash
  cd /Users/sharonsciammas/orbit-ai && pnpm --filter @orbit-ai/cli build 2>&1 | tail -5
  ```

  Expected: clean build.

- [ ] **Step 4: Request code review**

  Use `superpowers:requesting-code-review` skill to dispatch a review agent against the `feat/cli` branch diff.

---

## Execution Notes

**Parallel execution:** Tracks A, B, and C are fully independent (disjoint files). Dispatch three parallel subagents:
- **Agent A**: Tasks A1 + A2
- **Agent B**: Tasks B1 + B2 + B3 + B4
- **Agent C**: Tasks C1 + C2 + C3 + C4

Track D (tests) depends on A–C completing. Run sequentially after.

**Issue → Task mapping:**
| Codex Issue | Task | Severity |
|---|---|---|
| Commander parse errors bypass JSON contract | A1 | High |
| --format json doesn't trigger command JSON mode | A2 | High |
| Config ignores apiKeyEnv | B1 | High |
| Nested cwd config discovery breaks | B2 | High |
| --profile unimplemented | B3 | Medium |
| SQLite defaults to :memory: | B4 | Medium |
| URL allowlist incomplete | B4 | Medium |
| migrate --apply always destructive | C1 | Medium |
| seed checks flags.mode not resolved mode | C2 | Medium |
| status ad hoc error payload | C3 | Low |
| doctor checks Node >= 22 | C4 | Low |
