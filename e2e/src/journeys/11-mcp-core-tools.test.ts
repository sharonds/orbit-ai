import { describe, it, expect } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { spawnMcp } from '../harness/run-mcp.js'

describe('Journey 11 — MCP server + core tool flows', () => {
  it('registers core tools and executes search_records + create_record + get_record', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres' })
    const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })
    try {
      // tools/list — assert core generic tools are registered
      const toolsResp = await mcp.request('tools/list', {})
      const toolNames = toolsResp.tools.map((t) => t.name)
      expect(toolNames).toContain('search_records')
      expect(toolNames).toContain('get_record')
      expect(toolNames).toContain('create_record')
      expect(toolNames).toContain('update_record')
      expect(toolNames).toContain('delete_record')
      expect(toolNames).toContain('get_pipelines')
      expect(toolNames).toContain('move_deal_stage')
      expect(toolNames).toContain('get_schema')

      // search_records — seed has contacts
      const searchResp = await mcp.request('tools/call', {
        name: 'search_records',
        arguments: { object_type: 'contacts', limit: 5 },
      })
      const searchContent = searchResp.content?.[0]
      expect(searchContent?.type).toBe('text')
      const searchData = JSON.parse(searchContent!.text) as { data?: Array<{ id: string }> }
      expect(searchData.data?.length ?? 0).toBeGreaterThan(0)

      // create_record
      const createResp = await mcp.request('tools/call', {
        name: 'create_record',
        arguments: {
          object_type: 'contacts',
          record: { name: 'MCP Created', email: 'mcp@journey11.local' },
        },
      })
      expect(createResp.isError).toBeFalsy()
      const createData = JSON.parse(createResp.content![0]!.text) as { id?: string; data?: { id: string } }
      const createdId = createData.id ?? createData.data?.id ?? ''
      expect(createdId).toMatch(/^contact_/)

      // get_record — uses record_id (not id)
      const getResp = await mcp.request('tools/call', {
        name: 'get_record',
        arguments: { object_type: 'contacts', record_id: createdId },
      })
      expect(getResp.isError).toBeFalsy()
      const getData = JSON.parse(getResp.content![0]!.text) as { id?: string; data?: { id: string } }
      expect(getData.id ?? getData.data?.id).toBe(createdId)
    } finally {
      await mcp.close()
      await stack.teardown()
    }
  })
})
