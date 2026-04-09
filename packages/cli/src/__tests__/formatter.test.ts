import { describe, it, expect } from 'vitest'
import { formatCsv, formatTsv } from '../output/csv.js'
import { formatTable } from '../output/table.js'
import { formatOutput } from '../output/formatter.js'

describe('CSV formatter', () => {
  it('quotes fields containing commas', () => {
    const out = formatCsv([{ name: 'Smith, John' }])
    expect(out).toContain('"Smith, John"')
  })

  it('escapes double-quotes per RFC 4180', () => {
    const out = formatCsv([{ name: 'Say "hello"' }])
    expect(out).toContain('"Say ""hello"""')
  })

  it('preserves embedded newlines in quoted fields', () => {
    const out = formatCsv([{ bio: 'line1\nline2' }])
    expect(out).toContain('"line1\nline2"')
  })

  it('flattens custom_fields to custom_fields.<key> columns', () => {
    const out = formatCsv([{ name: 'Alice', custom_fields: { score: 42, tier: 'gold' } }])
    expect(out).toContain('custom_fields.score')
    expect(out).toContain('custom_fields.tier')
    expect(out).toContain('42')
    expect(out).toContain('gold')
  })

  it('has header row as first line', () => {
    const out = formatCsv([{ name: 'Alice', age: '30' }])
    const lines = out.split('\r\n')
    expect(lines[0]).toBe('name,age')
  })
})

describe('TSV formatter', () => {
  it('strips tab characters from field values', () => {
    const out = formatTsv([{ value: 'a\tb' }])
    // Tab in field replaced with space; result should not have tab in that field
    expect(out).not.toContain('a\tb')
    expect(out).toContain('a b')
  })
})

describe('Table formatter', () => {
  it('renders nested objects as JSON strings, not [object Object]', () => {
    const out = formatTable([{ data: { key: 'val' } }])
    expect(out).not.toContain('[object Object]')
    expect(out).toContain('"key"')
  })

  it('renders true as yes and false as no', () => {
    const out = formatTable([{ active: true, verified: false }])
    expect(out).toContain('yes')
    expect(out).toContain('no')
  })

  it('renders arrays as comma-separated values', () => {
    const out = formatTable([{ tags: ['a', 'b', 'c'] }])
    expect(out).toContain('a, b, c')
  })

  it('renders dates as ISO strings', () => {
    const d = '2024-01-15T10:00:00.000Z'
    const out = formatTable([{ created_at: d }])
    expect(out).toContain('2024-01-15')
  })
})

describe('JSON formatter', () => {
  it('round-trips through JSON.parse with equality', () => {
    const envelope = { data: [{ id: 'cnt_1', name: 'Alice' }], meta: { total: 1 } }
    const out = formatOutput(envelope, { format: 'json' })
    expect(JSON.parse(out)).toEqual(envelope)
  })
})
