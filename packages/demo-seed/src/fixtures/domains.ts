export const EMAIL_DOMAIN_TEMPLATES: readonly string[] = [
  '{slug}.co',
  '{slug}.io',
  '{slug}.com',
  'team-{slug}.co',
  'hello-{slug}.io',
  'go-{slug}.com',
  '{slug}-corp.com',
]

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
