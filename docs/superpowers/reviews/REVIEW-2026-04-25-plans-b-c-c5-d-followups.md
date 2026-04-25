# Plans B/C/C.5/D Follow-up Review

Date: 2026-04-25

Last updated: 2026-04-25 12:06 CEST after plan remediation.

Scope reviewed:

- `/Users/sharonsciammas/orbit-ai/.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-b-followups.md`
- `/Users/sharonsciammas/orbit-ai/.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-c-followups.md`
- `/Users/sharonsciammas/orbit-ai/.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-c5-migration-engine.md`
- `/Users/sharonsciammas/orbit-ai/.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-d-followups.md`

Review model:

- Release/package review: Plan B publish pipeline and Changesets workflow.
- E2E/parity review: Plan C journeys, API/SDK/CLI/MCP coverage, tenant isolation.
- Database/schema/security review: Plan C.5 migration engine, migration authority, RLS/tenant safety.
- Create-orbit-app/security review: Plan D CLI/scaffolder packaging, path safety, install command behavior.

Updated outcome: **PLAN DEFECTS FIXED; IMPLEMENTATION STILL PENDING**.

The reviewed plan documents now address the blocking defects found in the first pass. This does not mean the product code, workflows, or tests are fixed yet; it means the implementation plans now contain the required tasks, safety gates, and validation evidence to execute without the earlier known mistakes.

Initial outcome before remediation was **FIX BEFORE NEXT MILESTONE**. The findings below are retained for traceability, followed by the remediation and revalidation evidence.

## Remediation Summary

Sub-agents were used for independent plan ownership:

- Plan B release/package rewrite: agent `019dc413-4a6f-7b11-9225-a8054da4cafa`.
- Plan C E2E/parity rewrite: agent `019dc413-4ad9-7843-a94b-a67a27f7acc5`.
- Plan C.5 migration/database rewrite: agent `019dc413-b58d-70a2-9c6d-b9be4cdb8d96`.
- Plan D create-orbit-app/security rewrite: agent `019dc413-b5d3-7863-9656-55ad5da35092`.

Manual integration was also applied where the long-running Plan B/C agents had not returned yet.

Fixed in Plan B:

- Added Task 5.5 requiring release validate to run `pnpm --filter @orbit-ai/e2e test` before version/publish and requiring `.changeset/config.json` to ignore private `@orbit-ai/e2e`.
- Corrected the changeset package key to `"@orbit-ai/create-orbit-app": patch`.
- Replaced invalid `pnpm pack --dry-run` evidence with scoped `pnpm --filter @orbit-ai/create-orbit-app pack --pack-destination ...` plus tarball inspection.
- Expanded verifier requirements to cover package-readiness metadata, `license`, `README.md`, `LICENSE`, `files`, and string-form `bin`.
- Added build-before-pack `prepack` coverage and release-dry-run spawn/signal diagnostics.

Fixed in Plan C:

- Made `prepareCliWorkspace` adapter-aware instead of narrowing away Postgres coverage for journeys 7/8.
- Added direct proof that `ORBIT_E2E_ADAPTER=postgres` forces Postgres workspace config and runtime assertions.
- Added Journey 15 requirements across raw API, SDK HTTP, SDK DirectTransport, CLI, and MCP for cross-tenant negative checks.
- Required read-after-update persistence checks across SDK, raw API, CLI, and MCP.
- Required Journey 11 to invoke every listed MCP tool.
- Corrected the release-definition note: `docs/product/release-definition-v2.md` exists and must be updated in place.
- Made Journey 8 explicitly non-certifying until Plan C.5 replaces the stub migration engine.

Fixed in Plan C.5:

- Replaced the non-executable stub with an executable migration-engine follow-up plan.
- Added the migration-authority contract: preview may inspect runtime metadata, but apply/rollback/promote/drop/rename/DDL must use injected migration authority such as `runWithMigrationAuthority(...)`.
- Required `OrbitSchemaEngine` to receive migration authority and ledger dependencies.
- Required server/core destructive confirmation, checksum-bound confirmation, rollback ledger records, SQLite `migrationDatabase` coverage, schema read org-context assertions, and SQLite/Postgres/Neon adapter coverage.

Fixed in Plan D:

