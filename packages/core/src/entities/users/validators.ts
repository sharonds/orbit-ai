import { userInsertSchema, userSelectSchema, userUpdateSchema } from '../../schema/zod.js'

export const userRecordSchema = userSelectSchema
export type UserRecord = typeof userRecordSchema._output

export const sanitizedUserRecordSchema = userRecordSchema.omit({
  externalAuthId: true,
})
export type SanitizedUserRecord = typeof sanitizedUserRecordSchema._output

export function sanitizeUserRecord(record: UserRecord): SanitizedUserRecord {
  return sanitizedUserRecordSchema.parse(record)
}

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
  externalAuthId: true,
})
export type UserUpdateInput = typeof userUpdateInputSchema._input
