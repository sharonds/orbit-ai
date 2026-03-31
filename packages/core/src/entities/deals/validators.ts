import { z } from 'zod'

import { dealInsertBaseSchema, dealSelectSchema, dealUpdateBaseSchema } from '../../schema/zod.js'

export const dealRecordSchema = dealSelectSchema
export type DealRecord = typeof dealRecordSchema._output

export const dealCreateInputSchema = dealInsertBaseSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
})
export type DealCreateInput = typeof dealCreateInputSchema._input

export const dealUpdateInputSchema = dealUpdateBaseSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
})
export type DealUpdateInput = typeof dealUpdateInputSchema._input
