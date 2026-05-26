import { OrbitError } from './types/errors.js'

export const PUBLIC_ENTITY_DATE_INPUT_FIELDS: Readonly<Record<string, readonly string[]>> = {
  contacts: ['lastContactedAt'],
  deals: ['expectedCloseDate', 'wonAt', 'lostAt'],
  activities: ['occurredAt'],
  tasks: ['dueDate', 'completedAt'],
  payments: ['paidAt'],
  contracts: ['signedAt', 'expiresAt'],
  sequence_enrollments: ['enrolledAt', 'exitedAt'],
  sequence_events: ['occurredAt'],
}

export function isPublicEntityDateInputField(entity: string, field: string): boolean {
  return PUBLIC_ENTITY_DATE_INPUT_FIELDS[entity]?.includes(field) ?? false
}

export function deserializePublicDateInputField(field: string, value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new OrbitError({
      code: 'VALIDATION_FAILED',
      message: `Invalid date string for ${field}`,
      field,
      hint: 'Use an ISO 8601 date/time string with a timezone, for example 2026-04-17T12:00:00.000Z.',
    })
  }
  return date
}
