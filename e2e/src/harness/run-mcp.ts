import { createMcpServer } from '@orbit-ai/mcp'
import { OrbitClient } from '@orbit-ai/sdk'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { StorageAdapter } from '@orbit-ai/core'

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
  adapter: StorageAdapter
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

  async function dispatchRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (method === 'tools/list') {
      return mcpClient.listTools()
    }
    if (method === 'tools/call') {
      const p = params as { name: string; arguments?: Record<string, unknown> }
      return mcpClient.callTool({ name: p.name, arguments: p.arguments })
    }
    return (mcpClient as unknown as { request(method: string, params: unknown): Promise<unknown> }).request(method, params)
  }

  const handle: McpHandle = {
    request: dispatchRequest as McpHandle['request'],
    async close() {
      await mcpClient.close()
      if (typeof (server as { close?: () => Promise<void> }).close === 'function') {
        await (server as { close: () => Promise<void> }).close()
      }
    },
  }
  return handle
}
