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

  it.each([
    ['http://10.0.0.1/webhook', '10.x private range'],
    ['http://192.168.1.1/webhook', '192.168.x private range'],
    ['http://169.254.1.1/webhook', '169.254.x link-local'],
    ['http://172.16.0.1/webhook', '172.16.x first of private range'],
    ['http://172.31.255.255/webhook', '172.31.x last of private range'],
    ['http://localhost/webhook', 'localhost hostname'],
    ['http://0.0.0.0/webhook', '0.0.0.0 unspecified address'],
  ] as const)(
    'validateWebhookUrlForDirectMode blocks %s (%s)',
    (url, _label) => {
      expect(() => validateWebhookUrlForDirectMode(url)).toThrow(
        expect.objectContaining({ code: 'SSRF_BLOCKED' }),
      )
    },
  )

  it.each([
    ['http://172.15.0.1/webhook', 'just below 172.16 range'],
    ['http://172.32.0.1/webhook', 'just above 172.31 range'],
  ] as const)(
    'validateWebhookUrlForDirectMode allows %s (%s)',
    (url, _label) => {
      expect(() => validateWebhookUrlForDirectMode(url)).not.toThrow()
    },
  )

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
