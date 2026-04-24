import { z } from 'zod'

import { dealInsertBaseSchema, dealSelectSchema, dealUpdateBaseSchema } from '../../schema/zod.js'

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
  // Accept number or string for value — coerce to string for the numeric DB column.
  value: z.union([z.number(), z.string()]).transform((v) => String(v)).optional().nullable(),
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
  // Accept number or string for value — coerce to string for the numeric DB column.
  value: z.union([z.number(), z.string()]).transform((v) => String(v)).optional().nullable(),
}).transform((val) => {
  const { name, ...rest } = val
  if (name !== undefined && rest.title === undefined) {
    return { ...rest, title: name }
  }
  return rest as typeof val
})
export type DealUpdateInput = typeof dealUpdateInputSchema._input
