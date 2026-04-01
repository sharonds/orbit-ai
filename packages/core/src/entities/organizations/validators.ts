import { organizationInsertSchema, organizationSelectSchema, organizationUpdateSchema } from '../../schema/zod.js'

export const organizationRecordSchema = organizationSelectSchema
export type OrganizationRecord = typeof organizationRecordSchema._output

export const organizationCreateInputSchema = organizationInsertSchema.omit({
  createdAt: true,
  updatedAt: true,
})
export type OrganizationCreateInput = typeof organizationCreateInputSchema._input

export const organizationUpdateInputSchema = organizationUpdateSchema.omit({
  createdAt: true,
  updatedAt: true,
})
export type OrganizationUpdateInput = typeof organizationUpdateInputSchema._input
