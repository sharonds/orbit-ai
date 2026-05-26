# Multi-Domain Pre-PR Review — `codex/business-e2e-demo-gate`

**Date:** 2026-05-26
**Branch:** `codex/business-e2e-demo-gate` (originally 62 commits ahead of
`main`; resolved branch is 23 commits ahead of `origin/main`)
**Worktree:** `/Users/sharonsciammas/orbit-ai/.worktrees/business-e2e-demo-gate`
**Original diff size:** ~6,696 insertions / 1,575 deletions across 72 files
**Scope constraints:** SQLite-only; no Postgres/Supabase/OrbStack/live integrations/UI/deployment.

This report aggregates five independent reviews — security, business logic, code quality, database/query isolation, and documentation — into a single PR-blocker matrix with rationale, file:line citations, and false-positive notes.

---

## 0. Resolution Update

**Status after remediation:** PR blockers resolved; proceed to CodeQL/PR review.

- Rebased by replaying only the business E2E slice (`fa7e8ed` onward) onto
  `origin/main`, reducing the branch from 62 commits ahead to 23 commits ahead
  and 0 behind.
- Verified B-DOC-1 resolution with:
  `git diff --name-status origin/main..HEAD -- packages/create-orbit-app PLAN-D-EXECUTION-LEDGER.md docs/releasing.md .changeset docs/specs/release-definition-v2.md`
  returning no changes.
- Verified B-CODE-1 was rebase debt rather than an active branch regression:
  `packages/create-orbit-app` now has no diff from `origin/main`, and its test,
  typecheck, and lint gates pass.
- Applied scoped non-blocking cleanups for S-1, S-2, S-4, S-6, BL-2, BL-3,
  BL-4, DB-5, and C-2.
- Remaining non-blocking follow-ups: DNS-rebinding delivery-time validation
  (S-3), rate-limit test growth note (S-5), lead-qualification rule refactor
  (BL-1), shared date-field map/parity extraction (C-1), and documentation
  cleanups D-2 through D-4.

### Resolution Validation

- `pnpm -F @orbit-ai/create-orbit-app test` — passed, 9 files, 70 tests.
- `pnpm -F @orbit-ai/create-orbit-app typecheck` — passed.
- `pnpm -F @orbit-ai/create-orbit-app lint` — passed.
- `pnpm -r build` — passed.
- `pnpm -F @orbit-ai/api test -- src/__tests__/serialization.test.ts` —
  passed, 25 tests.
- `pnpm -F @orbit-ai/sdk test -- src/__tests__/serialization.test.ts` —
  passed, 18 tests.
- `pnpm -F @orbit-ai/e2e test -- src/security/auth-boundary.test.ts src/security/webhook-ssrf.test.ts src/security/redaction.test.ts src/security/payload-limit.test.ts src/business-journeys/05-cli-business-surface.test.ts`
  — passed, 5 files, 5 tests.
- `pnpm -F @orbit-ai/demo-seed test` — passed, 20 files, 52 tests.
- `pnpm -F @orbit-ai/api test` — passed, 14 files, 312 tests.
- `pnpm -F @orbit-ai/sdk test` — passed, 13 files, 234 tests.
- `pnpm -F @orbit-ai/e2e test` — passed, 33 files, 37 passed, 3 skipped.
- `pnpm -F @orbit-ai/demo-seed typecheck` — passed.
- `pnpm -F @orbit-ai/e2e typecheck` — passed.
- `pnpm -F @orbit-ai/api typecheck` — passed.
- `pnpm -F @orbit-ai/sdk typecheck` — passed.

Initial parallel full-suite attempt failed before `pnpm -r build` completed
because Vite could not resolve `@orbit-ai/core` package entrypoints while `dist`
was still being rebuilt. The same suites passed after the build completed.

## 1. Original PR-Blocker Verdict

**Original status: do not merge as-is.** Two blocker classes were found before
the remediation above:

