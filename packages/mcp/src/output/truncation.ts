export function truncateText(value: string, maxLength: number, suffix = '...[truncated]'): string {
  if (value.length <= maxLength) {
    return value
  }

  if (maxLength <= 0) {
    return ''
  }

  if (maxLength <= suffix.length) {
    return suffix.slice(0, maxLength)
  }

  const sliceLength = Math.max(0, maxLength - suffix.length)
  return `${value.slice(0, sliceLength)}${suffix}`
}

export function sanitizeStringInput(value: string, maxLength = 10_000): string {
  return truncateText(value, maxLength)
}

export function truncateUnknownStrings(value: unknown, maxLength: number): unknown {
  if (typeof value === 'string') {
    return truncateText(value, maxLength)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => truncateUnknownStrings(entry, maxLength))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, truncateUnknownStrings(entry, maxLength)]),
    )
  }

  return value
}

export function truncateUnknownStringsWithMeta(value: unknown, maxLength: number): {
  value: unknown
  truncated: boolean
} {
  let truncated = false

  function visit(entry: unknown): unknown {
    if (typeof entry === 'string') {
      const next = truncateText(entry, maxLength)
      if (next !== entry) {
        truncated = true
      }
      return next
    }

    if (Array.isArray(entry)) {
      return entry.map((item) => visit(item))
    }

    if (entry && typeof entry === 'object') {
      return Object.fromEntries(Object.entries(entry).map(([key, item]) => [key, visit(item)]))
    }

    return entry
  }

  return { value: visit(value), truncated }
}
