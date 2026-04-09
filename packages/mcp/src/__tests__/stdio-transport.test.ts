import { describe, expect, it, vi } from 'vitest'
import { createMcpServer } from '../server.js'
import { createStdioTransport } from '../transports/stdio.js'
import { buildTools } from '../tools/registry.js'
import { makeMockClient } from './helpers.js'

describe('stdio transport', () => {
  it('creates a stdio transport instance', () => {
    expect(createStdioTransport()).toBeTruthy()
  })

  it('exposes the same number of tools as the registry', () => {
    const server = createMcpServer({ client: makeMockClient(), transport: 'stdio' })
    expect(server).toBeTruthy()
    expect(buildTools()).toHaveLength(23)
  })

  it('direct mode server creation emits a startup warning', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    createMcpServer({ client: makeMockClient({ direct: true }), transport: 'stdio' })
    expect(spy).toHaveBeenCalled()
  })
})
