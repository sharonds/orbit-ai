# Fix Pass C — Alpha Readiness Implementation Plan

> **For agentic workers:** Execute this plan task-by-task using whichever subagent-driven workflow your runtime supports. Steps use checkbox (`- [ ]`) syntax for tracking. No external skill is required to execute the plan — every step is self-contained.

**Goal:** Close the 21 remaining findings from the post-stack audit (15 MUST + 6 SHOULD, after expanding OSS-9 into its 3 sub-files and adding per-package README/LICENSE artifacts) so that `@orbit-ai/core`, `@orbit-ai/api`, and `@orbit-ai/sdk` are publishable to npm as `0.1.0-alpha`, the branding is honest (README matches reality), each published tarball contains README + LICENSE + dist + package.json (verified by inspection of the actual packed artifact), consumers get a real working quickstart, and all security/DX footguns flagged by the review cycles are fixed.

**Architecture:** All work lands as new commits on top of `pr-4-cleanups-and-docs` HEAD `b177670`, pushed to PR #21. Fix Pass C is broken into 8 phases with explicit pause points between them; each phase is reviewable in isolation. After Phase 8, Sharon hands off the stack to an external review pass (Codex + GitHub PR review) before any npm publish happens. No force-push. No scope creep into CLI / integrations / MCP (those are separate plans Sharon will write later).

**Tech Stack:** TypeScript (strict) · Hono (API framework) · Vitest · Zod · pnpm + Turborepo · Node.js 22 (`node:sqlite` in use) · `@orbit-ai/core` workspace package.

**Repo location:** `/Users/sharonsciammas/orbit-ai`
**Package manager:** pnpm (always — never npm or yarn)
**Starting baseline:** 786 passing tests (core 321 + sdk 186 + api 279), 2 skipped, typecheck + lint clean on `pr-4-cleanups-and-docs` HEAD `b177670`.

---

## Context you MUST read before executing

Open these files before starting:

1. `docs/review/2026-04-08-post-stack-audit.md` — the 9-reviewer audit that identified the 19 items this plan closes. Every finding has a `H-` or lettered ID that maps to a task below.
2. `docs/product/release-definition-v1.md` §12 — defines "Yellow = fit for alpha or beta". This plan is explicitly a Yellow-alpha target, NOT a v1 GA target. Don't try to close v1 GA gates; they require packages that don't exist yet (CLI, MCP, integrations).

**Release milestone this plan hits**: `0.1.0-alpha` of `@orbit-ai/core` + `@orbit-ai/api` + `@orbit-ai/sdk`. Published to npm. Public GitHub repo. Honest README that says "this is the package foundation; CLI + integrations are next."

**Explicit non-goals** — do NOT do any of these in this plan:
- Build `@orbit-ai/cli` or `@orbit-ai/mcp` or `@orbit-ai/integrations` (separate plans, later)
- Implement cross-transport black-box parity tests (Phase 3 scope per memory)
- Rewrite the OpenAPI generator (Phase 3 T10)
- Clean up the 41 internal `as any` casts in api routes (Phase 3, internal-only)
- Add type-level tests (Phase 3)
- Any breaking change to `@orbit-ai/core` beyond what's explicitly required here
- Full HMAC-SHA256 + pepper rewrite for API key hashing (Phase 3 T19)

## The 19 findings this plan closes

From the post-stack audit (`docs/review/2026-04-08-post-stack-audit.md`):

### MUST (13) — blocks any external release

| # | Finding | Task |
|---|---|---|
| OSS-1 | All 3 packages marked `private: true` → cannot publish | Task 2-4 |
| OSS-2 | README references non-existent packages (mcp, cli, apps/docs, examples) | Task 6 |
| OSS-3 | README install command references unpublished sdk + nonexistent CLI | Task 6 |
| OSS-4 | No `.env.example` / env var documentation | Task 8 |
| OSS-5 | No `CONTRIBUTING.md` | Task 9 |
| OSS-6 | No `.github/workflows/` (no CI) | Task 11 |
| OSS-7 | Sparse package metadata (description/keywords/author/repo/homepage/bugs/engines) | Task 2-4 |
| OSS-8 | No `files` field in any package → `pnpm pack` ships everything | Tasks 2-4 + 7a/7b (per-package README+LICENSE so the `files` allow-list is satisfied) |
| OSS-9a | No `SECURITY.md` | Task 10a |
| OSS-9b | No `CHANGELOG.md` | Task 10b |
| OSS-9c | No `CODE_OF_CONDUCT.md` | Task 10c |
| OSS-10 | `zod` version mismatch (core `^4.1.11`, api `^3.23.0`) | Task 5 |
| DOC-SDK | No SDK package README with quickstart | Task 7 |
| PKG-README-CORE | No `packages/core/README.md` (would be missing from npm tarball) | Task 7a |
| PKG-README-API | No `packages/api/README.md` (would be missing from npm tarball) | Task 7b |
| EX-1 | No working consumer example in repo | Task 18 |
| TEST-E2E | No real end-to-end integration test (Lens 4 shallow-test finding) | Task 18 (combined with EX-1) |

### SHOULD (6) — real issues a first-time consumer will hit

| # | Finding | Task |
|---|---|---|
| DX-ERR-1 | `err.error.code` footgun — `err.code` silently compiles and returns undefined | Task 12 |
| DX-ERR-2 | `OrbitErrorCode` not re-exported from sdk barrel | Task 12 |
| DX-EXPORTS | Resource class exports pollute autocomplete (`BaseResource`, `ContactResource`, etc.) | Task 13 |
| DT-LINKS | DirectTransport `wrapEnvelope` omits `links.next` — cursor pagination silently fails | Task 14 |
| SCALE-SEARCH | Merged search can pull 30,000 rows into memory when `object_types` unset | Task 15 |
| SCALE-IDEM | In-memory idempotency + rate limit stores with no documentation | Task 16-17 |

## Phases at a glance

| Phase | Tasks | Focus | Approx commits |
|---|---|---|---|
| 0 | 1 | Pre-flight verification (incl. tracking the plan file itself) | 1 |
| 1 | 2-5 | Package publish gates + metadata + zod alignment | 4 |
| 2 | 6, 7, 7a, 7b, 8, 9, 10a, 10b, 10c | Root + per-package READMEs + per-package LICENSE + `.env.example` + CONTRIBUTING + SECURITY/CHANGELOG/CODE_OF_CONDUCT | 9 |
| 3 | 11 | CI workflow | 1 |
| 4 | 12-14 | SDK DX fixes | 3 |
| 5 | 15-17 | Functional closures (search cap, idempotency interface, docs) | 3 |
| 6 | 18 | Working example + end-to-end integration test | 1 |
| 7 | 19 | Full verification + version bump + tarball-content gate | 1 |
| 8 | 20 | External review handoff (Codex + GitHub) → publish gate | 0 |

**Total**: ~23 commits across 24 tasks. Each phase can be executed by a dedicated subagent; main session verifies between phases.

**Pause points** — main session MUST verify and checkpoint between each phase before dispatching the next:
- After Phase 1: verify all 3 packages have clean metadata, no longer private
- After Phase 2: verify docs are coherent, no broken links
- After Phase 3: verify CI workflow syntactically valid, no push required yet
- After Phase 4: run `pnpm --filter @orbit-ai/sdk test` and verify DX changes don't break sdk tests
- After Phase 5: run full test suite and verify idempotency still works
- After Phase 6: run the new example end-to-end to confirm it actually works
- After Phase 7: full verification gate
- At Phase 8: **STOP**. Hand off to external review. Do not publish.

---

## Hard rules (apply to every task)

- **NO `--force`**, `--force-with-lease`, `git reset --hard`, `git rebase`, `git commit --amend`, `git push --no-verify`
- Each task ends with ONE commit with a conventional-commits prefix (`fix(sdk):`, `docs:`, `chore:`, `feat(api):`, `test:`)
- After any `packages/core` change: `pnpm --filter @orbit-ai/core build` before typecheck
- Full verification between phases: `pnpm -r typecheck && pnpm -r lint && pnpm -r test`
- If any verification fails, STOP and report — do NOT "fix the fix" without escalating
- Stay on branch `pr-4-cleanups-and-docs` — no new branches
- Regular `git push origin pr-4-cleanups-and-docs` after each commit (or batched per phase) — normal push, never force

---

## Task 0: Pre-flight verification + commit the plan file

**Files**:
- Add to git: `docs/superpowers/plans/2026-04-08-fix-pass-c-alpha-readiness.md` (this very file)

- [ ] **Step 0.0: Commit the plan file itself**

The plan was written into the working tree but is currently **untracked**. Every later step assumes a clean working tree, so we land the plan as the first commit of Fix Pass C before doing anything else.

Run:
```bash
cd /Users/sharonsciammas/orbit-ai
git status --short docs/superpowers/plans/2026-04-08-fix-pass-c-alpha-readiness.md
```
Expected: `?? docs/superpowers/plans/2026-04-08-fix-pass-c-alpha-readiness.md` (untracked).

Commit it:
```bash
git add docs/superpowers/plans/2026-04-08-fix-pass-c-alpha-readiness.md
git commit -m "docs(plan): add Fix Pass C alpha-readiness implementation plan

Lands the Fix Pass C plan that drives this branch through alpha
readiness. Same pattern as the Fix Pass A plan committed earlier in
the stack — the plan is reviewable artifact #1, all subsequent commits
implement specific tasks from it.

Plan covers 21 findings (15 MUST + 6 SHOULD) from
docs/review/2026-04-08-post-stack-audit.md across 8 phases."
```

Now the working tree is clean and Step 0.1 will pass.

- [ ] **Step 0.1: Confirm environment + baseline**

Run:
```bash
cd /Users/sharonsciammas/orbit-ai
pwd
git branch --show-current
git rev-parse --short HEAD
git status
```
Expected:
- `pwd` prints `/Users/sharonsciammas/orbit-ai`
- Branch is `pr-4-cleanups-and-docs`
- HEAD is the new plan-file commit (one commit ahead of `b177670`)
- Working tree clean

- [ ] **Step 0.2: Confirm test baseline**

Run:
```bash
pnpm install --frozen-lockfile
pnpm --filter @orbit-ai/core build
pnpm -r typecheck
pnpm -r lint
pnpm -r test 2>&1 | tail -20
```
Expected: core 321 + sdk 186 + api 279 = **786 passing, 2 skipped**. typecheck + lint clean.

If any of the above fails, STOP and report — do NOT proceed.

- [ ] **Step 0.3: Confirm starting file state**

Run:
```bash
grep '"private": true' packages/core/package.json packages/api/package.json packages/sdk/package.json
```
Expected: all 3 lines present (this is what Task 2-4 will fix).

```bash
ls examples/ 2>&1
```
Expected: no such directory or empty (Task 18 creates it).

```bash
ls .github/workflows/ 2>&1
```
Expected: no such directory (Task 11 creates it).

No commit from this task — it's verification only.

---

# Phase 1 — Package publish gates + metadata + dependency alignment

## Task 1: Create a shared config snippet (reference only, no commit)

**Purpose**: Each of the 3 packages needs the same block of metadata. To avoid inconsistency, the metadata fields used in Tasks 2-4 are captured here as the single source of truth.

**Do NOT write this to a file**. This is the template the engineer uses when editing each package.json.

```jsonc
// Fields to add to each of packages/{core,api,sdk}/package.json:
{
  "name": "@orbit-ai/<core|api|sdk>",
  "version": "0.1.0-alpha.0",
  "description": "<see per-task below>",
  "keywords": ["crm", "ai-agents", "orbit-ai", "typescript", "<package-specific>"],
  "author": "Orbit AI Contributors",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/sharonds/orbit-ai.git",
    "directory": "packages/<core|api|sdk>"
  },
  "homepage": "https://github.com/sharonds/orbit-ai#readme",
  "bugs": {
    "url": "https://github.com/sharonds/orbit-ai/issues"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

**Important rules**:
- Do NOT set `"private": true` — remove that field entirely (do not just set to `false`)
- Preserve all existing fields (`type`, `main`, `types`, `exports`, `scripts`, `dependencies`, `devDependencies`) — only ADD the new fields
- `version` bumps from `0.0.0` to `0.1.0-alpha.0` in Task 19, NOT here. Leave version as-is for now — only metadata in this phase.

## Task 2: Update `packages/core/package.json`

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 2.1: Read current file**

Run:
```bash
cat packages/core/package.json
```

Capture the current structure. Note the exact position of `"private": true` and the trailing fields.

- [ ] **Step 2.2: Remove `"private": true` and add publish metadata**

Edit `packages/core/package.json`. Remove the `"private": true` line entirely. Add the following fields (use the template from Task 1; values below are core-specific):

```jsonc
{
  "name": "@orbit-ai/core",
  "version": "0.0.0",
  "description": "Schema engine, entities, adapters, and shared types for Orbit AI — a CRM infrastructure for AI agents",
  "keywords": ["crm", "ai-agents", "orbit-ai", "typescript", "schema", "drizzle", "multi-tenant"],
  "author": "Orbit AI Contributors",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/sharonds/orbit-ai.git",
    "directory": "packages/core"
  },
  "homepage": "https://github.com/sharonds/orbit-ai#readme",
  "bugs": {
    "url": "https://github.com/sharonds/orbit-ai/issues"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "type": "module",
  // ... existing main, types, exports, scripts, dependencies, devDependencies
}
```

The order inside `package.json` should be: `name`, `version`, `description`, `keywords`, `author`, `license`, `repository`, `homepage`, `bugs`, `engines`, `publishConfig`, `files`, `type`, `main`, `types`, `exports`, `scripts`, `dependencies`, `devDependencies`. Don't reorder for the sake of reordering — but the standard npm convention is metadata first, then type, then entry points, then scripts, then deps.

- [ ] **Step 2.3: Validate JSON syntax**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('packages/core/package.json', 'utf8')); console.log('ok')"
```
Expected: `ok`. If not, fix syntax errors.

- [ ] **Step 2.4: Run pnpm install to verify metadata doesn't break resolution**

