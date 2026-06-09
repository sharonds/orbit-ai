/**
 * Extract the bare email address from a "Display Name <email@example.com>" header.
 *
 * Uses indexOf (not a regex) to parse in linear time without backtracking, so
 * pathological inputs cannot cause CPU exhaustion. Returns the trimmed and
 * lowercased input when no well-formed `<...>` segment is present.
 */
export function extractAngleAddr(raw: string): string {
  const open = raw.indexOf('<')
  if (open !== -1) {
    const close = raw.indexOf('>', open + 1)
    if (close !== -1 && close > open + 1) {
      return raw.slice(open + 1, close).toLowerCase().trim()
    }
  }
  return raw.toLowerCase().trim()
}
