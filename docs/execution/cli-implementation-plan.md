# Orbit AI CLI Implementation Plan

Date: 2026-04-09
Revised: 2026-04-09 (post multi-agent review: architecture, security, testing)
Status: Execution-ready baseline
Package: `@orbit-ai/cli`
Depends on:
- [IMPLEMENTATION-PLAN.md](/Users/sharonsciammas/orbit-ai/docs/IMPLEMENTATION-PLAN.md)
- [api-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/api-implementation-plan.md)
- [sdk-implementation-plan.md](/Users/sharonsciammas/orbit-ai/docs/execution/sdk-implementation-plan.md)
- [03-sdk.md](/Users/sharonsciammas/orbit-ai/docs/specs/03-sdk.md)
- [04-cli.md](/Users/sharonsciammas/orbit-ai/docs/specs/04-cli.md)
- [orbit-ai-threat-model.md](/Users/sharonsciammas/orbit-ai/docs/security/orbit-ai-threat-model.md)
- [KB.md](/Users/sharonsciammas/orbit-ai/docs/KB.md)

## 1. Purpose

This document defines how to execute `@orbit-ai/cli` after the API and SDK planning baselines.

The CLI is not a second application contract. It is the terminal presentation layer over the accepted SDK surface. That matters most in `--json` mode: the CLI must emit real Orbit envelopes via SDK response-aware helpers and must not reconstruct `meta`, `links`, cursors, or `request_id` client-side.

This document is intentionally precise because it will be executed by AI sub-agents without human clarification. Every discrepancy between the spec and the real codebase is documented here. Agents must follow this plan rather than the spec snippets where they conflict.

## 2. CLI Objective

Deliver `@orbit-ai/cli` as the primary human and agent terminal interface for Orbit:

1. bootstrap `packages/cli`
2. define one shared program, flag, config, error, and output boundary
3. resolve hosted and direct SDK clients from flags, env, project config, and user config
4. implement command waves in the same breadth order as the accepted SDK surface
5. keep JSON mode envelope-faithful and non-interactive
6. add selective human UX on top: prompts, confirmations, and Ink views where the spec explicitly wants them
7. only wrap MCP and integrations commands once the required downstream packages exist and their seams are explicit

This is a CLI milestone. It is not permission to invent a new transport contract, bypass the SDK, or pull unreconciled MCP/integrations behavior forward.

## 3. Current Readiness And Constraints

Current repository state:

- `packages/cli` does not exist yet.
- `@orbit-ai/api` and `@orbit-ai/sdk` now exist, build, and already encode the main route/envelope/parity rules the CLI should consume.

### 3.1 Confirmed SDK Surface

These are the exact, verified SDK call signatures agents must use. **Do not use snippets from `docs/specs/04-cli.md` or `docs/specs/03-sdk.md` without cross-referencing the actual source file.** The spec snippets contain errors that this plan corrects.

**`OrbitClient` namespace**: the client exposes resources directly on the instance:

```typescript
client.contacts     // ContactResource
client.companies    // CompanyResource
client.deals        // DealResource
client.stages       // StageResource
client.activities   // ActivityResource
client.tasks        // TaskResource
client.notes        // NoteResource
client.products     // ProductResource
client.payments     // PaymentResource
client.contracts    // ContractResource
client.sequences    // SequenceResource
client.sequenceSteps
client.sequenceEnrollments
client.sequenceEvents
client.pipelines    // PipelineResource
client.tags         // TagResource
client.schema       // SchemaResource
client.webhooks     // WebhookResource
client.imports      // ImportResource
client.users        // UserResource
client.search       // SearchResource
```

There is **no** `client.crm` namespace. `orbit context <id>` must call `client.contacts.context(idOrEmail)` (table mode) or `client.contacts.response().context(idOrEmail)` (JSON mode).

**List and pagination**: verify the actual behavior in `packages/sdk/src/resources/base-resource.ts` before implementing. Based on post-merge review:

- `resource.list(query)` returns the first-page envelope (`Promise<OrbitEnvelope<T[]>>`). Do **not** call `.firstPage()` on top of `.list()`.
- For multi-page iteration, use `resource.pages(query).autoPaginate()` — `pages()` takes the query argument. Do not call `pages()` with zero arguments.
- CLI `--json` mode for list commands: call `resource.list(query)` and emit the result directly. Never reconstruct `meta`, `links`, or `next_cursor`.

**CRUD JSON mode**: use `resource.response().<method>(...)` which returns `Promise<OrbitEnvelope<T>>`.

**Search JSON mode**: use `client.search.response().query({ query: term, object_types: types, limit })`.

### 3.2 Adapter Factory Corrections

The spec's `resolve-context.ts` snippet imports four adapter factories that **do not exist**. The actual `@orbit-ai/core` exports are:

| Spec snippet name (WRONG) | Actual export name (CORRECT) | Config shape |
|---------------------------|------------------------------|--------------|
| `createSqliteAdapter` | `createSqliteStorageAdapter` | `{ database: OrbitDatabase }` |
| `createPostgresAdapter` | `createPostgresStorageAdapter` | `{ database: Pool }` — requires `pg.Pool` |
| `createSupabaseAdapter` | **does not exist** | throw `CliUnsupportedAdapterError` |
| `createNeonAdapter` | **does not exist** | throw `CliUnsupportedAdapterError` |