- Removed copy-pastable shell cleanup guidance and replaced it with Node `fs.rm` cleanup, path-boundary checks, and "never shell out" security wording.
- Replaced CommonJS `__dirname` guidance in ESM tests with `fileURLToPath(new URL(..., import.meta.url))`.
- Added `license`, registry metadata, README/LICENSE, `bin`, `files`, and `prepack` package-readiness validation.
- Added security validation for template/package path traversal, untrusted shell execution, and CLI input validation.

## Revalidation Evidence

Fresh validation command:

```bash
set -e
B=.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-b-followups.md
C=.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-c-followups.md
C5=.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-c5-migration-engine.md
D=.claude/worktrees/recursing-almeida-e96c5d/docs/superpowers/plans/2026-04-24-plan-d-followups.md
if rg -n '^"create-orbit-app": patch|^pnpm --filter create-orbit-app pack --dry-run' "$B"; then exit 1; fi
if rg -n 'release-definition-v2\.md.*does not exist in this repo|Per Task 5 path B|07/08 stay SQLite-only' "$C" | rg -v '^1492:'; then exit 1; fi
if rg -n 'SPEC STUB\. Do NOT execute|This document captures scope and rationale' "$C5"; then exit 1; fi
if rg -n 'Remove it manually: rm -rf "\$\{(tempPath|targetDir)\}"|path\.resolve\(__dirname' "$D"; then exit 1; fi
rg -n 'Test launch-gate E2E journeys|@orbit-ai/e2e' "$B" >/dev/null
rg -n '@orbit-ai/create-orbit-app": patch|pack --pack-destination' "$B" >/dev/null
rg -n 'Use \*\*path A\*\* \(make `prepareCliWorkspace` adapter-aware\)|ORBIT_E2E_ADAPTER|docs/product/release-definition-v2.md' "$C" >/dev/null
rg -n 'EXECUTABLE FOLLOW-UP PLAN|runWithMigrationAuthority|migrationAuthority|confirmDestructive|migrationDatabase' "$C5" >/dev/null
rg -n 'fileURLToPath\(new URL|Never shell out|prepack|license' "$D" >/dev/null
echo 'plan validation anchors passed'
```

Result: `plan validation anchors passed`.

Spot evidence:

- Plan B launch-gate E2E and Changesets fix: `2026-04-24-plan-b-followups.md:584-668`.
- Plan B scoped changeset and valid pack inspection: `2026-04-24-plan-b-followups.md:1079-1106` and `:1165-1188`.
- Plan C adapter-aware Postgres proof: `2026-04-24-plan-c-followups.md:18-23` and `:568-646`.
- Plan C existing release-definition update: `2026-04-24-plan-c-followups.md:1216-1236`.
- Plan C.5 executable authority plan: `2026-04-24-plan-c5-migration-engine.md:1-80` and `:400-430`.
- Plan D package/security readiness and ESM path fix: `2026-04-24-plan-d-followups.md:17-20`, `:92-146`, `:266-346`, `:764-778`, and `:1012-1030`.

No production code tests were run for this remediation pass because only plan/report Markdown files were edited. The implementation plans themselves include the required build/test/e2e commands to run when the plans are executed.

## Command Evidence

- `node --test scripts/release-workflow.test.mjs` passed only 2 tests. None of the Plan B/C regression tests described in the follow-up plans exist yet.
- `node scripts/verify-package-artifacts.mjs` printed `Package artifact verification passed.` even though `packages/create-orbit-app/package.json` has no `license` field and no `prepack` hook.
- `pnpm changeset status` reports patch bumps for `@orbit-ai/e2e`, but `e2e/package.json` is private and the release provenance guard only allows package manifests under `packages/*`.
- Static inspection confirmed `.github/workflows/release.yml` excludes `@orbit-ai/e2e` from the release `validate` test step.

## Critical / High Findings

### H1. Release workflow does not enforce the alpha E2E publish gate

Evidence:

- `e2e/README.md:3` says all 14 journeys must pass before npm release.
- `.github/workflows/release.yml:64-65` runs `pnpm -r --filter '!@orbit-ai/e2e' test`.
- `docs/product/release-definition-v2.md:90-95` requires automated journey tests in CI as part of the release pipeline.

