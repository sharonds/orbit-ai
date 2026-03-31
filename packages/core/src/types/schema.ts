export type CustomFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'email'
  | 'phone'
  | 'currency'
  | 'relation'

export interface CustomFieldDefinition {
  id: string
  organizationId: string
  entityType: string
  fieldName: string
  fieldType: CustomFieldType
  label: string
  description?: string
  isRequired: boolean
  isIndexed: boolean
  isPromoted: boolean
  promotedColumnName?: string
  defaultValue?: unknown
  options: string[]
  validation: Record<string, unknown>
}
