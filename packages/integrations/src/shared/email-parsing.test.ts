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

  it('returns quickly on pathological long input without backtracking', () => {
    const pathological = '<' + 'a'.repeat(200_000)
    const start = Date.now()
    const result = extractAngleAddr(pathological)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100)
    expect(result.length).toBeLessThanOrEqual(512)
  })
})