Impact: a release PR merge can publish packages without the actual launch-gate journeys passing for the exact SHA being published.

Fix:

- Add `pnpm -F @orbit-ai/e2e test` to the release workflow `validate` job before publish.
- If Postgres journey coverage is release-blocking, add a Postgres service-backed release validation job or make publish depend on a successful CI E2E result for the exact commit.

### H2. Changesets and release PR provenance guard disagree on private `@orbit-ai/e2e`

Evidence:

- `pnpm changeset status` reports `@orbit-ai/e2e` as a patch bump.
- `e2e/package.json:2-4` marks `@orbit-ai/e2e` private.
- `.github/workflows/release.yml:198-203` whitelists `packages/*/package.json`, changelog, lockfile, and changeset files, but not `e2e/package.json`.
- `.changeset/config.json:21` ignores only `orbit-ai-nodejs-quickstart`.

Impact: the generated release PR can include `e2e/package.json`, then the publish job rejects the release PR as changing an unexpected file.

Fix:

- Prefer adding `"@orbit-ai/e2e"` to `.changeset/config.json` `ignore`.
- If private version churn is intentional, explicitly allow `e2e/package.json` in the provenance guard and update Plan B expected status counts.

### H3. Plan B follow-up changeset uses the wrong create-orbit-app package name

Evidence:

- Plan B follow-up lines 888-898 use `"create-orbit-app": patch`.
- Current package name is `@orbit-ai/create-orbit-app` in `packages/create-orbit-app/package.json:2`.
- `.changeset/config.json:10` also uses `@orbit-ai/create-orbit-app`.

Impact: the changeset can fail, omit the scaffolder, or document the wrong package in the fixed-version group.

Fix:

- Replace `"create-orbit-app": patch` with `"@orbit-ai/create-orbit-app": patch`.
- Update Plan B release verification examples that still check unscoped `create-orbit-app` to use `@orbit-ai/create-orbit-app`.

### H4. Artifact verifier passes missing npm license metadata

Evidence:

- `packages/create-orbit-app/package.json:1-5` has no `license`.
- `scripts/verify-package-artifacts.mjs:16-20` skips private/non-`@orbit-ai` packages and then checks only entrypoint files.
- `node scripts/verify-package-artifacts.mjs` passed in this state.

Impact: npm metadata can publish as missing/UNLICENSED while the release gate reports success.

Fix:

- Add `"license": "MIT"` to `packages/create-orbit-app/package.json`.
- Update `scripts/verify-package-artifacts.mjs` to assert non-empty `manifest.license` and a shipped `LICENSE` file for every publishable package.
- Normalize `manifest.bin` so both object and string forms are handled.

### H5. `@orbit-ai/create-orbit-app` can pack stale/missing `dist`

Evidence:

- `packages/create-orbit-app/bin/create-orbit-app.js:2` imports `../dist/index.js`.
- `packages/create-orbit-app/package.json:21-24` has `build` and `prepublishOnly`, but no `prepack`.
- Plan B notes only `demo-seed` has `prepack`.
- `scripts/release-dry-run.mjs:25-37` runs publish dry-runs with `--ignore-scripts`.

Impact: local emergency publish or tarball smoke paths can package a bin that points to stale or missing `dist`.

Fix:

- Add `"prepack": "pnpm run build"` to all publishable packages with build scripts.
- Keep `prepublishOnly` for `@orbit-ai/create-orbit-app` publish guard.
- Verify packed tarballs with a command that exercises lifecycle scripts where intended.

### H6. Plan C still lacks a tenant isolation journey

Evidence:

- `e2e/README.md:7-22` lists only journeys 1-14.
- `e2e/src/harness/build-stack.ts:14-25` supports `tenant: 'both'` and exposes `betaOrgId`.
- `rg betaOrgId e2e/src/journeys` returns no journey usage.

Impact: the most important multi-tenant invariant is not proven by the alpha gate.

Fix:

- Add Journey 15 covering contacts and deals at minimum.
- Use beta-bound direct mode to get beta IDs, then assert Acme HTTP and direct clients receive `RESOURCE_NOT_FOUND` for get/update/delete and do not list beta records.
- Do not loosen this to `FORBIDDEN`; existence disclosure should fail the test.

