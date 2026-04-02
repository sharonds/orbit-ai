import { z } from 'zod'

import { contractInsertSchema, contractSelectSchema, contractUpdateSchema } from '../../schema/zod.js'

export const contractRecordSchema = contractSelectSchema
export type ContractRecord = z.infer<typeof contractRecordSchema>

export const contractCreateInputSchema = contractInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ContractCreateInput = z.input<typeof contractCreateInputSchema>

export const contractUpdateInputSchema = contractUpdateSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type ContractUpdateInput = z.input<typeof contractUpdateInputSchema>
