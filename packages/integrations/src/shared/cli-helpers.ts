import type { CredentialStore, StoredCredentials } from '../credentials.js'

export interface ConfigureInput {
  readonly provider: string
  readonly organizationId: string
  readonly userId: string
  readonly credentials: StoredCredentials
  readonly credentialStore: CredentialStore
  readonly skipValidation: boolean
}

export interface ConfigureResult {
  readonly configured: boolean
  readonly provider: string
  readonly error?: string
}

/**
 * Masks secret-looking substrings before any error text leaves this package.
 * Applied to BOTH success and failure paths so stderr/stdout cannot leak tokens
 * even if a validator or underlying SDK embeds a token in its error message.
 */
export function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/\b(ya29\.[A-Za-z0-9_-]+)/g, '***')
    .replace(/\b(sk|rk|pk|whsec)_[A-Za-z0-9_]{10,}/g, '***')
    .replace(/\b1\/\/[A-Za-z0-9_-]+/g, '***')
    .replace(/\b(token|key|secret|password)=([^\s&"',;]+)/gi, '$1=***')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
}

export async function runConfigureAction(input: ConfigureInput): Promise<ConfigureResult> {
  if (!input.skipValidation) {
    return {
      configured: false,
      provider: input.provider,
      error: `Live validation is not supported in alpha. Pass --skip-validation to persist credentials without a probe.`,
    }
  }
  try {
    await input.credentialStore.saveCredentials(
      input.organizationId,
      input.provider,
      input.userId,
      input.credentials,
    )
    return { configured: true, provider: input.provider }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const safe = sanitizeErrorMessage(raw)
    console.error(`[${input.provider}] configure: save failed — ${safe}`)
    return { configured: false, provider: input.provider, error: safe }
  }
}

export interface StatusInput {
  readonly provider: string
  readonly organizationId: string
  readonly userId: string
  readonly credentialStore: CredentialStore
}

export interface StatusResult {
  readonly provider: string
  readonly configured: boolean
  readonly status: 'configured' | 'not_configured'
}

export async function runStatusAction(input: StatusInput): Promise<StatusResult> {
  const creds = await input.credentialStore.getCredentials(
    input.organizationId,
    input.provider,
    input.userId,
  )
  const configured = creds !== null
  return { provider: input.provider, configured, status: configured ? 'configured' : 'not_configured' }
}