### H7. Postgres E2E matrix overstates coverage

Evidence:

- `.github/workflows/ci.yml:161-182` runs journeys 02-11 with `ORBIT_E2E_ADAPTER=postgres`.
- `e2e/src/harness/prepare-cli-workspace.ts:25-43` always creates SQLite and sets `ORBIT_ADAPTER=sqlite`.
- Journeys 7 and 8 use `prepareCliWorkspace`.

Impact: CI labels journeys 7 and 8 as Postgres coverage while they silently rerun SQLite paths.

Fix:

- Per Plan C path B, remove SQLite-only journeys 7 and 8 from the Postgres matrix until C.5 provides real migration coverage.
- Add Journey 15 to the Postgres subset if it uses `buildStack`.
- Add a `scripts/release-workflow.test.mjs` regression for the exact Postgres matrix membership.

### H8. Journey 8 still certifies migration safety against a stub

Evidence:

- `packages/core/src/schema-engine/engine.ts:139-153` returns fixed `preview` and `apply` responses.
- `e2e/src/journeys/08-migration-preview-apply.test.ts:24-36` only checks a non-error response and `destructive` false.
- `docs/product/release-definition-v2.md:81-82` requires preview/apply of a reversible migration.

Impact: the alpha gate appears to prove destructive migration safety but does not exercise real diffing, apply, rollback, or destructive gating.

Fix:

- Short term: rewrite Journey 8 as explicit alpha stub passthrough and document the limitation in `CHANGELOG.md`, `e2e/README.md`, and `docs/product/release-definition-v2.md`.
- Before claiming alpha.1 migration readiness: implement Plan C.5 as a real plan and restore Journey 8 to test a destructive refusal and confirmed apply.

### H9. Journey 11 registers eight MCP tools but invokes only three

Evidence:

- `e2e/src/journeys/11-mcp-core-tools.test.ts:13-20` asserts eight tool names.
- `e2e/src/journeys/11-mcp-core-tools.test.ts:23-52` only calls `search_records`, `create_record`, and `get_record`.

Impact: the test can pass even if `update_record`, `delete_record`, `get_pipelines`, `move_deal_stage`, or `get_schema` are broken.

Fix:

- Add real calls for all listed tools.
- Assert update persistence, deletion behavior, schema contents, pipeline stage movement, and an invalid-object negative case.

### H10. CRUD parity tests do not prove update persistence

Evidence:

- SDK update returns same id but no re-get: `e2e/src/journeys/_crud-matrix.ts:49-50`.
- Raw API update checks only status: `e2e/src/journeys/_crud-matrix.ts:92-95`.
- CLI update checks only exit code: `e2e/src/journeys/_crud-matrix.ts:147-153`.
- MCP update checks only `isError`: `e2e/src/journeys/_crud-matrix.ts:218-225`.

Impact: update implementations can no-op while the cross-surface CRUD journeys pass.

Fix:

- Add per-entity update/assert fields.
- Re-fetch after update on SDK HTTP, SDK direct, raw API, CLI, and MCP before deleting.

### H11. Plan C.5 is not executable and needs authority-boundary design first

Evidence:

- Plan C.5 states `SPEC STUB. Do NOT execute` at line 3.
- Plan C.5 includes global DDL operation examples (`add_column`, `drop_column`, `rename_column`) at line 24.
- Public tenant route `POST /v1/schema/migrations/apply` requires only `schema:apply` and passes tenant context to the engine at `packages/api/src/routes/objects.ts:94-107`.
- Plan C.5 itself lists cross-tenant safety as an unresolved design question at line 66.

Impact: a tenant API key with schema mutation scope must not be able to alter shared physical tables for every organization.

Fix:

- Run the required brainstorm and writing-plans flow before implementation.
- Split operation scope into tenant metadata operations versus global physical DDL.
- Reject global DDL from ordinary tenant API-key context; require platform/migration authority for global DDL, RLS, indexes, and promoted physical columns.

### H12. Schema engine lacks a migration authority dependency

Evidence:

