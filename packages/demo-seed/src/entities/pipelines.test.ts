import { describe, it, expect } from 'vitest'
import {
  createCoreServices,
  createSqliteOrbitDatabase,
  createSqliteStorageAdapter,
} from '@orbit-ai/core'
import { seedOrganization } from './organizations.js'
import { seedPipelinesAndStages } from './pipelines.js'
import { TENANT_PROFILES } from '../profiles.js'

describe('seedPipelinesAndStages', () => {
  it('creates one pipeline with 5 stages in order', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const org = await seedOrganization(adapter, TENANT_PROFILES.acme)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const { pipeline, stages } = await seedPipelinesAndStages(services, ctx)
    expect(pipeline.id).toMatch(/^pipeline_/)
    expect(stages.length).toBe(5)
    expect(stages.map((s) => s.name)).toEqual([
      'Prospecting', 'Qualification', 'Proposal', 'Closed Won', 'Closed Lost',
    ])
    for (const s of stages) {
      expect(s.id).toMatch(/^stage_/)
      expect(s.pipelineId).toBe(pipeline.id)
    }
  })

  it('marks Closed Won isWon=true and Closed Lost isLost=true', async () => {
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const org = await seedOrganization(adapter, TENANT_PROFILES.acme)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const { stages } = await seedPipelinesAndStages(services, ctx)
    const won = stages.find((s) => s.name === 'Closed Won')!
    const lost = stages.find((s) => s.name === 'Closed Lost')!
    expect(won.isWon).toBe(true)
    expect(won.isLost).toBe(false)
    expect(lost.isWon).toBe(false)
    expect(lost.isLost).toBe(true)
  })
})
