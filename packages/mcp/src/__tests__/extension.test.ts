import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerExtensionTools } from '../extension.js'
import type { ExtensionTool } from '../extension.js'

function makeMcpServer(): McpServer {
  return new McpServer(
    { name: '@orbit-ai/mcp-test', version: '0.0.0' },
    { capabilities: { tools: {} } },
  )
}

function makeValidTool(overrides: Partial<ExtensionTool> = {}): ExtensionTool {
  return {
    name: 'integrations.gmail.send_email',
    description: 'Send an email via Gmail',
    inputSchema: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
    execute: vi.fn(async () => ({ ok: true })),
    ...overrides,
  }
}

describe('registerExtensionTools', () => {
  it('registers valid tools with the integrations. prefix successfully', () => {
    const server = makeMcpServer()
    const toolA = makeValidTool({ name: 'integrations.gmail.send_email' })
    const toolB = makeValidTool({ name: 'integrations.calendar.create_event', description: 'Create a calendar event' })

    expect(() => registerExtensionTools(server, [toolA, toolB])).not.toThrow()
  })

  it('throws when a tool name lacks the integrations. prefix', () => {
    const server = makeMcpServer()
    const badTool = makeValidTool({ name: 'gmail.send_email' })

    expect(() => registerExtensionTools(server, [badTool])).toThrow(
      /must start with the 'integrations\.' prefix/,
    )
  })

  it('includes the offending tool name in the prefix error message', () => {
    const server = makeMcpServer()
    const badTool = makeValidTool({ name: 'send_email' })

    expect(() => registerExtensionTools(server, [badTool])).toThrow(/send_email/)
  })

  it('throws when two extension tools share the same name', () => {
    const server = makeMcpServer()
    const toolA = makeValidTool({ name: 'integrations.gmail.send_email' })
    const toolB = makeValidTool({ name: 'integrations.gmail.send_email', description: 'Another send tool' })

    expect(() => registerExtensionTools(server, [toolA, toolB])).toThrow(/Duplicate extension tool name/)
  })

  it('includes the duplicate name in the duplicate error message', () => {
    const server = makeMcpServer()
    const toolA = makeValidTool({ name: 'integrations.gmail.send_email' })
    const toolB = makeValidTool({ name: 'integrations.gmail.send_email', description: 'Duplicate' })

    expect(() => registerExtensionTools(server, [toolA, toolB])).toThrow(/integrations\.gmail\.send_email/)
  })

  it('writes a stderr warning before throwing on prefix violation', () => {
    const server = makeMcpServer()
    const badTool = makeValidTool({ name: 'no_prefix_here' })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)

    expect(() => registerExtensionTools(server, [badTool])).toThrow()
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('no_prefix_here'))

    stderrSpy.mockRestore()
  })

  it('writes a stderr warning before throwing on duplicate name', () => {
    const server = makeMcpServer()
    const toolA = makeValidTool({ name: 'integrations.duplicate.tool' })
    const toolB = makeValidTool({ name: 'integrations.duplicate.tool', description: 'Dup' })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)

    expect(() => registerExtensionTools(server, [toolA, toolB])).toThrow()
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('integrations.duplicate.tool'))

    stderrSpy.mockRestore()
  })

  it('accepts an empty tools array without throwing', () => {
    const server = makeMcpServer()
    expect(() => registerExtensionTools(server, [])).not.toThrow()
  })

  it('does not register any tools from the first violating tool onward when a prefix error occurs mid-list', () => {
    const server = makeMcpServer()
    const validTool = makeValidTool({ name: 'integrations.valid.tool' })
    const invalidTool = makeValidTool({ name: 'no_prefix' })

    // Calling with [valid, invalid] — valid is registered before we reach invalid,
    // but the function throws and the caller is notified of the violation.
    expect(() => registerExtensionTools(server, [validTool, invalidTool])).toThrow(
      /must start with the 'integrations\.' prefix/,
    )
  })
})
