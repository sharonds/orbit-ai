import { describe, it, expect } from 'vitest'
import { buildStack } from '../harness/build-stack.js'

describe('Journey 6 — move a deal between pipeline stages', () => {
  it('updates deal stage and preserves identity (HTTP write, direct read)', async () => {
    const stack = await buildStack({ tenant: 'acme' })
    try {
      // Get available stages — core returns camelCase fields (pipelineId, organizationId, etc.)
      const stagesPage = await stack.sdkHttp.stages.list({ limit: 10 })
      expect(stagesPage.data.length, 'seed must include at least 2 stages').toBeGreaterThanOrEqual(2)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fromStage = stagesPage.data[0] as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toStage = stagesPage.data[1] as any
      expect(fromStage.id).not.toBe(toStage.id)

      // Create a deal in fromStage via HTTP.
      // The API + core both use camelCase internally; send stageId (not stage_id).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deal = await stack.sdkHttp.deals.create({ name: 'Journey6 Test Deal' } as any)
      expect(deal.id).toMatch(/^deal_/)

      // Move to fromStage via HTTP update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const moved = await stack.sdkHttp.deals.update(deal.id, { stageId: fromStage.id } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((moved as any).stageId).toBe(fromStage.id)

      // Move to toStage via HTTP update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await stack.sdkHttp.deals.update(deal.id, { stageId: toStage.id } as any)
      expect(updated.id).toBe(deal.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((updated as any).stageId).toBe(toStage.id)

      // Confirm via direct transport (different surface)
      const refetched = await stack.sdkDirect.deals.get(deal.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((refetched as any).stageId).toBe(toStage.id)
    } finally {
      await stack.teardown()
    }
  })
})
