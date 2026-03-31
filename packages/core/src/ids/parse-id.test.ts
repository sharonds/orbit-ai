import { describe, expect, it } from 'vitest'

import { assertOrbitId } from './parse-id.js'

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
})