| ID | Class | Summary | Owner |
|----|-------|---------|-------|
| **B-DOC-1** | Rebase debt | Branch is parented behind main's `c4ea761` (Plan D follow-ups) and `8f6291f` (Plan C follow-ups). The diff *appears* to delete `PLAN-D-EXECUTION-LEDGER.md`, `docs/releasing.md` blocks, `packages/create-orbit-app/{README,CHANGELOG}.md` content, `.changeset/plan-d-followups.md`, and downgrades `release-definition-v2.md`. Merging would silently revert two landed PRs. | Rebase first. |
| **B-CODE-1** | Code regression in `create-orbit-app` refactor | (a) Bare-catch swallows added at `packages/create-orbit-app/src/copy.ts:29` and `packages/create-orbit-app/src/index.ts:101` violate the CLAUDE.md "always log before swallowing" rule; (b) `INSTALL_TIMEOUT_MS` and `isTimedOutError` were removed from `install.ts`, eliminating the 5-minute install timeout — a hung registry can now hang the scaffolder indefinitely; (c) Security regression tests deleted: path-traversal guard test, shell-metacharacter test, unterminated-quote test, `--install-cmd ""` and `--install-cmd "x" --no-install` conflict tests — and the corresponding validation in `options.ts` was also removed; (d) `index.test.ts` assertion `expect(logSpy).toHaveBeenCalledWith('\nInstalling dependencies…')` was replaced by tautological `expect(logSpy).toBeDefined()`; (e) `parseInstallCmd` no longer handles quoted args (`--registry "https://..."` breaks). | Restore behavior + tests, or split into a separate, justified PR. |

Everything else is non-blocking — useful follow-ups but not merge-gating.

---

## 2. Findings by Domain

### 2.1 Security  (no blockers)

| # | Severity | File:line | Finding |
|---|----------|-----------|---------|
| S-1 | NON-BLOCKING | `e2e/src/security/auth-boundary.test.ts:6-27` | Covers only `GET /v1/contacts`. Should also assert a `POST` with invalid key returns 401 *and* row count unchanged. |
| S-2 | NON-BLOCKING | `e2e/src/security/webhook-ssrf.test.ts:5-12` | `BLOCKED_URLS` list misses denied patterns that `packages/api/src/routes/webhooks.ts:14-32` actually rejects: `0.0.0.0`, `::1`, `metadata.google.internal`, `fe80::` link-local, decimal/octal IP encoding (`https://2130706433/`). Strengthen to prevent regressions. |
| S-3 | NON-BLOCKING | `packages/api/src/routes/webhooks.ts:11` | Pre-existing: validation is hostname-only; DNS-rebinding possible at delivery. Already documented; outside branch scope. |
| S-4 | NON-BLOCKING | `e2e/src/security/redaction.test.ts:87-89` | Asserts secret strings absent in stdout+stderr but doesn't assert a positive redaction marker — empty output would also pass. Add a positive assertion. |
| S-5 | NON-BLOCKING | `e2e/src/security/rate-limit.test.ts:10` | 101 sequential requests with module-scoped `_resetRateLimitBuckets` — currently safe because each stack creates a unique `apiKeyId`, but worth noting under parallel test growth. |
| S-6 | NON-BLOCKING | `e2e/src/security/payload-limit.test.ts:9-19` | Sets a `content-length` header that the harness will overwrite — cosmetic but misleading. |
| S-7 | FALSE-POSITIVE-RISK (cleared) | `packages/integrations/src/stripe/cli.ts` (commit `9b3d60f`) | Stripe credential sentinel namespace fix verified safe — no other reader; new value (`__orbit_sentinel__:stripe:api_key`) cannot collide with real Stripe refresh tokens (which start with `rt_`). |
| S-8 | FALSE-POSITIVE-RISK (cleared) | `.gitignore` +14 lines | Only un-ignores 6 specific markdown paths under `docs/{product,testing,reports}/`. No secret paths affected. |
| S-9 | FALSE-POSITIVE-RISK (cleared) | `e2e/src/harness/build-stack.ts` | Uses `crypto.randomUUID` + SHA-256, no hardcoded secrets, no env-var auth bypass. Parameterized SQL via Drizzle's `sql\`...\`` template. |

