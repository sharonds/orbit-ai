import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { RuntimeApiAdapter } from '@orbit-ai/api'
import { OrbitClient } from '@orbit-ai/sdk'
import { buildTools, executeTool } from './tools/registry.js'
import { createStdioTransport } from './transports/stdio.js'
import { startHttpTransport } from './transports/http.js'
import { readTeamMembers } from './resources/team-members.js'
import { readSchema } from './resources/schema.js'
import { McpToolError, normalizeToolError, toToolError } from './errors.js'

export interface StartMcpServerOptions {
  client: OrbitClient
  transport: 'stdio' | 'http'
  port?: number
  bindAddress?: string
  adapter?: RuntimeApiAdapter
}

export async function startMcpServer(options: StartMcpServerOptions): Promise<void> {
  if (!options.client) {
    throw new Error('startMcpServer requires a preconfigured Orbit client.')
  }

  if (options.transport === 'http') {
    if (!options.adapter) {
      throw new Error('startMcpServer requires adapter when transport is http.')
    }
    await startHttpTransport(options)
    return
  }

  const server = createMcpServer(options)
  const transport = createStdioTransport()
  await server.connect(transport)
}

export function createMcpServer(options: StartMcpServerOptions): McpServer {
  if (isDirectModeClient(options.client)) {
    emitDirectModeWarning()
  }

  const server = new McpServer(
    { name: '@orbit-ai/mcp', version: '0.1.0-alpha.0' },
    { capabilities: { logging: {}, tools: {}, resources: {} } },
  )

  for (const tool of buildTools()) {
    server.registerTool(
      tool.name,
      {
        title: tool.title as string,
        description: tool.description as string,
        inputSchema: tool.inputZodSchema,
        annotations: tool.annotations ?? {},
      },
      async (args): Promise<CallToolResult> => {
        try {
          const toolArgs =
            tool.name === 'delete_record'
              ? await resolveDeleteConfirmation(server, args as Record<string, unknown>)
              : args
          return await executeTool(options.client, tool.name, (toolArgs ?? {}) as Record<string, unknown>)
        } catch (error) {
          return toToolError(error)
        }
      },
    )
  }

  server.registerResource(
    'orbit-team-members',
    'orbit://team-members',
    { title: 'Orbit team members', mimeType: 'application/json' },
    async () => {
      try {
        return await safeReadResource(() => readTeamMembers(options.client))
      } catch (error) {
        const normalized = normalizeToolError(error)
        return {
          contents: [
            {
              uri: 'orbit://team-members',
              mimeType: 'application/json',
              text: JSON.stringify({ ok: false, error: normalized }, null, 2),
            },
          ],
        }
      }
    },
  )
  server.registerResource(
    'orbit-schema',
    'orbit://schema',
    { title: 'Orbit schema', mimeType: 'application/json' },
    async () => {
      try {
        return await safeReadResource(() => readSchema(options.client))
      } catch (error) {
        const normalized = normalizeToolError(error)
        return {
          contents: [
            {
              uri: 'orbit://schema',
              mimeType: 'application/json',
              text: JSON.stringify({ ok: false, error: normalized }, null, 2),
            },
          ],
        }
      }
    },
  )

  return server
}

export async function resolveDeleteConfirmation(server: McpServer, args: Record<string, unknown>) {
  if (args.confirm === true) {
    return args
  }

  const capabilities = server.server.getClientCapabilities()
  if (!capabilities?.elicitation) {
    return args
  }

  const result = await server.server.elicitInput({
    mode: 'form',
    message: `Permanently delete ${String(args.object_type)} record ${String(args.record_id)}? This cannot be undone.`,
    requestedSchema: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          title: 'Confirm deletion',
        },
      },
      required: ['confirmed'],
    },
  })

  if (result.action === 'accept' && result.content?.confirmed) {
    return { ...args, confirm: true }
  }

  throw new McpToolError('DESTRUCTIVE_CONFIRM_REQUIRED', 'User declined or dismissed the destructive confirmation.')
}

export function isDirectModeClient(client: OrbitClient): boolean {
  return Boolean(client.options.adapter && client.options.context?.orgId && !client.options.apiKey)
}

export function validateWebhookUrlForDirectMode(url: string): void {
  const parsed = new URL(url)
  const hostname = parsed.hostname.toLowerCase()

  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::' ||
    hostname === '[::]' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '169.254.169.254' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    is172PrivateRange(hostname)
  ) {
    throw new McpToolError('SSRF_BLOCKED', `Webhook URL ${url} is blocked by the direct-mode SSRF policy.`)
  }
}

function is172PrivateRange(hostname: string): boolean {
  if (!hostname.startsWith('172.')) {
    return false
  }

  const secondOctet = Number(hostname.split('.')[1])
  return secondOctet >= 16 && secondOctet <= 31
}

export function emitDirectModeWarning(): void {
  writeStderrWarning(
    'Orbit MCP direct mode bypasses API-layer authentication, per-org rate limiting, and scope enforcement. SSRF webhook destination checks are applied locally as a compensating control.',
  )
}

export function writeStderrWarning(message: string): void {
  process.stderr.write(`${message}\n`)
}

export function writeDirectModeAuditLog(payload: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify(payload)}\n`)
}

// Exported for use within this package and unit tests only. Not re-exported from
// index.ts and must not become part of the public API surface — it accepts an
// arbitrary reader function and normalizes errors in a way that is only safe when
// called by the resource registration wrappers in createMcpServer.
export async function safeReadResource<T>(reader: () => Promise<T>): Promise<T> {
  try {
    return await reader()
  } catch (error) {
    const normalized = normalizeToolError(error)
    // Resource readers surface errors as thrown Error instances. We normalize through
    // normalizeToolError for redaction, write the structured error to stderr, and re-throw as McpToolError.
    writeStderrWarning(`MCP resource read failed [${normalized.code}]: ${normalized.message}`)
    throw new McpToolError(normalized.code, normalized.message, normalized.hint, normalized.recovery)
  }
}
