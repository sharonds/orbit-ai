import { describe, expect, it } from 'vitest'
import { executeTool } from '../tools/registry.js'
import { makeMockClient, parseTextResult } from './helpers.js'

describe('gated tools', () => {
  for (const name of ['import_records', 'export_records', 'run_report', 'get_dashboard_summary'] as const) {
    it(`${name} returns DEPENDENCY_NOT_AVAILABLE`, async () => {
      const result = await executeTool(makeMockClient(), name, { object_type: 'contacts' })
      expect(result.isError).toBe(true)
      expect(parseTextResult(result).error.code).toBe('DEPENDENCY_NOT_AVAILABLE')
    })
  }
})
