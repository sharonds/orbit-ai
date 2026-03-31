import { describe, expect, it } from 'vitest'

import { dealInsertSchema, stageInsertSchema } from './zod.js'

describe('slice 2 zod schemas', () => {
  it('rejects stages that are both won and lost', () => {
    expect(() =>
      stageInsertSchema.parse({
        id: 'stage_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        pipelineId: 'pipeline_01ARYZ6S41YYYYYYYYYYYYYYYY',
        name: 'Closed',
        stageOrder: 1,
        probability: 100,
        isWon: true,
        isLost: true,
      }),
    ).toThrow('Stage cannot be both won and lost')
  })

  it('rejects wonAt when the deal status is not won', () => {
    expect(() =>
      dealInsertSchema.parse({
        id: 'deal_01ARYZ6S41YYYYYYYYYYYYYYYY',
        organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
        title: 'Expansion Deal',
        currency: 'usd',
        status: 'open',
        wonAt: new Date('2026-03-31T10:00:00.000Z'),
      }),
    ).toThrow('Deal wonAt requires a won status in slice 2')
  })

  it('normalizes currency codes to uppercase on accepted deals', () => {
    const parsed = dealInsertSchema.parse({
      id: 'deal_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      title: 'Expansion Deal',
      currency: 'usd',
      status: 'won',
      wonAt: new Date('2026-03-31T10:00:00.000Z'),
    })

    expect(parsed.currency).toBe('USD')
  })
})
