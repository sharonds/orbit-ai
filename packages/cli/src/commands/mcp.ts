import { Command } from 'commander'
import { CliNotImplementedError } from '../errors.js'

export function registerMcpCommand(program: Command): void {
  const mcp = program.command('mcp').description('Orbit MCP server commands')

  mcp
    .command('serve')
    .description('Start the Orbit MCP server (requires @orbit-ai/mcp)')
    .option('--host <host>', 'Bind host (default: 127.0.0.1; use 0.0.0.0 with caution)')
    .option('--port <port>', 'Listen port', '3001')
    .action((opts) => {
      // Security: warn if binding to 0.0.0.0
      if (opts.host && opts.host !== '127.0.0.1') {
        process.stderr.write(
          `Warning: binding MCP server to ${opts.host} exposes it to external connections.\n`,
        )
      }
      throw new CliNotImplementedError(
        'orbit mcp serve requires @orbit-ai/mcp which is not yet available.',
        { code: 'DEPENDENCY_NOT_AVAILABLE', dependency: '@orbit-ai/mcp' },
      )
    })
}
