import { stageInsertBaseSchema, stageSelectSchema, stageUpdateBaseSchema } from '../../schema/zod.js'

export const stageRecordSchema = stageSelectSchema
export type StageRecord = typeof stageRecordSchema._output

export const stageCreateInputSchema = stageInsertBaseSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type StageCreateInput = typeof stageCreateInputSchema._input

export const stageUpdateInputSchema = stageUpdateBaseSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type StageUpdateInput = typeof stageUpdateInputSchema._input
