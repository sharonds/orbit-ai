import { describe, expect, it } from 'vitest'
import { truncateText, truncateUnknownStringsWithMeta } from '../output/truncation.js'

describe('truncation helpers', () => {
  it('does not exceed maxLength when suffix is longer than the limit', () => {
    expect(truncateText('abcdef', 5)).toHaveLength(5)
  })

  it('returns empty string when maxLength is 0', () => {
    expect(truncateText('hello', 0)).toBe('')
  })

  it('returns empty string when maxLength is negative', () => {
    expect(truncateText('hello', -1)).toBe('')
  })

  it('tracks whether nested output was truncated', () => {
    const result = truncateUnknownStringsWithMeta(
      { id: 'record_01', body: 'x'.repeat(6_000), nested: [{ note: 'ok' }] },
      5_000,
    )
    expect(result.truncated).toBe(true)
    expect(JSON.stringify(result.value)).toContain('[truncated]')
  })
})
