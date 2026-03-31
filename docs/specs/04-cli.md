# Spec 4: `@orbit-ai/cli`

Status: Ready for implementation
Package: `packages/cli`
Depends on: `@orbit-ai/sdk`, `@orbit-ai/core`, `@orbit-ai/mcp` for embedded serve command

## 1. Scope

`@orbit-ai/cli` is the primary terminal interface for humans and agents. It must expose:

- full noun/verb CRUD coverage for first-party entities
- schema and migration commands
- context briefing and reporting commands
- consistent output formats: `table`, `json`, `csv`, `tsv`
- structured errors in `--json` mode
- interactive prompts for humans
- `orbit mcp serve` to launch the MCP server

The CLI must never implement domain logic directly. It is a presentation layer over the SDK.

## 2. Package Structure

```text
packages/cli/
├── src/
│   ├── index.ts
│   ├── program.ts
│   ├── config/
│   │   ├── files.ts
│   │   └── resolve-context.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── status.ts
│   │   ├── doctor.ts
│   │   ├── seed.ts
│   │   ├── migrate.ts
│   │   ├── context.ts
│   │   ├── contacts.ts
│   │   ├── companies.ts
│   │   ├── deals.ts
│   │   ├── log.ts
│   │   ├── tasks.ts
│   │   ├── notes.ts
│   │   ├── sequences.ts
│   │   ├── fields.ts
│   │   ├── schema.ts
│   │   ├── report.ts
│   │   ├── dashboard.tsx
│   │   ├── search.ts
│   │   ├── integrations.ts
│   │   └── mcp.ts
│   ├── output/
│   │   ├── formatter.ts
│   │   ├── table.ts
│   │   ├── csv.ts
│   │   └── json.ts
│   ├── interactive/
│   │   ├── prompt.tsx
│   │   ├── autocomplete.ts
│   │   └── confirm.tsx
│   └── ink/
│       ├── pipeline-board.tsx
│       ├── dashboard.tsx
│       └── status-panel.tsx
└── package.json
```

## 3. Command Surface

The CLI mirrors the meta plan exactly.

### 3.1 Core Setup

```text
orbit init
orbit status
orbit doctor
orbit seed
orbit migrate --preview
orbit migrate --apply
orbit migrate --rollback
```

### 3.2 Contacts

```text
orbit contacts list
orbit contacts get <id>
orbit contacts create
orbit contacts update <id>
orbit contacts delete <id>
orbit contacts search <query>
orbit contacts import <file>
orbit contacts export
```

### 3.3 Companies

```text
orbit companies list
orbit companies get <id>
orbit companies create
orbit companies update <id>
orbit companies delete <id>
orbit companies search <query>
```

### 3.4 Deals

```text
orbit deals list
orbit deals get <id>
orbit deals create
orbit deals update <id>
orbit deals delete <id>
orbit deals move <id> --stage <stage-id>
orbit deals pipeline
orbit deals stats
orbit deals search <query>
```

### 3.5 Activity and Tasks

```text
orbit log call
orbit log email
orbit log meeting
orbit log note
orbit tasks list
orbit tasks get <id>
orbit tasks create
orbit tasks done <id>
orbit notes list
orbit notes get <id>
orbit notes create
orbit notes update <id>
orbit notes delete <id>
orbit sequences list
orbit sequences get <id>
orbit sequences create
orbit sequences update <id>
orbit sequences delete <id>
orbit sequences enroll <sequence-id> --contact <contact-id>
orbit sequences unenroll <enrollment-id>
```

### 3.6 Schema and Fields

```text
orbit schema list
orbit schema describe [entity]
orbit fields create <entity> <field-name> <field-type>
orbit fields update <entity> <field-name>
orbit fields delete <entity> <field-name>
```

### 3.7 Reports and Utilities

```text
orbit report pipeline
orbit report activities
orbit report conversion
orbit dashboard
orbit context <contact-id|email>
orbit search <query>
orbit mcp serve
orbit integrations add <name>
orbit integrations list
```

## 4. Global Flags

Every command supports:

- `--format table|json|csv|tsv`
- `--json` shorthand for `--format json`
- `--quiet`
- `--no-color`
- `--api-key`
- `--base-url`
- `--org-id`
- `--user-id`
- `--profile <name>`
- `--dry-run`
- `--idempotency-key`

JSON mode must never print banners, spinners, prompts, or prose outside the JSON payload.

## 5. Commander Composition

