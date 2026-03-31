import { organizationMembershipInsertSchema, organizationMembershipSelectSchema, organizationMembershipUpdateSchema } from '../../schema/zod.js'

export const organizationMembershipRecordSchema = organizationMembershipSelectSchema
export type OrganizationMembershipRecord = typeof organizationMembershipRecordSchema._output

export const organizationMembershipCreateInputSchema = organizationMembershipInsertSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type OrganizationMembershipCreateInput = typeof organizationMembershipCreateInputSchema._input

export const organizationMembershipUpdateInputSchema = organizationMembershipUpdateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type OrganizationMembershipUpdateInput = typeof organizationMembershipUpdateInputSchema._input
