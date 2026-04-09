export function truncateText(value: string, maxLength: number, suffix = '...[truncated]'): string {
  if (value.length <= maxLength) {
    return value
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
