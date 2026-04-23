import { describe, it, expect } from 'vitest'
import { COMPANY_FIXTURES } from './companies.js'
import { FIRST_NAMES, LAST_NAMES } from './names.js'
import { EMAIL_DOMAIN_TEMPLATES, slugify } from './domains.js'
import { DEFAULT_PIPELINE_STAGES } from './stages.js'

describe('fixtures', () => {
  it('COMPANY_FIXTURES has at least 60 entries with name/industry/sizeHint', () => {
    expect(COMPANY_FIXTURES.length).toBeGreaterThanOrEqual(60)
    for (const c of COMPANY_FIXTURES) {
      expect(c.name).toBeTypeOf('string')
      expect(c.industry).toBeTypeOf('string')
      expect(c.sizeHint).toBeTypeOf('number')
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
  it('DEFAULT_PIPELINE_STAGES has 5 stages with stageOrder and weight', () => {
    expect(DEFAULT_PIPELINE_STAGES.length).toBe(5)
    const total = DEFAULT_PIPELINE_STAGES.reduce((s, st) => s + st.weight, 0)
    expect(total).toBeCloseTo(1, 5)
    for (const s of DEFAULT_PIPELINE_STAGES) {
      expect(s.stageOrder).toBeTypeOf('number')
      expect(s.isWon).toBeTypeOf('boolean')
      expect(s.isLost).toBeTypeOf('boolean')
    }
  })
  it('slugify lower-cases and hyphenates', () => {
    expect(slugify('Acme Events Inc.')).toBe('acme-events-inc')
  })
})