Run:
```bash
pnpm install --frozen-lockfile
```
Expected: clean install, no errors. If the lockfile must update because of metadata-only changes (shouldn't happen), investigate before proceeding.

- [ ] **Step 2.5: Verify `pnpm pack` would ship only the expected files**

> ⚠️ pnpm 9.12.3 (the version pinned in this repo) does **NOT** support `pnpm pack --dry-run` — it errors with `Unknown option: 'dry-run'`. Use the actual pack + `tar -tzf` inspection pattern below instead.

Run:
```bash
mkdir -p /tmp/orbit-pack && rm -f /tmp/orbit-pack/*.tgz
cd packages/core && pnpm pack --pack-destination /tmp/orbit-pack && cd -
tar -tzf /tmp/orbit-pack/orbit-ai-core-*.tgz | sort
rm -f /tmp/orbit-pack/orbit-ai-core-*.tgz
```
Expected file list inside the tarball (under `package/` prefix):
- `package/package.json`
- `package/dist/...` (build outputs — only present if `pnpm --filter @orbit-ai/core build` has been run; if not, the dist entries will be empty and that's fine for this metadata-only commit)
- `package/README.md` (only present after Task 7a lands; this commit may have it missing — that's expected)
- `package/LICENSE` (only present after Task 7a lands; this commit may have it missing — that's expected)

It MUST NOT include `package/src/`, `package/__tests__/`, `package/tsconfig.json`, `package/vitest.config.*`, or any test fixtures. If any of those appear, the `files` field is wrong — fix before committing.

(`README.md` and `LICENSE` are listed in the `files` allow-list as targets even if the files don't exist yet. `pnpm pack` warns about missing files but does not error. Tasks 7a, 7b, and 7 create them; the final tarball gate in Task 19 verifies all four expected entries are present.)

- [ ] **Step 2.6: Commit**

```bash
git add packages/core/package.json
git commit -m "chore(core): add publish metadata + remove private: true

Prepares @orbit-ai/core for npm publish as part of Fix Pass C
(alpha-readiness). Removes 'private: true' so the package can be
published, adds publishConfig with public access, engines node>=22,
repository + homepage + bugs URLs pointing at the GitHub repo, MIT
license, keywords for npm discoverability, and 'files' field so
'pnpm pack' ships only dist + README + LICENSE.

Version stays at 0.0.0 for this commit; bump to 0.1.0-alpha.0
happens in Task 19 across all 3 packages together.

Closes OSS-1, OSS-7, OSS-8 (partial) from
docs/review/2026-04-08-post-stack-audit.md."
```

## Task 3: Update `packages/api/package.json`

**Files:**
- Modify: `packages/api/package.json`

Same shape as Task 2, with api-specific values. Description and keywords below:

- [ ] **Step 3.1-3.5**: Follow the same sequence as Task 2, applying these api-specific fields:

```jsonc
{
  "name": "@orbit-ai/api",
  "version": "0.0.0",
  "description": "Hono-based REST API for Orbit AI — multi-tenant CRM server with auth, tenant isolation, and idempotency",
  "keywords": ["crm", "ai-agents", "orbit-ai", "typescript", "hono", "rest-api", "multi-tenant"],
  // ... rest identical to Task 2 (author, license, repository with directory: "packages/api",
  //     homepage, bugs, engines, publishConfig, files: ["dist", "README.md", "LICENSE"])
}
```

Preserve `repository.directory` as `"packages/api"`.

- [ ] **Step 3.6: Commit**

```bash
git add packages/api/package.json
git commit -m "chore(api): add publish metadata + remove private: true

Same pattern as core — prepares @orbit-ai/api for npm publish.

Closes OSS-1, OSS-7, OSS-8 (partial) from
docs/review/2026-04-08-post-stack-audit.md."
```

## Task 4: Update `packages/sdk/package.json`

**Files:**
- Modify: `packages/sdk/package.json`

Same shape, sdk-specific values:

- [ ] **Step 4.1-4.5**: Follow the Task 2 sequence, apply:

```jsonc
{
  "name": "@orbit-ai/sdk",
  "version": "0.0.0",
  "description": "TypeScript client SDK for Orbit AI — type-safe CRM client with HTTP and direct-core transports",
  "keywords": ["crm", "ai-agents", "orbit-ai", "typescript", "sdk", "type-safe", "pagination"],
  // ... rest identical (author, license, repository with directory: "packages/sdk", ...)
}
```

- [ ] **Step 4.6: Commit**

```bash
git add packages/sdk/package.json
git commit -m "chore(sdk): add publish metadata + remove private: true

Same pattern as core and api — prepares @orbit-ai/sdk for npm publish.

Closes OSS-1, OSS-7, OSS-8 (complete, all 3 packages done) from
docs/review/2026-04-08-post-stack-audit.md."
```

## Task 5: Align `zod` version across api and core

**Files:**
- Modify: `packages/api/package.json` (dependency bump)
- Possibly modify: any api source file where zod v3 → v4 API changes matter

**Problem**: `packages/core/package.json` uses `zod ^4.1.11`, `packages/api/package.json` uses `zod ^3.23.0`. This is OSS-10 from the audit. A consumer who depends on both packages gets two copies of zod in their node_modules, and any error handler that checks `err instanceof ZodError` might hit a version mismatch.

**Strategy**: Bump api to `^4.1.11` to match core. Zod v4 is mostly backward-compatible with v3 for the subset this codebase uses (schema definitions, `safeParse`, `ZodError`). Known v3→v4 differences to watch:
- `z.record(z.unknown())` — still works in v4
- `ZodError.issues` — still exists in v4
- `z.string().datetime()` — still works in v4
- `z.array(...)` — still works in v4

- [ ] **Step 5.1: Update api package.json**

Edit `packages/api/package.json`. Change:
```json
"zod": "^3.23.0"
```
to:
```json
"zod": "^4.1.11"
```

- [ ] **Step 5.2: Install + verify lockfile updates cleanly**

Run:
```bash
pnpm install
```
Expected: lockfile updates. Review with `git diff pnpm-lock.yaml` to confirm zod is now at `4.x` in the api package resolution.

- [ ] **Step 5.3: Typecheck**

Run:
```bash
pnpm --filter @orbit-ai/api typecheck
```
Expected: clean. If there are type errors due to v3→v4 changes:
- Most likely culprit: `z.ZodError` generic signature changed. Fix by using the correct import path.
- If `err.issues[0].code` / `err.issues[0].path` shape changed, update accordingly.
- If you hit more than 5 typecheck errors, STOP and escalate — downgrading core to v3 is the backup plan.

- [ ] **Step 5.4: Run api tests**

Run:
```bash
pnpm --filter @orbit-ai/api test
```
Expected: 279 passing (same as baseline). The Fix Pass B ZodError handler test specifically exercises `err instanceof ZodError` and must still pass.

If any test fails, the v4 upgrade broke something — investigate the specific failure:
- If `err.issues` shape differs, update the error handler's `hint` construction to use the new field name.
- If a Zod schema fails to construct, update the schema to the v4 API.

- [ ] **Step 5.5: Run full verification**

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```
Expected: 786 passing, clean typecheck, clean lint. If the sdk has any zod-related code, verify it compiles against v4 too.

- [ ] **Step 5.6: Commit**

```bash
git add packages/api/package.json pnpm-lock.yaml
git commit -m "chore(api): bump zod from ^3.23.0 to ^4.1.11 to match core

The core package has used zod ^4.1.11 for some time; the api package
was on ^3.23.0, causing version duplication in consumer node_modules
and a potential 'instanceof ZodError' mismatch between the core and
api packages.

All api tests still pass after the bump; the ZodError branch in
orbitErrorHandler (from Fix Pass B commit b8c42a3) was verified
against the v4 ZodError shape.

Closes OSS-10 from docs/review/2026-04-08-post-stack-audit.md."
```

**If Step 5.3 or 5.4 reveals significant breakage** (more than trivial fixes), back out and instead downgrade core to zod `^3.23.0`. But try upgrading api first — core's zod usage is lighter.

---

**✋ PHASE 1 CHECKPOINT** — main session verifies before dispatching Phase 2:

```bash
git log --oneline b177670..HEAD
# Expected: 4 commits (core metadata, api metadata, sdk metadata, zod align)

pnpm -r typecheck && pnpm -r lint && pnpm -r test 2>&1 | tail -20
# Expected: 786 passing, clean

for pkg in core api sdk; do
  node -e "const p = require('./packages/$pkg/package.json'); console.log('$pkg:', p.private ? 'STILL PRIVATE ❌' : 'OK ✓', 'zod:', p.dependencies?.zod || 'n/a')"
done
# Expected: all OK, zod version consistent
```

Push the 4 commits:
```bash
git push origin pr-4-cleanups-and-docs
```

---

# Phase 2 — Root + SDK docs, .env.example, CONTRIBUTING, SECURITY

## Task 6: Rewrite root `README.md` to be honest

**Files:**
- Modify: `/Users/sharonsciammas/orbit-ai/README.md`

**Problem**: Current README references `packages/mcp/`, `packages/cli/`, `apps/docs/`, `examples/nextjs-crm/`, `examples/agent-workflow/` — none of which exist. A first-time visitor cloning the repo and following the README hits broken paths within 30 seconds. This is OSS-2 + OSS-3 from the audit.

**Strategy**: Rewrite the README to describe ONLY what exists today (core, api, sdk) and explicitly mark CLI, MCP, integrations as "in progress / next". Keep the "Resend for CRM" positioning — that's the strongest branding.

- [ ] **Step 6.1: Read the current README**

```bash
wc -l README.md
head -100 README.md
```
Capture the current structure and identify the problem sections (package list, install instructions, CLI examples).

- [ ] **Step 6.2: Write the new README**

Replace the entire file with this content (adjust sections that are already good to preserve them; the sections below MUST appear):

```markdown
# Orbit AI

> **CRM infrastructure for AI agents and developers.** Packages, not a product.
> (Think: "Resend for CRM" — type-safe primitives, not a UI.)

**Status**: pre-alpha. First npm release (`0.1.0-alpha`) targets `@orbit-ai/core`,
`@orbit-ai/api`, and `@orbit-ai/sdk`. CLI, MCP server, and integrations (Gmail,
Google Calendar, Stripe) are next.

## What's in this repo today

| Package | Status | Purpose |
|---|---|---|
| [`@orbit-ai/core`](packages/core) | ✅ alpha | Schema engine, entities, storage adapters (SQLite, Postgres, Supabase, Neon), tenant context, migrations |
| [`@orbit-ai/api`](packages/api) | ✅ alpha | Hono-based REST API with auth, scope enforcement, idempotency, rate limiting, sanitization |
| [`@orbit-ai/sdk`](packages/sdk) | ✅ alpha | TypeScript client with HTTP and direct-core transports, auto-pagination, type-safe resources |

## What's coming next (not in this release)

- `@orbit-ai/cli` — `orbit init`, CRUD commands, `--json` mode, schema tooling
- `@orbit-ai/integrations` — Gmail, Google Calendar, Stripe connectors
- `@orbit-ai/mcp` — Model Context Protocol server with 23 core tools
- A reference web app built on the SDK

## Quick look

```typescript
import { OrbitClient } from '@orbit-ai/sdk'

const client = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY!,
  baseUrl: 'https://api.orbit-ai.example.com',
})

// Happy path: list the first page of contacts
const page = await client.contacts.list({ limit: 10 })
console.log(page.data) // Contact[]

// Multi-page iteration
for await (const contact of client.contacts.pages({ limit: 50 }).autoPaginate()) {
  console.log(contact.id, contact.name)
}

// Create
const contact = await client.contacts.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
})
```

A runnable example lives at [`examples/nodejs-quickstart`](examples/nodejs-quickstart).

## Installation (when published)

```bash
pnpm add @orbit-ai/sdk
# or for the server-side packages:
pnpm add @orbit-ai/core @orbit-ai/api
```

> **Note**: the packages have not yet been published to npm. Until the `0.1.0-alpha`
> release, the only way to try Orbit AI is to clone this repo and run it from source
> with `pnpm install && pnpm -r build`.

## Architecture

Orbit AI is a monorepo (pnpm + Turborepo) with three layered packages:

```
┌─────────────────┐   ┌─────────────────┐
│  @orbit-ai/api  │   │  @orbit-ai/sdk  │
│   (REST server) │   │ (client lib)    │
└────────┬────────┘   └────────┬────────┘
         │                     │
         │   depends on        │
         └──────────┬──────────┘
                    │
           ┌────────▼─────────┐
           │  @orbit-ai/core  │
           │  (schema + adp.) │
           └──────────────────┘
```

- **core** is the source of truth for schema, entities, storage adapters, tenant
  isolation, and migrations. It has no network or HTTP dependencies.
- **api** is a Hono-based REST server that wraps core with auth, scopes, idempotency,
  rate limiting, and sanitization. It exposes `/v1/*` routes.
- **sdk** is a TypeScript client that can talk to an api server over HTTP, or run
  in-process directly against a core adapter (DirectTransport) for tests and trusted
  server-side use.

## Development

```bash
# Install deps (pnpm required — never use npm or yarn in this repo)
pnpm install

# Build all packages
pnpm -r build

# Run all tests (vitest)
pnpm -r test

# Typecheck + lint
pnpm -r typecheck
pnpm -r lint

# Run the quickstart example
cd examples/nodejs-quickstart && pnpm start
```

Requires **Node.js 22+** (the SQLite adapter uses `node:sqlite`).

## Supported storage adapters

| Adapter | Status | Notes |
|---|---|---|
| SQLite (`node:sqlite`) | ✅ | Local dev + tests. Not for production tenant isolation. |
| Postgres (raw `pg`) | ✅ | Production target. RLS policies shipped. |
| Supabase | ✅ | Via the Postgres adapter + RLS. |
| Neon | ✅ | Via the Postgres adapter + branching. |

## Security

See [`SECURITY.md`](SECURITY.md) for vulnerability disclosure, and
[`docs/security/`](docs/security) for the threat model and database hardening
checklist.

**Quick notes for alpha users:**
- API keys are hashed with SHA-256 before storage. HMAC-SHA256 + server pepper is
  planned for v1 GA.
- Multi-tenant isolation is enforced in two layers: application-level `orgId` filtering
  in every repository + Postgres RLS policies for Postgres-family adapters. SQLite has
  no RLS — application-layer filtering only.
- Idempotency and rate limiting are **in-memory by default** — single-instance deployments
  only. For multi-instance, implement the `IdempotencyStore` interface and pass it via
  `CreateApiOptions`.
- The full list of known alpha gaps lives in
  [`docs/review/2026-04-08-post-stack-audit.md`](docs/review/2026-04-08-post-stack-audit.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](LICENSE).

## Key planning docs

- [`docs/META-PLAN.md`](docs/META-PLAN.md) — master plan
- [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — execution baseline
- [`docs/product/release-definition-v1.md`](docs/product/release-definition-v1.md) — what v1 GA requires
- [`docs/specs/01-core.md`](docs/specs/01-core.md) through [`06-integrations.md`](docs/specs/06-integrations.md) — per-component specs
- [`docs/review/2026-04-08-post-stack-audit.md`](docs/review/2026-04-08-post-stack-audit.md) — post-stack audit (alpha readiness)
```

- [ ] **Step 6.3: Verify no broken links**

Run:
```bash
grep -oE '\[.*?\]\(([^)]+)\)' README.md | grep -oE '\(([^)]+)\)' | tr -d '()' | while read p; do
  if [[ "$p" =~ ^https?:// ]]; then
    continue # skip external
  fi
  if [ ! -e "$p" ]; then
    echo "MISSING: $p"
  fi
done
```

Expected: only `examples/nodejs-quickstart` missing (created in Task 18, Phase 6). `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md` are all created later in Phase 2 (Tasks 9, 10a-10c), and `LICENSE` already exists at the repo root. The README links to these files, and they will all resolve before the Phase 2 checkpoint. Any other missing file means the README is lying again.

- [ ] **Step 6.4: Commit**

```bash
git add README.md
git commit -m "docs: rewrite root README to match what actually exists

The previous README referenced packages/mcp, packages/cli, apps/docs,
examples/nextjs-crm, and examples/agent-workflow — none of which exist.
A first-time visitor following the README hit broken paths immediately.

New README:
- Honest package list (core, api, sdk only)
- Explicit 'what's coming next' section for CLI, MCP, integrations
- Working code snippet matching the current SDK API (list() → Promise,
  pages() → AutoPager — post-05a553b contract)
- Pointer to examples/nodejs-quickstart (created in Task 18)
- Pointer to CONTRIBUTING.md and SECURITY.md (created in Tasks 9-10)
- Pointer to the post-stack audit for the full list of known alpha gaps
- Retains the 'Resend for CRM' positioning

Closes OSS-2, OSS-3 from docs/review/2026-04-08-post-stack-audit.md."
```

## Task 7: Write `packages/sdk/README.md` with a real quickstart

**Files:**
- Create: `packages/sdk/README.md`

**Problem**: The SDK has no README at the package level. The Lens 5 reviewer said "No docs at all. Even 30 lines matching the actual API" would help. A published npm package without a README has broken-looking listings on npmjs.com.

- [ ] **Step 7.1: Create the SDK README**

Write to `packages/sdk/README.md`:

```markdown
# @orbit-ai/sdk

> Type-safe TypeScript client for Orbit AI — the CRM infrastructure for AI agents.

**Status**: `0.1.0-alpha` — first public release. API may change before 1.0.

## Installation

```bash
pnpm add @orbit-ai/sdk
# or
npm install @orbit-ai/sdk
```

Requires **Node.js 22+**.

## Quickstart

### 1. Create a client

```typescript
import { OrbitClient } from '@orbit-ai/sdk'

const client = new OrbitClient({
  apiKey: process.env.ORBIT_API_KEY!,
  baseUrl: 'https://api.orbit-ai.example.com',
})
```

### 2. CRUD a contact

```typescript
// Create
const contact = await client.contacts.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
})
console.log(contact.id) // 'contact_01...'

// Get
const fetched = await client.contacts.get(contact.id)

// Update
const updated = await client.contacts.update(contact.id, {
  email: 'ada+work@example.com',
})

// Delete
await client.contacts.delete(contact.id)
```

### 3. Paginated list

Two ways to paginate:

```typescript
// First page only — returns the envelope directly (recommended default)
const page = await client.contacts.list({ limit: 10 })
console.log(page.data)              // Contact[]
console.log(page.meta.next_cursor)  // string | null
console.log(page.meta.has_more)     // boolean

// Multi-page iteration — returns an AutoPager
for await (const contact of client.contacts.pages({ limit: 50 }).autoPaginate()) {
  console.log(contact.id, contact.name)
}
```

### 4. Error handling

```typescript
import { OrbitClient, OrbitApiError, type OrbitErrorCode } from '@orbit-ai/sdk'

try {
  await client.contacts.get('contact_does_not_exist')
} catch (err) {
  if (err instanceof OrbitApiError) {
    // err.code is the discriminated OrbitErrorCode literal union
    if (err.code === 'RESOURCE_NOT_FOUND') {
      console.log('not found:', err.message)
    } else if (err.code === 'RATE_LIMITED') {
      console.log('rate limited, retryable:', err.retryable)
    }
    console.log('request_id:', err.request_id)
  } else {
    throw err // network error, parse error, etc.
  }
}
```

## Resources

Every CRM entity has the same method surface (`create`, `get`, `update`, `delete`, `list`, `pages`, `search`, `batch`):

```typescript
client.contacts       // Contact
client.companies      // Company
client.deals          // Deal
client.pipelines      // Pipeline
client.stages         // Stage
client.users          // User
client.activities     // Activity
client.tasks          // Task
client.notes          // Note
client.products       // Product
client.payments       // Payment
client.contracts      // Contract
client.sequences      // Sequence
client.sequenceSteps  // SequenceStep
client.sequenceEnrollments
client.sequenceEvents
client.tags           // Tag
client.webhooks       // Webhook
client.imports        // Import
client.search         // Global search
```

Each returns strongly-typed records and accepts strongly-typed inputs — `client.contacts.create({...})` enforces `CreateContactInput` at compile time.

## Direct-core transport (advanced)

For server-side code that runs in the same process as the database (e.g. tests, CLI tools, trusted workers), you can skip the HTTP layer and talk directly to a core adapter:

```typescript
import { createSqliteStorageAdapter, createSqliteOrbitDatabase, initializeAllSqliteSchemas } from '@orbit-ai/core'
import { OrbitClient } from '@orbit-ai/sdk'

const db = createSqliteOrbitDatabase({ filename: ':memory:' })
await initializeAllSqliteSchemas(db)

const adapter = createSqliteStorageAdapter({
  database: db,
  lookupApiKeyForAuth: async () => ({
    id: 'key_test',
    organizationId: 'org_01...',
    scopes: ['*'],
    revokedAt: null,
    expiresAt: null,
  }),
})

const client = new OrbitClient({
  adapter,
  context: { orgId: 'org_01...' },
})

await client.contacts.create({ name: 'Ada' })
```

> ⚠️ **Security warning**: `DirectTransport` bypasses the API middleware chain
> (auth, scopes, idempotency, rate limiting, SSRF validation for webhooks). Only
> use it with trusted inputs in server-side code. For any production consumer or
> untrusted input, use the HTTP transport against a real API server.

## What's NOT in this release

- `search()` and `batch()` still accept `Record<string, unknown>` — per-entity typed inputs are planned for v1 GA
- `AbortSignal` support on transport requests
- Request/response interceptors
- Custom-fields type generic (`ContactRecord<TCustom>`)
- MCP + CLI integration (separate packages, not yet released)

See the [post-stack audit](../../docs/review/2026-04-08-post-stack-audit.md) for the full list of known alpha gaps.

## License

MIT
```

- [ ] **Step 7.2: Verify the code snippets match the real API**

Run:
```bash
grep -n "client\.contacts\.\(list\|pages\|create\|get\|update\|delete\)" packages/sdk/README.md
```
Every method call in the README must match a real method in `packages/sdk/src/resources/base-resource.ts` or a subclass. Verify:
```bash
grep -n "^\s*\(async \)\?list\|^\s*\(async \)\?pages\|^\s*\(async \)\?create\|^\s*\(async \)\?get\b\|^\s*\(async \)\?update\|^\s*\(async \)\?delete" packages/sdk/src/resources/base-resource.ts
```
If any method referenced in the README doesn't exist in base-resource.ts, the README is lying.

- [ ] **Step 7.3: Commit**

```bash
git add packages/sdk/README.md
git commit -m "docs(sdk): add package README with real quickstart

The Lens 5 post-stack audit reviewer flagged that the SDK had no
README — a published npm package without a README has broken-looking
npmjs.com listings and nothing for first-time consumers to copy-paste.

New README includes:
- Install command
- 4-step quickstart (create client, CRUD, paginate, handle errors)
- Full resource list (22 entities)
- Direct-core transport example with the @security warning
- Honest 'what's NOT in this release' section
- Link to post-stack audit for the full known-gaps list

Code snippets verified against the real post-05a553b API:
list() returns Promise<OrbitEnvelope<T[]>>, pages() returns AutoPager.

Closes DOC-SDK from docs/review/2026-04-08-post-stack-audit.md."
```

## Task 7a: Create `packages/core/README.md` + copy LICENSE

**Files:**
- Create: `packages/core/README.md`
- Copy: `LICENSE` → `packages/core/LICENSE`

**Problem**: PKG-README-CORE. The `files` field in package.json lists `README.md` and `LICENSE`, but neither exists at the package level. The npm tarball would ship without them — the npmjs.com page would show no README, and the license metadata would be incomplete.

- [ ] **Step 7a.1: Copy LICENSE into the package**

```bash
cp LICENSE packages/core/LICENSE
```

The root LICENSE is MIT. Each published package should ship its own copy so consumers see the license in `node_modules/@orbit-ai/core/LICENSE` without needing the full repo.

- [ ] **Step 7a.2: Write the core README**

Write to `packages/core/README.md`:

```markdown
# @orbit-ai/core

> Schema engine, entities, storage adapters, and shared types for Orbit AI — a CRM infrastructure for AI agents.

**Status**: `0.1.0-alpha` — first public release. API may change before 1.0.

## What this package provides

- **Schema definitions** (Drizzle ORM) for 12 CRM entity types: contacts, companies, deals, pipeline stages, activities, products, payments, contracts, channels, sequences, tags, notes
- **Storage adapters** for SQLite (`node:sqlite`), Postgres, Supabase, and Neon
- **Entity services** with CRUD, search, batch operations
- **Tenant context** and `organization_id`-scoped isolation
- **Migration engine** with runtime/migration authority split

## Installation

```bash
pnpm add @orbit-ai/core
```

Requires **Node.js 22+**.

## Quick usage

```typescript
import {
  createSqliteStorageAdapter,
  createSqliteOrbitDatabase,
  createCoreServices,
  initializeAllSqliteSchemas,
} from '@orbit-ai/core'

const db = createSqliteOrbitDatabase() // :memory:
await initializeAllSqliteSchemas(db)

const adapter = createSqliteStorageAdapter({ database: db })
const services = createCoreServices(adapter)
```

Most consumers will use `@orbit-ai/api` (REST server) or `@orbit-ai/sdk` (client) rather than importing core directly. Core is the foundation package that both depend on.

## License

MIT — see [LICENSE](./LICENSE).
```

- [ ] **Step 7a.3: Verify tarball contents**

```bash
mkdir -p /tmp/orbit-pack && rm -f /tmp/orbit-pack/*.tgz
cd packages/core && pnpm pack --pack-destination /tmp/orbit-pack && cd -
tar -tzf /tmp/orbit-pack/orbit-ai-core-*.tgz | grep -E "(README|LICENSE|package.json)" | sort
rm -f /tmp/orbit-pack/orbit-ai-core-*.tgz
```
Expected: `package/LICENSE`, `package/README.md`, `package/package.json` all present.

- [ ] **Step 7a.4: Commit**

```bash
git add packages/core/README.md packages/core/LICENSE
git commit -m "docs(core): add package-level README + LICENSE for npm publish

The files field in core's package.json lists README.md and LICENSE,
but neither existed at the package level. The npm tarball would ship
without them — npmjs.com would show no README and the license metadata
would be incomplete.

Adds a concise README with quick usage showing SQLite adapter setup,
and copies the root MIT LICENSE into the package directory so it ships
inside the tarball.

Closes PKG-README-CORE."
```

## Task 7b: Create `packages/api/README.md` + copy LICENSE

**Files:**
- Create: `packages/api/README.md`
- Copy: `LICENSE` → `packages/api/LICENSE`

**Problem**: PKG-README-API. Same as 7a — no package-level README or LICENSE for the api package.

- [ ] **Step 7b.1: Copy LICENSE into the package**

```bash
cp LICENSE packages/api/LICENSE
```

- [ ] **Step 7b.2: Write the api README**

Write to `packages/api/README.md`:

```markdown
# @orbit-ai/api

> Hono-based REST API for Orbit AI — multi-tenant CRM server with auth, tenant isolation, and idempotency.

**Status**: `0.1.0-alpha` — first public release. API may change before 1.0.

## What this package provides

- **Hono REST server** mounting `/v1/*` routes for all 12 CRM entity types
- **Auth middleware** with API key validation and scope enforcement
- **Tenant isolation** via `organization_id` context propagation
- **Idempotency middleware** with pluggable `IdempotencyStore` (in-memory default)
- **Rate limiting** (in-memory, single-instance — documented limitation)
- **Body sanitization** stripping internal metadata from responses
- **Request body size limits** (1 MB default, configurable)

## Installation

```bash
pnpm add @orbit-ai/api @orbit-ai/core
```

Requires **Node.js 22+**.

## Quick usage

```typescript
import { createApi } from '@orbit-ai/api/node'
import { createSqliteStorageAdapter, createSqliteOrbitDatabase, createCoreServices, initializeAllSqliteSchemas } from '@orbit-ai/core'

const db = createSqliteOrbitDatabase()
await initializeAllSqliteSchemas(db)
const adapter = createSqliteStorageAdapter({ database: db })
const services = createCoreServices(adapter)

const app = createApi({ adapter, version: '2026-04-01', services })
// app is a Hono instance — serve it with any Node.js HTTP server
```

Most consumers will use `@orbit-ai/sdk` as the client and `@orbit-ai/api` as the server.

## License

MIT — see [LICENSE](./LICENSE).
```

- [ ] **Step 7b.3: Also copy LICENSE into packages/sdk/**

The SDK already has README.md from Task 7, but needs LICENSE too:

```bash
cp LICENSE packages/sdk/LICENSE
```

- [ ] **Step 7b.4: Verify all 3 package tarballs**

```bash
for pkg in core api sdk; do
  echo "=== $pkg ==="
  mkdir -p /tmp/orbit-pack && rm -f /tmp/orbit-pack/*.tgz
  cd packages/$pkg && pnpm pack --pack-destination /tmp/orbit-pack && cd ../..
  tar -tzf /tmp/orbit-pack/orbit-ai-$pkg-*.tgz | grep -E "(README|LICENSE|package.json)" | sort
  rm -f /tmp/orbit-pack/*.tgz
done
```
Expected: all 3 packages show `package/LICENSE`, `package/README.md`, `package/package.json`.

- [ ] **Step 7b.5: Commit**

```bash
git add packages/api/README.md packages/api/LICENSE packages/sdk/LICENSE
git commit -m "docs(api): add package-level README + LICENSE; copy LICENSE into sdk

Same pattern as core — ensures all 3 published packages ship with
README.md and LICENSE in the npm tarball. API README covers quick
server setup with createApi(). SDK LICENSE was missing despite the
SDK already having a README from Task 7.

Closes PKG-README-API. Completes per-package artifact coverage for
OSS-8."
```

## Task 8: Create `.env.example`

**Files:**
- Create: `/Users/sharonsciammas/orbit-ai/.env.example`

**Problem**: OSS-4. No env var documentation. A new contributor cloning the repo has no idea what secrets/config are needed.

- [ ] **Step 8.1: Create the file**

Write to `.env.example`:

```bash
# Orbit AI — environment variables
#
# Copy this file to .env (or .env.local) and fill in values for the adapters
# you're using. Not all variables are required — only the ones for the adapter
# you've configured.

# ═══════════════════════════════════════════════════════════════════════════
# Postgres adapter (used by Supabase, Neon, and raw Postgres deployments)
# ═══════════════════════════════════════════════════════════════════════════

# Full connection string. For Supabase: get this from Project Settings → Database
# For Neon: get this from the Neon console → "Connection Details"
DATABASE_URL=postgres://user:password@host:5432/dbname

# Optional: separate URL for migrations (if you want to use a higher-privilege
# role for DDL while keeping runtime requests on a restricted role). If unset,
# DATABASE_URL is used for both.
# MIGRATION_DATABASE_URL=postgres://migration_user:password@host:5432/dbname

# ═══════════════════════════════════════════════════════════════════════════
# Supabase adapter (optional, if you want Supabase-specific auth integration)
# ═══════════════════════════════════════════════════════════════════════════

# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your-anon-key-here
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
# NOTE: service_role is a migration-authority credential. Do NOT use it for
# request paths. See docs/security/security-architecture.md.

# ═══════════════════════════════════════════════════════════════════════════
# Orbit AI API server
# ═══════════════════════════════════════════════════════════════════════════

# Port for the Hono server (local dev only — in production, use your process
# manager's port config)
# ORBIT_API_PORT=3000

# API version header default (the version used when clients don't send one)
# ORBIT_API_VERSION=2026-04-01

# Maximum HTTP request body size in bytes (default: 1 MB = 1_048_576)
# ORBIT_MAX_REQUEST_BODY_SIZE=1048576

# ═══════════════════════════════════════════════════════════════════════════
# Orbit AI SDK consumers
# ═══════════════════════════════════════════════════════════════════════════

# API key for SDK authentication (get this from `orbit bootstrap api-keys` once
# the CLI ships, or from your Orbit AI dashboard once hosted is live)
# ORBIT_API_KEY=sk_test_...

# Base URL of the Orbit API server your SDK connects to
# ORBIT_API_BASE_URL=https://api.orbit-ai.example.com

# ═══════════════════════════════════════════════════════════════════════════
# Local development
# ═══════════════════════════════════════════════════════════════════════════

# Node environment (affects logging and rate-limit strictness)
# NODE_ENV=development
```

- [ ] **Step 8.2: Verify `.env.example` is not gitignored**

Run:
```bash
git check-ignore .env.example
```
Expected: no output (not ignored). If ignored, check `.gitignore` — `.env*` might be pattern-matching `.env.example`. If so, add `!.env.example` to `.gitignore`.

- [ ] **Step 8.3: Commit**

```bash
git add .env.example
# If .gitignore was modified:
# git add .gitignore
git commit -m "docs: add .env.example with Postgres/Supabase/API/SDK variables

OSS-4: no environment variable documentation. First-time contributors
had no idea what secrets/config the repo needs. Adds .env.example with
commented-out entries for every env var the codebase reads (verified
by grep against process.env usages), grouped by adapter + server +
SDK + dev.

Closes OSS-4 from docs/review/2026-04-08-post-stack-audit.md."
```

## Task 9: Create `CONTRIBUTING.md`

**Files:**
- Create: `/Users/sharonsciammas/orbit-ai/CONTRIBUTING.md`

- [ ] **Step 9.1: Write the file**

```markdown
# Contributing to Orbit AI

Thanks for wanting to contribute. Orbit AI is pre-alpha right now
(0.1.0-alpha), so the contributing surface is narrower than a mature
project — but we welcome bug reports, small PRs, and feedback on the
SDK/API shape before we lock v1.

## Ground rules

- **Be nice.** We follow the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md) (coming soon).
- **Security issues go to `SECURITY.md`**, not public issues.
- **One concern per PR.** A PR that fixes 3 unrelated things is harder to
  review than 3 PRs.
- **Tests are required** for bug fixes and new features. Documentation-only
  changes can skip tests.

## Dev environment

Requires:
- **Node.js 22+** (the SQLite adapter uses `node:sqlite`, which is stable in 22)
- **pnpm 9+** (never use npm or yarn in this repo — the lockfile is pnpm-only)
- **Git**

Setup:

```bash
git clone https://github.com/sharonds/orbit-ai.git
cd orbit-ai
pnpm install
pnpm -r build
pnpm -r test
```

Expected: 786+ passing tests (grows over time), clean typecheck and lint.

## Project layout

```
packages/core/    # @orbit-ai/core — schema, adapters, entities
packages/api/     # @orbit-ai/api — Hono REST server
packages/sdk/     # @orbit-ai/sdk — TypeScript client
examples/         # Runnable examples
docs/             # Specs, planning, security, review artifacts
```

Future packages (`packages/cli`, `packages/mcp`, `packages/integrations`) are
planned but not yet implemented. See the root [`README.md`](README.md).

## Common commands

```bash
# Full build + verify
pnpm -r build && pnpm -r typecheck && pnpm -r lint && pnpm -r test

# Test a single package
pnpm --filter @orbit-ai/api test

# Test a single file with pattern
pnpm --filter @orbit-ai/api test -- idempotency

# Rebuild only core (needed after any change under packages/core/src)
pnpm --filter @orbit-ai/core build

# Run the quickstart example end-to-end
cd examples/nodejs-quickstart && pnpm start
```

## Pull request process

1. **Open an issue first** for anything non-trivial. Small typo fixes and
   obvious bug fixes don't need an issue, but a feature or behavior change does.
2. **Fork and branch** from `main`. Branch naming: `fix/<short-desc>`, `feat/<short-desc>`, or `docs/<short-desc>`.
3. **Write tests** that fail before your change and pass after.
4. **Run the full verification** (see "Common commands" above) before pushing.
5. **Write a clear commit message** using conventional-commits prefixes:
   `fix(api): ...`, `feat(sdk): ...`, `docs(core): ...`, `test: ...`, `chore: ...`, `refactor: ...`.
6. **One PR = one concern.** If you discover a second issue while fixing the
   first, open a second PR.
7. **PR description** should explain: what problem it solves, why this approach,
   any alternatives considered, and what manual testing you did beyond the
   automated tests.

## Code style

- TypeScript strict mode — no `any` in consumer-facing types. Internal `as any`
  is discouraged but accepted where the alternative is ~50 lines of type
  gymnastics; add a comment explaining why.
- **No silent failures.** Never write `catch (e) { return null }` or
  `catch { /* ignore */ }`. Every catch must either rethrow a typed error or
  log via `console.error` with structured context.
- **No new `private: true` packages** — if you add a new workspace package that
  should eventually be published, set up its publish metadata on day one.
- **Every route that mutates data** must have a Zod schema validating the body
  before the service layer touches it.
- **Tests are real** — no mocking the thing under test. Route tests should use
  `createRouteTestApp()` + real handler registration, not mock the services
  they're supposed to verify.

## Running the fix/review workflow

This repo uses a multi-stage review workflow for non-trivial changes:

1. Write code + tests
2. Run full verification locally
3. Open a PR with a clear description
4. Internal review (if you have access to the review-agent setup)
5. External review (Codex or GitHub PR review)
6. Merge

For the detailed playbook see
[`docs/review/2026-04-08-post-stack-audit.md`](docs/review/2026-04-08-post-stack-audit.md)
which documents the fix-and-review protocol used to land the `0.1.0-alpha` stack.

## Questions?

Open a GitHub discussion or reach out via the issue tracker. Don't file security
issues in public — see [`SECURITY.md`](SECURITY.md).
```

- [ ] **Step 9.2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md

OSS-5: the README promised 'Contribution guidelines will be published
when the project reaches public alpha'. This IS the public alpha
preparation — time to deliver.

Covers dev setup (Node 22+, pnpm), project layout, common commands,
PR process, code style rules (no silent failures, no private:true
packages, mandatory Zod validation), and the review workflow.

Closes OSS-5 from docs/review/2026-04-08-post-stack-audit.md."
```

## Task 10a: Create `SECURITY.md`

**Files:**
- Create: `/Users/sharonsciammas/orbit-ai/SECURITY.md`

> **OSS-9 split note**: the audit's OSS-9 finding is `No SECURITY.md, CHANGELOG.md, CODE_OF_CONDUCT.md`. This plan splits OSS-9 into three separate tasks (10a SECURITY.md, 10b CHANGELOG.md, 10c CODE_OF_CONDUCT.md), each landing as its own commit so external reviewers can read them in isolation.

- [ ] **Step 10.1: Write the file**

```markdown
# Security Policy

Thank you for helping keep Orbit AI and its users safe.

## Supported versions

Orbit AI is pre-alpha. The only "supported" version right now is the current
`0.1.0-alpha` release and the `main` branch. Older alpha tags are not
receiving security fixes.

| Version | Supported |
|---|---|
| `0.1.0-alpha.*` | ✅ |
| `< 0.1.0-alpha` | ❌ |

## Reporting a vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Email security reports to: **security@orbit-ai.dev** (replace with the real
inbox before publishing the repo publicly — see note below).

Include:
- A clear description of the vulnerability
- Affected packages and versions
- Steps to reproduce (proof-of-concept if possible)
- Impact assessment (what an attacker can do)
- Suggested fix, if you have one

We'll acknowledge receipt within **72 hours** and aim to respond with an
assessment and fix timeline within **7 days**.

## What counts as a security issue

**In scope:**
- Cross-tenant data leakage (organization A reading organization B's data)
- Authentication or authorization bypass on any `/v1/*` route
- SSRF, XXE, or injection vulnerabilities (SQL, command, etc.)
- Secret leakage in logs, error responses, or API responses
- Rate limiting or idempotency bypass that enables abuse
- API key handling flaws (storage, transmission, revocation)
- Webhook signing / verification flaws
- Migration authority escalation
- Dependency vulnerabilities in our direct dependencies

**Out of scope:**
- Issues in user-provided storage adapters you wrote yourself
- Denial-of-service attacks requiring large botnets (we're pre-alpha; rate
  limiting and horizontal scaling are explicitly deferred)
- Vulnerabilities in test-only code or example applications
- Known alpha gaps documented in
  [`docs/review/2026-04-08-post-stack-audit.md`](docs/review/2026-04-08-post-stack-audit.md)
  — these are already tracked and will be fixed before v1 GA

## Our security model

Orbit AI is a multi-tenant CRM SDK. The security model has three layers:

1. **Application-layer tenant isolation**: every repository query filters by
   `organization_id` from the authenticated context.
2. **Database-layer Row-Level Security** (Postgres-family adapters only): RLS
   policies enforce `organization_id` at the DB level as defense-in-depth.
   **SQLite has no RLS** — SQLite is for local dev only, not production.
3. **Runtime / migration authority split**: request paths never hold migration
   credentials. See [`docs/security/security-architecture.md`](docs/security/security-architecture.md).

Known security gaps documented in the post-stack audit (not yet fixed):
- SHA-256 API key hashing is used; HMAC-SHA256 + server pepper is planned for
  v1 GA (T19).
- In-memory idempotency + rate limit stores are single-instance only. For
  multi-instance deployments, implement the `IdempotencyStore` interface.
- Full cross-transport black-box parity tests are not yet implemented (T14).

## Credit

We'll credit reporters in the CHANGELOG unless you prefer to remain anonymous.

---

**Note for the maintainer**: replace `security@orbit-ai.dev` with the real
reporting inbox before publishing this repo publicly. GitHub's "Private
vulnerability reporting" feature under Settings → Code security and analysis
is a good alternative if you don't want to set up a dedicated inbox.
```

- [ ] **Step 10.2: Commit**

```bash
git add SECURITY.md
git commit -m "docs: add SECURITY.md with disclosure policy

OSS-9: no responsible disclosure process documented. GitHub surfaces
this prominently in community health metrics, and security researchers
need a channel.

Policy covers: supported versions, how to report, what's in scope vs
out of scope (pointing at the post-stack audit for known gaps), our
3-layer security model (app filtering + RLS + authority split), known
pre-alpha gaps, and a note to the maintainer to swap the placeholder
email before publishing.

Closes OSS-9a from docs/review/2026-04-08-post-stack-audit.md."
```

## Task 10b: Create `CHANGELOG.md`

**Files:**
- Create: `/Users/sharonsciammas/orbit-ai/CHANGELOG.md`

- [ ] **Step 10b.1: Write the file**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha.0] — Unreleased

### Added
- `@orbit-ai/core` — schema engine, 12 entity types, storage adapters (SQLite, Postgres, Supabase, Neon), tenant context, migration engine
- `@orbit-ai/api` — Hono REST API with auth, scope enforcement, idempotency, rate limiting, body sanitization
- `@orbit-ai/sdk` — TypeScript client with HTTP and DirectTransport, auto-pagination, type-safe resources
- `examples/nodejs-quickstart` — runnable quickstart + CI smoke test
- CI workflow (GitHub Actions: build, typecheck, lint, test)
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`

### Known limitations (alpha)
- Idempotency and rate limiting use in-memory stores (single-instance only)
- API key hashing uses SHA-256 (HMAC-SHA256 + pepper planned for v1 GA)
- SQLite adapter has no Row-Level Security — application-layer filtering only
- `search()` and `batch()` accept `Record<string, unknown>` (per-entity typed inputs planned for v1 GA)
- No CLI, MCP server, or integration packages yet

See [`docs/review/2026-04-08-post-stack-audit.md`](docs/review/2026-04-08-post-stack-audit.md) for the full audit.
```

- [ ] **Step 10b.2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md for 0.1.0-alpha.0

OSS-9b: no CHANGELOG. Keep a Changelog format with the initial alpha
release entry documenting what's included and what's known-limited.

Closes OSS-9b from docs/review/2026-04-08-post-stack-audit.md."
```

## Task 10c: Create `CODE_OF_CONDUCT.md`

**Files:**
- Create: `/Users/sharonsciammas/orbit-ai/CODE_OF_CONDUCT.md`

- [ ] **Step 10c.1: Write the file**

```markdown
# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, caste, color, religion, or sexual
identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming,
diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment:

* Using welcoming and inclusive language
* Being respectful of differing viewpoints and experiences
* Gracefully accepting constructive criticism
* Focusing on what is best for the community
* Showing empathy towards other community members

Examples of unacceptable behavior:

* The use of sexualized language or imagery, and sexual attention or advances
  of any kind
* Trolling, insulting or derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information without explicit permission
* Other conduct which could reasonably be considered inappropriate in a
  professional setting

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the project maintainers. All complaints will be reviewed and
investigated promptly and fairly.

## Attribution

This Code of Conduct is adapted from the
[Contributor Covenant](https://www.contributor-covenant.org), version 2.1,
available at
[https://www.contributor-covenant.org/version/2/1/code_of_conduct.html](https://www.contributor-covenant.org/version/2/1/code_of_conduct.html).
```

- [ ] **Step 10c.2: Commit**

```bash
git add CODE_OF_CONDUCT.md
git commit -m "docs: add CODE_OF_CONDUCT.md (Contributor Covenant 2.1)

OSS-9c: no code of conduct. Adopts Contributor Covenant 2.1, the
most widely used CoC in open source. CONTRIBUTING.md already
references it.

Closes OSS-9c from docs/review/2026-04-08-post-stack-audit.md."
```

---

**✋ PHASE 2 CHECKPOINT** — main session verifies:

```bash
git log --oneline b177670..HEAD
# Expected: 14 commits total (1 plan + 4 Phase 1 + 9 Phase 2)

# Verify all new docs exist at repo root + all packages
ls README.md CONTRIBUTING.md SECURITY.md CHANGELOG.md CODE_OF_CONDUCT.md .env.example
ls packages/core/README.md packages/core/LICENSE
ls packages/api/README.md packages/api/LICENSE
ls packages/sdk/README.md packages/sdk/LICENSE
# Expected: all 12 files exist

# Verify root README has no broken references to nonexistent packages
grep -E "packages/mcp|packages/cli|apps/docs|examples/nextjs-crm|examples/agent-workflow" README.md
# Expected: zero matches

# Verify all 3 package tarballs contain README + LICENSE
for pkg in core api sdk; do
  rm -f /tmp/orbit-pack/*.tgz
  cd packages/$pkg && pnpm pack --pack-destination /tmp/orbit-pack && cd ../..
  echo "=== $pkg ==="
  tar -tzf /tmp/orbit-pack/orbit-ai-$pkg-*.tgz | grep -E "(README|LICENSE)" | sort
done
# Expected: each shows package/README.md and package/LICENSE

pnpm -r test 2>&1 | tail -5
# Expected: still 786 passing (no code changes in Phase 2)
```

Push:
```bash
git push origin pr-4-cleanups-and-docs
```

---

# Phase 3 — CI workflow

## Task 11: Add `.github/workflows/ci.yml`

**Files:**
- Create: `.github/workflows/ci.yml`

**Problem**: OSS-6. No CI. A merged PR could break the build with no gate. Before publishing, we need at minimum a workflow that runs build + typecheck + lint + test on every PR and push to main.

- [ ] **Step 11.1: Create the workflow file**

```bash
mkdir -p .github/workflows
```

Write to `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    name: Build, typecheck, lint, test
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm -r build

      - name: Typecheck
        run: pnpm -r typecheck

      - name: Lint
        run: pnpm -r lint

      - name: Test
        run: pnpm -r test

      - name: Run quickstart example (smoke)
        run: |
          if [ -d "examples/nodejs-quickstart" ]; then
            cd examples/nodejs-quickstart
            if [ -f package.json ] && grep -q '"start"' package.json; then
              pnpm start
            fi
          fi
```

**Notes:**
- `pnpm/action-setup@v4` + `actions/setup-node@v4` is the modern pattern; cache is handled by setup-node
- Node 22 matches the `engines.node` field in the packages
- `timeout-minutes: 15` prevents a hung test from spinning forever
- The "Run quickstart example" step is conditional — if `examples/nodejs-quickstart` doesn't exist yet (it's created in Task 18), the step no-ops. After Task 18 lands, this step becomes a real end-to-end smoke test.

- [ ] **Step 11.2: Validate YAML syntax locally**

Run:
```bash
node -e "
const yaml = require('fs').readFileSync('.github/workflows/ci.yml', 'utf8');
// Basic sanity: every non-empty line has consistent indentation
const lines = yaml.split('\n');
let ok = true;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/^\t/)) { console.error('TAB at line', i+1); ok = false; }
}
console.log(ok ? 'ok' : 'FAIL');
"
```
Expected: `ok`. If fails, GitHub Actions won't accept tabs in YAML — fix.

Alternatively, if you have `yamllint` or similar installed:
```bash
npx --yes yaml-lint .github/workflows/ci.yml 2>&1 || echo "yaml-lint not available, skipping"
```

- [ ] **Step 11.3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for build/typecheck/lint/test

OSS-6: no CI. A merged PR could break the build with no gate, which
is unacceptable before npm publish.

Minimal workflow:
- Runs on push to main and pull_request to main
- Node 22, pnpm 9, frozen lockfile
- Full verification chain: build → typecheck → lint → test
- Conditional smoke test against examples/nodejs-quickstart (added in Task 18)
- 15-minute timeout per job

Closes OSS-6 from docs/review/2026-04-08-post-stack-audit.md."
```

**Note**: this commit does NOT push to GitHub yet — the push happens at the end of the phase. When it does, GitHub will immediately try to run the workflow. If it fails in CI, investigate from the Actions tab.

---

**✋ PHASE 3 CHECKPOINT** — main session:

```bash
git log --oneline b177670..HEAD
# Expected: 15 commits (1 plan + 4 Phase 1 + 9 Phase 2 + 1 CI)

cat .github/workflows/ci.yml | head -20
# Eyeball the workflow looks reasonable

# Push (this triggers the first CI run on GitHub)
git push origin pr-4-cleanups-and-docs
```

**After push**: open GitHub Actions tab, watch the first CI run. If it fails:
- `pnpm install --frozen-lockfile` fails → lockfile drift, needs update
- Build fails → something depends on an uncommitted file
- Tests fail → environment difference between local Node version and CI

Do NOT proceed to Phase 4 until CI is green on this commit.

---

# Phase 4 — SDK DX fixes

## Task 12: Re-export `OrbitErrorCode` from sdk + add `.code` getter to `OrbitApiError`

**Files:**
- Modify: `packages/sdk/src/errors.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/sdk/src/__tests__/error-types.test.ts` (new file — create if missing)

**Problem**: DX-ERR-1 + DX-ERR-2.
- `OrbitApiError` stores the error shape under `.error.code`, not `.code` directly. Consumers writing `if (err.code === 'RATE_LIMITED')` get silent false — `err.code` is undefined.
- `OrbitErrorCode` is defined in core but NOT re-exported from the sdk. Consumers need dual imports to narrow errors.

- [ ] **Step 12.1: Write failing test**

Create `packages/sdk/src/__tests__/error-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { OrbitApiError } from '../errors.js'
import type { OrbitErrorCode } from '../index.js'

describe('OrbitApiError .code getter', () => {
  it('exposes .code as a direct property matching .error.code', () => {
    const err = new OrbitApiError(
      {
        code: 'RATE_LIMITED',
        message: 'too many requests',
        retryable: true,
      },
      429,
    )
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.error.code).toBe('RATE_LIMITED') // legacy path still works
  })

  it('exposes .message inherited from Error', () => {
    const err = new OrbitApiError(
      { code: 'RESOURCE_NOT_FOUND', message: 'contact not found', retryable: false },
      404,
    )
    expect(err.message).toBe('contact not found')
  })

  it('TypeScript narrows on .code without reaching into .error', () => {
    const err = new OrbitApiError(
      { code: 'AUTH_INVALID_API_KEY', message: 'bad key', retryable: false },
      401,
    )
    // Compile-time check: err.code is OrbitErrorCode
    const code: OrbitErrorCode = err.code
    expect(code).toBe('AUTH_INVALID_API_KEY')
  })
})

describe('@orbit-ai/sdk index exports', () => {
  it('re-exports OrbitErrorCode type from core', async () => {
    // Import from the sdk barrel — this line must typecheck
    const sdk = await import('../index.js')
    expect(sdk).toHaveProperty('OrbitApiError')
    // ORBIT_ERROR_CODES is a value export we also want re-exported
    expect(sdk).toHaveProperty('ORBIT_ERROR_CODES')
  })
})
```

- [ ] **Step 12.2: Run test to verify it fails**

```bash
pnpm --filter @orbit-ai/sdk test -- error-types
```
Expected: **FAIL** — `err.code` is `undefined` (no getter yet), and `ORBIT_ERROR_CODES` is not in the sdk barrel.

- [ ] **Step 12.3: Add `.code` getter to OrbitApiError**

Edit `packages/sdk/src/errors.ts`. The current class is:

```typescript
import type { OrbitErrorShape } from '@orbit-ai/core'

export class OrbitApiError extends Error {
  constructor(
    public readonly error: OrbitErrorShape,
    public readonly status: number,
  ) {
    super(error.message)
    this.name = 'OrbitApiError'
  }
  // ... static fromResponse ...
}
```

Add a `code` getter right after the constructor:

```typescript
import type { OrbitErrorShape, OrbitErrorCode } from '@orbit-ai/core'

export class OrbitApiError extends Error {
  constructor(
    public readonly error: OrbitErrorShape,
    public readonly status: number,
  ) {
    super(error.message)
    this.name = 'OrbitApiError'
  }

  /**
   * The discriminated error code. Equivalent to `this.error.code`, but exposed
   * as a direct property so consumers can write `err.code === 'RATE_LIMITED'`
   * without reaching through `.error`. Both access patterns are supported.
   */
  get code(): OrbitErrorCode {
    return this.error.code
  }

  /**
   * Request ID for correlation with server logs, if present.
   */
  get request_id(): string | undefined {
    return this.error.request_id
  }

  /**
   * Whether the error is retryable. Convenience passthrough from .error.retryable.
   */
  get retryable(): boolean {
    return this.error.retryable ?? false
  }

  static async fromResponse(response: Response): Promise<OrbitApiError> {
    // ... existing implementation unchanged
  }
}
```

- [ ] **Step 12.4: Verify core exports `ORBIT_ERROR_CODES` as a value before re-exporting**

```bash
grep "ORBIT_ERROR_CODES" packages/core/src/types/errors.ts packages/core/src/index.ts
```
Expected: `types/errors.ts` has `export const ORBIT_ERROR_CODES = [...]` and `index.ts` has `export * from './types/errors.js'`. This confirms the value is available from the `@orbit-ai/core` barrel.

(Verified during plan writing: core barrel at line 81 uses `export * from './types/errors.js'`, which re-exports `ORBIT_ERROR_CODES` as a value and `OrbitErrorCode` as a type.)

- [ ] **Step 12.5: Re-export `OrbitErrorCode` and `ORBIT_ERROR_CODES` from sdk index**

Edit `packages/sdk/src/index.ts`. Add near the existing `OrbitApiError` export:

```typescript
export { OrbitClient } from './client.js'
export type { OrbitClientOptions } from './config.js'
export { OrbitApiError } from './errors.js'
// NEW: re-export error code discriminator so consumers can narrow errors
// without reaching into @orbit-ai/core
export { ORBIT_ERROR_CODES } from '@orbit-ai/core'
export type { OrbitErrorCode, OrbitErrorShape } from '@orbit-ai/core'

// ... rest of the existing exports
```

- [ ] **Step 12.6: Rebuild core if needed + run tests**

```bash
pnpm --filter @orbit-ai/core build  # only needed if core types changed; they didn't, but safe
pnpm --filter @orbit-ai/sdk typecheck
pnpm --filter @orbit-ai/sdk test -- error-types
```
Expected: **PASS** — both new test suites green.

- [ ] **Step 12.7: Run full sdk test suite**

```bash
pnpm --filter @orbit-ai/sdk test
```
Expected: 186 + 3 new = **189 passing**.

- [ ] **Step 12.8: Commit**

```bash
git add packages/sdk/src/errors.ts packages/sdk/src/index.ts packages/sdk/src/__tests__/error-types.test.ts
git commit -m "fix(sdk): expose OrbitApiError.code + re-export OrbitErrorCode

DX-ERR-1: the SDK's OrbitApiError wraps the error shape under
err.error.code, which silently compiles as err.code (undefined).
Consumers writing if (err.code === 'RATE_LIMITED') got false always.

DX-ERR-2: OrbitErrorCode was defined in @orbit-ai/core and never
re-exported from @orbit-ai/sdk, so consumers had to import from two
packages to narrow errors.

Adds:
- .code, .request_id, .retryable getters on OrbitApiError (delegate to
  .error.* for the underlying storage)
- Re-exports ORBIT_ERROR_CODES value + OrbitErrorCode type + OrbitErrorShape
  type from the sdk barrel

Both legacy (err.error.code) and new (err.code) access patterns are
supported. Adds error-types.test.ts with 4 new assertions.

Closes DX-ERR-1, DX-ERR-2 from docs/review/2026-04-08-post-stack-audit.md."
```

## Task 13: Remove resource class exports from sdk index

**Files:**
- Modify: `packages/sdk/src/index.ts`

**Problem**: DX-EXPORTS. `BaseResource`, `ContactResource`, `CompanyResource`, etc. are exported from the sdk barrel, polluting autocomplete. Consumers access resources through `client.contacts`, never by constructing `new ContactResource(...)`.

**Strategy**: Remove the class exports, keep the `type` exports (consumers need them for DI / custom transports / typed wrappers). This is technically a breaking change but at `0.0.0` / pre-alpha it's acceptable.

- [ ] **Step 13.1: Read the current index**

```bash
cat packages/sdk/src/index.ts
```

- [ ] **Step 13.2: Remove value exports, keep type exports**

Edit `packages/sdk/src/index.ts`. Remove all the resource CLASS exports:

```typescript
// REMOVE these lines (value exports of resource classes):
// export { BaseResource } from './resources/base-resource.js'
// export { ContactResource } from './resources/contacts.js'
// export { CompanyResource } from './resources/companies.js'
// ... all the XResource class exports

// KEEP these lines (type exports of records and inputs):
export type { ContactRecord, CreateContactInput, UpdateContactInput } from './resources/contacts.js'
export type { CompanyRecord, CreateCompanyInput, UpdateCompanyInput } from './resources/companies.js'
// ... all the XRecord / CreateXInput / UpdateXInput type exports
```

**Keep exported** (these are legitimately consumer-facing values):
- `OrbitClient`
- `OrbitApiError`
- `AutoPager`
- `ORBIT_ERROR_CODES` (just added in Task 12)

**Remove** (internal class values — consumers access via `client.contacts`, never `new ContactResource(...)`):
- `BaseResource`
- `SearchResource` (standalone class taking internal `OrbitTransport` — no consumer would construct it directly; accessed via `client.search`)
- `ContactResource`, `CompanyResource`, `DealResource`, `PipelineResource`, `StageResource`, `UserResource`
- `ActivityResource`, `TaskResource`, `NoteResource`, `ProductResource`, `PaymentResource`, `ContractResource`
- `SequenceResource`, `SequenceStepResource`, `SequenceEnrollmentResource`, `SequenceEventResource`
- `TagResource`, `SchemaResource`, `WebhookResource`, `ImportResource`

- [ ] **Step 13.3: Typecheck + test**

```bash
pnpm --filter @orbit-ai/sdk typecheck
pnpm --filter @orbit-ai/sdk test
```

**Expected issues**:
- Any existing test or import that did `import { ContactResource } from '@orbit-ai/sdk'` will now fail to typecheck.
- Fix by either (a) importing from the internal path `./resources/contacts.js` if it's an internal test, or (b) restructuring the test to use `client.contacts` instead.

- [ ] **Step 13.4: Run full verification**

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Expected: 789 passing (786 baseline + 3 new error-types tests from Task 12). Zero failures from the removal.

- [ ] **Step 13.5: Commit**

```bash
git add packages/sdk/src/index.ts
git commit -m "fix(sdk): stop exporting internal resource classes from the barrel

DX-EXPORTS: BaseResource, ContactResource, CompanyResource, etc. were
exported from @orbit-ai/sdk polluting consumer autocomplete. Consumers
never construct these directly — they access resources via
client.contacts, client.deals, etc. The class exports were noise.

Removes the 22 resource class value exports. Keeps:
- OrbitClient, OrbitApiError, AutoPager, OrbitErrorCode, ORBIT_ERROR_CODES
  (legitimate consumer API)
- All XRecord / CreateXInput / UpdateXInput type exports (consumers need
  these for typed wrappers, DI, and DTO pattern matching)

BREAKING CHANGE at 0.0.0: any internal code that imported a resource
class from the barrel must now import from its internal path. This is
acceptable at pre-alpha.

Closes DX-EXPORTS from docs/review/2026-04-08-post-stack-audit.md."
```

## Task 14: Fix DirectTransport `wrapEnvelope` to populate `links.next`

**Files:**
- Modify: `packages/sdk/src/transport/direct-transport.ts`
- Modify: `packages/sdk/src/__tests__/direct-transport.test.ts` (or add to transport-parity.test.ts)

**Problem**: DT-LINKS (L-ARCH-1 from the post-stack audit). `DirectTransport.wrapEnvelope` sets `links: { self: path }` but omits `links.next`. HttpTransport responses populate `links.next` with a full cursor-augmented URL. Consumers relying on `response.links.next` for cursor-based pagination silently get `undefined` under DirectTransport.

- [ ] **Step 14.1: Read the current wrapEnvelope**

```bash
sed -n '100,140p' packages/sdk/src/transport/direct-transport.ts
```

Capture the current shape.

- [ ] **Step 14.2: Write failing test**

Add to `packages/sdk/src/__tests__/direct-transport.test.ts` (or create a new test if the file doesn't have a suitable describe block):

```typescript
it('wrapEnvelope populates links.next when the service returns a cursor-paginated result', async () => {
  // NOTE: createTestAdapter() is defined locally inside direct-transport.test.ts (line 74).
  // It is NOT an importable utility — it's a local function. Use the existing one in the file.
  const adapter = createTestAdapter()
  const transport = new DirectTransport({
    adapter,
    context: { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' },
    version: '2026-04-01',
  })

  // Mock a paginated service result (data + nextCursor + hasMore)
  const fakeService = {
    list: async () => ({
      data: [{ id: 'cnt_1' }, { id: 'cnt_2' }],
      nextCursor: 'eyJjdXJzb3IiOiJhYmMifQ==',
      hasMore: true,
    }),
  }
  // Inject the mock via services field
  ;(transport as any).services = {
    ...((transport as any).services ?? {}),
    contacts: fakeService,
  }

  const result = await transport.request({
    method: 'GET',
    path: '/v1/contacts',
    query: { limit: 2 },
  })

  expect(result.data).toHaveLength(2)
  expect(result.meta.next_cursor).toBe('eyJjdXJzb3IiOiJhYmMifQ==')
  expect(result.meta.has_more).toBe(true)
  // The critical assertion: links.next should be populated when there's a next cursor
  expect(result.links).toHaveProperty('next')
  expect(typeof result.links.next).toBe('string')
  expect(result.links.next).toContain('cursor=')
})

it('wrapEnvelope leaves links.next undefined when there is no next cursor', async () => {
  const adapter = createTestAdapter()
  const transport = new DirectTransport({
    adapter,
    context: { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY' },
    version: '2026-04-01',
  })

  const fakeService = {
    list: async () => ({
      data: [{ id: 'cnt_1' }],
      nextCursor: null,
      hasMore: false,
    }),
  }
  ;(transport as any).services = {
    ...((transport as any).services ?? {}),
    contacts: fakeService,
  }

  const result = await transport.request({
    method: 'GET',
    path: '/v1/contacts',
  })

  expect(result.links.next).toBeUndefined()
})
```

- [ ] **Step 14.3: Run test to verify it fails**

```bash
pnpm --filter @orbit-ai/sdk test -- direct-transport
```
Expected: **FAIL** — `result.links.next` is undefined even when `hasMore: true`.

- [ ] **Step 14.4: Fix `wrapEnvelope`**

Edit `packages/sdk/src/transport/direct-transport.ts`. Find the `wrapEnvelope` method (at line 147, called from line 79). Replace it with:

```typescript
private wrapEnvelope(
  path: string,
  query: Record<string, unknown> | undefined,
  data: unknown,
): OrbitEnvelope<unknown> {
  const paginated = data as { data?: unknown[]; nextCursor?: string | null; hasMore?: boolean }
  if (
    paginated &&
    typeof paginated === 'object' &&
    'data' in paginated &&
    'hasMore' in paginated
  ) {
    const nextCursor = paginated.nextCursor ?? null
    // Build links.next to match HttpTransport's shape: the same path with the
    // cursor query param replaced (and limit preserved). Undefined when there
    // is no next page.
    const links: { self: string; next?: string } = { self: path }
    if (nextCursor !== null) {
      const params = new URLSearchParams()
      if (query?.limit !== undefined) params.set('limit', String(query.limit))
      if (query?.include !== undefined) params.set('include', String(query.include))
      params.set('cursor', nextCursor)
      links.next = `${path}?${params.toString()}`
    }
    return {
      data: paginated.data as unknown,
      meta: {
        request_id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`,
        cursor: null,
        next_cursor: nextCursor,
        has_more: paginated.hasMore ?? false,
        version: this.options.version ?? '2026-04-01',
      },
      links,
    }
  }
  // Single-resource response: no next link
  return {
    data: data as unknown,
    meta: {
      request_id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 26)}`,
      cursor: null,
      next_cursor: null,
      has_more: false,
      version: this.options.version ?? '2026-04-01',
    },
    links: { self: path },
  }
}
```

Note: the method signature changes from `wrapEnvelope(path, data)` to `wrapEnvelope(path, query, data)`. Update the caller in `request()` to pass `input.query`:

```typescript
async request<T>(input: TransportRequest): Promise<OrbitEnvelope<T>> {
  try {
    const result = await this.options.adapter!.withTenantContext(this.ctx, async () => {
      return this.dispatch(input)
    })
    return this.wrapEnvelope(input.path, input.query, result) as OrbitEnvelope<T>
    //                                    ^^^^^^^^^^^ NEW
  } catch (err: unknown) {
    // ... existing error handling unchanged
  }
}
```

- [ ] **Step 14.5: Run tests**

```bash
pnpm --filter @orbit-ai/sdk test -- direct-transport
```
Expected: **PASS** — both new assertions green.

```bash
pnpm --filter @orbit-ai/sdk test
```
Expected: 191 passing (189 + 2 new). Check that existing parity tests still pass.

- [ ] **Step 14.6: Commit**

```bash
git add packages/sdk/src/transport/direct-transport.ts packages/sdk/src/__tests__/direct-transport.test.ts
git commit -m "fix(sdk): populate links.next in DirectTransport wrapEnvelope

DT-LINKS / L-ARCH-1: DirectTransport's wrapEnvelope omitted links.next
entirely — only links.self was populated. HttpTransport responses
populate links.next with a full cursor-augmented URL when hasMore is
true. Consumers using response.links.next for cursor-based pagination
silently got undefined under DirectTransport, causing pagination to
silently stop.

Fix: wrapEnvelope now also receives the input query, and when the
service returns a paginated result with a non-null nextCursor, it
builds links.next by preserving the path + limit + include params and
appending cursor=<nextCursor>. When there is no next page, links.next
is explicitly undefined.

Two new tests lock the behavior.

Closes DT-LINKS from docs/review/2026-04-08-post-stack-audit.md."
```

---

**✋ PHASE 4 CHECKPOINT** — main session:

```bash
git log --oneline b177670..HEAD
# Expected: 18 commits total (1 plan + 4 Phase 1 + 9 Phase 2 + 1 CI + 3 SDK DX)

pnpm -r typecheck && pnpm -r lint && pnpm -r test 2>&1 | tail -5
# Expected: ~791 passing (786 + 3 error-types + 2 direct-transport)

# Quick sanity: the SDK barrel no longer exports internal classes
node -e "const sdk = require('./packages/sdk/dist/index.js'); const names = Object.keys(sdk); console.log('sdk exports:', names.length, 'symbols'); console.log(names.filter(n => n.endsWith('Resource')));"
# Expected: empty array for the filter (no XResource class exports). Value count should be smaller than before.

git push origin pr-4-cleanups-and-docs
```

---

# Phase 5 — Functional closures

## Task 15: Merged-search OOM cap enforcement

**Files:**
- Modify: `packages/core/src/services/search-service.ts`
- Modify: `packages/core/src/services/__tests__/search-service.test.ts` (222 lines, the main search test file)

> **Note**: there are TWO search test files: `services/__tests__/search-service.test.ts` (222 lines, the comprehensive one) and `services/search-service.test.ts` (93 lines, a lighter one). Add the new test to the `__tests__/` variant — that's where the existing search logic tests live.

**Problem**: SCALE-SEARCH. `search-service.ts` does `Promise.all([fetchAllPages × 6])` when `object_types` is unset, fanning out to 6 repositories (companies, contacts, deals, pipelines, stages, users) simultaneously at up to `MAX_SEARCH_ROWS_PER_TYPE = 5000` rows each. Worst case: 30,000 rows materialized in memory. Code comment explicitly flags this as "OOM-prone pending registry-driven rewrite."

**Strategy**: The full registry-driven rewrite is Phase 3 T10. For alpha, the defensive fix is to enforce an **absolute total cap** of `MAX_SEARCH_TOTAL_ROWS = 5000` (same as per-type cap) across the fan-out — if the combined rows exceed it, throw `SEARCH_RESULT_TOO_LARGE` instead of silently materializing 30k rows. This keeps the feature usable but prevents the OOM trap.

- [ ] **Step 15.1: Read the current search service**

```bash
grep -n "MAX_SEARCH_ROWS_PER_TYPE\|Promise.all\|object_types" packages/core/src/services/search-service.ts
```

Find the fan-out loop and understand the current structure.

- [ ] **Step 15.2: Write failing test**

Add to `packages/core/src/services/__tests__/search-service.test.ts`:

```typescript
it('throws SEARCH_RESULT_TOO_LARGE when merged search total exceeds MAX_SEARCH_TOTAL_ROWS', async () => {
  // Build a fake search dependency bag where each of 6 entity types returns
  // 1000 rows → 6000 total, which exceeds the 5000 total cap.
  const makeRows = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}_${i}` }))

  // NOTE: the actual fan-out targets the 6 repositories wired in createSearchService:
  // companies, contacts, deals, pipelines, stages, users — NOT activities/tasks/notes.
  const searchDeps = {
    contacts: { search: async () => ({ data: makeRows('cnt', 1000), hasMore: false, nextCursor: null }) },
    companies: { search: async () => ({ data: makeRows('cmp', 1000), hasMore: false, nextCursor: null }) },
    deals: { search: async () => ({ data: makeRows('deal', 1000), hasMore: false, nextCursor: null }) },
    pipelines: { search: async () => ({ data: makeRows('pip', 1000), hasMore: false, nextCursor: null }) },
    stages: { search: async () => ({ data: makeRows('stg', 1000), hasMore: false, nextCursor: null }) },
    users: { search: async () => ({ data: makeRows('usr', 1000), hasMore: false, nextCursor: null }) },
  } as any

  const searchService = createSearchService(searchDeps)
  const ctx = { orgId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY', scopes: ['*'] } as any

  await expect(
    searchService.search(ctx, { q: 'test', limit: 100 }),
  ).rejects.toThrow(/SEARCH_RESULT_TOO_LARGE/)
})
```

(Adjust the `createSearchService` import and factory signature to match the actual code — read the file to find the real constructor.)

- [ ] **Step 15.3: Run test to verify it fails**

```bash
pnpm --filter @orbit-ai/core test -- search-service
```
Expected: **FAIL** — currently returns all 6000 rows sliced to 100, no error thrown.

- [ ] **Step 15.4: Add the total-cap check**

Edit `packages/core/src/services/search-service.ts`. Near the top of the file (next to the existing `MAX_SEARCH_ROWS_PER_TYPE` constant), add:

```typescript
const MAX_SEARCH_ROWS_PER_TYPE = 5000 // existing
const MAX_SEARCH_TOTAL_ROWS = 5000    // NEW: hard cap on the combined merged result

// Keep the comment explaining the registry-driven rewrite plan
```

In the search method, after the `Promise.all` fan-out and before the merge/sort, add the total check:

```typescript
// ... existing Promise.all fan-out that produces `results: Array<{ type, data, ... }>`

const totalRows = results.reduce((sum, r) => sum + (r.data?.length ?? 0), 0)
if (totalRows > MAX_SEARCH_TOTAL_ROWS) {
  throw createOrbitError({
    code: 'SEARCH_RESULT_TOO_LARGE',
    message: `Merged search returned ${totalRows} rows, exceeding MAX_SEARCH_TOTAL_ROWS=${MAX_SEARCH_TOTAL_ROWS}`,
    hint: 'Pass object_types to narrow the search to specific entity types, or use a more specific query',
    retryable: false,
  })
}

// ... existing merge + sort + slice logic unchanged
```

**Important**: this file uses `createOrbitError` (imported from `'../types/errors.js'`), NOT `new OrbitError(...)`. The existing per-type cap check at line 77 already uses `createOrbitError` — follow the same pattern. If `createOrbitError` is not already imported, it will be (the file already imports it for the per-type cap).

- [ ] **Step 15.5: Run test to verify it passes**

```bash
pnpm --filter @orbit-ai/core test -- search-service
```
Expected: **PASS**. Also verify no existing search tests regress.

- [ ] **Step 15.6: Full core verification**

```bash
pnpm --filter @orbit-ai/core build
pnpm --filter @orbit-ai/core test
```
Expected: 322 passing (321 + 1 new test).

- [ ] **Step 15.7: Commit**

```bash
git add packages/core/src/services/search-service.ts packages/core/src/services/__tests__/search-service.test.ts
git commit -m "fix(core): cap merged search total rows to prevent OOM fan-out

SCALE-SEARCH: search-service.ts does Promise.all across 6 entity
types when object_types is unset, fanning out to up to
MAX_SEARCH_ROWS_PER_TYPE=5000 rows each — worst case 30,000 rows
materialized in memory. The code comment explicitly flagged this as
'OOM-prone pending registry-driven rewrite'.

The registry-driven rewrite is Phase 3 T10 and too large for alpha.
As a defensive stopgap, this commit adds MAX_SEARCH_TOTAL_ROWS=5000
as an absolute cap across the fan-out. If the combined result exceeds
the cap, the search throws SEARCH_RESULT_TOO_LARGE with a hint to use
object_types. The cap preserves the feature for normal queries while
closing the OOM trap.

Closes SCALE-SEARCH from docs/review/2026-04-08-post-stack-audit.md.
T10 (registry-driven search) remains Phase 3 scope for a real fix."
```

## Task 16: Pluggable idempotency store interface

**Files:**
- Modify: `packages/api/src/middleware/idempotency.ts`
- Modify: `packages/api/src/config.ts`
- Modify: `packages/api/src/create-api.ts`

**Problem**: SCALE-IDEM. The audit finding is "in-memory idempotency + rate limit stores with no documentation." Current idempotency uses a module-scope `Map`. Multi-instance deployments silently have zero idempotency. The `idempotency_keys` DB table exists but is unused.

**Strategy**: Full DB-wiring is Phase 3 T12. For alpha, this task closes the **idempotency extensibility** half of SCALE-IDEM plus **documentation of the rate-limit limitation**:
1. Extract the in-memory Map behavior behind an `IdempotencyStore` interface
2. Default to `MemoryIdempotencyStore` (current behavior, now an explicit class)
3. Accept an optional `idempotencyStore?: IdempotencyStore` in `CreateApiOptions`
4. Document the single-instance default loudly in the README (already done in Task 6) and in JSDoc (Task 17)

**What this task does NOT close**: the rate-limit store is NOT made pluggable in this plan. Rate limiting remains in-memory-only with no extension seam. Task 17's JSDoc documents this constraint explicitly, and the README (Task 6) calls it out. A `RateLimitStore` interface is Phase 3 scope.

This gives consumers a clear extension point for idempotency: when they need multi-instance idempotency, they implement `IdempotencyStore` (backed by Redis, the `idempotency_keys` table, etc.) and pass it via config.

- [ ] **Step 16.1: Write failing test**

Add to `packages/api/src/__tests__/idempotency.test.ts` (inside the existing describe block, before line 127 or whatever it is now):

```typescript
it('uses a custom IdempotencyStore when provided via CreateApiOptions', async () => {
  const calls: string[] = []
  const customStore = {
    async get(key: string) {
      calls.push(`get:${key}`)
      return undefined
    },
    async set(key: string, value: any) {
      calls.push(`set:${key}`)
    },
    async evictExpired() {
      calls.push('evictExpired')
    },
  }

  const app = new Hono()
  app.onError(orbitErrorHandler)
  app.use('*', requestIdMiddleware())
  app.use('*', async (c, next) => {
    c.set('orbit', { orgId: 'org_test', scopes: ['*'] })
    await next()
  })
  app.use('*', idempotencyMiddleware({ store: customStore as any }))

  app.post('/v1/contacts', async (c) => {
    const body = await c.req.json()
    return c.json({ id: 'ct_001', name: body.name }, 201)
  })

  const res = await app.request('/v1/contacts', {
    method: 'POST',
    body: JSON.stringify({ name: 'Alice' }),
    headers: {
      'idempotency-key': 'idem_custom_001',
      'content-type': 'application/json',
    },
  })
  expect(res.status).toBe(201)

  // Custom store's methods should have been called
  expect(calls).toContain('get:org_test:POST:/v1/contacts:idem_custom_001')
  expect(calls.some((c) => c.startsWith('set:'))).toBe(true)
})
```

- [ ] **Step 16.2: Run test to verify it fails**

```bash
pnpm --filter @orbit-ai/api test -- idempotency
```
Expected: **FAIL** — `idempotencyMiddleware` doesn't accept a `store` option yet.

- [ ] **Step 16.3: Refactor `idempotency.ts` to the interface pattern**

Edit `packages/api/src/middleware/idempotency.ts`. Add the interface at the top:

```typescript
import type { MiddlewareHandler } from 'hono'
import { OrbitError } from '@orbit-ai/core'
import '../context.js'

/**
 * Interface for idempotency key storage. Implementations can be in-memory
 * (default, single-instance only), Redis-backed, or DB-backed (see the
 * idempotency_keys table in @orbit-ai/core for the schema).
 *
 * For multi-instance deployments you MUST provide a custom implementation
 * via CreateApiOptions.idempotencyStore — the default MemoryIdempotencyStore
 * is process-local and will silently fail to replay across instances.
 */
export interface IdempotencyStore {
  get(key: string): Promise<StoredResponse | undefined>
  set(key: string, value: StoredResponse): Promise<void>
  evictExpired(): Promise<void>
}

export interface StoredResponse {
  status: number
  body: string
  requestHash: string
  createdAt: number
}

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_STORE_SIZE = 10_000

/**
 * Default in-memory idempotency store. Single-instance only — use a custom
 * IdempotencyStore (e.g. backed by Redis or the idempotency_keys DB table)
 * for multi-instance deployments.
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, StoredResponse>()

  async get(key: string): Promise<StoredResponse | undefined> {
    return this.store.get(key)
  }

  async set(key: string, value: StoredResponse): Promise<void> {
    this.store.set(key, value)
    if (this.store.size > MAX_STORE_SIZE) {
      const oldest = this.store.keys().next().value
      if (oldest) this.store.delete(oldest)
    }
  }

  async evictExpired(): Promise<void> {
    const now = Date.now()
    for (const [k, v] of this.store) {
      if (now - v.createdAt > TTL_MS) this.store.delete(k)
    }
  }

  /** Exposed for tests only. */
  _reset(): void {
    this.store.clear()
  }
}

// Shared singleton used when no custom store is provided (preserves current behavior)
const defaultStore = new MemoryIdempotencyStore()

/** Exposed for tests only — resets the default shared store. */
export function _resetIdempotencyStore(): void {
  defaultStore._reset()
}

export interface IdempotencyMiddlewareOptions {
  store?: IdempotencyStore
}

export function idempotencyMiddleware(
  options: IdempotencyMiddlewareOptions = {},
): MiddlewareHandler {
  const store = options.store ?? defaultStore

  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      await next()
      return
    }

    // Bootstrap exemption (from Fix Pass B, commit a1724e7)
    if (c.req.path.startsWith('/v1/bootstrap/')) {
      await next()
      return
    }

    const key = c.req.header('idempotency-key')
    if (!key) {
      await next()
      return
    }

    await store.evictExpired()

    const orgId = c.get('orbit')?.orgId ?? 'unknown'
    const routeKey = `${orgId}:${c.req.method}:${c.req.path}:${key}`
    const existing = await store.get(routeKey)

    let bodyText = ''
    try {
      const parsed = await c.req.json()
      bodyText = JSON.stringify(parsed)
    } catch {
      // no body or not JSON
    }
    const currentHash = bodyText || 'null'

    if (existing) {
      if (currentHash !== existing.requestHash) {
        throw new OrbitError({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key already used with different request body',
          retryable: false,
        })
      }
      c.header('idempotency-key', key)
      c.header('x-idempotent-replayed', 'true')
      return c.json(
        JSON.parse(existing.body),
        existing.status as Parameters<typeof c.json>[1],
      )
    }

    await next()

    const cloned = c.res.clone()
    const responseBody = await cloned.text()
    await store.set(routeKey, {
      status: c.res.status,
      body: responseBody,
      requestHash: currentHash,
      createdAt: Date.now(),
    })

    c.header('idempotency-key', key)
  }
}
```

- [ ] **Step 16.4: Wire the option through `config.ts` and `create-api.ts`**

Edit `packages/api/src/config.ts`. Add:

```typescript
import type { IdempotencyStore } from './middleware/idempotency.js'

export interface CreateApiOptions {
  // ... existing fields

  /**
   * Custom idempotency store. If omitted, a single-instance in-memory store
   * is used (MemoryIdempotencyStore). For multi-instance deployments you MUST
   * provide a custom implementation, otherwise idempotency silently fails
   * across instances.
   */
  idempotencyStore?: IdempotencyStore
}
```

Edit `packages/api/src/create-api.ts`. Find the `app.use('/v1/*', idempotencyMiddleware())` line and change to:

```typescript
app.use('/v1/*', idempotencyMiddleware({ store: options.idempotencyStore }))
```

- [ ] **Step 16.4b: Add a createApi-level wiring test**

The test in Step 16.1 exercises `idempotencyMiddleware({ store })` directly. Add a second test that proves the `CreateApiOptions.idempotencyStore` wiring works end-to-end through `createApi`:

```typescript
it('createApi({ idempotencyStore }) wires the custom store end-to-end', async () => {
  const calls: string[] = []
  const customStore = {
    async get(key: string) { calls.push(`get:${key}`); return undefined },
    async set(key: string, value: any) { calls.push(`set:${key}`) },
    async evictExpired() { calls.push('evictExpired') },
  }

  // Use the real createApi with a custom idempotencyStore
  const adapter = createTestAdapter() // whatever helper produces a RuntimeApiAdapter
  const app = createApi({
    adapter,
    version: '2026-04-01',
    idempotencyStore: customStore as any,
  })

  const res = await app.request('/v1/contacts', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test' }),
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'sk_test_valid',
      'idempotency-key': 'idem_e2e_001',
    },
  })

  // The custom store should have been called (get at minimum)
  expect(calls.some(c => c.startsWith('get:'))).toBe(true)
})
```

(Adjust the test adapter factory and auth header to match whatever the existing idempotency tests use. The point is to prove `createApi` actually passes the store through — not to re-test idempotency logic.)

- [ ] **Step 16.5: Run tests**

```bash
pnpm --filter @orbit-ai/api test -- idempotency
```
Expected: **PASS** — all existing tests still pass AND both new tests pass (middleware-level custom store + createApi-level wiring).

- [ ] **Step 16.6: Commit**

```bash
git add packages/api/src/middleware/idempotency.ts packages/api/src/config.ts packages/api/src/create-api.ts packages/api/src/__tests__/idempotency.test.ts
git commit -m "feat(api): introduce IdempotencyStore interface with in-memory default

SCALE-IDEM: in-memory idempotency silently broken on multi-instance
deployments (every pod has its own Map). The idempotency_keys DB table
exists but is unused. Full DB wiring is Phase 3 T12.

This commit is the minimum-viable alpha fix: extract the current
behavior behind an IdempotencyStore interface with a MemoryIdempotencyStore
default. Consumers who need multi-instance idempotency can now pass a
custom implementation via CreateApiOptions.idempotencyStore — e.g.
backed by Redis or the idempotency_keys table.

Preserves all existing behavior for single-instance deployments
(default path unchanged). Adds an explicit seam + docs so consumers
understand the constraint and know the escape hatch.

Closes SCALE-IDEM from docs/review/2026-04-08-post-stack-audit.md.
Phase 3 T12 (persistent idempotency) still tracked separately."
```

## Task 17: Document the single-instance constraints in create-api JSDoc

**Files:**
- Modify: `packages/api/src/create-api.ts`

**Problem**: Even with the `IdempotencyStore` interface, a consumer who doesn't read the README will use the default and hit the multi-instance trap. Add a loud JSDoc warning on `createApi` itself.

- [ ] **Step 17.1: Edit create-api.ts**

Add a JSDoc block above the `createApi` function export:

```typescript
/**
 * Create an Orbit AI Hono app with the full middleware chain:
 * `requestId → version → bodyLimit → auth → tenantContext → rateLimit → idempotency → routes`.
 *
 * @security **Single-instance defaults**: by default this function uses
 * in-memory stores for both idempotency (`MemoryIdempotencyStore`) and
 * rate limiting. These are **single-instance only** — on multi-pod
 * deployments (Vercel, Cloudflare Workers, horizontal Kubernetes pods)
 * every instance has its own memory, which silently disables both
 * guards.
 *
 * For multi-instance deployments you MUST:
 * - Provide a custom `idempotencyStore` via `CreateApiOptions` (back it
 *   with Redis, Upstash, or the `idempotency_keys` DB table)
 * - Plan for a shared-store rate limiter (tracked as Phase 3 T12 —
 *   the default in-memory limiter remains the only option until then)
 *
 * For single-pod / serverless-with-sticky-sessions / local-dev, the
 * defaults are safe.
 *
 * @example
 * ```ts
 * import { createApi } from '@orbit-ai/api/node'
 * import { createPostgresStorageAdapter, createCoreServices } from '@orbit-ai/core'
 *
 * const adapter = createPostgresStorageAdapter({ ... })
 * const services = createCoreServices(adapter)
 * const app = createApi({
 *   adapter,
 *   services,
 *   version: '2026-04-01',
 *   // For multi-instance deployments, uncomment:
 *   // idempotencyStore: new MyRedisBackedStore(redisClient),
 * })
 * ```
 */
export function createApi(options: CreateApiOptions) {
  // ... existing implementation
}
```

No test changes — this is JSDoc only.

- [ ] **Step 17.2: Build and verify docs render**

```bash
pnpm --filter @orbit-ai/api build
```
Expected: clean build. The JSDoc is extracted into the `.d.ts` file.

```bash
grep -A 5 "@security" packages/api/dist/create-api.d.ts
```
Expected: the @security warning appears in the generated `.d.ts` so IDE tooltips show it.

- [ ] **Step 17.3: Commit**

```bash
git add packages/api/src/create-api.ts
git commit -m "docs(api): add @security JSDoc warning to createApi about single-instance defaults

SCALE-IDEM follow-up: even with the IdempotencyStore interface added
in the previous commit, a consumer who doesn't read the README will
use the defaults and hit the multi-instance trap.

Adds a loud @security JSDoc block on createApi() explaining:
- Default idempotency and rate limit stores are single-instance only
- Multi-instance deployments MUST provide a custom idempotencyStore
- When the defaults are safe (single-pod, serverless sticky, local dev)
- Links to Phase 3 T12 for the persistent idempotency tracking

The warning appears in the generated .d.ts so IDE tooltips surface it.

Closes the documentation half of SCALE-IDEM."
```

---

**✋ PHASE 5 CHECKPOINT** — main session:

```bash
git log --oneline b177670..HEAD
# Expected: 21 commits (18 after Phase 4 + 3 functional closures)

pnpm -r test 2>&1 | tail -5
# Expected: ~794 passing (789 after Phase 4 + 1 search + 1 idempotency + 3 others if any)

git push origin pr-4-cleanups-and-docs
```

Verify CI passes on GitHub.

---

# Phase 6 — Working example + end-to-end integration test

## Task 18: Create `examples/nodejs-quickstart/` with real end-to-end smoke test

**Files:**
- Create: `examples/nodejs-quickstart/package.json`
- Create: `examples/nodejs-quickstart/tsconfig.json`
- Create: `examples/nodejs-quickstart/src/index.ts`
- Create: `examples/nodejs-quickstart/README.md`
- Modify: `.github/workflows/ci.yml` (uncomment the smoke test step — or the conditional from Task 11 activates automatically)
- Modify: `pnpm-workspace.yaml` (if needed, to include `examples/*`)

**Problem**: EX-1 + TEST-E2E. No working consumer example. No real end-to-end integration test. Both can be closed by a single `examples/nodejs-quickstart/` that is:
- A real consumer example anyone can run from a fresh clone
- Wired into CI as a smoke test that mounts `createApi` + real SQLite adapter + SDK and exercises CRUD end-to-end

This is the most complex task in the plan — it has the most file creations — but each piece is small.

- [ ] **Step 18.1: Confirm pnpm workspace already includes `examples/*`**

```bash
cat pnpm-workspace.yaml
```

Expected: `examples/*` is already listed (verified — it's in the current `pnpm-workspace.yaml`). No modification needed. If for some reason it's missing, add it — but it shouldn't be.

- [ ] **Step 18.2: Create the example directory and package.json**

```bash
mkdir -p examples/nodejs-quickstart/src
```

Write `examples/nodejs-quickstart/package.json`:

```json
{
  "name": "orbit-ai-nodejs-quickstart",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Runnable quickstart showing @orbit-ai/sdk against a local in-memory SQLite adapter",
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "tsx src/index.ts"
  },
  "dependencies": {
    "@orbit-ai/core": "workspace:*",
    "@orbit-ai/api": "workspace:*",
    "@orbit-ai/sdk": "workspace:*",
    "drizzle-orm": "^0.44.7"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.2"
  }
}
```

> **Note**: `drizzle-orm` is required because `src/index.ts` imports `{ sql }` from `'drizzle-orm'` for the organization seed query. Including it upfront avoids a runtime `MODULE_NOT_FOUND` error on first run.

Write `examples/nodejs-quickstart/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 18.3: Write the quickstart source**

Write `examples/nodejs-quickstart/src/index.ts`:

```typescript
/**
 * Orbit AI — Node.js quickstart + end-to-end smoke test.
 *
 * What this does:
 * 1. Spins up an in-memory SQLite adapter with the full Orbit schema
 * 2. Mounts the @orbit-ai/api Hono app against it
 * 3. Uses @orbit-ai/sdk over a local fetch intercept (so HTTP transport
 *    hits the in-memory app, not the network)
 * 4. Exercises CRUD on contacts: list → create → list → get → update → delete
 * 5. Also exercises the DirectTransport path
 * 6. Exits 0 on success, non-zero on any failure
 *
 * This file doubles as the CI smoke test (see .github/workflows/ci.yml).
 *
 * Run locally:
 *   cd examples/nodejs-quickstart
 *   pnpm start
 */

import {
  createSqliteStorageAdapter,
  createSqliteOrbitDatabase,
  createCoreServices,
  initializeAllSqliteSchemas,
} from '@orbit-ai/core'
import { createApi } from '@orbit-ai/api/node'
import { OrbitClient, OrbitApiError } from '@orbit-ai/sdk'
import { sql } from 'drizzle-orm'

const ORG_ID = 'org_01HZ000000000000000000ABCD'

async function main() {
  console.log('=== Orbit AI Node.js quickstart ===\n')

  // ── 1. Bootstrap the adapter + schema ─────────────────────────────────
  const db = createSqliteOrbitDatabase() // :memory:
  await initializeAllSqliteSchemas(db)

  // Seed the organization so tenant-scoped queries have a valid orgId
  await db.execute(sql.raw(
    `insert into organizations (id, name, slug, plan, is_active, settings, created_at, updated_at) ` +
    `values ('${ORG_ID}', 'Quickstart Org', 'quickstart', 'community', 1, '{}', '${new Date().toISOString()}', '${new Date().toISOString()}')`,
  ))

  const adapter = createSqliteStorageAdapter({
    database: db,
    lookupApiKeyForAuth: async () => ({
      id: 'key_01HZ000000000000000000ABCD',
      organizationId: ORG_ID,
      scopes: ['*'],
      revokedAt: null,
      expiresAt: null,
    }),
  })

  const services = createCoreServices(adapter)
  console.log('[setup] adapter + schema + services ready')

  // ── 2. Mount the API ─────────────────────────────────────────────────
  const app = createApi({ adapter, version: '2026-04-01', services })
  console.log('[setup] @orbit-ai/api mounted')

  // ── 3. Point the SDK's fetch at the in-memory app ────────────────────
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
    const path = url.replace('http://orbit.local', '')
    return app.request(path, init)
  }) as typeof fetch

  const client = new OrbitClient({
    apiKey: 'sk_test_valid',
    baseUrl: 'http://orbit.local',
    version: '2026-04-01',
    maxRetries: 0,
  })
  console.log('[setup] @orbit-ai/sdk HTTP transport ready\n')

  // ── 4. CRUD via HTTP transport ───────────────────────────────────────
  console.log('=== HTTP transport CRUD ===')

  const emptyPage = await client.contacts.list({ limit: 5 })
  assertEqual(emptyPage.data.length, 0, 'initial contacts list should be empty')
  console.log('[http] initial list: 0 contacts ✓')

  const created = await client.contacts.create({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  })
  assertTruthy(created.id, 'created contact should have an id')
  console.log(`[http] created contact: ${created.id} ✓`)

  const afterPage = await client.contacts.list({ limit: 5 })
  assertEqual(afterPage.data.length, 1, 'list after create should have 1 contact')
  console.log('[http] list after create: 1 contact ✓')

  const fetched = await client.contacts.get(created.id)
  assertEqual(fetched.id, created.id, 'fetched id should match created id')
  assertEqual(fetched.name, 'Ada Lovelace', 'fetched name should match')
  console.log('[http] get by id ✓')

  const updated = await client.contacts.update(created.id, {
    email: 'ada+new@example.com',
  })
  assertEqual(updated.email, 'ada+new@example.com', 'updated email should apply')
  console.log('[http] update ✓')

  // Error path: get a nonexistent contact should throw OrbitApiError
  try {
    await client.contacts.get('contact_01HZZZZZZZZZZZZZZZZZZZZZZZ')
    throw new Error('expected OrbitApiError on nonexistent get')
  } catch (err) {
    if (!(err instanceof OrbitApiError)) throw err
    assertEqual(err.code, 'RESOURCE_NOT_FOUND', 'error code should be RESOURCE_NOT_FOUND')
    assertEqual(err.status, 404, 'error status should be 404')
    console.log(`[http] error path: ${err.code} / ${err.status} ✓`)
  }

  await client.contacts.delete(created.id)
  const afterDelete = await client.contacts.list({ limit: 5 })
  assertEqual(afterDelete.data.length, 0, 'list after delete should be empty')
  console.log('[http] delete ✓\n')

  // ── 5. DirectTransport CRUD ──────────────────────────────────────────
  console.log('=== DirectTransport CRUD ===')

  const directClient = new OrbitClient({
    adapter,
    context: { orgId: ORG_ID },
    version: '2026-04-01',
  })

  const directCreated = await directClient.contacts.create({
    name: 'Grace Hopper',
    email: 'grace@example.com',
  })
  assertTruthy(directCreated.id, 'direct-transport created contact should have an id')
  console.log(`[direct] created contact: ${directCreated.id} ✓`)

  const directPage = await directClient.contacts.list({ limit: 5 })
  assertEqual(directPage.data.length, 1, 'direct-transport list should have 1 contact')
  console.log('[direct] list ✓\n')

  console.log('=== All smoke tests passed ===')
}

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    console.error(`ASSERTION FAILED: ${msg}`)
    console.error(`  expected: ${JSON.stringify(expected)}`)
    console.error(`  actual:   ${JSON.stringify(actual)}`)
    process.exit(1)
  }
}

function assertTruthy(actual: unknown, msg: string): void {
  if (!actual) {
    console.error(`ASSERTION FAILED: ${msg}`)
    console.error(`  actual: ${JSON.stringify(actual)}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('QUICKSTART FAILED:', err)
  process.exit(1)
})
```

- [ ] **Step 18.4: Create the example README**

Write `examples/nodejs-quickstart/README.md`:

```markdown
# Orbit AI — Node.js quickstart

A runnable script that exercises `@orbit-ai/core`, `@orbit-ai/api`, and
`@orbit-ai/sdk` end-to-end against an in-memory SQLite adapter. No network,
no setup, no secrets.

This is both a learning example and the repo's CI smoke test — if the
quickstart breaks, CI fails.

## Running

From the repo root:

```bash
pnpm install
pnpm -r build
cd examples/nodejs-quickstart
pnpm start
```

Expected output: a series of `[http] ... ✓` and `[direct] ... ✓` lines
ending with `=== All smoke tests passed ===`. Any failure exits with
non-zero status and prints what went wrong.

## What it demonstrates

1. Spinning up the Orbit schema on an in-memory SQLite adapter
2. Mounting the `@orbit-ai/api` Hono app against that adapter
3. Using `@orbit-ai/sdk` over a local `fetch` intercept (so HTTP calls hit
   the in-memory app instead of going to the network)
4. CRUD on contacts: `list` → `create` → `list` → `get` → `update` → `delete`
5. Error handling: getting a nonexistent contact throws `OrbitApiError`
   with a discriminated `code`
6. The same CRUD flow via `DirectTransport` (in-process, no HTTP)

## Files

- `src/index.ts` — the quickstart script
- `package.json` — minimal workspace package pointing at `@orbit-ai/*` via `workspace:*`
- `tsconfig.json` — ESM + NodeNext module resolution

## Customizing

To point the SDK at a real Orbit API server (not the in-memory app),
remove the `globalThis.fetch = ...` monkeypatch and set `baseUrl` to your
real server URL.

To use a real Postgres adapter, replace `createSqliteOrbitDatabase` +
`initializeAllSqliteSchemas` with `createPostgresStorageAdapter` — see
the [root README](../../README.md) for the full adapter list.
```

- [ ] **Step 18.5: Install and run locally**

```bash
pnpm install
pnpm -r build   # Must build ALL packages — the quickstart imports from @orbit-ai/api/node
                 # which resolves to dist/node.js. If only core is built, the api import fails
                 # with "Cannot find module".
cd examples/nodejs-quickstart
pnpm start
cd ../..
```

Expected: the quickstart runs end-to-end and exits 0, printing the `✓` success lines. If anything fails, investigate before committing.

**Note**: `drizzle-orm` is already listed in the package.json (Step 18.2) — no runtime `MODULE_NOT_FOUND` surprises. The explicit `initializeAllSqliteSchemas(db)` call in the quickstart is belt-and-suspenders (safe, idempotent due to `CREATE TABLE IF NOT EXISTS`). Leave it for clarity.

- [ ] **Step 18.6: Confirm CI workflow picks up the smoke test**

The CI workflow from Task 11 already has a conditional step for `examples/nodejs-quickstart` — the condition `-d "examples/nodejs-quickstart"` is now true, so the step will activate on next push.

No changes needed to the workflow file.

- [ ] **Step 18.7: Commit**

```bash
git add examples/nodejs-quickstart pnpm-lock.yaml
git commit -m "feat(examples): add nodejs-quickstart + CI smoke test

Closes EX-1 + TEST-E2E: no runnable consumer example, no real
end-to-end integration test. A single example directory closes both
by serving as a learning artifact AND as the CI smoke test.

What it does:
1. In-memory SQLite adapter bootstrapped with the full Orbit schema
2. @orbit-ai/api Hono app mounted against it
3. @orbit-ai/sdk exercises CRUD over a local fetch intercept (HTTP
   transport against the in-memory app) — list, create, list, get,
   update, delete, error path for RESOURCE_NOT_FOUND
4. Same CRUD flow via DirectTransport (in-process)
5. Exits 0 on success, non-zero on any assertion failure

The CI workflow from Task 11 already has a conditional step that runs
'cd examples/nodejs-quickstart && pnpm start' when the directory
exists — this commit activates that step.

pnpm-workspace.yaml already includes examples/* — no modification
needed.

Closes EX-1, TEST-E2E from docs/review/2026-04-08-post-stack-audit.md."
```

---

**✋ PHASE 6 CHECKPOINT** — main session:

```bash
git log --oneline b177670..HEAD
# Expected: 22 commits (21 after Phase 5 + 1 example)

# Run the quickstart manually to sanity-check
cd examples/nodejs-quickstart && pnpm start && cd ../..
# Expected: clean exit 0, all ✓ lines

pnpm -r test 2>&1 | tail -5
# Expected: ~794 passing (unchanged from Phase 5; the example is a smoke test, not a vitest suite)

git push origin pr-4-cleanups-and-docs
```

Watch CI — the smoke test step should now activate and pass.

---

# Phase 7 — Full verification + version bump

## Task 19: Version bump to `0.1.0-alpha.0` across all 3 packages

**Files:**
- Modify: `packages/core/package.json` (version)
- Modify: `packages/api/package.json` (version)
- Modify: `packages/sdk/package.json` (version)

- [ ] **Step 19.1: Bump all 3 packages to `0.1.0-alpha.0`**

```bash
node -e "
const fs = require('fs');
for (const pkg of ['core', 'api', 'sdk']) {
  const path = \`packages/\${pkg}/package.json\`;
  const p = JSON.parse(fs.readFileSync(path, 'utf8'));
  p.version = '0.1.0-alpha.0';
  fs.writeFileSync(path, JSON.stringify(p, null, 2) + '\n');
  console.log(pkg, '→', p.version);
}
"
```

- [ ] **Step 19.2: Cross-package dependencies**

If `@orbit-ai/api` or `@orbit-ai/sdk` depend on `@orbit-ai/core` with an explicit version (rather than `workspace:*`), bump those references too. Check:

```bash
grep -n '"@orbit-ai/core"' packages/api/package.json packages/sdk/package.json
grep -n '"@orbit-ai/sdk"' packages/api/package.json  # unlikely but check
```

If any show `"workspace:^"` or `"workspace:*"`, leave them — pnpm will resolve at publish time. If any show explicit `"0.0.0"`, bump to `"0.1.0-alpha.0"`.

- [ ] **Step 19.3: Install + verify lockfile updates cleanly**

```bash
pnpm install
```
Expected: lockfile updates for the version bumps, no errors.

- [ ] **Step 19.4: Full verification**

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test 2>&1 | tail -5
cd examples/nodejs-quickstart && pnpm start && cd ../..
```

Expected: all clean. Test count unchanged (~794). Smoke test passes.

- [ ] **Step 19.5: Commit**

```bash
git add packages/core/package.json packages/api/package.json packages/sdk/package.json pnpm-lock.yaml
git commit -m "chore: bump all packages to 0.1.0-alpha.0

First public alpha release target. Bumps @orbit-ai/core, @orbit-ai/api,
and @orbit-ai/sdk from 0.0.0 to 0.1.0-alpha.0 together to keep them
version-aligned for the initial release.

Aftewards, cross-package deps using workspace:* will resolve to
0.1.0-alpha.0 automatically at pnpm publish time.

No code changes — this is a version-only commit. 794+ tests still
passing, quickstart smoke test clean."
```

- [ ] **Step 19.6: Final full verification**

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test 2>&1 | tail -10
cd examples/nodejs-quickstart && pnpm start
cd ../..
git log --oneline b177670..HEAD
git status
```

Expected:
- All tests pass
- Smoke test clean
- 18 commits on top of b177670
- Working tree clean

- [ ] **Step 19.7: Push final state**

```bash
git push origin pr-4-cleanups-and-docs
```

Wait for CI to go green.

---

# Phase 8 — External review handoff + publish gate

## Task 20: Handoff for external review (Codex + GitHub)

**This task is not executed by a subagent — it's a HUMAN GATE.**

Fix Pass C is done from the internal-review perspective. Before any `pnpm publish` touches npm, the stack must be reviewed by an external reviewer (Codex review, GitHub PR review, or both per Sharon's preference).

### Deliverables for external review

1. **PR #21 link** — the full 5-PR stack tip, with all Fix Pass C commits on top
2. **Commit range for focused review**: `b177670..HEAD` — these are the 18 Fix Pass C commits
3. **Audit trail for context**:
   - `docs/review/2026-04-08-post-stack-audit.md` — the original 9-reviewer audit with all findings
   - `docs/superpowers/plans/2026-04-08-fix-pass-c-alpha-readiness.md` — this plan
   - Git log with all Fix Pass A + B + B2 + B3 commits showing the iterative review cycles
4. **Test state**: 794+ passing, 2 skipped, typecheck + lint + CI smoke test clean
5. **Known-gaps document**: the post-stack audit's "What this audit did NOT cover" + "Phase 3 priorities" sections spell out what's explicitly deferred

### What to ask the external reviewer to check

Prepare a review request that points at:

1. **The 18 commit range** with a note that each commit closes a specific finding ID (H-*, OSS-*, DX-*, SCALE-*, EX-*, DT-*) from the audit
2. **The quickstart example** (`examples/nodejs-quickstart/src/index.ts`) — does it feel like a real consumer experience?
3. **The README + SDK README** — is the branding honest? Do the code snippets match the actual API?
4. **The SECURITY.md** — does the disclosure policy look right? Is the placeholder email replaced with a real inbox?
5. **Zero new `catch { }` / silent failures** (run `git diff b177670..HEAD -- packages/ | grep -E "^\+.*catch"` and inspect)
6. **Type-safety regression check**: new `as any` casts introduced?
7. **Test quality**: do the new tests actually assert behavior, or are they theater?

### Publish gate — do NOT skip

**After external review clears**:

1. Address any findings (if MINOR, fix inline and re-request review; if MAJOR, write a Fix Pass D plan and loop)
2. **Replace the `security@orbit-ai.dev` placeholder** in `SECURITY.md` with a real inbox (or set up GitHub Private Vulnerability Reporting) — this is a hard blocker for publish
3. **Confirm the LICENSE file exists** at repo root — if not, create `LICENSE` with the MIT text from [choosealicense.com/licenses/mit/](https://choosealicense.com/licenses/mit/) (Sharon's name as copyright holder, year 2026)
4. Run a **final tarball inspection** for each package (pack to a temp dir, then `tar -tzf` — `pnpm pack --dry-run` does not exist in pnpm 9.x) and verify each tarball contains `dist/`, `README.md`, `LICENSE`, `package.json` — nothing else
5. **Merge the stack to main** via squash-merge or stack-merge (Sharon's choice): `#17 → #18 → #19 → #20 → #21`

### Publish commands (after the gate passes)

**From `main`** (not from a stack branch):

```bash
git checkout main
git pull
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r typecheck
pnpm -r lint
pnpm -r test

# Inspect tarballs before publishing (pnpm 9.x has no --dry-run flag)
mkdir -p /tmp/orbit-publish-check
for pkg in core api sdk; do
  rm -f /tmp/orbit-publish-check/*.tgz
  cd packages/$pkg && pnpm pack --pack-destination /tmp/orbit-publish-check && cd ../..
  echo "=== $pkg tarball contents ==="
  tar -tzf /tmp/orbit-publish-check/orbit-ai-$pkg-*.tgz | sort
  echo ""
done
rm -rf /tmp/orbit-publish-check
# Each tarball MUST contain: package/package.json, package/dist/*, package/README.md, package/LICENSE
# It MUST NOT contain: src/, __tests__/, tsconfig.json, vitest.config.*

# Publish in dependency order: core → api → sdk
# (api depends on core; sdk depends on core)
cd packages/core && pnpm publish --access public && cd ../..
cd packages/api && pnpm publish --access public && cd ../..
cd packages/sdk && pnpm publish --access public && cd ../..
```

If using 2FA on npm: `pnpm publish` will prompt for the OTP.

### Create the GitHub release

```bash
# Tag the release
git tag -a v0.1.0-alpha.0 -m "Orbit AI 0.1.0-alpha.0"
git push origin v0.1.0-alpha.0

# Create release via gh cli
gh release create v0.1.0-alpha.0 \
  --title "Orbit AI 0.1.0-alpha.0 — Package foundation" \
  --notes "First public alpha of @orbit-ai/core, @orbit-ai/api, and @orbit-ai/sdk.

Highlights:
- Schema engine + SQLite/Postgres/Supabase/Neon adapters (@orbit-ai/core)
- Hono-based REST API with auth, scopes, idempotency, rate limiting (@orbit-ai/api)
- TypeScript client SDK with HTTP + DirectTransport, auto-pagination, type-safe resources (@orbit-ai/sdk)
- Runnable quickstart example (examples/nodejs-quickstart)

What's NOT in this release (coming next):
- @orbit-ai/cli, @orbit-ai/mcp, @orbit-ai/integrations — see the roadmap
- Full v1 GA readiness — see docs/product/release-definition-v1.md

Known gaps: see docs/review/2026-04-08-post-stack-audit.md for the full list of alpha-scope limitations and Phase 3 priorities.

Install:
  pnpm add @orbit-ai/sdk
  # or for server-side:
  pnpm add @orbit-ai/core @orbit-ai/api"
```

### Post-publish

1. Announce on whatever channels (Twitter, blog, HN) — the README and SECURITY.md URLs will resolve once the repo is public
2. Monitor the first npm downloads + any early issues
3. Move to the CLI implementation plan (separate doc Sharon owns)

---

## Summary

**Plan produces**:
- ~23 commits on top of `b177670`
- 15 MUST + 6 SHOULD findings from the post-stack audit closed (OSS-9 expanded to 3 sub-files, 2 package-artifact tasks added)
- Working quickstart that doubles as CI smoke test
- Honest README + per-package READMEs + per-package LICENSE copies + CONTRIBUTING + SECURITY + CHANGELOG + CODE_OF_CONDUCT + .env.example
- CI workflow running on every push
- Verified tarballs: each `pnpm pack` output contains dist/, README.md, LICENSE, package.json
- `0.1.0-alpha.0` version-bumped packages ready for external review → publish

---

## Self-review checklist

- [x] Every task has exact file paths
- [x] Every code step shows the actual code
- [x] Every commit has a concrete commit message
- [x] TDD discipline where applicable (Tasks 12, 14, 15, 16); config/docs tasks don't need TDD but still commit cleanly
- [x] No placeholders (`TBD`, "similar to above", "add error handling")
- [x] Type names consistent across tasks (`IdempotencyStore`, `MemoryIdempotencyStore`, `OrbitErrorCode`, `OrbitApiError.code`)
- [x] Phase boundaries documented with explicit checkpoints
- [x] Hard rules on force-push, branch hygiene repeated at the top
- [x] External review gate explicit at Phase 8
- [x] Publish gate is NOT automated — requires human sign-off after external review
- [x] Covers all 21 findings from the post-stack audit (cross-checked against the finding-to-task table at the top)
- [x] Explicit non-goals listed (no CLI, no MCP, no integrations, no Phase 3 items)
- [x] Rollback strategy: every commit is independent enough to `git revert` cleanly if external review rejects it
- [x] No `pnpm pack --dry-run` anywhere in the plan (pnpm 9.x does not support it — uses pack-to-tmp + tar -tzf instead)
- [x] `createOrbitError` used instead of `new OrbitError` in Task 15 (matches actual codebase pattern)
- [x] `createTestAdapter` documented as a local helper, not an importable utility
- [x] `SearchResource` explicitly listed for REMOVAL in Task 13 (confirmed standalone class with no consumer use case)
- [x] Task 16 is honest: closes idempotency extensibility + rate-limit documentation, NOT the full rate-limit pluggability (Phase 3)
- [x] All 3 package tarballs verified at Phase 2 checkpoint + Task 19 final gate (README.md + LICENSE + dist + package.json)
- [x] `drizzle-orm` included upfront in example package.json (not left as a "likely issue")
- [x] `pnpm-workspace.yaml` already includes `examples/*` — no modification, commit message doesn't claim otherwise

**Cross-check**: every audit finding listed in "The 21 findings this plan closes" maps to at least one task:
- OSS-1 → Tasks 2-4 ✓
- OSS-2 → Task 6 ✓
- OSS-3 → Task 6 ✓
- OSS-4 → Task 8 ✓
- OSS-5 → Task 9 ✓
- OSS-6 → Task 11 ✓
- OSS-7 → Tasks 2-4 ✓
- OSS-8 → Tasks 2-4 + 7a + 7b (per-package README + LICENSE ensures `files` allow-list is satisfied) ✓
- OSS-9a → Task 10a (SECURITY.md) ✓
- OSS-9b → Task 10b (CHANGELOG.md) ✓
- OSS-9c → Task 10c (CODE_OF_CONDUCT.md) ✓
- OSS-10 → Task 5 ✓
- DOC-SDK → Task 7 ✓
- PKG-README-CORE → Task 7a ✓
- PKG-README-API → Task 7b ✓
- EX-1 → Task 18 ✓
- TEST-E2E → Task 18 ✓
- DX-ERR-1 → Task 12 ✓
- DX-ERR-2 → Task 12 ✓
- DX-EXPORTS → Task 13 ✓
- DT-LINKS → Task 14 ✓
- SCALE-SEARCH → Task 15 ✓
- SCALE-IDEM → Tasks 16 + 17 (idempotency extensibility + rate-limit documentation; rate-limit pluggability remains Phase 3) ✓

All 21 findings have at least one task. ✅
