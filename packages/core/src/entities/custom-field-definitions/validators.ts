import { z } from 'zod'

import { customFieldDefinitionSelectSchema, customFieldDefinitionInsertSchema } from '../../schema/zod.js'

const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi_select',
  'url',
  'email',
  'phone',
  'currency',
  'relation',
] as const

const customFieldTypeSchema = z.enum(CUSTOM_FIELD_TYPES)

export const customFieldDefinitionRecordSchema = customFieldDefinitionSelectSchema.extend({
  fieldType: customFieldTypeSchema,
})
export type CustomFieldDefinitionRecord = z.infer<typeof customFieldDefinitionRecordSchema>

export const customFieldDefinitionCreateInputSchema = customFieldDefinitionInsertSchema.omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  fieldType: customFieldTypeSchema,
})
export type CustomFieldDefinitionCreateInput = z.input<typeof customFieldDefinitionCreateInputSchema>
