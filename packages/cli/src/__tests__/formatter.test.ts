import { describe, it, expect } from 'vitest'
import { formatCsv, formatTsv } from '../output/csv.js'
import { formatTable } from '../output/table.js'
import { formatOutput } from '../output/formatter.js'
import { formatJson } from '../output/json.js'

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

  it('returns empty string for empty array', () => {
    expect(formatCsv([])).toBe('')
  })

  it('renders null values as empty string (not "undefined")', () => {
    const out = formatCsv([{ a: null }])
    const lines = out.split('\r\n')
    // header line + data line + trailing empty from split
    expect(lines[1]).toBe('')
    expect(out).not.toContain('undefined')
    expect(out).not.toContain('null')
  })

  it('renders true as yes', () => {
    const out = formatCsv([{ active: true }])
    const lines = out.split('\r\n')
    expect(lines[1]).toBe('yes')
  })

  it('renders false as no', () => {
    const out = formatCsv([{ active: false }])
    const lines = out.split('\r\n')
    expect(lines[1]).toBe('no')
  })

  it('renders arrays as comma-separated values', () => {
    const out = formatCsv([{ tags: ['a', 'b', 'c'] }])
    expect(out).toContain('a, b, c')
  })
})

describe('TSV formatter', () => {
  it('strips tab characters from field values', () => {
    const out = formatTsv([{ value: 'a\tb' }])
    // Tab in field replaced with space; result should not have tab in that field
    expect(out).not.toContain('a\tb')
    expect(out).toContain('a b')
  })

  it('returns empty string for empty array', () => {
    expect(formatTsv([])).toBe('')
  })

  it('uses tab as delimiter in header', () => {
    const out = formatTsv([{ name: 'Alice', age: '30' }])
    const lines = out.split('\r\n')
    expect(lines[0]).toBe('name\tage')
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

  it('returns (no records) for empty array', () => {
    expect(formatTable([])).toBe('(no records)\n')
  })

  it('renders Date objects as ISO string', () => {
    const d = new Date('2024-06-01T12:00:00.000Z')
    const out = formatTable([{ created_at: d }])
    expect(out).toContain('2024-06-01T12:00:00.000Z')
  })

  it('renders null values as empty string', () => {
    const out = formatTable([{ name: null }])
    expect(out).not.toContain('null')
    expect(out).not.toContain('undefined')
  })
})

describe('JSON formatter', () => {
  it('round-trips through JSON.parse with equality', () => {
    const envelope = { data: [{ id: 'cnt_1', name: 'Alice' }], meta: { total: 1 } }
    const out = formatOutput(envelope, { format: 'json' })
    expect(JSON.parse(out)).toEqual(envelope)
  })

  it('formatJson(null) returns "null\\n"', () => {
    expect(formatJson(null)).toBe('null\n')
  })

  it('formatJson with object returns pretty-printed JSON', () => {
    const out = formatJson({ key: 'value' })
    expect(out).toContain('"key"')
    expect(out.endsWith('\n')).toBe(true)
  })
})

describe('formatOutput', () => {
  it('format table with envelope { data: [...] } renders data array', () => {
    const envelope = { data: [{ id: '1', name: 'Alice' }] }
    const out = formatOutput(envelope, { format: 'table' })
    expect(out).toContain('Alice')
    expect(out).not.toContain('(no records)')
  })

  it('format csv with envelope passes through to CSV', () => {
    const envelope = { data: [{ name: 'Bob' }] }
    const out = formatOutput(envelope, { format: 'csv' })
    expect(out).toContain('name')
    expect(out).toContain('Bob')
  })

  it('format tsv with envelope passes through to TSV', () => {
    const envelope = { data: [{ name: 'Carol' }] }
    const out = formatOutput(envelope, { format: 'tsv' })
    expect(out).toContain('name')
    expect(out).toContain('Carol')
  })

  it('format table with non-array envelope (single record) renders the record', () => {
    const singleRecord = { data: { id: '42', name: 'Dave' } }
    const out = formatOutput(singleRecord, { format: 'table' })
    expect(out).toContain('Dave')
  })

  it('format json with single record returns full envelope as JSON', () => {
    const envelope = { data: { id: '1' }, meta: {} }
    const out = formatOutput(envelope, { format: 'json' })
    expect(JSON.parse(out)).toEqual(envelope)
  })

  it('format table with empty data array returns (no records)', () => {
    const envelope = { data: [] }
    const out = formatOutput(envelope, { format: 'table' })
    expect(out).toBe('(no records)\n')
  })
})
