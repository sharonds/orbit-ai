import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ZodTypeAny } from 'zod'
import { buildTools } from './tools/registry.js'
import { writeStderrWarning } from './server.js'

/**
 * Minimal shape expected from integration tool plugins.
 * Tool names MUST start with the 'integrations.' prefix.
 */
export interface ExtensionTool {
  /** Must start with 'integrations.' prefix, e.g. 'integrations.gmail.send_email' */
  name: string
  title?: string
  description: string
  inputSchema: ZodTypeAny
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

const INTEGRATION_PREFIX = 'integrations.'

/**
 * Set of core tool names, computed once at module load to avoid redundant
 * registry traversals on every registerExtensionTools call.
 */
const CORE_TOOL_NAMES = new Set(buildTools().map((t) => t.name))

/**
 * Registers a set of integration extension tools on an existing McpServer.
 *
 * Validation rules:
 * - Every tool name must start with 'integrations.'
 * - No tool name may duplicate a core tool name
 * - No two extension tools may share the same name
 *
 * @throws Error if any validation rule is violated
 */
export function registerExtensionTools(server: McpServer, tools: ExtensionTool[]): void {
  const coreToolNames = CORE_TOOL_NAMES
  const seen = new Set<string>()

  for (const tool of tools) {
    if (!tool.name.startsWith(INTEGRATION_PREFIX)) {
      const msg = `Extension tool name "${tool.name}" must start with the '${INTEGRATION_PREFIX}' prefix.`
      writeStderrWarning(msg)
      throw new Error(msg)
    }

    if (coreToolNames.has(tool.name)) {
      const msg = `Extension tool name "${tool.name}" conflicts with a core tool name.`
      writeStderrWarning(msg)
      throw new Error(msg)
    }

    if (seen.has(tool.name)) {
      const msg = `Duplicate extension tool name detected: "${tool.name}". Each tool name must be unique.`
      writeStderrWarning(msg)
      throw new Error(msg)
    }

    seen.add(tool.name)

    const toolConfig: {
      description: string
      inputSchema: ZodTypeAny
      title?: string
    } = {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }
    if (tool.title !== undefined) {
      toolConfig.title = tool.title
    }

    server.registerTool(
      tool.name,
      toolConfig,
      async (args) => {
        try {
          const result = await tool.execute(args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          writeStderrWarning(`Extension tool "${tool.name}" execution failed: ${message}`)
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: message }) }],
            isError: true,
          }
        }
      },
    )
  }
}
