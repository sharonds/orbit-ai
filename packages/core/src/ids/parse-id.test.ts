import { describe, expect, it } from 'vitest'

import { assertOrbitId, isOrbitId } from './parse-id.js'

describe('assertOrbitId', () => {
  it('accepts a valid prefixed id', () => {
    expect(assertOrbitId('contact_01ARYZ6S41YYYYYYYYYYYYYYYY', 'contact')).toBe(
      'contact_01ARYZ6S41YYYYYYYYYYYYYYYY',
    )
  })

  it('rejects the wrong prefix', () => {
    expect(() => assertOrbitId('deal_01ARYZ6S41YYYYYYYYYYYYYYYY', 'contact')).toThrow(
      'Expected contact ID with prefix "contact_"',
    )
  })

  it('rejects malformed ulid bodies', () => {
    expect(() => assertOrbitId('contact_not-a-ulid', 'contact')).toThrow(
      'Invalid ULID body for contact ID',
    )
  })

  it('rejects lowercase ulid bodies', () => {
    expect(() => assertOrbitId('contact_01aryz6s41yyyyyyyyyyyyyyyy', 'contact')).toThrow(
      'Invalid ULID body for contact ID',
    )
  })
})

describe('isOrbitId', () => {
  it('returns true for valid prefixed id', () => {
    expect(isOrbitId('org_01ARZ3NDEKTSV4RRFFQ69G5FAV', 'organization')).toBe(true)
  })

  it('returns false for wrong prefix', () => {
    expect(isOrbitId('deal_01ARZ3NDEKTSV4RRFFQ69G5FAV', 'organization')).toBe(false)
  })

  it('returns false for plain UUID', () => {
    expect(isOrbitId('550e8400-e29b-41d4-a716-446655440000', 'organization')).toBe(false)
  })

  it('returns false for random string', () => {
    expect(isOrbitId('not-an-id', 'organization')).toBe(false)
  })

  it('returns false for malformed ULID body', () => {
    expect(isOrbitId('org_not-valid-ulid', 'organization')).toBe(false)
  })
})
