import { z } from 'zod'

import { companyInsertSchema, companySelectSchema, companyUpdateSchema } from '../../schema/zod.js'

export const companyRecordSchema = companySelectSchema
export type CompanyRecord = z.infer<typeof companyRecordSchema>

export const companyCreateInputSchema = companyInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type CompanyCreateInput = z.input<typeof companyCreateInputSchema>

export const companyUpdateInputSchema = companyUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type CompanyUpdateInput = z.input<typeof companyUpdateInputSchema>
