import { describe, expect, it } from 'vitest'
import { dealCreateInputSchema, dealUpdateInputSchema } from './validators.js'

describe('deal value validation', () => {
  it.each([
    ['scientific notation string', { name: 'Bad Deal', value: '1e21' }],
    ['unsafe number magnitude', { name: 'Bad Deal', value: 1e21 }],
    ['infinite number', { name: 'Bad Deal', value: Infinity }],
    ['too many integer digits', { name: 'Bad Deal', value: '12345678901234567.00' }],
    ['too many fractional digits', { name: 'Bad Deal', value: '1.234' }],
    ['numeric value with too many fractional digits', { name: 'Bad Deal', value: 1.234 }],
    ['large numeric value with unsafe fractional cents', { name: 'Bad Deal', value: 12345678901234.123 }],
    ['large numeric value that can shift apparent cents', { name: 'Bad Deal', value: 90071992547409.9 }],
  ] as const)('rejects %s', (_label, input) => {
    const result = dealCreateInputSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('accepts decimal strings that fit numeric(18,2)', () => {
    expect(dealCreateInputSchema.parse({ name: 'Good Deal', value: '1234567890123456.78' }).value).toBe(
      '1234567890123456.78',
    )
  })

  it('normalizes integer numbers to two fractional digits', () => {
    expect(dealCreateInputSchema.parse({ name: 'Good Deal', value: 1234 }).value).toBe('1234.00')
  })

  it('normalizes cent-safe fractional numbers without binary rounding drift', () => {
    expect(dealCreateInputSchema.parse({ name: 'Good Deal', value: 0.29 }).value).toBe('0.29')
  })

  it('accepts negative decimal strings', () => {
    expect(dealCreateInputSchema.parse({ name: 'Good Deal', value: '-50.00' }).value).toBe('-50.00')
  })

  it('accepts null and absent update values', () => {
    expect(dealUpdateInputSchema.parse({ value: null }).value).toBeNull()
    expect(dealUpdateInputSchema.parse({})).not.toHaveProperty('value')
  })
})
