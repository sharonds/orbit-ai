import { describe, expect, it } from 'vitest'
import { executeTool } from '../tools/registry.js'
import { makeMockClient, parseTextResult } from './helpers.js'

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

  it('update_custom_field uses schema.updateField', async () => {
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
})
