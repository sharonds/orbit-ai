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
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.acme)
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
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.acme)
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

  it('re-uses surviving stages and recreates missing ones when re-run after a partial delete', async () => {
    // Regression guard for the by-name merge path in seedPipelinesAndStages.
    // If a previous run created a subset of stages and some were later
    // deleted, the seeder must (a) re-use the survivors by id (not throw on
    // the unique (pipeline, name) constraint) and (b) fill in the missing
    // ones.
    const database = createSqliteOrbitDatabase()
    const adapter = createSqliteStorageAdapter({ database })
    await adapter.migrate()
    const { organization: org } = await seedOrganization(adapter, TENANT_PROFILES.acme)
    const services = createCoreServices(adapter)
    const ctx = { orgId: org.id }
    const first = await seedPipelinesAndStages(services, ctx)
    // Delete two stages. The remaining 3 must keep their ids across the
    // second seed() call.
    const toDelete = first.stages.filter((s) => s.name === 'Proposal' || s.name === 'Closed Lost')
    expect(toDelete.length).toBe(2)
    const survivors = first.stages.filter((s) => !toDelete.includes(s))
    const survivorIdsByName = new Map(survivors.map((s) => [s.name, s.id]))
    for (const s of toDelete) {
      await services.stages.delete(ctx, s.id)
    }

    const second = await seedPipelinesAndStages(services, ctx)
    expect(second.pipeline.id).toBe(first.pipeline.id)
    expect(second.stages.length).toBe(5)
    for (const s of second.stages) {
      const priorId = survivorIdsByName.get(s.name)
      if (priorId) {
        // Survivor — must retain the original id.
        expect(s.id).toBe(priorId)
      } else {
        // Recreated — id differs from the deleted row.
        expect(s.name === 'Proposal' || s.name === 'Closed Lost').toBe(true)
      }
    }
  })
})
