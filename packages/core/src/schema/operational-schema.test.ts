import { describe, expect, it } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

import { companies, contacts, deals, pipelines, stages } from './tables.js'
import { companiesRelations, contactsRelations, dealsRelations, pipelinesRelations, stagesRelations } from './relations.js'

describe('operational schema slice 2', () => {
  it('defines the five operational tenant tables with organization scope', () => {
    for (const table of [companies, contacts, pipelines, stages, deals]) {
      const columns = getTableColumns(table)
      expect(Object.keys(columns)).toContain('organizationId')
    }
  })

  it('keeps the expected relation graph compiled for the operational tables', () => {
    expect(companiesRelations.table).toBe(companies)
    expect(contactsRelations.table).toBe(contacts)
    expect(pipelinesRelations.table).toBe(pipelines)
    expect(stagesRelations.table).toBe(stages)
    expect(dealsRelations.table).toBe(deals)

    expect(getTableConfig(companies).foreignKeys).toHaveLength(2)
    expect(getTableConfig(contacts).foreignKeys).toHaveLength(3)
    expect(getTableConfig(pipelines).foreignKeys).toHaveLength(1)
    expect(getTableConfig(stages).foreignKeys).toHaveLength(2)
    expect(getTableConfig(deals).foreignKeys).toHaveLength(6)
  })

  it('defines the expected operational indexes', () => {
    const pipelineConfig = getTableConfig(pipelines)
    const stageConfig = getTableConfig(stages)
    const dealConfig = getTableConfig(deals)

    expect(pipelineConfig.indexes.length).toBeGreaterThanOrEqual(1)
    expect(stageConfig.indexes.length).toBeGreaterThanOrEqual(2)
    expect(dealConfig.indexes.length).toBeGreaterThanOrEqual(4)
  })
})
