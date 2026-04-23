/**
 * Build an RFC-5322-safe local-part for an email address from a display name.
 *
 * Strips anything that is not a letter or digit, lower-casing the result. That
 * drops spaces, hyphens, and apostrophes so multi-word names like "De Boer"
 * or "O'Brien" still produce a syntactically valid email local-part.
 */
export function emailLocalPart(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}
