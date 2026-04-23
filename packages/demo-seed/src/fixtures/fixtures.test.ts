import { describe, it, expect } from 'vitest'
import { COMPANY_FIXTURES } from './companies.js'
import { FIRST_NAMES, LAST_NAMES } from './names.js'
import { EMAIL_DOMAIN_TEMPLATES, slugify } from './domains.js'
import { DEFAULT_PIPELINE_STAGES } from './stages.js'

describe('fixtures', () => {
  it('COMPANY_FIXTURES has exactly 60 entries with name/industry/sizeHint (positive integer)', () => {
    expect(COMPANY_FIXTURES.length).toBe(60)
    for (const c of COMPANY_FIXTURES) {
      expect(c.name).toBeTypeOf('string')
      expect(c.industry).toBeTypeOf('string')
      expect(c.sizeHint).toBeTypeOf('number')
      expect(Number.isInteger(c.sizeHint)).toBe(true)
      expect(c.sizeHint).toBeGreaterThan(0)
    }
  })
  it('name pools have at least 200 entries each', () => {
    expect(FIRST_NAMES.length).toBeGreaterThanOrEqual(200)
    expect(LAST_NAMES.length).toBeGreaterThanOrEqual(200)
  })
  it('EMAIL_DOMAIN_TEMPLATES is non-empty and template-shaped', () => {
    expect(EMAIL_DOMAIN_TEMPLATES.length).toBeGreaterThan(0)
    for (const t of EMAIL_DOMAIN_TEMPLATES) expect(t).toContain('{slug}')
  })
  it('DEFAULT_PIPELINE_STAGES has 5 stages with stageOrder, weight, and discriminated kind', () => {
    expect(DEFAULT_PIPELINE_STAGES.length).toBe(5)
    const total = DEFAULT_PIPELINE_STAGES.reduce((s, st) => s + st.weight, 0)
    expect(total).toBeCloseTo(1, 5)
    let wonCount = 0
    let lostCount = 0
    for (let i = 0; i < DEFAULT_PIPELINE_STAGES.length; i += 1) {
      const s = DEFAULT_PIPELINE_STAGES[i]!
      expect(s.stageOrder).toBe(i + 1)
      expect(s.probability).toBeGreaterThanOrEqual(0)
      expect(s.probability).toBeLessThanOrEqual(100)
      expect(['open', 'won', 'lost']).toContain(s.kind)
      if (s.kind === 'won') wonCount += 1
      if (s.kind === 'lost') lostCount += 1
    }
    expect(wonCount).toBe(1)
    expect(lostCount).toBe(1)
  })
  it('slugify lower-cases and hyphenates', () => {
    expect(slugify('Acme Events Inc.')).toBe('acme-events-inc')
  })
})
