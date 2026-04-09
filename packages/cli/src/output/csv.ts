/**
 * CSV formatter (RFC 4180 compliant).
 * Fields containing commas, double-quotes, or newlines are quoted.
 * Double-quotes within quoted fields are doubled ("").
 * TSV: same but tab-delimited. Fields containing literal tabs are stripped
 * (replaced with a space) since there is no standard tab escape in TSV.
 */

function csvField(value: unknown, delimiter: string): string {
  const str =
    value === null || value === undefined
      ? ''
      : typeof value === 'boolean'
        ? value ? 'yes' : 'no'
        : typeof value === 'object' && !Array.isArray(value)
          ? JSON.stringify(value)
          : Array.isArray(value)
            ? value.join(', ')
            : String(value)

  if (delimiter === '\t') {
    // TSV: strip tab characters (replace with space)
    const cleaned = str.replace(/\t/g, ' ')
    // Still quote if contains newlines
    if (cleaned.includes('\n') || cleaned.includes('"')) {
      return '"' + cleaned.replace(/"/g, '""') + '"'
    }
    return cleaned
  }

  // CSV: quote if contains delimiter, double-quote, or newline
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function flattenRecord(record: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (key === 'custom_fields' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [cfKey, cfValue] of Object.entries(value)) {
        flat[`custom_fields.${cfKey}`] = cfValue
      }
    } else {
      flat[key] = value
    }
  }
  return flat
}

function formatDelimited(records: Record<string, unknown>[], delimiter: string): string {
  if (records.length === 0) return ''

  const flattened = records.map(flattenRecord)
  const firstRecord = flattened[0]
  if (firstRecord === undefined) return ''
  const headers = Object.keys(firstRecord)

  const lines: string[] = []
  lines.push(headers.map((h) => csvField(h, delimiter)).join(delimiter))
  for (const record of flattened) {
    lines.push(headers.map((h) => csvField(record[h], delimiter)).join(delimiter))
  }

  return lines.join('\r\n') + '\r\n'
}

export function formatCsv(records: Record<string, unknown>[]): string {
  return formatDelimited(records, ',')
}

export function formatTsv(records: Record<string, unknown>[]): string {
  return formatDelimited(records, '\t')
}
