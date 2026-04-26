import { describe, expect, it, vi } from 'vitest'
import { executeTool } from '../tools/registry.js'
import { getTextContent, makeMockClient, parseTextResult } from './helpers.js'

describe('schema tools', () => {
  it('get_schema lists all objects when object_type is omitted', async () => {
    const client = makeMockClient()
    await executeTool(client, 'get_schema', {})
    expect(client.schema.listObjects).toHaveBeenCalled()
  })

  it('get_schema describes a specific object when object_type is provided', async () => {
    const client = makeMockClient()
    await executeTool(client, 'get_schema', { object_type: 'contacts' })
    expect(client.schema.describeObject).toHaveBeenCalledWith('contacts')
  })

  it('create_custom_field uses schema.addField', async () => {
    const client = makeMockClient()
    await executeTool(client, 'create_custom_field', {
      object_type: 'contacts',
      field: { name: 'tier', type: 'text' },
    })
    expect(client.schema.addField).toHaveBeenCalledWith('contacts', { name: 'tier', type: 'text' })
  })

  it('update_custom_field uses schema.updateField for safe metadata changes', async () => {
    const client = makeMockClient()
    await executeTool(client, 'update_custom_field', {
      object_type: 'contacts',
      field_name: 'tier',
      field: { label: 'Tier' },
    })
    expect(client.schema.updateField).toHaveBeenCalledWith('contacts', 'tier', { label: 'Tier' })
  })

  it('update_custom_field validates field_name presence', async () => {
    const result = await executeTool(makeMockClient(), 'update_custom_field', {
      object_type: 'contacts',
      field: { label: 'Tier' },
    } as never)
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('VALIDATION_FAILED')
  })

  it.each([
    ['type change', { fieldType: 'number' }],
    ['legacy type change', { type: 'number' }],
    ['rename', { name: 'customer_tier' }],
    ['migration rename', { newFieldName: 'customer_tier' }],
    ['delete intent', { deleted: true }],
    ['promote intent', { isPromoted: true, promotedColumnName: 'tier' }],
    ['validation narrowing', { validation: { min: 10 } }],
    ['confirmation-backed destructive patch', { label: 'Tier', confirmation: { destructive: true } }],
  ])('update_custom_field rejects %s through MCP', async (_caseName, field) => {
    const client = makeMockClient()
    const result = await executeTool(client, 'update_custom_field', {
      object_type: 'contacts',
      field_name: 'tier',
      field,
    })

    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error).toMatchObject({
      code: 'DEPENDENCY_NOT_AVAILABLE',
    })
    expect(client.schema.updateField).not.toHaveBeenCalled()
  })

  it('update_custom_field unsupported errors do not leak SQL, credentials, or stack traces', async () => {
    const client = makeMockClient()
    const result = await executeTool(client, 'update_custom_field', {
      object_type: 'contacts',
      field_name: 'tier',
      field: {
        fieldType: 'number',
        sql: 'ALTER TABLE contacts DROP COLUMN custom_fields',
        rollbackSql: 'DROP TABLE contacts',
        api_key: 'sk_SECRET',
        stack: 'Error: hidden\n    at secret.ts:1:1',
      },
    })

    const text = getTextContent(result)
    expect(text).not.toContain('ALTER TABLE')
    expect(text).not.toContain('DROP TABLE')
    expect(text).not.toContain('sk_SECRET')
    expect(text).not.toContain('secret.ts')
    expect(client.schema.updateField).not.toHaveBeenCalled()
  })

  it('get_schema sanitizes sensitive fields in response', async () => {
    const client = makeMockClient()
    vi.mocked(client.schema.describeObject).mockResolvedValueOnce({ object: 'contacts', api_key: 'sk_SECRET' } as never)
    const result = await executeTool(client, 'get_schema', { object_type: 'contacts' })
    expect(getTextContent(result)).not.toContain('sk_SECRET')
  })
})
