import { pipelineInsertSchema, pipelineSelectSchema, pipelineUpdateSchema } from '../../schema/zod.js'

export const pipelineRecordSchema = pipelineSelectSchema
export type PipelineRecord = typeof pipelineRecordSchema._output

export const pipelineCreateInputSchema = pipelineInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type PipelineCreateInput = typeof pipelineCreateInputSchema._input

export const pipelineUpdateInputSchema = pipelineUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type PipelineUpdateInput = typeof pipelineUpdateInputSchema._input
