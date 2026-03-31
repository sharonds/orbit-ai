import { apiKeyInsertSchema, apiKeySelectSchema, apiKeyUpdateSchema } from '../../schema/zod.js'

export const apiKeyRecordSchema = apiKeySelectSchema
export type ApiKeyRecord = typeof apiKeyRecordSchema._output

export const apiKeyCreateInputSchema = apiKeyInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ApiKeyCreateInput = typeof apiKeyCreateInputSchema._input

export const apiKeyUpdateInputSchema = apiKeyUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ApiKeyUpdateInput = typeof apiKeyUpdateInputSchema._input
