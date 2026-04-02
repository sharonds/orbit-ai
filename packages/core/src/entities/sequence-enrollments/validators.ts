import { z } from 'zod'

import {
  sequenceEnrollmentInsertSchema,
  sequenceEnrollmentSelectSchema,
  sequenceEnrollmentUpdateSchema,
} from '../../schema/zod.js'

export const sequenceEnrollmentRecordSchema = sequenceEnrollmentSelectSchema
export type SequenceEnrollmentRecord = z.infer<typeof sequenceEnrollmentRecordSchema>

export const sequenceEnrollmentCreateInputSchema = sequenceEnrollmentInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SequenceEnrollmentCreateInput = z.input<typeof sequenceEnrollmentCreateInputSchema>

export const sequenceEnrollmentUpdateInputSchema = sequenceEnrollmentUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type SequenceEnrollmentUpdateInput = z.input<typeof sequenceEnrollmentUpdateInputSchema>
