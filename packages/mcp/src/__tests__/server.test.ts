import { describe, expect, it, vi } from 'vitest'
import { createMcpServer, emitDirectModeWarning, resolveDeleteConfirmation, safeReadResource, startMcpServer, validateWebhookUrlForDirectMode } from '../server.js'
import { makeMockClient } from './helpers.js'

vi.mock('../resources/team-members.js', () => ({
  readTeamMembers: vi.fn(),
}))
vi.mock('../resources/schema.js', () => ({
  readSchema: vi.fn(),
}))

import { readTeamMembers } from '../resources/team-members.js'
import { readSchema } from '../resources/schema.js'

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
    ['http://[::]/webhook', 'IPv6 unspecified address [::]'],
    ['http://[::]/webhook', 'IPv6 unspecified root [::]'],
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

  it('orbit-team-members resource returns structured error when readTeamMembers throws', async () => {
    vi.mocked(readTeamMembers).mockRejectedValueOnce(new Error('upstream failure'))

    const server = createMcpServer({ client: makeMockClient(), transport: 'stdio' })
    // Access the registered resource callback via the SDK's internal store.
    const registered = (server as unknown as { _registeredResources: Record<string, { readCallback: () => Promise<unknown> }> })
      ._registeredResources['orbit://team-members']
    expect(registered).toBeDefined()

    const result = await registered!.readCallback() as { contents: Array<{ text: string }> }
    const parsed = JSON.parse(result.contents[0]!.text) as { ok: boolean; error: { code: string } }
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe('INTERNAL_ERROR')
  })

  it('orbit-schema resource returns structured error when readSchema throws', async () => {
    vi.mocked(readSchema).mockRejectedValueOnce(new Error('schema unavailable'))

    const server = createMcpServer({ client: makeMockClient(), transport: 'stdio' })
    const registered = (server as unknown as { _registeredResources: Record<string, { readCallback: () => Promise<unknown> }> })
      ._registeredResources['orbit://schema']
    expect(registered).toBeDefined()

    const result = await registered!.readCallback() as { contents: Array<{ text: string }> }
    const parsed = JSON.parse(result.contents[0]!.text) as { ok: boolean; error: { code: string } }
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe('INTERNAL_ERROR')
  })

  it('validateWebhookUrlForDirectMode rejects a non-URL string', () => {
    expect(() => validateWebhookUrlForDirectMode('not-a-url')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    )
  })

  it('resolveDeleteConfirmation propagates error when elicitInput rejects', async () => {
    const server = createMcpServer({ client: makeMockClient(), transport: 'stdio' })
    vi.spyOn(server.server, 'getClientCapabilities').mockReturnValue({ elicitation: {} } as never)
    vi.spyOn(server.server, 'elicitInput').mockRejectedValue(new Error('network timeout'))
    await expect(
      resolveDeleteConfirmation(server, { object_type: 'contacts', record_id: 'contact_01' }),
    ).rejects.toThrow('network timeout')
  })

  it('safeReadResource writes structured error to stderr', async () => {
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await safeReadResource(() => Promise.reject(new Error('db down'))).catch(() => {})
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[INTERNAL_ERROR]'))
    spy.mockRestore()
  })
})
