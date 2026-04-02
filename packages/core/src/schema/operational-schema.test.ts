import { describe, expect, it } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

import {
  activities,
  companies,
  contacts,
  contracts,
  deals,
  notes,
  payments,
  pipelines,
  products,
  sequenceEnrollments,
  sequenceEvents,
  sequences,
  sequenceSteps,
  stages,
  tasks,
} from './tables.js'
import {
  activitiesRelations,
  companiesRelations,
  contractsRelations,
  contactsRelations,
  dealsRelations,
  notesRelations,
  paymentsRelations,
  pipelinesRelations,
  productsRelations,
  sequenceEnrollmentsRelations,
  sequenceEventsRelations,
  sequencesRelations,
  sequenceStepsRelations,
  stagesRelations,
  tasksRelations,
} from './relations.js'

describe('operational schema slice 2', () => {
  it('defines the operational tenant tables with organization scope', () => {
    for (const table of [
      companies,
      contacts,
      pipelines,
      stages,
      deals,
      activities,
      tasks,
      notes,
      products,
      payments,
      contracts,
      sequences,
      sequenceSteps,
      sequenceEnrollments,
      sequenceEvents,
    ]) {
      const columns = getTableColumns(table)
      expect(Object.keys(columns)).toContain('organizationId')
    }
  })

  it('keeps the expected relation graph compiled for the operational and engagement tables', () => {
    expect(activitiesRelations.table).toBe(activities)
    expect(companiesRelations.table).toBe(companies)
    expect(contractsRelations.table).toBe(contracts)
    expect(contactsRelations.table).toBe(contacts)
    expect(pipelinesRelations.table).toBe(pipelines)
    expect(paymentsRelations.table).toBe(payments)
    expect(productsRelations.table).toBe(products)
    expect(sequenceEnrollmentsRelations.table).toBe(sequenceEnrollments)
    expect(sequenceEventsRelations.table).toBe(sequenceEvents)
    expect(sequencesRelations.table).toBe(sequences)
    expect(sequenceStepsRelations.table).toBe(sequenceSteps)
    expect(stagesRelations.table).toBe(stages)
    expect(dealsRelations.table).toBe(deals)
    expect(tasksRelations.table).toBe(tasks)
    expect(notesRelations.table).toBe(notes)

    expect(getTableConfig(companies).foreignKeys).toHaveLength(2)
    expect(getTableConfig(contacts).foreignKeys).toHaveLength(3)
    expect(getTableConfig(pipelines).foreignKeys).toHaveLength(1)
    expect(getTableConfig(stages).foreignKeys).toHaveLength(2)
    expect(getTableConfig(deals).foreignKeys).toHaveLength(6)
    expect(getTableConfig(activities).foreignKeys).toHaveLength(5)
    expect(getTableConfig(tasks).foreignKeys).toHaveLength(5)
    expect(getTableConfig(notes).foreignKeys).toHaveLength(5)
    expect(getTableConfig(products).foreignKeys).toHaveLength(1)
    expect(getTableConfig(payments).foreignKeys).toHaveLength(3)
    expect(getTableConfig(contracts).foreignKeys).toHaveLength(4)
    expect(getTableConfig(sequences).foreignKeys).toHaveLength(1)
    expect(getTableConfig(sequenceSteps).foreignKeys).toHaveLength(2)
    expect(getTableConfig(sequenceEnrollments).foreignKeys).toHaveLength(3)
    expect(getTableConfig(sequenceEvents).foreignKeys).toHaveLength(3)
  })

  it('defines the expected operational and engagement indexes', () => {
    const pipelineConfig = getTableConfig(pipelines)
    const stageConfig = getTableConfig(stages)
    const dealConfig = getTableConfig(deals)
    const activityConfig = getTableConfig(activities)
    const taskConfig = getTableConfig(tasks)
    const noteConfig = getTableConfig(notes)
    const productConfig = getTableConfig(products)
    const paymentConfig = getTableConfig(payments)
    const contractConfig = getTableConfig(contracts)
    const sequenceConfig = getTableConfig(sequences)
    const sequenceStepConfig = getTableConfig(sequenceSteps)
    const sequenceEnrollmentConfig = getTableConfig(sequenceEnrollments)
    const sequenceEventConfig = getTableConfig(sequenceEvents)

    expect(pipelineConfig.indexes.length).toBeGreaterThanOrEqual(1)
    expect(stageConfig.indexes.length).toBeGreaterThanOrEqual(2)
    expect(dealConfig.indexes.length).toBeGreaterThanOrEqual(4)
    expect(activityConfig.indexes.length).toBeGreaterThanOrEqual(4)
    expect(taskConfig.indexes.length).toBeGreaterThanOrEqual(2)
    expect(noteConfig.indexes.length).toBeGreaterThanOrEqual(2)
    expect(productConfig.indexes.length).toBeGreaterThanOrEqual(1)
    expect(paymentConfig.indexes.length).toBeGreaterThanOrEqual(2)
    expect(contractConfig.indexes.length).toBeGreaterThanOrEqual(1)
    expect(sequenceConfig.indexes.length).toBeGreaterThanOrEqual(1)
    expect(sequenceStepConfig.indexes.length).toBeGreaterThanOrEqual(1)
    expect(sequenceEnrollmentConfig.indexes.length).toBeGreaterThanOrEqual(1)
    expect(sequenceEventConfig.indexes.length).toBeGreaterThanOrEqual(1)
  })
})
