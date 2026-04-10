import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { executeTool } from '../tools/registry.js'
import { createMcpServer, resolveDeleteConfirmation, safeReadResource } from '../server.js'
import { McpToolError } from '../errors.js'
import { makeMockClient, parseTextResult, getTextContent } from './helpers.js'

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

  it('update_record blocks webhook SSRF URLs in direct mode', async () => {
    const client = makeMockClient({ direct: true })
    const result = await executeTool(client, 'update_record', {
      object_type: 'webhooks',
      record_id: 'webhook_01',
      record: { url: 'http://127.0.0.1/hook', events: ['contact.created'] },
    })
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('SSRF_BLOCKED')
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

  it.each([
    ['contact_company', 'contact_01', 'company_01', 'contacts', { company_id: null }] as const,
    ['contact_deal', 'contact_01', 'deal_01', 'deals', { contact_id: null }] as const,
    ['company_deal', 'company_01', 'deal_01', 'deals', { company_id: null }] as const,
  ])(
    'relate_records %s with detach=true sets relationship to null',
    async (relationshipType, sourceId, targetId, resource, expectedPatch) => {
      const client = makeMockClient()
      await executeTool(client, 'relate_records', {
        relationship_type: relationshipType,
        source_record_id: sourceId,
        target_record_id: targetId,
        detach: true,
      })
      const updateId = resource === 'contacts' ? sourceId : targetId
      expect(client[resource].update).toHaveBeenCalledWith(updateId, expectedPatch)
    },
  )

  it('relate_records tag detach path calls tags.detach', async () => {
    const client = makeMockClient()
    await executeTool(client, 'relate_records', {
      relationship_type: 'tag',
      source_record_id: 'contact_01',
      target_record_id: 'tag_01',
      detach: true,
    })
    expect(client.tags.detach).toHaveBeenCalled()
  })

  it('relate_records contact_deal path patches deal contact_id', async () => {
    const client = makeMockClient()
    await executeTool(client, 'relate_records', {
      relationship_type: 'contact_deal',
      source_record_id: 'contact_01',
      target_record_id: 'deal_01',
    })
    expect(client.deals.update).toHaveBeenCalledWith('deal_01', { contact_id: 'contact_01' })
  })

  it('relate_records company_deal path patches deal company_id', async () => {
    const client = makeMockClient()
    await executeTool(client, 'relate_records', {
      relationship_type: 'company_deal',
      source_record_id: 'company_01',
      target_record_id: 'deal_01',
    })
    expect(client.deals.update).toHaveBeenCalledWith('deal_01', { company_id: 'company_01' })
  })

  it('relate_records rejects unknown record prefixes for tag relationships', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'relate_records', {
      relationship_type: 'tag',
      source_record_id: 'mystery_01',
      target_record_id: 'tag_01',
    })
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('VALIDATION_FAILED')
  })

  it.each([
    ['company_01', 'companies'],
    ['deal_01', 'deals'],
    ['task_01', 'tasks'],
  ] as const)(
    'relate_records tag path resolves %s source to correct entity type',
    async (sourceId, expectedEntityType) => {
      const client = makeMockClient()
      await executeTool(client, 'relate_records', {
        relationship_type: 'tag',
        source_record_id: sourceId,
        target_record_id: 'tag_01',
      })
      expect(client.tags.attach).toHaveBeenCalledWith(
        'tag_01',
        expect.objectContaining({ entity_type: expectedEntityType }),
      )
    },
  )

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

  it('bulk_operation rejects more than 100 operations', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'bulk_operation', {
      object_type: 'contacts',
      operations: Array.from({ length: 101 }, (_, index) => ({
        action: 'delete',
        record_id: `contact_${index}`,
        confirm: true,
      })),
    } as never)
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('VALIDATION_FAILED')
  })

  it('list_related_records stays dependency-gated', async () => {
    const result = await executeTool(makeMockClient(), 'list_related_records', {
      relationship_type: 'contact_company',
      source_record_id: 'contact_01',
    })
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('DEPENDENCY_NOT_AVAILABLE')
  })

  it('search_records handles flat-array search result (non-envelope)', async () => {
    const client = makeMockClient()
    vi.mocked(client.contacts.search).mockResolvedValueOnce([
      { id: 'contact_01', name: 'Jane' },
    ] as never)
    const result = await executeTool(client, 'search_records', { object_type: 'contacts', query: 'jane' })
    expect(result.isError).toBeFalsy()
    const text = getTextContent(result)
    const parsed = JSON.parse(text) as { ok: boolean; data: unknown }
    expect(parsed.ok).toBe(true)
  })

  it('search_records truncates oversized queries before dispatch', async () => {
    const client = makeMockClient()
    await executeTool(client, 'search_records', { object_type: 'contacts', query: 'x'.repeat(12_000) })
    const query = vi.mocked(client.contacts.search).mock.calls[0]?.[0]?.query as string
    expect(query.length).toBeLessThanOrEqual(10_000)
  })

  it('search_records sanitizes sensitive fields in envelope-shaped results', async () => {
    const client = makeMockClient()
    vi.mocked(client.webhooks.search).mockResolvedValueOnce({
      data: [{ id: 'webhook_01', signing_secret: 'whsec_SUPER_SECRET' }],
    } as never)
    const result = await executeTool(client, 'search_records', { object_type: 'webhooks', query: 'test' })
    const text = getTextContent(result)
    expect(text).not.toContain('whsec_SUPER_SECRET')
  })

  it('search_records with object_type all sanitizes sensitive fields', async () => {
    const client = makeMockClient()
    vi.mocked(client.search.query).mockResolvedValueOnce({
      data: [{ id: 'contact_01', api_key: 'sk_live_ALL_SECRET' }],
    } as never)
    const result = await executeTool(client, 'search_records', { object_type: 'all', query: 'jane' })
    const text = getTextContent(result)
    expect(text).not.toContain('sk_live_ALL_SECRET')
  })

  it('relate_records contact_company sanitizes sensitive fields in response', async () => {
    const client = makeMockClient()
    vi.mocked(client.contacts.update).mockResolvedValueOnce({ id: 'contact_01', api_key: 'sk_live_SECRET' } as never)
    const result = await executeTool(client, 'relate_records', {
      relationship_type: 'contact_company',
      source_record_id: 'contact_01',
      target_record_id: 'company_01',
    })
    const text = getTextContent(result)
    expect(text).not.toContain('sk_live_SECRET')
  })

  it('bulk_operation sanitizes sensitive fields in batch results', async () => {
    const client = makeMockClient()
    vi.mocked(client.contacts.batch).mockResolvedValueOnce([
      { id: 'contact_01', api_key: 'sk_live_SECRET' },
    ] as never)
    const result = await executeTool(client, 'bulk_operation', {
      object_type: 'contacts',
      operations: [{ action: 'create', record: { name: 'Test' } }],
    })
    const text = getTextContent(result)
    expect(text).not.toContain('sk_live_SECRET')
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

describe('safeReadResource', () => {
  it('sanitizes sensitive content in thrown errors', async () => {
    const err = await safeReadResource(
      () => Promise.reject(new Error('Bearer ya29.LEAKED_TOKEN internal error')),
    ).catch((e: unknown) => e) as McpToolError
    expect(err.name).toBe('McpToolError')
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.message).not.toContain('ya29.LEAKED_TOKEN')
    expect(err.message).not.toContain('LEAKED_TOKEN')
  })

  it('wraps reader errors as McpToolError', async () => {
    await expect(
      safeReadResource(() => Promise.reject(new Error('db down'))),
    ).rejects.toMatchObject({ name: 'McpToolError', code: 'INTERNAL_ERROR' })
  })
})
