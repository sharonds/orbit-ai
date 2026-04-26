import { z } from 'zod'

import { dealInsertBaseSchema, dealSelectSchema, dealUpdateBaseSchema } from '../../schema/zod.js'

const DECIMAL_18_2 = /^-?\d{1,16}(\.\d{1,2})?$/
const MAX_CENT_SAFE_FRACTIONAL_NUMBER = Number.MAX_SAFE_INTEGER / 1000

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
  if (Number.isInteger(value)) return value.toFixed(2)

  if (Math.abs(value) > MAX_CENT_SAFE_FRACTIONAL_NUMBER) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'value must fit numeric(18,2): large fractional values must be passed as decimal strings',
    })
    return z.NEVER
  }

  const cents = value * 100
  const roundedCents = Math.round(cents)
  if (!Number.isSafeInteger(roundedCents) || Math.abs(cents - roundedCents) > 1e-9) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'value must fit numeric(18,2): numeric inputs must be safe at cent precision; pass a decimal string',
    })
    return z.NEVER
  }
  return formatCents(roundedCents)
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.trunc(abs / 100)
  const fractional = String(abs % 100).padStart(2, '0')
  return `${sign}${whole}.${fractional}`
}

const dealValueSchema = z.union([
  z.number().finite(),
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
