import { describe, expect, it, vi } from 'vitest'
import { createMcpServer, emitDirectModeWarning, resolveDeleteConfirmation, startMcpServer, validateWebhookUrlForDirectMode } from '../server.js'
import { makeMockClient } from './helpers.js'

describe('server', () => {
  it('createMcpServer constructs with stdio transport options', () => {
    expect(() => createMcpServer({ client: makeMockClient(), transport: 'stdio' })).not.toThrow()
  })

  it('startMcpServer rejects a missing client', async () => {
    await expect(startMcpServer({ client: undefined as never, transport: 'stdio' })).rejects.toThrow(
      'startMcpServer requires a preconfigured Orbit client.',
    )
  })

  it('startMcpServer rejects http mode without adapter', async () => {
    await expect(startMcpServer({ client: makeMockClient(), transport: 'http' })).rejects.toThrow(
      'startMcpServer requires adapter when transport is http.',
    )
  })

  it('emitDirectModeWarning writes the expected protections to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    emitDirectModeWarning()
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('API-layer authentication'),
    )
  })

  it('validateWebhookUrlForDirectMode rejects loopback destinations', () => {
    expect(() => validateWebhookUrlForDirectMode('http://127.0.0.1/hook')).toThrow()
  })

  it('validateWebhookUrlForDirectMode allows public destinations', () => {
    expect(() => validateWebhookUrlForDirectMode('https://example.com/hook')).not.toThrow()
  })

  it('validateWebhookUrlForDirectMode rejects IPv6 loopback destinations', () => {
    expect(() => validateWebhookUrlForDirectMode('http://[::1]/hook')).toThrow()
  })

  it('resolveDeleteConfirmation returns args unchanged when elicitation is unavailable', async () => {
    const server = createMcpServer({ client: makeMockClient(), transport: 'stdio' })
    vi.spyOn(server.server, 'getClientCapabilities').mockReturnValue({})
    await expect(
      resolveDeleteConfirmation(server, { object_type: 'contacts', record_id: 'contact_01' }),
    ).resolves.toEqual({
      object_type: 'contacts',
      record_id: 'contact_01',
    })
  })
})
