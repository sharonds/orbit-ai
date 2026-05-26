import { describe, expect, it } from 'vitest'
import {
  deserializePublicDateInputField,
  isPublicEntityDateInputField,
  PUBLIC_ENTITY_DATE_INPUT_FIELDS,
} from './public-date-fields.js'
import { OrbitError } from './types/errors.js'

describe('public date input fields', () => {
  it('identifies date fields by public entity and core field name', () => {
    expect(PUBLIC_ENTITY_DATE_INPUT_FIELDS.tasks).toContain('dueDate')
    expect(isPublicEntityDateInputField('tasks', 'dueDate')).toBe(true)
    expect(isPublicEntityDateInputField('tasks', 'title')).toBe(false)
    expect(isPublicEntityDateInputField('unknown_entity', 'dueDate')).toBe(false)
  })

  it('coerces valid date strings and rejects invalid date strings with OrbitError', () => {
    expect(deserializePublicDateInputField('due_date', '2026-04-17T12:00:00.000Z')).toEqual(
      new Date('2026-04-17T12:00:00.000Z'),
    )

    const err = (() => {
      try {
        deserializePublicDateInputField('due_date', 'not-a-date')
      } catch (caught) {
        return caught
      }
      return undefined
    })()

    expect(err).toBeInstanceOf(OrbitError)
    expect(err).toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'due_date',
    })
  })
})