**Strongest test in the new suite:** `tenant-graph-isolation.test.ts` / `cli-graph-isolation.test.ts` — assert negative results across SDK-direct, SDK-HTTP, raw API, MCP, and CLI surfaces, with a positive control. Solid.

### 2.2 Business Logic  (no blockers)

| # | Severity | File | Finding |
|---|----------|------|---------|
| BL-1 | NON-BLOCKING | `packages/demo-seed/src/scenarios/lead-qualification.ts:10-14, :213` | Qualification answer uses a hardcoded `QUALIFIED_EMAILS` allowlist. Couples answer to fixture identity rather than business rule. Acceptable for demo gate; replace with property-based filter (`customFields.qualificationSignal !== 'cold-import'`) before this is marketed as an "agent benchmark." |
| BL-2 | NON-BLOCKING | `packages/{api,sdk}/src/{transport/,}serialization.ts` (commit `fa7e8ed`) | `new Date(string)` coercion accepts `Invalid Date` silently (`getTime() === NaN`). Add `if (Number.isNaN(d.getTime())) throw` or Zod refinement. Also: only ISO-8601 with `Z`/offset is tested — bare `'2026-05-01'` would parse as local time. |
| BL-3 | NON-BLOCKING | `e2e/src/business-journeys/05-cli-business-surface.test.ts` | Only exercises `<entity> get <id>`. Missing `list`, `deals move`, `search` — the first commands a customer hits. Adding 3–5 calls closes the gap. |
| BL-4 | NON-BLOCKING | `packages/demo-seed/src/scenarios/integration-events.ts:10-29` | Fake event shapes diverge substantially from real Gmail/Calendar/Stripe webhooks (Gmail lacks `historyId`/`payload.body.data`; Calendar lacks `iCalUID`/`start.dateTime`; Stripe `amount` is a decimal-dollar string vs. real integer-cents). Risk of false confidence. Document as "minimal stand-ins, not webhook fixtures." |
| BL-5 | FALSE-POSITIVE (cleared) | `packages/demo-seed/src/scenarios/*.ts` | Determinism claim holds — zero hits for `Date.now()` / `Math.random()` / `randomUUID()` in scenarios; `now` is injected; `dateDaysAgo`/`isoDaysAgo` are pure. IDs vary but tests reference via `records` handles. |
| BL-6 | FALSE-POSITIVE (cleared) | All five scenarios | Cross-scenario pollution: companies/contacts/emails are distinct across scenarios; per-scenario tag fences (`scenario:lead-qualification` etc.); `customFields.scenario` filter on queries. |
| BL-7 | OK | `packages/core/src/entities/deals/validators.ts` (commit `65e9e08`) | Numeric-precision regex `^-?\d{1,16}(\.\d{1,2})?$` correctly caps `numeric(18,2)`. Tests cover scientific notation, `Infinity`, 17-digit ints, 3-digit fractions, negative values, null on update. |
| BL-8 | OK | `stalled-pipeline.ts:258-261` | Real "days since last activity" computation against 14-day threshold + high-value-no-task detection. Genuinely detectable, not just labeled. |

### 2.3 Database & Query Isolation  (no blockers)

