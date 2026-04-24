import * as fs from 'node:fs'
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
    .replace(
      /\b(accessToken|refreshToken|access_token|refresh_token|apiKey|api_key|clientSecret|client_secret|token|key|secret|password)\s*[:=]\s*([^\s,}"']+)/gi,
      '$1=***',
    )
    .replace(
      /(["'])(accessToken|refreshToken|access_token|refresh_token|apiKey|api_key|clientSecret|client_secret|token|key|secret|password)\1\s*:\s*(["'])(.*?)\3/gi,
      '$1$2$1:$3***$3',
    )
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
}

export interface OAuthCredentialArgs {
  readonly accessToken?: string
  readonly refreshToken?: string
  readonly accessTokenEnv?: string
  readonly refreshTokenEnv?: string
  readonly accessTokenFile?: string
  readonly refreshTokenFile?: string
  readonly tokensStdin?: boolean
}

export interface ResolveOAuthCredentialInputOptions {
  readonly provider?: string
  readonly defaultAccessTokenEnv?: string
  readonly defaultRefreshTokenEnv?: string
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>
  readonly argv?: string[]
  readonly warn?: (message: string) => void
  readonly readFile?: (path: string) => string
  readonly readStdin?: () => string | Promise<string>
}

const SECRET_ARG_FLAGS = new Set(['--access-token', '--refresh-token'])

export function redactOAuthTokenArgv(argv: string[] = process.argv): boolean {
  let redacted = false
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? ''
    if (SECRET_ARG_FLAGS.has(arg) && i + 1 < argv.length) {
      argv[i + 1] = '[REDACTED]'
      redacted = true
    } else if (arg.startsWith('--access-token=')) {
      argv[i] = '--access-token=[REDACTED]'
      redacted = true
    } else if (arg.startsWith('--refresh-token=')) {
      argv[i] = '--refresh-token=[REDACTED]'
      redacted = true
    }
  }
  return redacted
}

function readEnv(
  name: string | undefined,
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string | undefined {
  if (!name) return undefined
  const value = env[name]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function readTokenFile(
  filePath: string | undefined,
  readFile: (path: string) => string,
): string | undefined {
  if (!filePath) return undefined
  const value = readFile(filePath).trim()
  return value.length > 0 ? value : undefined
}

async function readStdin(readStdin?: () => string | Promise<string>): Promise<string> {
  if (readStdin) return readStdin()
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function parseStdinCredentials(input: string): Partial<StoredCredentials> | { error: string } {
  try {
    const parsed = JSON.parse(input) as Partial<StoredCredentials>
    const credentials: Partial<StoredCredentials> = {}
    if (typeof parsed.accessToken === 'string') credentials.accessToken = parsed.accessToken
    if (typeof parsed.refreshToken === 'string') credentials.refreshToken = parsed.refreshToken
    return credentials
  } catch (_err) {
    return { error: 'OAuth token stdin input must be JSON with accessToken and refreshToken fields.' }
  }
}

export async function resolveOAuthCredentials(
  args: OAuthCredentialArgs,
  opts: ResolveOAuthCredentialInputOptions = {},
): Promise<StoredCredentials> {
  const result = await resolveOAuthCredentialsFromArgs(args, opts)
  if ('error' in result) throw new Error(result.error)
  return result
}

export async function resolveOAuthCredentialsFromArgs(
  args: OAuthCredentialArgs,
  opts: ResolveOAuthCredentialInputOptions,
): Promise<StoredCredentials | { error: string }> {
  const env = opts.env ?? process.env
  const readFile = opts.readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'))
  const usedArgSecret = typeof args.accessToken === 'string' || typeof args.refreshToken === 'string'
  if (usedArgSecret && redactOAuthTokenArgv(opts.argv ?? process.argv)) {
    opts.warn?.(
      `[${opts.provider}] Warning: OAuth tokens passed as CLI flags may be visible in process listings. Prefer ${opts.defaultAccessTokenEnv}/${opts.defaultRefreshTokenEnv} or --access-token-env/--refresh-token-env.`,
    )
  }

  const stdinCredentials = args.tokensStdin ? parseStdinCredentials(await readStdin(opts.readStdin)) : {}
  if ('error' in stdinCredentials) return stdinCredentials

  const accessToken =
    stdinCredentials.accessToken ??
    readTokenFile(args.accessTokenFile, readFile) ??
    args.accessToken ??
    readEnv(args.accessTokenEnv, env) ??
    readEnv(opts.defaultAccessTokenEnv, env)
  const refreshToken =
    stdinCredentials.refreshToken ??
    readTokenFile(args.refreshTokenFile, readFile) ??
    args.refreshToken ??
    readEnv(args.refreshTokenEnv, env) ??
    readEnv(opts.defaultRefreshTokenEnv, env)

  if (!accessToken || !refreshToken) {
    return {
      error: `OAuth access and refresh tokens are required. Prefer ${opts.defaultAccessTokenEnv ?? 'provider token env vars'}, --access-token-env/--refresh-token-env, --access-token-file/--refresh-token-file, or --tokens-stdin.`,
    }
  }

  return { accessToken, refreshToken }
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
