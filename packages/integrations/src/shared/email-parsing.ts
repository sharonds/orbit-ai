// RFC 5321 caps the forward-path at 256 octets; allowing 512 leaves slack for a
// reasonable display name without inviting catastrophic-backtracking inputs.
const MAX_FROM_HEADER_LENGTH = 512

/**
 * Extract the bare email address from a "Display Name <email@example.com>" header.
 *
 * Uses indexOf/lastIndexOf (not a regex) to avoid polynomial-backtracking risk
 * on attacker-controlled mail headers. Inputs longer than MAX_FROM_HEADER_LENGTH
 * are treated as malformed and returned trimmed/lowercased without parsing.
 */
export function extractAngleAddr(raw: string): string {
  if (raw.length > MAX_FROM_HEADER_LENGTH) {
    return raw.slice(0, MAX_FROM_HEADER_LENGTH).toLowerCase().trim()
  }
  const open = raw.indexOf('<')
  if (open !== -1) {
    const close = raw.indexOf('>', open + 1)
    if (close !== -1 && close > open + 1) {
      return raw.slice(open + 1, close).toLowerCase().trim()
    }
  }
  return raw.toLowerCase().trim()
}