| # | Severity | Finding |
|---|----------|---------|
| DB-1 | OK | **No Postgres/Supabase scope creep.** `git diff main..HEAD -- packages/core/` is README-only (one paragraph trimming Supabase/Neon claims). No RLS or migration code added. |
| DB-2 | OK | **Tenant scoping**: all five scenarios build `ctx = { orgId: opts.organizationId }` once and thread it to every `services.<entity>.create(ctx, …)` / `.list(ctx, …)`. 58 `organizationId` references, zero `ctx`-bypass. |
| DB-3 | OK | **Raw SQL**: only in `e2e/src/harness/build-stack.ts:74,88` via Drizzle's parameterized `sql\`...\`` template (pre-existing Postgres api-key seeding path, untouched semantically). Demo-seed has zero raw SQL. |
| DB-4 | OK | **Tenant-isolation tests** assert `RESOURCE_NOT_FOUND` across 4 surfaces × 6 entity types (company/contact/deal/activity/note/task), with negative re-running of `answerAccount360Question` as the wrong org. Strong coverage. |
| DB-5 | NON-BLOCKING | **Idempotency**: `integration-events.ts` is genuinely idempotent (explicit existence check before insert; re-apply test asserts `created: false`). The other four scenarios are single-shot — re-seeding would duplicate. Tests use a fresh adapter per `it()`, so safe in practice. Add a one-liner to `packages/demo-seed/README.md`. |
| DB-6 | NON-BLOCKING | **N+1**: scenarios do 15–25 sequential inserts each, no `Promise.all`. Fine on SQLite (sub-second). |
| DB-7 | FALSE-POSITIVE (cleared) | Commit `65e9e08`'s `fix(core)` label suggests schema touch — it's actually runtime Zod validation only. Appropriate. |

### 2.4 Code Quality  (B-CODE-1 blocker; see §1)

Non-blocking items beyond the blocker:

| # | Severity | Finding |
|---|----------|---------|
| C-1 | NON-BLOCKING | `ENTITY_DATE_INPUT_FIELDS` duplicated verbatim in `packages/api/src/serialization.ts` and `packages/sdk/src/transport/serialization.ts`. Extract to `@orbit-ai/core` or add a cross-file parity test (analogous to the existing strip-fields test). |
| C-2 | NON-BLOCKING | `e2e/src/harness/build-stack.ts:102-110` — api-key reuse relies on `JSON.stringify(scopes)` order. Canonicalize (sort) before stringify on both sides. Low impact today because all callers pass `['*']`. |
| C-3 | OK | `pnpm -r typecheck`: PASS. `pnpm --filter @orbit-ai/create-orbit-app lint`: PASS. Test count not run end-to-end — verify against baseline before merge. |

### 2.5 Documentation  (B-DOC-1 blocker; see §1)

Non-blocking items beyond the blocker:

| # | Severity | Finding |
|---|----------|---------|
| D-1 | NON-BLOCKING | `CLAUDE.md` test baseline still reads `1,796`. If the new tests are all under `/e2e` (excluded from the per-package baseline), the wording is fine — confirm with `pnpm -r test` count before merge. |
| D-2 | NON-BLOCKING | Inconsistency: `llms.txt` correctly removes "Supabase/Neon" from core description, but `CLAUDE.md` still lists "Supabase, Neon" under storage adapters. Pick one. |
| D-3 | NON-BLOCKING | `CHANGELOG.md` line 224: `0.1.0-alpha.0` entry was retroactively edited from "Supabase and Neon support" to "Postgres-compatible managed provider support." More accurate, but editing a released entry deserves a PR-description note. |
| D-4 | NON-BLOCKING | `packages/integrations/README.md` now says credentials are stored "in the `integration_connections` table when the integration schema is installed." Verify the table is actually installable in alpha — otherwise this is a pre-announce. |
| D-5 | OK | All claims spot-checked: 9 security test files in `security-e2e-matrix.md` exist on disk; 6 business journey files exist; scenario-map's 5 scenarios match `packages/demo-seed/src/scenarios/`; Beta-tenant exclusion claim at `e2e/src/business-journeys/01-lead-qualification.test.ts:75` confirmed. |
| D-6 | OK | `security-e2e-matrix.md` rows 27–28 explicitly mark Postgres RLS and migration safety as deferred — scope-honest. |

---