**SQLite construction** (two steps required — the spec's `{ databaseUrl }` pattern is wrong):

```typescript
import { DatabaseSync } from 'node:sqlite'
import { createSqliteStorageAdapter } from '@orbit-ai/core'

const database = new DatabaseSync(flags.databaseUrl ?? './.orbit/orbit.db')
const adapter = createSqliteStorageAdapter({ database })
```

**Postgres construction**:

```typescript
import { Pool } from 'pg'
import { createPostgresStorageAdapter } from '@orbit-ai/core'

const database = new Pool({ connectionString: flags.databaseUrl ?? process.env.DATABASE_URL })
const adapter = createPostgresStorageAdapter({ database })
```

Verify the exact config shape by reading `packages/core/src/adapters/sqlite/adapter.ts` and `packages/core/src/adapters/postgres/adapter.ts` before writing `src/config/resolve-context.ts`.

### 3.3 Known Dependency Gaps

1. `@orbit-ai/mcp` does not exist. `orbit mcp serve` must be deferred or explicitly marked unavailable until that package ships. The command must exist in the Commander tree but throw a clear `CliNotImplementedError` on execution.
2. Supabase and Neon direct adapters do not exist in `@orbit-ai/core`. These adapter names must throw a `CliUnsupportedAdapterError` immediately in `resolveAdapter()` — before any `OrbitClient` is constructed.
3. `orbit seed` and `orbit migrate` commands require a configured adapter to execute. They belong in Slice C alongside `orbit init` and `orbit doctor`.

## 4. In Scope

Package bootstrap:

- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/cli/vitest.config.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/program.ts`

Runtime boundary:

- shared global flags
- config file discovery and profile resolution
- SDK client resolution for API mode and direct mode
- centralized command execution and error-to-exit-code mapping
- formatters for `table`, `json`, `csv`, and `tsv`

Command work:

- setup commands: `init`, `status`, `doctor`, `seed`, `migrate`
- Wave 1 entity commands aligned to the stable SDK surface
- Wave 2 entity and workflow commands aligned to the stable SDK surface
- schema and field commands that wrap SDK schema helpers
- reporting, search, and context commands
- selective Ink views and interactive prompts where the spec requires them
- deferred-but-registered commands: `mcp`, `integrations`

Contract proof:

- JSON-mode tests proving real envelopes are preserved (5 specific cases — see Slice C)
- formatter tests (11 specific cases — see Slice C)
- config resolution tests (15 cases — see Slice B)
- command parsing and non-interactive validation tests
- exit code mapping tests (6 cases — see Slice A)
- Ink component tests (4 cases — see Slice F)
- CLI smoke test via subprocess (3 cases — see Slice G)
- final review artifacts under `docs/review/`

## 5. Out Of Scope

- new business logic in the CLI layer
- route or envelope changes that belong to API or SDK
- direct database access that bypasses `@orbit-ai/sdk`
- implementation of missing adapter families (Supabase, Neon)
- implementation of `@orbit-ai/mcp` itself
- integrations runtime behavior beyond listing or wrapping already-implemented downstream seams
- `bun build --compile` standalone binary (deferred to post-alpha; tsc build is the alpha target)

## 6. Required Execution Principles

### 6.1 SDK Boundary

1. The SDK is the only command execution boundary. The CLI may not call core services or API routes directly except through accepted SDK surfaces.
2. `--json` mode must use `resource.list(query)` or `.response()` helpers directly. It may not fabricate envelopes.
3. JSON mode must never emit prompts, banners, spinners, Ink output, or prose outside the JSON payload.
4. Human interaction is additive. Missing args in agent mode must return typed validation failures rather than prompting.
5. Direct mode stays explicitly trusted-caller-only. The CLI must not imply it has API middleware protections when using embedded adapters.
6. Command breadth follows SDK acceptance order. Do not build CLI coverage ahead of a stable SDK helper just to match the spec matrix on paper.
7. Destructive schema actions must require explicit confirmation in TTY mode and remain non-interactive in `--json` mode.
8. Output formatters must work from already-correct data; they are not allowed to infer transport metadata.

### 6.2 Security Principles

These are not optional. All must be implemented in the slice they are assigned to.

9. **API key visibility**: `--api-key` is visible in `ps aux` and shell history. When `--api-key` is used, the CLI must print to stderr: `"Warning: --api-key is visible in process listings. Prefer ORBIT_API_KEY env var."` After parsing, overwrite `process.argv` entries containing the key. Verify this requirement is implemented in Slice B.
10. **Config file permissions**: `orbit init` must write `.orbit/config.json` with file mode `0600`. On startup, the config reader must warn to stderr if the config file is readable by group or world (permissions wider than `0600`). Implement this in Slice B (reader) and Slice C (`init`).
11. **Gitignore scaffolding**: `orbit init` must append `.orbit/` to `.gitignore` if not already present, and warn if `.gitignore` is absent. Implement in Slice C.
12. **No file overwrites without confirmation**: `orbit init` must never overwrite existing files (including `.env.example`) without an explicit `--overwrite` flag. When `--yes` is passed, missing files may be created; existing files must not be replaced. Implement in Slice C.
13. **No literal secrets in scaffolded files**: `.env.example` must contain only placeholder values (`ORBIT_API_KEY=your-key-here`). `config.json` must store `apiKeyEnv` (the env var name) never the literal key. Implement in Slice C.
14. **Direct mode TTY warning**: when the resolved mode is `direct` and stdout is a TTY, the CLI must print to stderr before execution: `"Warning: running in direct mode — auth, rate limiting, scope enforcement, and SSRF protection are not active."` This warning must only be suppressible by `--quiet`. Implement in Slice B.
15. **Database URL scheme allowlist**: before calling any adapter factory, validate the `databaseUrl` scheme. SQLite accepts file paths (relative or absolute) only — reject any scheme starting with `http`, `ftp`, etc. Postgres/Supabase/Neon accept `postgresql://` or `postgres://` only. Throw a `CliValidationError` for any other scheme. Implement in Slice B (`resolveAdapter`).
16. **Config path canonicalization**: all config file paths discovered by `src/config/files.ts` must be canonicalized via `fs.realpathSync` before reading. Reject any path that resolves outside the project root or user home directory. Implement in Slice B.
17. **`orbit init` never writes to `.env`**: `orbit init` must only write to `.env.example`. If a user passes `--env-file .env`, reject with a clear error. Implement in Slice C.
18. **`contacts import` deferred stub**: the command must be registered but throw `CliNotImplementedError` — never silently missing and never crashing with a raw import error. File path validation must be added when the SDK file-upload seam is implemented. Implement the stub in Slice D.
19. **MCP server binding**: when `@orbit-ai/mcp` ships, its HTTP transport must default to `127.0.0.1` (localhost-only). Binding to `0.0.0.0` must require an explicit `--host 0.0.0.0` flag with a stderr warning. This requirement must be enforced at the CLI wrapper layer in Slice G.

### 6.3 Destructive Action Definition

The following CLI actions are **destructive** and require the behaviors described:

- `orbit fields delete <entity> <field-name>`
- `orbit migrate --rollback`
- `orbit migrate --apply` when the migration preview contains any `DROP COLUMN`, `DROP TABLE`, or `RENAME COLUMN` operation
- `orbit contacts delete <id>` with a `--bulk` flag (if implemented)

**TTY mode**: require `--yes` or an interactive confirmation prompt before execution. The prompt must name the specific action and target.

**`--json` mode or non-TTY**: must return exit code 1 with a structured error — do **not** silently skip. Error body:

```json
{
  "error": {
    "code": "DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION",
    "message": "Use --yes to confirm this destructive action in non-interactive mode.",
    "action": "fields.delete",
    "target": "contacts.custom_tier"
  }
}
```

## 7. Exit Code Mapping

This table is a contract. Every sub-agent must implement it exactly.

| Exit code | Condition |
|-----------|-----------|
| 0 | Success |
| 1 | API/SDK error (`OrbitApiError`, HTTP error from server) |
| 2 | CLI validation error (missing required arg, invalid flag value, unsupported adapter) |
| 3 | Config error (missing required config file, unresolvable profile, malformed config JSON) |
| 130 | Interrupted by SIGINT |

In `--json` mode, error payloads for exit codes 1, 2, and 3 must be written to **stdout** (not stderr) before exit so agent consumers can parse them. Stderr in JSON mode is reserved for debug/trace output only.

## 8. File-to-Slice Mapping

Every file the CLI package requires is assigned to exactly one slice. Sub-agents must not create files outside their assigned slice without explicit cross-slice justification.

| File | Slice | Notes |
|------|-------|-------|
| `package.json` | A | include `bin`, `files`, `type: "module"` |
| `tsconfig.json` | A | include `*.tsx`, `jsx: "react-jsx"` |
| `vitest.config.ts` | A | see Slice A requirements |
| `src/index.ts` | A | shebang, binary entry |
| `src/program.ts` | A | Commander composition |
| `src/config/files.ts` | B | config discovery |
| `src/config/resolve-context.ts` | B | client/adapter resolution |
| `src/__tests__/setup.ts` | B | filesystem isolation helpers |
| `src/output/formatter.ts` | C | |
| `src/output/json.ts` | C | |
| `src/output/table.ts` | C | |
| `src/output/csv.ts` | C | |
| `src/commands/init.ts` | C | |
| `src/commands/status.ts` | C | |
| `src/commands/doctor.ts` | C | |
| `src/commands/seed.ts` | C | |
| `src/commands/migrate.ts` | C | destructive — see Section 6.3 |
| `src/commands/contacts.ts` | D | |
| `src/commands/companies.ts` | D | |
| `src/commands/deals.ts` | D | |
| `src/commands/context.ts` | D | wraps `client.contacts.context()` |
| `src/commands/search.ts` | D | |
| `src/commands/users.ts` | D | |
| `src/commands/log.ts` | E | |
| `src/commands/tasks.ts` | E | |
| `src/commands/notes.ts` | E | |
| `src/commands/sequences.ts` | E | |
| `src/commands/fields.ts` | E | destructive — see Section 6.3 |
| `src/commands/schema.ts` | E | |
| `src/commands/report.ts` | E | |
| `src/commands/dashboard.tsx` | F | Ink — `.tsx` extension |
| `src/interactive/prompt.tsx` | F | Ink |
| `src/interactive/autocomplete.ts` | F | |
| `src/interactive/confirm.tsx` | F | Ink |
| `src/ink/pipeline-board.tsx` | F | Ink |
| `src/ink/dashboard.tsx` | F | Ink |
| `src/ink/status-panel.tsx` | F | Ink |
| `src/commands/mcp.ts` | G | deferred stub |
| `src/commands/integrations.ts` | G | deferred stub |

## 9. Delivery Slices

### Slice A. Package Bootstrap And Program Skeleton

Goal:

- create `packages/cli` and lock the command-registration, execution seams, and exit-code contract before command breadth begins

Scope (see Section 8 for file ownership):

- package manifest, TS config, Vitest config, binary entry
- `src/index.ts`
- `src/program.ts`
- global options and shared command context types
- centralized command runner and top-level error handling

#### A.1 Package Manifest Requirements

`package.json` must include:

```json
{
  "name": "@orbit-ai/cli",
  "version": "0.1.0-alpha.0",
  "type": "module",
  "bin": { "orbit": "./dist/index.js" },
  "files": ["dist/", "README.md", "LICENSE"],
  "dependencies": {
    "commander": "^12.0.0",
    "ink": "^5.0.0",
    "react": "^18.0.0",
    "cli-table3": "^0.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

Use Commander v12. Use Ink v5 (ESM-only, React 18). Do not use older versions — they have incompatible module systems.

#### A.2 TypeScript Config Requirements

The CLI `tsconfig.json` must extend the root `tsconfig.base.json` and add:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**Critical**: the include pattern must cover `.tsx` files. Ink components (`dashboard.tsx`, `pipeline-board.tsx`, etc.) will be silently excluded if only `"src/**/*.ts"` is specified — the TypeScript build will succeed while omitting all Ink components.

#### A.3 Binary Entry Requirements

`src/index.ts` must begin with:

```typescript
#!/usr/bin/env node
```

The shebang must be the first line. The build step in `package.json` must run `chmod +x dist/index.js` after `tsc`.

```json
{
  "scripts": {
    "build": "rm -rf dist && tsc && chmod +x dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "dev": "tsx src/index.ts"
  }
}
```

#### A.4 Vitest Config Requirements

`vitest.config.ts` must include:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.smoke.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: { enabled: false },
  },
})
```

Smoke tests (subprocess invocation) are excluded from the default run. They are run separately in CI after `pnpm -r build`.

#### A.5 Exit Code Implementation

The centralized command runner must catch all thrown errors and map them to exit codes per Section 7. Implementation pattern:

```typescript
async function run() {
  try {
    const program = createProgram()
    await program.parseAsync(process.argv)
    process.exit(0)
  } catch (error) {
    const { code, payload } = classifyError(error)
    if (isJsonMode()) {
      process.stdout.write(JSON.stringify({ error: payload }) + '\n')
    } else {
      process.stderr.write(formatErrorForHuman(payload) + '\n')
    }
    process.exit(code)
  }
}
```

#### A.6 Required Tests (Slice A)

File: `src/__tests__/program.test.ts`

- All command names from spec Section 3 (`init`, `status`, `doctor`, `seed`, `migrate`, `contacts`, `companies`, `deals`, `context`, `search`, `users`, `log`, `tasks`, `notes`, `sequences`, `fields`, `schema`, `report`, `dashboard`, `mcp`, `integrations`) are registered in the Commander tree.
- `--json` flag sets internal format state to `'json'`.
- An unknown subcommand exits with a non-zero code.

File: `src/__tests__/exit-codes.test.ts`

- Successful command exits with code 0.
- `OrbitApiError` with `code: 'RESOURCE_NOT_FOUND'` → exit code 1, `{ error: { code, message } }` on stdout in JSON mode.
- Missing required argument in non-TTY mode → exit code 2.
- Unsupported adapter name → exit code 2.
- Malformed config JSON → exit code 3.
- In `--json` mode, all error exit codes still write JSON to stdout before exit.

Exit criteria:

- the package exists, builds, typechecks, and can host commands without reopening CLI-wide design questions

---

### Slice B. Config Resolution And SDK Client Bootstrap

Goal:

- make the CLI able to resolve one correct SDK client per invocation before adding broad commands

Scope:

- `src/config/files.ts`
- `src/config/resolve-context.ts`
- `src/__tests__/setup.ts`
- profile lookup and merge order
- environment-variable helpers
- direct-mode adapter resolution

#### B.1 Config Precedence

Config must be resolved in this order (highest wins):

1. Command flags (`--api-key`, `--base-url`, `--org-id`, etc.)
2. `ORBIT_*` environment variables
3. `.orbit/config.json` (project-level, resolved from `cwd` upward)
4. `~/.config/orbit/config.json` (user-level)

`src/config/files.ts` must canonicalize each discovered path via `fs.realpathSync` before reading. Reject any path that resolves outside `cwd` ancestors or `os.homedir()`. Throw a typed `CliConfigError` (exit code 3) rather than crashing with an unhandled exception.

#### B.2 SDK Client Construction

API mode:

```typescript
return new OrbitClient({
  apiKey: flags.apiKey ?? process.env.ORBIT_API_KEY,
  baseUrl: flags.baseUrl ?? process.env.ORBIT_BASE_URL,
  context: flags.orgId ? { orgId: flags.orgId, userId: flags.userId } : undefined,
})
```

Direct mode (follow adapter construction patterns in Section 3.2 exactly):

```typescript
const adapter = resolveAdapter(flags) // throws CliUnsupportedAdapterError for supabase/neon
// Print direct-mode TTY warning (Principle 14)
return new OrbitClient({ adapter, context: { orgId, userId } })
```

Missing `apiKey` in API mode must throw `CliValidationError` (exit code 2) with `code: 'MISSING_REQUIRED_CONFIG'` and `path: 'apiKey'`.

Missing `orgId` in direct mode must throw `CliValidationError` with `code: 'MISSING_REQUIRED_CONFIG'` and `path: 'context.orgId'`.

#### B.3 `resolveAdapter()` URL Validation

Before calling any adapter factory, validate the database URL scheme:

- SQLite: accept relative paths, absolute paths, and `file:` URIs only. Reject `http://`, `https://`, etc.
- Postgres: accept `postgresql://` and `postgres://` schemes only.
- `supabase` / `neon`: throw `CliUnsupportedAdapterError` with message naming the adapter and suggesting `postgres` as an alternative.

#### B.4 `--api-key` Security Requirement

If `--api-key` is present in `process.argv`:

1. Emit to stderr: `Warning: --api-key is visible in process listings. Prefer ORBIT_API_KEY env var.`
2. After extracting the value, overwrite the argv entry: `process.argv[keyIndex] = '--api-key=***'`.
3. Never log or serialize the key value in error payloads.

#### B.5 Required Review Gate

After Slice B: confirm the CLI config story matches current `@orbit-ai/core` and `@orbit-ai/sdk` exports rather than the older illustrative snippets in the spec. Specifically verify adapter factory names and config shapes against the actual source files.

#### B.6 Required Tests (Slice B)

File: `src/__tests__/setup.ts` — filesystem isolation helpers (shared across all test files):

```typescript
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

let tmpDirs: string[] = []

export function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-cli-test-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  tmpDirs = []
})
```

All tests that read or write config files must use `makeTmpDir()` for project root and a second temp dir for `HOME`. Inject these via the function that determines config file paths (mock it with `vi.mock` or inject via parameter).

File: `src/__tests__/config-resolve.test.ts`:

1. `--api-key` flag overrides `ORBIT_API_KEY` env var — assert resolved `apiKey` equals the flag value.
2. `ORBIT_API_KEY` env var overrides `.orbit/config.json` value.
3. `.orbit/config.json` (project) overrides `~/.config/orbit/config.json` (user) for the same key.
4. When only user config is present, its value is used.
5. Missing `apiKey` in API mode throws `CliValidationError` with `code: 'MISSING_REQUIRED_CONFIG'`.
6. `mode: 'direct'` with `adapter: 'sqlite'` calls `createSqliteStorageAdapter`.
7. `mode: 'direct'` with `adapter: 'postgres'` calls `createPostgresStorageAdapter`.
8. `mode: 'direct'` with `adapter: 'supabase'` throws `CliUnsupportedAdapterError`.
9. `mode: 'direct'` with `adapter: 'neon'` throws `CliUnsupportedAdapterError`.
10. Malformed config JSON (`{ broken`) throws `CliConfigError` with `code: 'CONFIG_PARSE_ERROR'`.
11. Missing `orgId` in direct mode throws `CliValidationError`.
12. Database URL with `http://` scheme for SQLite throws `CliValidationError` (URL scheme allowlist).
13. Config path outside project root throws `CliConfigError` (path canonicalization guard).
14. Direct mode in TTY prints warning to stderr listing missing middleware protections.
15. `--api-key` in argv triggers stderr warning and argv redaction.

Exit criteria:

- commands can construct the correct SDK client without route-local config logic

---

### Slice C. Output Boundary, JSON Fidelity, And Base Commands

Goal:

- prove the CLI's shared output and error behavior before entity command breadth lands

Scope:

- `src/output/formatter.ts`, `json.ts`, `table.ts`, `csv.ts`
- `src/commands/init.ts`, `status.ts`, `doctor.ts`, `seed.ts`, `migrate.ts`

#### C.1 Required Output Behavior

JSON mode: emit the exact SDK envelope or error payload. Never add keys. Never wrap in an additional object. Use `JSON.stringify(envelope, null, 2)` + newline.

Table mode: render from returned records. Booleans as `yes`/`no`. Arrays comma-separated. Dates as ISO strings. Nested objects as compact JSON strings — never as `[object Object]`.

CSV: RFC 4180 compliant. Fields containing commas, double-quotes, or newlines must be quoted. Double-quotes within quoted fields must be doubled (`""`). Header row is always the first line. `custom_fields` flatten as `custom_fields.<field_name>`.

TSV: same as CSV but tab-delimited. Fields containing literal tab characters must be escaped or stripped — this behavior must be chosen and documented in a comment in `csv.ts`.

#### C.2 `orbit init` Requirements

Scaffolds `.orbit/config.json` and `.env.example`.

Security requirements (Principles 10–13 and 17):

- Write `.orbit/config.json` with file mode `0600` via `fs.writeFileSync(path, content, { mode: 0o600 })`.
- Append `.orbit/` to `.gitignore` if not present. Warn if `.gitignore` is absent.
- Never write to `.env`. If user targets `.env`, reject with `CliValidationError`.
- Never write literal API key values to any file. Store only `apiKeyEnv: "ORBIT_API_KEY"`.
- Never overwrite existing files unless `--overwrite` flag is explicitly passed. When `--yes` is passed without `--overwrite`, create missing files only.

Non-interactive form: `orbit init --db sqlite --org-name "Acme" --yes --json`

`--org-name` must be validated: printable characters only, max 100 chars. Reject with `CliValidationError` otherwise.

#### C.3 `.gitignore` Requirement

Add `.orbit/` to the root `.gitignore` file as part of Slice C implementation. This prevents config files and SQLite databases created by `orbit init` from being accidentally committed.

#### C.4 Required Review Gate

JSON contract review after Slice C: confirm the shared output path does not reconstruct transport metadata and is safe for agent use.

#### C.5 Required Tests (Slice C)

File: `src/__tests__/json-fidelity.test.ts`:

1. Mock SDK transport to return envelope with known `request_id: 'req_known'`, `next_cursor: 'cursor_abc'`, `has_more: true`, `links.next: '/v1/contacts?cursor=cursor_abc'`. Run `contacts list --json`. Assert `JSON.parse(stdout).meta.request_id === 'req_known'` and `JSON.parse(stdout).meta.next_cursor === 'cursor_abc'`. This is the primary anti-fabrication proof.
2. Assert the JSON output object has no keys beyond what the SDK returned — no injected `generatedAt`, `cliVersion`, or similar additions.
3. Run `contacts get cnt_123 --json` with mocked single-record envelope. Assert `data.id` and `meta` are pass-through.
4. Run a command where the SDK throws `OrbitApiError`. Assert CLI writes `{ error: { code, message, request_id } }` to stdout and `request_id` matches what the SDK error contained (not a CLI-generated substitute). Assert exit code 1.
5. Assert that no line of stdout in `--json` mode contains ANSI escape codes or non-JSON prose. Use a regex assertion on the raw stdout string before `JSON.parse`.

File: `src/__tests__/non-tty.test.ts`:

- Set `process.stdout.isTTY = false` and `process.stdin.isTTY = false` before each test. Restore in `afterEach`.
- Call `contacts create` with no args and `isTTY = false`. Assert throws `CliValidationError`, no call to any `prompt()` or `confirm()` (use `vi.spyOn`).
- Call `contacts create` with all required args and `isTTY = false`. Assert proceeds normally.
- Call `orbit init` with no `--yes` and `isTTY = false`. Assert `CliValidationError`.

File: `src/__tests__/formatter.test.ts`:

CSV tests:
1. `{ name: 'Smith, John' }` → `"Smith, John"` (comma-in-field quoting).
2. `{ name: 'Say "hello"' }` → `"Say ""hello"""` (quote escaping, RFC 4180).
3. `{ bio: 'line1\nline2' }` → quoted with embedded newline preserved.
4. `custom_fields: { score: 42, tier: 'gold' }` flattens to columns `custom_fields.score` and `custom_fields.tier`.
5. Header row is the first line.

TSV tests:
6. Tab-containing field value is handled (escaped or stripped — whatever is implemented must be tested).

Table tests:
7. Nested object renders as readable string, not `[object Object]`.
8. `true` renders as `yes`, `false` as `no`.
9. Arrays render comma-separated.
10. Date strings render as ISO format.

JSON tests:
11. `formatOutput(envelope, { format: 'json' })` round-trips through `JSON.parse` with equality.

Exit criteria:

- the CLI has one accepted execution/output boundary that later commands reuse

---

### Slice D. Wave 1 Entity Commands And Search/Context

Goal:

- deliver the first broadly useful command wave on top of the already-stable SDK surface

Dependency:

- the accepted SDK Wave 1 helpers and their response semantics (verify in `packages/sdk/src/resources/` before implementing)

Scope:

- `contacts`, `companies`, `deals`, `pipelines` (via `client.pipelines`), `stages` (via `client.stages`), `users`, `search`, `context`

#### D.1 Context Command

`orbit context <contact-id|email>` calls `client.contacts.context(idOrEmail)` in table mode. In JSON mode, calls `client.contacts.response().context(idOrEmail)`.

**There is no `client.crm` namespace.** Do not use `crm.contacts.context()`. The correct accessor is `client.contacts`.

Table mode sections: contact summary, company, open deals, open tasks, recent activities, tags.

#### D.2 Search Command

`orbit search <query>` with optional flags:

```
orbit search <query> [--types contacts,deals,companies,...] [--limit N] [--cursor <cursor>]
```

Map to `SearchInput`:

```typescript
const input = {
  query: args.query,
  object_types: flags.types ? flags.types.split(',') : undefined,
  limit: flags.limit ? Number(flags.limit) : undefined,
  cursor: flags.cursor,
}
```

Table mode: `client.search.query(input)`.
JSON mode: `client.search.response().query(input)`.

#### D.3 List Commands

In JSON mode, list commands call `resource.list(query)` which returns the first-page envelope directly. Do NOT call `.firstPage()` on the result — `list()` already does this internally.

For commands that need multi-page iteration (e.g., export), use `resource.pages(query).autoPaginate()` — note the `query` argument is required.

In table mode, collect records from the envelope's `.data` array for rendering.

#### D.4 `contacts import` — Deferred

`orbit contacts import <file>` is **not implementable in Slice D**. `ImportResource.create({ entity_type, ... })` only registers import job metadata — it has no file upload seam. Uploading CSV file content to a batch import endpoint is not exposed by the current SDK.

The command must be registered in the Commander tree but throw `CliNotImplementedError` on execution:

```typescript
program
  .command('contacts import <file>')
  .description('Import contacts from a CSV file (requires file-upload seam in SDK)')
  .action(() => {
    throw new CliNotImplementedError(
      'orbit contacts import requires a file-upload seam that is not yet available in @orbit-ai/sdk.',
      { code: 'DEPENDENCY_NOT_AVAILABLE', dependency: 'sdk.imports.upload' },
    )
  })
```

When the SDK exposes a file upload or streaming import endpoint, this command must be revisited. At that point, file path validation (canonicalization via `fs.realpathSync`, path-escape guard) must be implemented before the file is opened.

#### D.5 Required Review Gate

Command-surface review after Slice D: confirm the first CLI wave mirrors the accepted SDK behavior and is stable enough for agent execution.

#### D.6 Required Tests (Slice D)

One test file per entity group (e.g., `src/__tests__/contacts.test.ts`), covering:

- `list --json`: assert envelope pass-through (reference `json-fidelity.test.ts` patterns).
- `list` (table): assert records render without `[object Object]`.
- `get <id> --json`: assert single-record envelope.
- `create --json`: assert created record envelope.
- `update <id> --json`: assert updated record envelope.
- `delete <id> --json`: assert deletion envelope.
- Non-TTY mode: missing required arg returns `CliValidationError`, no prompt.

`src/__tests__/context.test.ts`:

- `orbit context cnt_123 --json` calls `client.contacts.response().context('cnt_123')` — assert no fabricated envelope keys.
- `orbit context user@example.com` (table) calls `client.contacts.context('user@example.com')`.

`src/__tests__/search.test.ts`:

- `orbit search "Alice" --types contacts,deals --limit 10 --json` maps to correct `SearchInput`.
- `orbit search "Alice"` (no types) sends `object_types: undefined`.

Exit criteria:

- the CLI is useful for the first transport wave without inventing a second contract

---

### Slice E. Wave 2 Entity, Workflow, And Schema Commands

Goal:

- complete the main operational CLI surface once the matching SDK helpers are present and accepted

Dependency:

- the accepted SDK Wave 2 helpers and schema helpers (verify each in `packages/sdk/src/resources/` before implementing)

Scope:

- `activities`, `tasks`, `notes`, `products`, `payments`, `contracts`, `sequences`, `sequence_steps`, `sequence_enrollments`, `sequence_events`, `tags`, `webhooks`, `imports`
- `schema`, `fields`, `migrate`, `log`, `report`

#### E.1 Workflow Commands

Thin wrappers over SDK helpers:

- `orbit log call|email|meeting|note`: calls `client.activities.create({ type, ... })`
- `orbit deals move <id> --stage <stage-id>`: calls `client.deals.move(id, { stage_id })`
- `orbit sequences enroll <seq-id> --contact <contact-id>`: calls `client.sequences.enroll(seqId, body)` where `body` contains `contact_id` and any other enrollment fields. **Do not use `client.sequenceEnrollments.create()`** — enroll is a semantic workflow helper on the sequence resource itself (`sequences.ts` line 32), not a generic create on the enrollment resource.
- `orbit sequences unenroll <enrollment-id>`: calls `client.sequenceEnrollments.unenroll(enrollmentId)` — this is a dedicated workflow method (`sequence-enrollments.ts` line 33), not `delete()`. **Do not use `client.sequenceEnrollments.delete()`.**

#### E.2 Schema And Field Commands

Use `client.schema` resource exclusively. Never call core schema services directly.

`orbit migrate --preview`: calls `client.schema.previewMigration({})` and renders the diff in table mode.
`orbit migrate --apply` and `orbit migrate --rollback`: **destructive actions** — follow Section 6.3.

`orbit fields delete <entity> <field-name>`: **destructive action** — follow Section 6.3.

#### E.3 Required Review Gate

Command/dependency review after Slice E: confirm the CLI did not outrun the real SDK surface, especially for workflows and schema paths.

#### E.4 Required Tests (Slice E)

Same per-entity pattern as Slice D. Additional:

`src/__tests__/destructive-actions.test.ts`:

- `orbit fields delete contacts custom_tier --json` (no `--yes`): assert exit code 1, structured `DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION` error on stdout.
- `orbit fields delete contacts custom_tier --json --yes`: proceeds and returns deletion envelope.
- `orbit migrate --rollback --json` (no `--yes`): assert same error structure.
- `orbit migrate --rollback --yes`: proceeds.
- In TTY mode: assert confirm prompt is shown, and cancelling exits with code 1.

Exit criteria:

- the CLI's main command matrix is implementation-complete relative to available SDK coverage

---

### Slice F. Interactive UX, Ink Views, And Human-Only Affordances

Goal:

- add human-focused ergonomics after the agent-safe command baseline already exists

Scope:

- `src/interactive/` — `prompt.tsx`, `autocomplete.ts`, `confirm.tsx`
- `src/ink/` — `pipeline-board.tsx`, `dashboard.tsx`, `status-panel.tsx`
- `src/commands/dashboard.tsx`
- destructive confirmations
- fuzzy lookup helpers where practical

#### F.1 Required Behavior

- Ink is used only for commands the spec explicitly calls out: `orbit dashboard`, `orbit deals pipeline`, and destructive confirmations.
- All Ink and prompt paths must check `!process.stdout.isTTY || isJsonMode()` and skip rendering entirely when either is true. Never wrap this check in a try/catch — it must be a synchronous guard at the top of each interactive path.
- The CLI must fall back cleanly to plain text when terminal capabilities are limited.

#### F.2 Ink Testing Approach

Do **not** use React Testing Library or jsdom for Ink components. Ink renders to a Node TTY stream.

Use `ink`'s `render()` + `unmount()` in tests, or use the `renderToString()` utility for snapshot-style assertions. Import from `ink` directly — do not add `@inkjs/testing` as a separate dependency unless it ships with ink v5.

Vitest environment for Ink tests must remain `'node'` (not jsdom).

#### F.3 Required Tests (Slice F)

File: `src/__tests__/ink-views.test.ts`:

1. `PipelineBoard` with two columns and three deals renders each deal title.
2. `PipelineBoard` with an empty `deals` array renders the stage name but no deal rows.
3. `PipelineBoard` does not render (returns empty string) when `isJsonMode()` returns true.
4. `confirm.tsx` calls resolve with `true` on Enter keypress and `false` on Escape — simulate via stdin write.

Exit criteria:

- human UX is improved without weakening deterministic agent behavior

---

### Slice G. MCP/Integration Wrappers, CLI Smoke Tests, And Final Hardening

Goal:

- finish the remaining wrapper commands, add the subprocess smoke test, and close the validation/review loop

Scope:

- `src/commands/mcp.ts` — stub or real wrapper
- `src/commands/integrations.ts` — stub
- final documentation
- final review artifacts
- CLI smoke tests

#### G.1 MCP Command Behavior

`orbit mcp serve` is only implemented once `@orbit-ai/mcp` exists and exposes a stable start seam. Until then:

```typescript
export function registerMcpCommand(program: Command) {
  program
    .command('mcp serve')
    .description('Start the Orbit MCP server (requires @orbit-ai/mcp)')
    .action(() => {
      throw new CliNotImplementedError(
        'orbit mcp serve requires @orbit-ai/mcp which is not yet available.',
        { code: 'DEPENDENCY_NOT_AVAILABLE', dependency: '@orbit-ai/mcp' },
      )
    })
}
```

When `@orbit-ai/mcp` is implemented: HTTP transport must default to binding `127.0.0.1`. Binding to `0.0.0.0` requires `--host 0.0.0.0` with a stderr warning. This must be enforced at the CLI wrapper layer regardless of the MCP package's default.

#### G.2 Required Review Gates

**Code review**: confirm no command accesses core services or API routes directly; all execution goes through the SDK.

**Agent-UX review**: focus on `--json`, non-TTY behavior, error determinism, and exit code consistency.

**Security review** — named checklist (must verify each item):

- [ ] `--api-key` argv redaction and stderr warning are implemented (Principle 9)
- [ ] `.orbit/config.json` is written with mode `0600` (Principle 10)
- [ ] Config reader warns if file permissions are wider than `0600` (Principle 10)
- [ ] `.orbit/` is appended to `.gitignore` by `orbit init` (Principle 11)
- [ ] `orbit init` never overwrites existing files without `--overwrite` (Principle 12)
- [ ] No literal API key values appear in scaffolded files (Principle 13)
- [ ] Direct mode TTY warning is implemented (Principle 14)
- [ ] `databaseUrl` scheme allowlist is enforced before adapter factory call (Principle 15)
- [ ] Config paths are canonicalized and constrained (Principle 16)
- [ ] `orbit init` never writes to `.env` (Principle 17)
- [ ] `contacts import <file>` is registered but throws `CliNotImplementedError` (not silently missing, not crashing) (Principle 18)
- [ ] MCP HTTP transport defaults to `127.0.0.1` (Principle 19)
- [ ] Destructive actions in `--json` mode return exit 1 with structured error (Section 6.3)
- [ ] `--yes` flag is documented in `--help` output as a safety bypass

#### G.3 CLI Smoke Tests

File: `src/__tests__/smoke.test.ts` (excluded from default `vitest run` — run separately after `pnpm -r build`).

These tests spawn the compiled `orbit` binary as a subprocess:

1. `orbit contacts list --json` with direct SQLite mode (temp db, seeded with one contact). Assert exit code 0, valid JSON envelope on stdout.
2. `orbit contacts list --json` with an invalid `--api-key` against a mock local server. Assert exit code 1, `{ error: { code: 'AUTH_INVALID_API_KEY' } }` on stdout.
3. `orbit` with no arguments. Assert exit code 0 (help text) or the Commander default — whichever is chosen must be locked by this test.

#### G.4 Final Docs

Direct-mode trust boundaries must be documented clearly in `README.md` and in a code comment at the top of `src/config/resolve-context.ts` listing the specific middleware protections that are absent in direct mode.

Exit criteria:

- the CLI is accepted as a stable user and agent interface over the SDK

---

## 10. Validation Matrix

At minimum, the CLI branch must prove:

- one `orbit` program resolves config and constructs the correct SDK client in API mode and direct mode
- `--json` preserves server-owned `meta`, `links`, cursor fields, and `request_id` — verified by json-fidelity test case 1
- no command prints non-JSON output in `--json` mode — verified by json-fidelity test case 5
- table/CSV/TSV formatting is deterministic and does not corrupt record data
- non-TTY runs fail with typed validation errors instead of prompting — verified by non-tty tests
- destructive schema flows require `--yes` or interactive confirmation in TTY mode
- destructive schema flows return structured errors in `--json` mode — verified by destructive-actions tests
- command coverage matches the accepted SDK surface rather than bypassing through raw-core logic
- unsupported direct adapters fail with `CliUnsupportedAdapterError` — verified by config-resolve test cases 8–9
- `orbit mcp serve` fails gracefully when `@orbit-ai/mcp` is absent — verified by smoke test or unit test
- the `orbit` binary is executable and has a correct shebang

## 11. Branch Exit Criteria

The CLI implementation branch is complete when:

1. `packages/cli` exists, builds cleanly, and exposes the `orbit` binary.
2. Config resolution and SDK client bootstrap are review-accepted.
3. The shared output boundary preserves raw JSON envelopes correctly.
4. Wave 1 and Wave 2 command slices cover the accepted SDK surface.
5. Human-only interaction paths stay fully disabled in agent/JSON mode.
6. Final code, UX, and security reviews return no blocking findings (all 14 security checklist items pass).
7. Any still-missing dependency surfaces such as `@orbit-ai/mcp` are handled explicitly with `CliNotImplementedError` rather than implied to exist.
8. **The CLI package reaches a minimum of 120 tests**:

| Test area | Approx count |
|-----------|-------------|
| Program / command registration (Slice A) | 15 |
| Config resolution and adapter resolution (Slice B) | 20 |
| JSON fidelity (Slice C) | 10 |
| Formatter unit tests (Slice C) | 20 |
| Exit code mapping (Slice A/C) | 8 |
| Non-TTY / agent-mode (Slice C/D) | 8 |
| Wave 1 entity commands (Slice D) | 20 |
| Wave 2 entity and workflow commands (Slice E) | 15 |
| Destructive action enforcement (Slice E) | 8 |
| Ink components (Slice F) | 4 |
| Smoke / integration tests (Slice G) | 3 |

This brings the projected repo total to approximately 914 tests (current baseline: 794). Any PR that adds command breadth without corresponding tests for that command must be rejected at review.
