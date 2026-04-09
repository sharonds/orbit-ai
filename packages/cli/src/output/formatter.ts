import { formatJson } from './json.js'
import { formatTable } from './table.js'
import { formatCsv, formatTsv } from './csv.js'
import type { OutputFormat } from './types.js'

export type { OutputFormat }

export function formatOutput(
  data: unknown,
  options: { format: OutputFormat },
): string {
  const { format } = options

  if (format === 'json') {
    return formatJson(data)
  }

  // For table/csv/tsv, extract records from envelope or use as-is
  const records = extractRecords(data)

  if (format === 'table') return formatTable(records)
  if (format === 'csv') return formatCsv(records)
  if (format === 'tsv') return formatTsv(records)

  return formatJson(data)
}

function extractRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data !== null && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[]
    // Single record envelope
    if (obj.data !== undefined && typeof obj.data === 'object') {
      return [obj.data as Record<string, unknown>]
    }
    return [obj]
  }
  return []
}
