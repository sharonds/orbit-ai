import type { IntegrationCommand, CliRuntimeContext } from '../types.js'
import {
  resolveOAuthCredentialsFromArgs,
  runConfigureAction,
  runStatusAction,
} from '../shared/cli-helpers.js'

export interface GmailConfigureArgs {
  readonly accessToken?: string
  readonly refreshToken?: string
  readonly accessTokenEnv?: string
  readonly refreshTokenEnv?: string
  readonly accessTokenFile?: string
  readonly refreshTokenFile?: string
  readonly tokensStdin?: boolean
  readonly skipValidation?: boolean
}

const GMAIL_ACCESS_TOKEN_ENV = 'ORBIT_GMAIL_ACCESS_TOKEN'
const GMAIL_REFRESH_TOKEN_ENV = 'ORBIT_GMAIL_REFRESH_TOKEN'

export function buildGmailCommands(runtime: CliRuntimeContext): IntegrationCommand[] {
  return [
    {
      name: 'gmail/configure',
      description: 'Configure the Gmail connector with OAuth2 tokens',
      options: [
        { flags: '--access-token <token>',  description: `OAuth2 access token (prefer ${GMAIL_ACCESS_TOKEN_ENV})` },
        { flags: '--refresh-token <token>', description: `OAuth2 refresh token (prefer ${GMAIL_REFRESH_TOKEN_ENV})` },
        { flags: '--access-token-env <name>', description: 'Environment variable containing the OAuth2 access token' },
        { flags: '--refresh-token-env <name>', description: 'Environment variable containing the OAuth2 refresh token' },
        { flags: '--access-token-file <path>', description: 'File containing the OAuth2 access token' },
        { flags: '--refresh-token-file <path>', description: 'File containing the OAuth2 refresh token' },
        { flags: '--tokens-stdin', description: 'Read OAuth2 tokens as JSON from stdin', defaultValue: false },
        { flags: '--skip-validation',       description: 'Skip live validation — required in alpha', defaultValue: false },
      ],
      async action(...actionArgs: unknown[]) {
        const args = (actionArgs[0] ?? {}) as GmailConfigureArgs
        const credentials = await resolveOAuthCredentialsFromArgs(args, {
          provider: 'gmail',
          defaultAccessTokenEnv: GMAIL_ACCESS_TOKEN_ENV,
          defaultRefreshTokenEnv: GMAIL_REFRESH_TOKEN_ENV,
          warn: (message) => process.stderr.write(`${message}\n`),
        })
        if ('error' in credentials) {
          runtime.print({ configured: false, provider: 'gmail', error: credentials.error })
          return
        }
        const result = await runConfigureAction({
          provider: 'gmail',
          organizationId: runtime.organizationId,
          userId: runtime.userId,
          credentials,
          credentialStore: runtime.credentialStore,
          skipValidation: Boolean(args.skipValidation),
        })
        runtime.print(result)
      },
    },
    {
      name: 'gmail/status',
      description: 'Show the Gmail connector configuration status',
      async action() {
        const result = await runStatusAction({
          provider: 'gmail',
          organizationId: runtime.organizationId,
          userId: runtime.userId,
          credentialStore: runtime.credentialStore,
        })
        runtime.print(result)
      },
    },
  ]
}