- `packages/core/src/services/index.ts:902` constructs `new OrbitSchemaEngine(() => getCustomFieldDefinitionsRepository())`.
- `packages/core/src/schema-engine/engine.ts:35-47` stores only the custom-field repository factory.
- `packages/core/src/schema-engine/engine.ts:147-153` has stub `apply`.

Impact: implementing DDL inside the current engine shape would either be impossible or tempt unsafe backdoors from runtime paths.

Fix:

- Inject a narrow `SchemaMigrationExecutor` backed by `runWithMigrationAuthority`.
- Inject a schema migration repository for operation logging.
- Keep the executor inaccessible to ordinary entity services and runtime CRUD paths.

### H13. Destructive confirmation is client-side only today

Evidence:

- Plan C.5 requires engine-side destructive gating at line 27.
- `packages/cli/src/commands/migrate.ts:91-101` confirms locally, then calls `client.schema.applyMigration(pendingMigrationRequest)` with no confirmation propagated.
- `packages/cli/src/commands/fields.ts:92-99` deletes a field without passing confirmation.
- `packages/sdk/src/resources/schema.ts:66-70` has `deleteField(type, fieldName)` with no confirm body.

Impact: API, SDK direct mode, MCP, or future callers can bypass CLI prompts unless the engine independently enforces destructive refusal.

Fix:

- Add `confirmDestructive: true` to API/SDK/CLI/MCP request shapes for apply/updateField/deleteField.
- Engine must recompute or validate destructiveness and reject before metadata write or DDL.

### H14. Plan D proposed cleanup warning is a command-injection footgun

Evidence:

- Plan D follow-up lines 252-254 propose printing `Remove it manually: rm -rf "${tempPath}"`.
- `projectName` is constrained, but the parent current working directory is user-controlled.

Impact: a malicious or unusual cwd containing quotes or command substitutions could produce a copy-pastable shell command that executes unintended commands.

Fix:

- Do not print executable cleanup commands.
- Or add a POSIX single-quote helper and print `rm -rf -- ${quoteShellArg(tempPath)}`.
- Add a regression test with a cwd containing quotes and shell metacharacters.

## Medium Findings

### M1. Release provenance is enabled without a public-repo precondition

Evidence:

- `.github/workflows/release.yml:158-161` grants `id-token: write`.
- `.github/workflows/release.yml:260-261` sets `NPM_CONFIG_PROVENANCE=true`.
- There is no public repository check before `.github/workflows/release.yml:244-247`.

Fix:

- Insert the Plan B `gh api /repos/${GITHUB_REPOSITORY} --jq '.private'` fail-closed step before `Verify package artifacts`.

### M2. CI E2E path filter misses release-sensitive paths

Evidence:

- `.github/workflows/ci.yml:43` matches only selected package `src/` paths plus `e2e/` and quickstart.
- `.github/workflows/ci.yml:49` matches only `core|api|sdk/src` and selected e2e paths.

Fix:

- Expand SQLite filter to include `packages/demo-seed/`, `packages/create-orbit-app/`, package manifests, `pnpm-lock.yaml`, and workflow changes.
- Expand or intentionally narrow the Postgres filter and lock it with tests.

### M3. Plan B tarball verification command is invalid for this pnpm

Evidence:

- Plan B follow-up lines 974-977 use `pnpm --filter create-orbit-app pack --dry-run`.
- The release reviewer verified pnpm 9.12.3 does not support `pnpm pack --dry-run`.

Fix:

- Replace with `pnpm publish --dry-run --json --ignore-scripts --no-git-checks --tag alpha` for publish-style evidence, or use `npm pack --dry-run --json` when lifecycle-script behavior is desired.
- Use the scoped package name.

### M4. `release-dry-run.mjs` still has silent failure branches

Evidence:

- `scripts/release-dry-run.mjs:13-15` parses manifests without path-aware diagnostics.
- `scripts/release-dry-run.mjs:40-41` checks only `result.status`, not `result.error` or `result.signal`.

Fix:

- Wrap manifest parse failures with the package path.
- Log spawn error, signal termination, and non-zero status separately.

### M5. Schema reads skip explicit org-context assertion

Evidence:

- `packages/core/src/schema-engine/engine.ts:77-91` lists/gets schema objects without calling `assertOrgContext`.
- `addField`, `preview`, and `apply` do assert org context at `engine.ts:99`, `engine.ts:143`, and `engine.ts:151`.

