import { Command } from 'commander'
import { CliValidationError, CliConfigError, CliNotImplementedError } from './errors.js'
import type { GlobalFlags } from './types.js'
import { registerInitCommand } from './commands/init.js'
import { registerStatusCommand } from './commands/status.js'
import { registerDoctorCommand } from './commands/doctor.js'
import { registerSeedCommand } from './commands/seed.js'
import { registerMigrateCommand } from './commands/migrate.js'
import { registerContactsCommand } from './commands/contacts.js'
import { registerCompaniesCommand } from './commands/companies.js'
import { registerDealsCommand } from './commands/deals.js'
import { registerUsersCommand } from './commands/users.js'
import { registerPipelinesCommand } from './commands/pipelines.js'
import { registerStagesCommand } from './commands/stages.js'
import { registerContextCommand } from './commands/context.js'
import { registerSearchCommand } from './commands/search.js'

let _jsonMode = false

export function isJsonMode(): boolean {
  return _jsonMode
}

// test-only
export function _resetJsonMode(): void {
  _jsonMode = false
}

function classifyError(error: unknown): { code: number; payload: Record<string, unknown> } {
  if (error instanceof CliNotImplementedError) {
    return {
      code: 2,
      payload: {
        code: error.details?.code ?? 'NOT_IMPLEMENTED',
        message: error.message,
        ...error.details,
      },
    }
  }
  if (error instanceof CliValidationError) {
    return {
      code: 2,
      payload: {
        code: error.details?.code ?? 'VALIDATION_ERROR',
        message: error.message,
        ...error.details,
      },
    }
  }
  if (error instanceof CliConfigError) {
    return {
      code: 3,
      payload: {
        code: error.details?.code ?? 'CONFIG_ERROR',
        message: error.message,
        ...error.details,
      },
    }
  }
  // OrbitApiError and HTTP errors → exit code 1
  if (
    error instanceof Error &&
    (error.name === 'OrbitApiError' || (error as { statusCode?: number }).statusCode !== undefined)
  ) {
    const e = error as { statusCode?: number; code?: string; requestId?: string }
    return {
      code: 1,
      payload: {
        code: e.code ?? 'API_ERROR',
        message: error.message,
        ...(e.requestId ? { request_id: e.requestId } : {}),
      },
    }
  }
  // Generic error → exit code 1
  return {
    code: 1,
    payload: {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  }
}

function formatErrorForHuman(payload: Record<string, unknown>): string {
  return `Error [${payload.code}]: ${payload.message}`
}

export function createProgram(): Command {
  const program = new Command()
  program
    .name('orbit')
    .description('Orbit AI CRM terminal interface')
    .version('0.1.0-alpha.0')
    .option('--json', 'Output as JSON envelope')
    .option('--format <format>', 'Output format: table|json|csv|tsv', 'table')
    .option('--api-key <key>', 'Orbit API key (prefer ORBIT_API_KEY env var)')
    .option('--base-url <url>', 'Orbit API base URL')
    .option('--org-id <id>', 'Organization ID')
    .option('--user-id <id>', 'User ID')
    .option('--database-url <url>', 'Database URL (direct mode)')
    .option('--adapter <type>', 'Storage adapter: sqlite|postgres (direct mode)')
    .option('--mode <mode>', 'Client mode: api|direct', 'api')
    .option('--profile <name>', 'Config profile name')
    .option('--quiet', 'Suppress warnings')
    .option('--yes', 'Skip interactive confirmations (bypass for --yes flag)')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts<GlobalFlags & { json?: boolean }>()
      _jsonMode = opts.json === true || opts.format === 'json'
    })

  // Register all command groups
  registerInitCommand(program)
  registerStatusCommand(program)
  registerDoctorCommand(program)
  registerSeedCommand(program)
  registerMigrateCommand(program)
  registerContactsCommand(program)
  registerCompaniesCommand(program)
  registerDealsCommand(program)
  registerUsersCommand(program)
  registerPipelinesCommand(program)
  registerStagesCommand(program)
  registerContextCommand(program)
  registerSearchCommand(program)
  registerStubCommand(program, 'log', 'Log an activity (call, email, meeting, note)')
  registerStubCommand(program, 'tasks', 'Manage tasks')
  registerStubCommand(program, 'notes', 'Manage notes')
  registerStubCommand(program, 'sequences', 'Manage and enroll contacts in sequences')
  registerStubCommand(program, 'fields', 'Manage custom fields')
  registerStubCommand(program, 'schema', 'Manage CRM schema')
  registerStubCommand(program, 'report', 'Generate reports')
  registerStubCommand(program, 'dashboard', 'Interactive dashboard')
  registerStubCommand(program, 'mcp', 'MCP server commands')
  registerStubCommand(program, 'integrations', 'Integration commands')

  return program
}

function registerStubCommand(program: Command, name: string, description: string): void {
  program.command(name).description(description).allowUnknownOption(true).action(() => {
    // Stub — will be replaced by actual implementation in later slices
  })
}

export async function run(): Promise<void> {
  // Handle SIGINT
  process.once('SIGINT', () => {
    process.exit(130)
  })

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
