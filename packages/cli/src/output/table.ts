import Table from 'cli-table3'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.join(', ')
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function formatTable(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '(no records)\n'

  const firstRecord = records[0]
  if (firstRecord === undefined) return '(no records)\n'
  const headers = Object.keys(firstRecord)
  const table = new Table({ head: headers })

  for (const record of records) {
    table.push(headers.map((h) => formatValue(record[h])))
  }

  return table.toString() + '\n'
}
