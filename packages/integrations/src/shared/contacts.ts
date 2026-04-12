import { createIntegrationError } from '../errors.js'

export interface ContactLookupClient {
  // Minimal SDK-like interface for contact operations
  list(params: { filter?: Record<string, unknown> }): Promise<{ data: Array<{ id: string; email?: string | null; company_id?: string | null }> }>
  create(data: { email: string; first_name?: string; company_id?: string }): Promise<{ id: string }>
}

export interface CompanyLookupClient {
  list(params: { filter?: Record<string, unknown> }): Promise<{ data: Array<{ id: string; domain?: string | null }> }>
  create(data: { name: string; domain?: string }): Promise<{ id: string }>
}

/**
 * Find or create a contact from an email address.
 * Lookup is ALWAYS scoped to orgId — cross-org collisions are impossible.
 *
 * Dedupe policy per spec section 5:
 * 1. Exact normalized email match (within org)
 * 2. Company match by domain (within org)
 * 3. Create only when autoCreate is true
 */
export async function findOrCreateContactFromEmail(
  contactClient: ContactLookupClient,
  companyClient: CompanyLookupClient,
  orgId: string,
  email: string,
  options?: { autoCreate?: boolean },
): Promise<{ contactId: string; created: boolean }> {
  if (!orgId || typeof orgId !== 'string') {
    throw createIntegrationError(
      'INVALID_INPUT',
      'orgId must be a non-empty string',
      { provider: 'integrations' },
    )
  }

  const normalizedEmail = email.toLowerCase().trim()

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw createIntegrationError(
      'INVALID_INPUT',
      `Invalid email address: '${email}'`,
      { provider: 'integrations' },
    )
  }

  // Step 1: Exact email match within org
  const existing = await contactClient.list({
    filter: { email: normalizedEmail, organization_id: orgId },
  })
  if (existing.data.length > 0) {
    return { contactId: existing.data[0]!.id, created: false }
  }

  if (options?.autoCreate === false) {
    throw createIntegrationError(
      'NOT_FOUND',
      `Contact not found for email ${normalizedEmail} and auto_create is disabled`,
      { provider: 'integrations' },
    )
  }

  // Step 2: Try to find company by email domain
  const domain = normalizedEmail.split('@')[1]
  let companyId: string | undefined
  if (domain) {
    const companies = await companyClient.list({
      filter: { domain, organization_id: orgId },
    })
    if (companies.data.length > 0) {
      companyId = companies.data[0]!.id
    }
  }

  // Step 3: Create contact
  const firstName = normalizedEmail.split('@')[0] ?? normalizedEmail
  const created = await contactClient.create({
    email: normalizedEmail,
    first_name: firstName,
    ...(companyId != null ? { company_id: companyId } : {}),
  })

  return { contactId: created.id, created: true }
}

/**
 * Detect message direction based on sender email vs org user emails.
 */
export function detectDirection(from: string, orgUserEmails: string[]): 'inbound' | 'outbound' {
  const fromNormalized = from.toLowerCase().trim()
  // Extract email from "Name <email>" format
  const emailMatch = fromNormalized.match(/<([^>]+)>/)
  const fromEmail = emailMatch ? emailMatch[1]! : fromNormalized

  for (const userEmail of orgUserEmails) {
    if (fromEmail === userEmail.toLowerCase().trim()) {
      return 'outbound'
    }
  }
  return 'inbound'
}