## 3. False-Positive Watch

The following surfaced during review but were verified safe / out of scope. Logged here so re-reviewers don't re-raise them:

- **Stripe credential sentinel rename** (commit `9b3d60f`) — safe; no downstream readers.
- **`.gitignore` 14-line addition** — only un-ignores docs paths, no secrets.
- **`build-stack.ts` apparent shared key** — replaced with random per-stack `key_e2e_<uuid>`; net positive for isolation.
- **`fix(core)` label in `65e9e08`** — runtime Zod validator only, not schema.
- **`release-definition-v2.md` 24-line change** — not gate-lowering; it's rebase debt (see B-DOC-1).
- **Determinism in demo-seed** — confirmed via `grep` and design (`now` injection, pure `dateDaysAgo`).

---

## 4. Recommended Actions Before Opening the PR

**Resolution status:** items 1 and 2 are complete after the remediation pass.
Item 3's low-risk improvements were also completed where they fit the current
SQLite-only scope.

1. **Rebase onto `main`** to absorb `c4ea761` (Plan D follow-ups) and `8f6291f` (Plan C follow-ups). Re-run `git diff main..HEAD` and confirm the apparent deletions in §1 / B-DOC-1 disappear.
2. **Restore `create-orbit-app` regressions (B-CODE-1)**:
   - Re-add `INSTALL_TIMEOUT_MS` and `isTimedOutError` in `install.ts`.
   - Restore logging in `copy.ts:29` and `index.ts:101` cleanup catches.
   - Restore `--install-cmd` validation in `options.ts` (empty/whitespace reject; conflict with `--no-install`).
   - Restore `parseInstallCmd` quoted-args support (or remove the docs claim and document the limitation in CHANGELOG).
   - Restore the deleted security tests (`'rejects template traversal'`, `'treats shell metacharacters as literal argv'`, `'rejects unterminated quotes'`).
   - Replace the tautological `expect(logSpy).toBeDefined()` with a real assertion.
3. **Optional pre-merge improvements** (non-blocking):
   - Reject `Invalid Date` in the date coercer with a Zod refinement (BL-2).
   - Expand `webhook-ssrf.test.ts` `BLOCKED_URLS` to cover the full deny list in `webhooks.ts:14-32` (S-2).
   - Add a positive assertion in `redaction.test.ts` (S-4).
   - Add 3–5 `list`/`deals move` calls to `05-cli-business-surface.test.ts` (BL-3).
4. **Post-merge follow-ups** (file as issues):
   - Resolve `CLAUDE.md` vs `llms.txt` Supabase/Neon mention inconsistency (D-2).
   - Extract `ENTITY_DATE_INPUT_FIELDS` to a shared location with a parity test (C-1).
   - Document idempotency semantics in `packages/demo-seed/README.md` (DB-5).
   - Replace lead-qualification email allowlist with a property-based filter (BL-1).
   - Document integration-event shapes as minimal stand-ins (BL-4).

---

## 5. Net Assessment

**Updated net assessment after remediation:** the branch is ready for CodeQL and
PR review. The original blockers were resolved without reintroducing
`create-orbit-app` regressions, and the focused non-blocking test-coverage gaps
were tightened.

The core deliverable — 5 deterministic demo-seed scenarios, 6 business-journey e2e tests, 8 security smoke tests with negative tenant-isolation assertions across 4 surfaces, a correct numeric-precision validator, and a safe Stripe sentinel namespace fix — is **high-quality work that meets the launch-gate intent for SQLite scope**. The two blockers are localized:
- **B-DOC-1** is purely a rebase artifact, resolvable without code change.
- **B-CODE-1** is an unrelated `create-orbit-app` refactor that snuck onto a test-PR branch. It should be either reverted (restore the deleted tests + timeout + validations) or split into its own clearly-justified PR.

After rebase + create-orbit-app revert/split, this branch is **ready for `pr-review-toolkit:review-pr`** and merge.
