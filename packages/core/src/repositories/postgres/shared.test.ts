import { describe, expect, it } from 'vitest'

import { fromPostgresJson } from './shared.js'

describe('fromPostgresJson (T9/L10)', () => {
  it('parses JSON string values into the structured shape', () => {
    expect(fromPostgresJson<{ a: number }>('{"a":1}', { a: 0 })).toEqual({ a: 1 })
  })

  it('returns the value as-is when Postgres has already parsed jsonb to an object', () => {
    const obj = { x: 'y' }
    expect(fromPostgresJson<Record<string, string>>(obj, {})).toBe(obj)
  })

  it('returns SQL NULL as null (not the fallback) so callers can distinguish', () => {
    expect(fromPostgresJson<string | null>(null, 'fallback')).toBeNull()
  })

  it('returns the fallback when the value is undefined (column missing)', () => {
    expect(fromPostgresJson<string>(undefined, 'fallback')).toBe('fallback')
  })

  it('preserves number primitives stored in jsonb', () => {
    expect(fromPostgresJson<number>(42, 0)).toBe(42)
    expect(fromPostgresJson<number>(0, -1)).toBe(0)
    expect(fromPostgresJson<number>(3.14, 0)).toBe(3.14)
  })

  it('preserves boolean primitives stored in jsonb', () => {
    expect(fromPostgresJson<boolean>(true, false)).toBe(true)
    expect(fromPostgresJson<boolean>(false, true)).toBe(false)
  })

  it('returns the fallback for malformed JSON strings', () => {
    expect(fromPostgresJson<{ a: number }>('not json', { a: 0 })).toEqual({ a: 0 })
  })
})
