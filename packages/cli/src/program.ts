import { Command, CommanderError, Option } from 'commander'
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
import { registerActivitiesCommand } from './commands/activities.js'
import { registerTasksCommand } from './commands/tasks.js'
import { registerNotesCommand } from './commands/notes.js'
import { registerProductsCommand } from './commands/products.js'
import { registerPaymentsCommand } from './commands/payments.js'
import { registerContractsCommand } from './commands/contracts.js'
import { registerSequencesCommand } from './commands/sequences.js'
import { registerTagsCommand } from './commands/tags.js'
import { registerWebhooksCommand } from './commands/webhooks.js'
import { registerImportsCommand } from './commands/imports.js'
import { registerLogCommand } from './commands/log.js'
import { registerSchemaCommand } from './commands/schema.js'
import { registerFieldsCommand } from './commands/fields.js'
import { registerReportCommand } from './commands/report.js'
import { registerDashboardCommand } from './commands/dashboard.js'
import { registerMcpCommand } from './commands/mcp.js'
import { registerIntegrationsCommand, registerIntegrationSubcommands } from './commands/integrations.js'
import { registerCalendarAliasCommand } from './commands/calendar-alias.js'
import { buildGmailCommands } from '@orbit-ai/integrations/gmail'
import { buildCalendarCommands } from '@orbit-ai/integrations/google-calendar'
import { resolveIntegrationsRuntime } from './config/integrations-runtime.js'
import type { IntegrationCommand, CliRuntimeContext } from '@orbit-ai/integrations'

let _jsonMode = false
let _sigintHandler: (() => void) | null = null

export function isJsonMode(): boolean {
  return _jsonMode
}

// test-only
export function _resetJsonMode(): void {
  _jsonMode = false
}

// test-only
export function _setJsonMode(value: boolean): void {
  _jsonMode = value
}

// test-only export
export { classifyError as _classifyError }

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
  // Commander parse/validation errors (exitOverride surfaces these as CommanderError)
  if (error instanceof CommanderError) {
    return {
      code: error.exitCode === 0 ? 0 : 2,
      payload: {
        code: error.code ?? 'COMMANDER_ERROR',
        message: error.message,
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
    .addOption(new Option('--format <format>', 'Output format').choices(['table', 'json', 'csv', 'tsv']).default('table'))
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
  registerActivitiesCommand(program)
  registerTasksCommand(program)
  registerNotesCommand(program)
  registerProductsCommand(program)
  registerPaymentsCommand(program)
  registerContractsCommand(program)
  registerSequencesCommand(program)
  registerTagsCommand(program)
  registerWebhooksCommand(program)
  registerImportsCommand(program)
  registerLogCommand(program)
  registerSchemaCommand(program)
  registerFieldsCommand(program)
  registerReportCommand(program)
  registerDashboardCommand(program)
  registerMcpCommand(program)
  registerIntegrationsCommand(program)
  registerCalendarAliasCommand(program)

  const placeholderRuntime: CliRuntimeContext = {
    organizationId: '',
    userId: '',
    isJsonMode: false,
    credentialStore: null as never,
    print: () => {},
  }

  function wrapForDeferredRuntime(
    factory: (runtime: CliRuntimeContext) => IntegrationCommand[],
  ): IntegrationCommand[] {
    const placeholders = factory(placeholderRuntime)
    return placeholders.map((cmd) => ({
      ...cmd,
      async action(...args: unknown[]) {
        const invokedCommand = args[args.length - 1] as Command
        let root: Command = invokedCommand
        while (root.parent) root = root.parent
        const flags = root.opts() as GlobalFlags
        const runtime = await resolveIntegrationsRuntime({ flags, cwd: process.cwd() })
        const real = factory(runtime)
        const match = real.find((c) => c.name === cmd.name)
        if (!match) throw new Error(`Command ${cmd.name} not found in factory rebuild`)
        await match.action(...args)
      },
    }))
  }

  registerIntegrationSubcommands(program, [
    ...wrapForDeferredRuntime(buildGmailCommands),
    ...wrapForDeferredRuntime(buildCalendarCommands),
  ])

  return program
}

export async function run(): Promise<void> {
  _jsonMode = false  // reset from any previous invocation
  if (_sigintHandler) process.removeListener('SIGINT', _sigintHandler)
  _sigintHandler = () => { process.exit(130) }
  process.once('SIGINT', _sigintHandler)

  // Detect JSON mode from argv before preAction hook can fire
  // (preAction only fires if Commander reaches the command — parse errors fire before it)
  const argvHasJson =
    process.argv.includes('--json') ||
    process.argv.includes('--format=json') ||
    (process.argv.includes('--format') &&
      process.argv[process.argv.indexOf('--format') + 1] === 'json')
  if (argvHasJson) _jsonMode = true

  try {
    const program = createProgram()
    program.exitOverride()
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
