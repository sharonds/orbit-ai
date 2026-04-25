import { z } from 'zod'

import { dealInsertBaseSchema, dealSelectSchema, dealUpdateBaseSchema } from '../../schema/zod.js'

const DECIMAL_18_2 = /^-?\d{1,16}(\.\d{1,2})?$/

function normalizeNumberValue(value: number, ctx: z.RefinementCtx): string | typeof z.NEVER {
  if (!Number.isFinite(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'value must be finite' })
    return z.NEVER
  }
  if (!Number.isSafeInteger(Math.trunc(value))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'value magnitude exceeds safe integer range; pass a decimal string',
    })
    return z.NEVER
  }
  return value.toFixed(2)
}

const dealValueSchema = z.union([
  z.number(),
  z.string(),
]).transform((value, ctx) => {
  const normalized = typeof value === 'number' ? normalizeNumberValue(value, ctx) : value
  if (normalized === z.NEVER) return z.NEVER
  if (!DECIMAL_18_2.test(normalized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'value must fit numeric(18,2): at most 16 integer digits and 2 fractional digits',
    })
    return z.NEVER
  }
  return normalized
}).optional().nullable()

export const dealRecordSchema = dealSelectSchema
export type DealRecord = typeof dealRecordSchema._output

export const dealCreateInputSchema = dealInsertBaseSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  // Omit `title` from the base so we can redefine it alongside `name`.
  title: true,
}).extend({
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
  // Public API accepts either `name` or `title` — both map to the `title` column.
  name: z.string().optional(),
  title: z.string().optional(),
  value: dealValueSchema,
}).superRefine((val, ctx) => {
  if (val.name === undefined && val.title === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Required: provide `name` or `title`',
      path: ['name'],
    })
  }
}).transform((val) => {
  const { name, ...rest } = val
  if (name !== undefined && rest.title === undefined) {
    return { ...rest, title: name }
  }
  return rest as typeof val
})
export type DealCreateInput = typeof dealCreateInputSchema._input

export const dealUpdateInputSchema = dealUpdateBaseSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  title: true,
}).extend({
  // Public API accepts either `name` or `title` — both map to the `title` column.
  name: z.string().optional(),
  title: z.string().optional(),
  value: dealValueSchema,
}).transform((val) => {
  const { name, ...rest } = val
  if (name !== undefined && rest.title === undefined) {
    return { ...rest, title: name }
  }
  return rest as typeof val
})
export type DealUpdateInput = typeof dealUpdateInputSchema._input
