import { userInsertSchema, userSelectSchema, userUpdateSchema } from '../../schema/zod.js'

export const userRecordSchema = userSelectSchema
export type UserRecord = typeof userRecordSchema._output

export const userCreateInputSchema = userInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type UserCreateInput = typeof userCreateInputSchema._input

export const userUpdateInputSchema = userUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type UserUpdateInput = typeof userUpdateInputSchema._input
