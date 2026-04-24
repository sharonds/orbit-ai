import { createMcpServer } from '@orbit-ai/mcp'
import { OrbitClient } from '@orbit-ai/sdk'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { SqliteStorageAdapter } from '@orbit-ai/core'

export interface McpHandle {
  request(
    method: 'tools/list',
    params: Record<string, unknown>,
  ): Promise<{ tools: Array<{ name: string }> }>
  request(
    method: 'tools/call',
    params: { name: string; arguments?: Record<string, unknown> },
  ): Promise<{ content?: Array<{ type: string; text: string }>; isError?: boolean }>
  request(method: string, params: Record<string, unknown>): Promise<unknown>
  close(): Promise<void>
}

export interface SpawnMcpOptions {
  adapter: SqliteStorageAdapter
  organizationId: string
}

export async function spawnMcp(opts: SpawnMcpOptions): Promise<McpHandle> {
  const orbitClient = new OrbitClient({
    adapter: opts.adapter,
    context: { orgId: opts.organizationId },
  })

  const server = createMcpServer({ client: orbitClient, transport: 'stdio' })
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()

  const mcpClient = new Client(
    { name: 'orbit-e2e-test', version: '1.0.0' },
    { capabilities: {} },
  )

  await server.connect(serverTransport)
  await mcpClient.connect(clientTransport)

  return {
    async request(method: string, params: Record<string, unknown>) {
      if (method === 'tools/list') {
        return mcpClient.listTools()
      }
      if (method === 'tools/call') {
        const p = params as { name: string; arguments?: Record<string, unknown> }
        return mcpClient.callTool({ name: p.name, arguments: p.arguments })
      }
      throw new Error(`Unsupported method: ${method}`)
    },
    async close() {
      await mcpClient.close()
    },
  }
}