```typescript
// packages/cli/src/program.ts
import { Command } from 'commander'
import { registerInitCommand } from './commands/init'
import { registerStatusCommand } from './commands/status'
import { registerDoctorCommand } from './commands/doctor'
import { registerSeedCommand } from './commands/seed'
import { registerMigrateCommand } from './commands/migrate'
import { registerContextCommand } from './commands/context'
import { registerContactsCommand } from './commands/contacts'
import { registerCompaniesCommand } from './commands/companies'
import { registerDealsCommand } from './commands/deals'
import { registerLogCommand } from './commands/log'
import { registerTasksCommand } from './commands/tasks'
import { registerNotesCommand } from './commands/notes'
import { registerSequencesCommand } from './commands/sequences'
import { registerSchemaCommand } from './commands/schema'
import { registerFieldsCommand } from './commands/fields'
import { registerReportCommand } from './commands/report'
import { registerDashboardCommand } from './commands/dashboard'
import { registerSearchCommand } from './commands/search'
import { registerIntegrationsCommand } from './commands/integrations'
import { registerMcpCommand } from './commands/mcp'

export function createProgram() {
  const program = new Command()
    .name('orbit')
    .description('Orbit AI CLI')
    .option('--format <format>', 'table|json|csv|tsv', 'table')
    .option('--json', 'alias for --format json')
    .option('--quiet', 'suppress non-data output', false)
    .option('--no-color', 'disable colors')
    .option('--api-key <key>')
    .option('--base-url <url>')
    .option('--org-id <orgId>')
    .option('--user-id <userId>')
    .option('--profile <name>')
    .option('--dry-run', false)
    .option('--idempotency-key <key>')

  registerInitCommand(program)
  registerStatusCommand(program)
  registerDoctorCommand(program)
  registerSeedCommand(program)
  registerMigrateCommand(program)
  registerContextCommand(program)
  registerContactsCommand(program)
  registerCompaniesCommand(program)
  registerDealsCommand(program)
  registerLogCommand(program)
  registerTasksCommand(program)
  registerNotesCommand(program)
  registerSequencesCommand(program)
  registerSchemaCommand(program)
  registerFieldsCommand(program)
  registerReportCommand(program)
  registerDashboardCommand(program)
  registerSearchCommand(program)
  registerIntegrationsCommand(program)
  registerMcpCommand(program)

  return program
}
```

## 6. SDK Client Resolution

CLI context resolution order:

1. command flags
2. `ORBIT_*` environment variables
3. `.orbit/config.json`
4. `~/.config/orbit/config.json`

Project config must explicitly support hosted and direct modes:

```json
{
  "mode": "api",
  "profile": "default",
  "baseUrl": "https://api.orbit-ai.dev",
  "apiKeyEnv": "ORBIT_API_KEY",
  "context": {
    "orgId": "org_01...",
    "userId": "user_01..."
  }
}
```

```json
{
  "mode": "direct",
  "profile": "local",
  "adapter": "sqlite",
  "databaseUrl": "./.orbit/orbit.db",
  "context": {
    "orgId": "org_01...",
    "userId": "user_01..."
  }
}
```

```typescript
// packages/cli/src/config/resolve-context.ts
import { OrbitClient } from '@orbit-ai/sdk'
import { createSqliteAdapter, createSupabaseAdapter, createNeonAdapter, createPostgresAdapter } from '@orbit-ai/core'

export function resolveClient(flags: {
  apiKey?: string
  baseUrl?: string
  orgId?: string
  userId?: string
  mode?: 'api' | 'direct'
  adapter?: 'sqlite' | 'supabase' | 'neon' | 'postgres'
  databaseUrl?: string
}) {
  if (flags.mode === 'direct') {
    const adapter = resolveAdapter(flags)
    return new OrbitClient({
      adapter,
      context: {
        orgId: flags.orgId ?? process.env.ORBIT_ORG_ID ?? requiredConfig('context.orgId'),
        userId: flags.userId ?? process.env.ORBIT_USER_ID,
      },
    })
  }

  return new OrbitClient({
    apiKey: flags.apiKey ?? process.env.ORBIT_API_KEY,
    baseUrl: flags.baseUrl ?? process.env.ORBIT_BASE_URL,
    context: flags.orgId ? { orgId: flags.orgId, userId: flags.userId } : undefined,
  })
}

function resolveAdapter(flags: {
  adapter?: 'sqlite' | 'supabase' | 'neon' | 'postgres'
  databaseUrl?: string
}) {
  switch (flags.adapter) {
    case 'sqlite':
      return createSqliteAdapter({ databaseUrl: flags.databaseUrl ?? './.orbit/orbit.db' })
    case 'supabase':
      return createSupabaseAdapter({ databaseUrl: flags.databaseUrl ?? process.env.DATABASE_URL! })
    case 'neon':
      return createNeonAdapter({ databaseUrl: flags.databaseUrl ?? process.env.DATABASE_URL! })
    default:
      return createPostgresAdapter({ databaseUrl: flags.databaseUrl ?? process.env.DATABASE_URL! })
  }
}

function requiredConfig(path: string): never {
  throw new Error(`Missing required Orbit CLI config: ${path}`)
}
```

