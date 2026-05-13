import { describe, it, expect } from 'vitest'
import { extractAngleAddr } from './email-parsing.js'

describe('extractAngleAddr', () => {
  it('extracts the address from a display-name form', () => {
    expect(extractAngleAddr('Alice <alice@example.com>')).toBe('alice@example.com')
  })

  it('lowercases and trims the result', () => {
    expect(extractAngleAddr('Alice <  Alice@Example.com  >')).toBe('alice@example.com')
  })

  it('returns the trimmed lowercased input when no angle brackets are present', () => {
    expect(extractAngleAddr('  ALICE@example.com  ')).toBe('alice@example.com')
  })

  it('falls back to the raw input when only an opening bracket is present', () => {
    expect(extractAngleAddr('Alice <alice@example.com')).toBe('alice <alice@example.com')
  })

  it('falls back when the bracketed segment is empty', () => {
    expect(extractAngleAddr('Alice <>')).toBe('alice <>')
  })

  it('still extracts the address when the display name is very long', () => {
    const longName = 'A'.repeat(2000)
    expect(extractAngleAddr(`${longName} <alice@example.com>`)).toBe('alice@example.com')
  })

  it('handles pathological unmatched-bracket input without parsing it as an email', () => {
    // Pre-fix, a polynomial-backtracking regex would hang on inputs like this.
    // With the indexOf-based parser, an unmatched `<` falls through to the
    // raw-input branch and returns the (lowercased, trimmed) input — never
    // mis-extracts a bogus address. No timing assertion here: indexOf is O(n)
    // by definition, so correctness is enough.
    const pathological = '<' + 'a'.repeat(200_000)
    const result = extractAngleAddr(pathological)
    expect(result.length).toBe(pathological.length)
    expect(result.startsWith('<')).toBe(true)
  })
})
