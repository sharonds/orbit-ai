import { describe, it, expect } from 'vitest'
import { buildStack } from '../harness/build-stack.js'
import { spawnMcp } from '../harness/run-mcp.js'
import { expectMcpError, expectMcpSuccess } from '../harness/mcp-envelope.js'

describe('Journey 11 — MCP server + core tool flows', () => {
  it('registers and invokes every expected core MCP tool', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres' })
    const mcp = await spawnMcp({ adapter: stack.adapter, organizationId: stack.acmeOrgId })
    try {
      const toolsResp = await mcp.request('tools/list', {})
      const expectedCoreToolNames = new Set([
        'search_records',
        'get_record',
        'create_record',
        'update_record',
        'delete_record',
        'get_schema',
        'get_pipelines',
        'move_deal_stage',
      ])
      const registeredCoreToolNames = new Set(
        toolsResp.tools.filter((tool) => expectedCoreToolNames.has(tool.name)).map((tool) => tool.name),
      )
      expect([...registeredCoreToolNames].sort()).toEqual([...expectedCoreToolNames].sort())

      const invokedToolNames = new Set<string>()
      const callTool = async (name: string, args: Record<string, unknown>) => {
        invokedToolNames.add(name)
        return mcp.request('tools/call', { name, arguments: args })
      }

      const searchPayload = expectMcpSuccess(
        await callTool('search_records', { object_type: 'contacts', limit: 5 }),
        'search_records contacts',
      )
      const searchData = searchPayload.data as Array<{ id: string }> | undefined
      expect(searchData?.length ?? 0).toBeGreaterThan(0)

      const createContactPayload = expectMcpSuccess(
        await callTool('create_record', {
          object_type: 'contacts',
          record: { name: 'MCP Created', email: 'mcp@journey11.local' },
        }),
        'create_record contact',
      )
      const createContactData = unwrapData(createContactPayload) as { id?: string }
      const createdId = createContactData.id ?? ''
      expect(createdId).toMatch(/^contact_/)

      const getContactPayload = expectMcpSuccess(
        await callTool('get_record', { object_type: 'contacts', record_id: createdId }),
        'get_record contact',
      )
      expect((unwrapData(getContactPayload) as { id?: string }).id).toBe(createdId)

      expectMcpSuccess(
        await callTool('update_record', {
          object_type: 'contacts',
          record_id: createdId,
          record: { name: 'MCP Updated' },
        }),
        'update_record contact',
      )
      const updatedContactPayload = expectMcpSuccess(
        await callTool('get_record', { object_type: 'contacts', record_id: createdId }),
        'get_record updated contact',
      )
      expect((unwrapData(updatedContactPayload) as { name?: string }).name).toBe('MCP Updated')

      const schemaPayload = expectMcpSuccess(
        await callTool('get_schema', {}),
        'get_schema',
      )
      const schemaData = unwrapData(schemaPayload) as Array<{ type?: string }>
      expect(schemaData.some((object) => object.type === 'contacts')).toBe(true)

      const pipelinesPayload = expectMcpSuccess(
        await callTool('get_pipelines', { limit: 10 }),
        'get_pipelines',
      )
      const pipelinesEnvelope = unwrapData(pipelinesPayload) as { data?: Array<{ id: string }> }
      const pipeline = pipelinesEnvelope.data?.[0]
      expect(pipeline?.id).toMatch(/^pipeline_/)
      const stagesPage = await stack.sdkDirect.stages.list({ filter: { pipeline_id: pipeline!.id }, limit: 10 })
      expect(stagesPage.data.length, 'pipeline has at least two stages').toBeGreaterThanOrEqual(2)
      const fromStage = stagesPage.data[0]!
      const toStage = stagesPage.data[1]!

      const dealPayload = expectMcpSuccess(
        await callTool('create_record', {
          object_type: 'deals',
          record: { name: 'MCP Move Deal', stage_id: fromStage.id, pipeline_id: pipeline!.id },
        }),
        'create_record deal',
      )
      const dealId = (unwrapData(dealPayload) as { id?: string }).id ?? ''
      expect(dealId).toMatch(/^deal_/)

      expectMcpSuccess(
        await callTool('move_deal_stage', { deal_id: dealId, stage_id: toStage.id }),
        'move_deal_stage',
      )
      const movedDealPayload = expectMcpSuccess(
        await callTool('get_record', { object_type: 'deals', record_id: dealId }),
        'get_record moved deal',
      )
      expect((unwrapData(movedDealPayload) as { stage_id?: string }).stage_id).toBe(toStage.id)

      expectMcpSuccess(
        await callTool('delete_record', { object_type: 'contacts', record_id: createdId, confirm: true }),
        'delete_record contact',
      )
      expectMcpError(
        await callTool('get_record', { object_type: 'contacts', record_id: createdId }),
        'RESOURCE_NOT_FOUND',
        'get_record deleted contact',
      )

      const invalidObjectResponse = await callTool('search_records', { object_type: 'invalid_object', limit: 5 })
      expect(invalidObjectResponse.isError, 'search_records invalid object isError').toBe(true)
      expect(invalidObjectResponse.content?.[0]?.type, 'search_records invalid object content type').toBe('text')

      expect([...invokedToolNames].filter((name) => expectedCoreToolNames.has(name)).sort()).toEqual(
        [...expectedCoreToolNames].sort(),
      )
    } finally {
      await mcp.close()
      await stack.teardown()
    }
  })
})

function unwrapData(payload: Record<string, unknown>): unknown {
  return payload.data ?? payload
}