## 7. Output Formatting

### 7.1 JSON

- raw envelope from SDK, normalized to CLI metadata
- errors printed as JSON and exit with code `1`

### 7.2 Table

- use `cli-table3` or a small custom table renderer
- dates displayed in ISO format by default
- booleans rendered as `yes` / `no`
- arrays rendered comma-separated

### 7.3 CSV and TSV

- flatten nested objects using dot paths
- `custom_fields` flattened as `custom_fields.<field_name>`
- RFC 4180 escaping for CSV

```typescript
// packages/cli/src/output/formatter.ts
export interface FormatOptions {
  format: 'table' | 'json' | 'csv' | 'tsv'
  quiet?: boolean
}

export function formatOutput(data: unknown, options: FormatOptions): string {
  switch (options.format) {
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'csv':
      return formatDelimited(data, ',')
    case 'tsv':
      return formatDelimited(data, '\t')
    default:
      return formatTable(data)
  }
}
```

## 8. `orbit init`

Responsibilities:

- create `.orbit/config.json`
- write `.env.example`
- scaffold adapter config
- optionally run first migration
- optionally seed starter pipeline
- emit AGENTS.MD/llms context hints into the project root when missing

Interactive prompts:

1. adapter: `supabase`, `neon`, `postgres`, `sqlite`
2. hosted API vs direct DB mode
3. default organization name
4. seed demo data yes/no
5. start MCP config yes/no

Non-interactive form:

```bash
orbit init --db supabase --org-name "Acme" --yes --json
```

`orbit init` must write a config file that records:

- `mode`
- `adapter`
- `baseUrl` or `databaseUrl`
- default `orgId`
- default `userId` when available
- profile name

## 9. `orbit context`

`orbit context <contact-id|email>` calls `crm.contacts.context()` and renders a dossier.

Table mode sections:

- contact summary
- company
- open deals
- open tasks
- recent activities
- tags

JSON mode returns the exact SDK payload unchanged.

## 10. Ink Views

Ink is used selectively, not everywhere.

Use Ink for:

- `orbit dashboard`
- `orbit deals pipeline`
- interactive confirmations for destructive migrations

Do not use Ink in `--json` mode.

```tsx
// packages/cli/src/ink/pipeline-board.tsx
import { Box, Text } from 'ink'

export function PipelineBoard(props: {
  columns: Array<{ stage: string; deals: Array<{ id: string; title: string; value?: string }> }>
}) {
  return (
    <Box flexDirection="row" gap={2}>
      {props.columns.map((column) => (
        <Box key={column.stage} flexDirection="column" borderStyle="round" padding={1} width={30}>
          <Text bold>{column.stage}</Text>
          {column.deals.map((deal) => (
            <Text key={deal.id}>{deal.title}</Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}
```

## 11. Interactive Mode

Human mode behavior:

- if required args are missing and stdin is a TTY, prompt interactively
- support fuzzy entity lookup for IDs
- confirm destructive actions
- persist last-used profile and org

Agent mode behavior:

- disabled automatically when `--json` or non-TTY output is detected
- missing args return structured validation errors instead of prompts

## 12. `orbit mcp serve`

The CLI wraps the MCP package so users can start an MCP server with one command.

```typescript
// packages/cli/src/commands/mcp.ts
import { startMcpServer } from '@orbit-ai/mcp'

export function registerMcpCommand(program: import('commander').Command) {
  program
    .command('mcp')
    .description('MCP server commands')
    .command('serve')
    .option('--transport <transport>', 'stdio|http', 'stdio')
    .option('--port <port>')
    .action(async (flags, command) => {
      await startMcpServer({
        transport: flags.transport,
        port: flags.port ? Number(flags.port) : undefined,
      })
    })
}
```

## 13. Distribution

Required distributions:

- npm executable: `npx @orbit-ai/cli`
- installable binary package through npm
- standalone binary built with `bun build --compile`

Package manifest requirements:

- `bin: { "orbit": "./dist/index.js" }`
- ESM build
- shebang preserved

## 14. Acceptance Criteria

1. Every command listed in the meta plan exists.
2. Every command supports `--json`.
3. `orbit init`, `orbit context`, and `orbit mcp serve` work end-to-end.
4. Table, JSON, CSV, and TSV output all work from the same data payload.
5. Human mode prompts only when appropriate; agent mode never prompts.
6. CLI delegates all business logic to SDK/core rather than duplicating it.
7. The registered Commander command tree exactly matches the documented command surface, including `seed`, `log`, `notes`, `sequences`, and `search`.
8. Hosted API mode and direct DB mode are both configurable and exercised through the same CLI surface.
