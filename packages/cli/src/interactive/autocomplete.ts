/**
 * Simple prefix-based fuzzy lookup for interactive mode.
 * Returns items matching the query prefix (case-insensitive).
 */
export function filterByPrefix<T extends { name: string; id: string }>(
  items: T[],
  query: string,
): T[] {
  const q = query.toLowerCase()
  return items.filter(
    (item) =>
      item.id.toLowerCase().startsWith(q) ||
      item.name.toLowerCase().startsWith(q) ||
      item.name.toLowerCase().includes(q),
  )
}
