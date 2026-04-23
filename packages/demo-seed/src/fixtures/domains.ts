// Templates use IANA-reserved, non-routable TLDs per RFC 2606 and RFC 6761
// (`.test`, `.example`, `.invalid`). Demo data must never resolve to a real
// domain — even accidentally — because consumers may ship the seeded dataset
// in public demos, e2e fixtures, and screenshots.
export const EMAIL_DOMAIN_TEMPLATES: readonly string[] = [
  '{slug}.test',
  '{slug}.example',
  '{slug}.invalid',
  'team-{slug}.test',
  'hello-{slug}.example',
  'go-{slug}.test',
  '{slug}-corp.example',
]

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
