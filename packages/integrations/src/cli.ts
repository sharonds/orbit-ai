import type { Command } from 'commander'
import type { IntegrationTool, IntegrationCommand } from './types.js'
import type { IntegrationRegistry } from './registry.js'
import type { IntegrationsConfig } from './config.js'
import { loadEnabledIntegrations } from './config.js'

/**
 * Collect all CLI commands from enabled integration plugins.
 * Per spec section 10: commands are registered dynamically when plugins are enabled.
 */
export function getIntegrationCommands(
  registry: IntegrationRegistry,
  config: IntegrationsConfig,
): IntegrationCommand[] {
  const enabled = loadEnabledIntegrations(registry, config)
  const commands: IntegrationCommand[] = []
  for (const plugin of enabled) {
    for (const cmd of plugin.commands) {
      commands.push(cmd)
    }
  }
  return commands
}

/**
 * Collect all MCP tools from enabled integration plugins.
 * Per spec section 10: tools are registered dynamically when plugins are enabled.
 * All tool names MUST start with 'integrations.' prefix and must not shadow core tools.
 */
export function getIntegrationTools(
  registry: IntegrationRegistry,
  config: IntegrationsConfig,
): IntegrationTool[] {
  const enabled = loadEnabledIntegrations(registry, config)
  const tools: IntegrationTool[] = []
  const seenNames = new Set<string>()

  for (const plugin of enabled) {
    for (const tool of plugin.tools) {
      // Enforce namespacing: must start with 'integrations.'
      if (!tool.name.startsWith('integrations.')) {
        console.error(
          `Skipping tool '${tool.name}' from plugin '${plugin.slug}': name must start with 'integrations.'`,
        )
        continue
      }
      // No duplicates
      if (seenNames.has(tool.name)) {
        console.error(
          `Skipping duplicate tool name '${tool.name}' from plugin '${plugin.slug}'`,
        )
        continue
      }
      seenNames.add(tool.name)
      tools.push(tool)
    }
  }

  return tools
}

/**
 * Register all integration commands onto a Commander program.
 * Per spec section 10: only enabled plugins contribute commands.
 * The 'integrations' parent command must already exist on the program.
 */
export function registerIntegrationCommands(
  program: Command,
  registry: IntegrationRegistry,
  config: IntegrationsConfig,
): void {
  const commands = getIntegrationCommands(registry, config)
  const intCmd = program.commands.find((c: Command) => c.name() === 'integrations')
  if (!intCmd) return

  for (const cmd of commands) {
    const sub = intCmd.command(cmd.name).description(cmd.description)
    if (cmd.options) {
      for (const opt of cmd.options) {
        if (opt.defaultValue != null) {
          sub.option(opt.flags, opt.description, String(opt.defaultValue))
        } else {
          sub.option(opt.flags, opt.description)
        }
      }
    }
    sub.action(cmd.action)
  }
}
