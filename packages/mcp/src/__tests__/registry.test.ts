import { describe, expect, it } from 'vitest'
import { buildTools, executeTool } from '../tools/registry.js'
import { makeMockClient, parseTextResult } from './helpers.js'

describe('registry', () => {
  it.each(buildTools())('tool %s includes explicit boolean annotations', (tool) => {
    expect(typeof tool.annotations?.readOnlyHint).toBe('boolean')
    expect(typeof tool.annotations?.destructiveHint).toBe('boolean')
    expect(typeof tool.annotations?.idempotentHint).toBe('boolean')
  })

  it('returns exactly 23 tools', () => {
    expect(buildTools()).toHaveLength(23)
  })

  it('intentionally excludes destructive schema migration tools', () => {
    const names = buildTools().map((tool) => tool.name)

    expect(names).not.toEqual(expect.arrayContaining([
      'preview_schema_migration',
      'apply_schema_migration',
      'rollback_schema_migration',
      'delete_custom_field',
      'rename_custom_field',
      'promote_custom_field',
    ]))
  })

  it('has non-empty unique tool names', () => {
    const names = buildTools().map((tool) => tool.name)
    expect(names.every((name) => typeof name === 'string' && name.length > 0)).toBe(true)
    expect(new Set(names).size).toBe(names.length)
  })

  it('marks destructive and read-only tools correctly', () => {
    const tools = Object.fromEntries(buildTools().map((tool) => [tool.name, tool]))
    const deleteRecord = tools.delete_record!
    const searchRecords = tools.search_records!
    const getRecord = tools.get_record!
    const bulkOperation = tools.bulk_operation!
    expect(deleteRecord.annotations?.destructiveHint).toBe(true)
    expect(searchRecords.annotations?.readOnlyHint).toBe(true)
    expect(getRecord.annotations?.readOnlyHint).toBe(true)
    expect(bulkOperation.annotations?.destructiveHint).toBe(true)
  })

  it('returns the same tool names across successive calls', () => {
    expect(buildTools().map((tool) => tool.name)).toEqual(buildTools().map((tool) => tool.name))
  })

  it('returns UNKNOWN_TOOL instead of throwing', async () => {
    const result = await executeTool(makeMockClient(), 'totally_unknown_tool', {})
    const parsed = parseTextResult(result)
    expect(result.isError).toBe(true)
    expect(parsed.error.code).toBe('UNKNOWN_TOOL')
  })
})
