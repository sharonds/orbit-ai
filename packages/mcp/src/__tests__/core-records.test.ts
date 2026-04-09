import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { executeTool } from '../tools/registry.js'
import { createMcpServer, resolveDeleteConfirmation } from '../server.js'
import { makeMockClient, parseTextResult } from './helpers.js'

describe('core record tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('get_record dispatches to contacts.get', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'get_record', { object_type: 'contacts', record_id: 'contact_01' })
    expect(client.contacts.get).toHaveBeenCalledWith('contact_01', undefined)
    expect(parseTextResult(result).data.id).toBe('contact_01')
  })

  it('get_record rejects unsupported object types', async () => {
    const result = await executeTool(makeMockClient(), 'get_record', { object_type: 'unknown', record_id: 'x' } as never)
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('VALIDATION_FAILED')
  })

  it.each(['contacts', 'companies', 'deals', 'activities', 'tasks'] as const)(
    'get_record dispatches correctly for %s',
    async (objectType) => {
      const client = makeMockClient()
      await executeTool(client, 'get_record', { object_type: objectType, record_id: `${objectType}_01` })
      expect(client[objectType].get).toHaveBeenCalled()
    },
  )

  it('create_record calls the correct resource create method', async () => {
    const client = makeMockClient()
    await executeTool(client, 'create_record', { object_type: 'companies', record: { name: 'Acme' } })
    expect(client.companies.create).toHaveBeenCalled()
  })

  it('update_record calls update on the correct resource', async () => {
    const client = makeMockClient()
    await executeTool(client, 'update_record', { object_type: 'contacts', record_id: 'contact_01', record: { name: 'Jane' } })
    expect(client.contacts.update).toHaveBeenCalledWith('contact_01', { name: 'Jane' })
  })

  it('delete_record with confirm true deletes', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'delete_record', { object_type: 'contacts', record_id: 'contact_01', confirm: true })
    expect(client.contacts.delete).toHaveBeenCalledWith('contact_01')
    expect(parseTextResult(result).data.deleted).toBe(true)
  })

  it('delete_record with confirm false returns destructive confirm error', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'delete_record', { object_type: 'contacts', record_id: 'contact_01', confirm: false } as never)
    expect(result.isError).toBe(true)
    expect(client.contacts.delete).not.toHaveBeenCalled()
    expect(parseTextResult(result).error.code).toBe('VALIDATION_FAILED')
  })

  it('delete_record with confirm omitted returns validation error', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'delete_record', { object_type: 'contacts', record_id: 'contact_01' } as never)
    expect(result.isError).toBe(true)
    expect(client.contacts.delete).not.toHaveBeenCalled()
  })

  it('search_records with all calls global search', async () => {
    const client = makeMockClient()
    await executeTool(client, 'search_records', { object_type: 'all', query: 'jane' })
    expect(client.search.query).toHaveBeenCalled()
    expect(client.contacts.search).not.toHaveBeenCalled()
  })

  it('search_records with contacts calls contacts.search', async () => {
    const client = makeMockClient()
    await executeTool(client, 'search_records', { object_type: 'contacts', query: 'jane' })
    expect(client.contacts.search).toHaveBeenCalled()
    expect(client.search.query).not.toHaveBeenCalled()
  })

  it('relate_records tag path calls tags.attach', async () => {
    const client = makeMockClient()
    await executeTool(client, 'relate_records', {
      relationship_type: 'tag',
      source_record_id: 'contact_01',
      target_record_id: 'tag_01',
    })
    expect(client.tags.attach).toHaveBeenCalled()
  })

  it('relate_records contact_company path patches contact company_id', async () => {
    const client = makeMockClient()
    await executeTool(client, 'relate_records', {
      relationship_type: 'contact_company',
      source_record_id: 'contact_01',
      target_record_id: 'company_01',
    })
    expect(client.contacts.update).toHaveBeenCalledWith('contact_01', { company_id: 'company_01' })
  })

  it('bulk_operation enforces confirm for delete actions', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'bulk_operation', {
      object_type: 'contacts',
      operations: [{ action: 'delete', record_id: 'contact_01', confirm: false }],
    } as never)
    expect(result.isError).toBe(true)
    expect(client.contacts.batch).not.toHaveBeenCalled()
  })

  it('bulk_operation rejects unsupported object types', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'bulk_operation', {
      object_type: 'users',
      operations: [{ action: 'delete', record_id: 'user_01', confirm: true }],
    } as never)
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('UNSUPPORTED_OBJECT_TYPE')
  })

  it('list_related_records stays dependency-gated', async () => {
    const result = await executeTool(makeMockClient(), 'list_related_records', {
      relationship_type: 'contact_company',
      source_record_id: 'contact_01',
    })
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('DEPENDENCY_NOT_AVAILABLE')
  })

  it('search_records truncates oversized queries before dispatch', async () => {
    const client = makeMockClient()
    await executeTool(client, 'search_records', { object_type: 'contacts', query: 'x'.repeat(12_000) })
    const query = vi.mocked(client.contacts.search).mock.calls[0]?.[0]?.query as string
    expect(query.length).toBeLessThanOrEqual(10_000)
  })

  it('create_record blocks webhook SSRF URLs in direct mode', async () => {
    const client = makeMockClient({ direct: true })
    const result = await executeTool(client, 'create_record', {
      object_type: 'webhooks',
      record: { url: 'http://127.0.0.1/hook', events: ['contact.created'] },
    })
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('SSRF_BLOCKED')
  })

  it('delete confirmation helper injects confirm true when elicitation is accepted', async () => {
    const server = createMcpServer({ client: makeMockClient(), transport: 'stdio' })
    vi.spyOn(server.server, 'getClientCapabilities').mockReturnValue({ elicitation: {} } as never)
    vi.spyOn(server.server, 'elicitInput').mockResolvedValue({ action: 'accept', content: { confirmed: true } } as never)
    await expect(resolveDeleteConfirmation(server, { object_type: 'contacts', record_id: 'contact_01' })).resolves.toEqual({
      object_type: 'contacts',
      record_id: 'contact_01',
      confirm: true,
    })
  })

  it('delete confirmation helper throws when elicitation is declined', async () => {
    const server = createMcpServer({ client: makeMockClient(), transport: 'stdio' })
    vi.spyOn(server.server, 'getClientCapabilities').mockReturnValue({ elicitation: {} } as never)
    vi.spyOn(server.server, 'elicitInput').mockResolvedValue({ action: 'decline' } as never)
    await expect(resolveDeleteConfirmation(server, { object_type: 'contacts', record_id: 'contact_01' })).rejects.toMatchObject({
      code: 'DESTRUCTIVE_CONFIRM_REQUIRED',
    })
  })
})