Fix:

- Add `assertOrgContext(ctx)` to `listObjects` and `getObject`.
- Add async rejection unit tests for missing org context.

### M6. MCP harness leaks server if client connect fails

Evidence:

- `e2e/src/harness/run-mcp.ts:39-40` connects server, then awaits client connect with no cleanup path.

Fix:

- Wrap `mcpClient.connect(clientTransport)` in `try/catch`.
- Close the server in the catch path and rethrow with `cause`.
- Add a regression test.

### M7. Deal value validation accepts unsafe numeric strings

Evidence:

- `packages/core/src/entities/deals/validators.ts:20-21` and `:49-50` coerce number/string via `String(v)`.

Fix:

- Replace with a shared decimal-safe Zod schema.
- Reject non-finite values, unsafe integer magnitudes, scientific notation, and more than two fractional digits.
- Preserve `.optional().nullable()`.

### M8. Rollback ledger is not actionable yet

Evidence:

- `packages/core/src/schema-engine/engine.ts:147-153` has no rollback implementation.
- `packages/sdk/src/transport/direct-transport.ts:176-178` already expects `schema.rollback`.

Fix:

- Record forward and reverse SQL atomically with migration execution.
- Add rollback lifecycle metadata or append-only reversal rows.
- Execute reverse SQL in reverse order under migration authority.

### M9. SQLite migrate ignores configured migration database

Evidence:

- `packages/core/src/adapters/sqlite/adapter.ts:53-62` stores `migrationDatabase` but default `migrateImpl` calls `initializeAllSqliteSchemas(this.unsafeRawDatabase)`.

Fix:

- Route SQLite schema initialization through `runWithMigrationAuthority((db) => initializeAllSqliteSchemas(db))`.

### M10. Plan C documentation note incorrectly says `docs/product/release-definition-v2.md` does not exist

Evidence:

- Plan C follow-up line 1112 says `docs/product/release-definition-v2.md` does not exist.
- In this checkout, `docs/product/release-definition-v2.md` exists and is the active alpha.1 launch gate.

Fix:

- Update Plan C Task 12 to link and amend `docs/product/release-definition-v2.md` rather than claiming it is absent.
- Ensure known limitations are recorded in both the release definition and user-facing changelog/docs.

### M11. Plan D proposed version test uses `__dirname` in an ESM package

Evidence:

- Plan D follow-up lines 683-688 use `path.resolve(__dirname, '..', 'package.json')`.
- `packages/create-orbit-app/package.json:5` is `type: module`.

Fix:

- Use `fileURLToPath(new URL('../package.json', import.meta.url))`.
- Or define `__filename` / `__dirname` explicitly in the test.

## Positive Checks

- No arbitrary file-write/path-traversal issue found in the current `create-orbit-app` target path flow. Project names reject `/`, `.`, and uppercase; target symlinks are refused; template symlinks and special files are ignored.
- No direct shell-injection issue found in current `--install-cmd` execution because `execa(cmd, args, { shell: false })` is used. It remains trusted input and should be documented as such.
- No current RLS generation bug found in static review. `generatePostgresRlsSql` uses `app.current_org_id` and emits tenant policies for implemented tenant tables.

## Required Fix Order

1. Fix Plan B package-name and release-gate blockers: scoped create-orbit-app changeset, `@orbit-ai/e2e` Changesets handling, release workflow E2E gate, verifier license/bin checks.
2. Fix Plan C test truthfulness and coverage: Journey 8 honesty, Journey 15, MCP tool invocations, CRUD update persistence, Postgres matrix accuracy.
3. Treat Plan C.5 as design work, not implementation work. Complete brainstorming/spec/planning before any migration-engine code is written.
4. Fix Plan D security/test plan issues: escaped/no cleanup shell commands, ESM version test, `prepack`, `--install-cmd` trust docs, timeout/conflict tests.
5. Rerun validation: `pnpm -r build`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -F @orbit-ai/e2e test`, `node --test scripts/release-workflow.test.mjs`, `node scripts/verify-package-artifacts.mjs`, and a publish dry-run/tarball inspection using valid commands for pnpm/npm.
