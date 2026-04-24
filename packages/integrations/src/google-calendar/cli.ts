import type { IntegrationCommand, CliRuntimeContext } from '../types.js'
import {
  resolveOAuthCredentialsFromArgs,
  runConfigureAction,
  runStatusAction,
} from '../shared/cli-helpers.js'

export interface CalendarConfigureArgs {
  readonly accessToken?: string
  readonly refreshToken?: string
  readonly accessTokenEnv?: string
  readonly refreshTokenEnv?: string
  readonly accessTokenFile?: string
  readonly refreshTokenFile?: string
  readonly tokensStdin?: boolean
  readonly skipValidation?: boolean
}

const CALENDAR_ACCESS_TOKEN_ENV = 'ORBIT_GOOGLE_CALENDAR_ACCESS_TOKEN'
const CALENDAR_REFRESH_TOKEN_ENV = 'ORBIT_GOOGLE_CALENDAR_REFRESH_TOKEN'

export function buildCalendarCommands(runtime: CliRuntimeContext): IntegrationCommand[] {
  return [
    {
      name: 'google-calendar/configure',
      description: 'Configure the Google Calendar connector with OAuth2 tokens',
      options: [
        { flags: '--access-token <token>',  description: `OAuth2 access token (prefer ${CALENDAR_ACCESS_TOKEN_ENV})` },
        { flags: '--refresh-token <token>', description: `OAuth2 refresh token (prefer ${CALENDAR_REFRESH_TOKEN_ENV})` },
        { flags: '--access-token-env <name>', description: 'Environment variable containing the OAuth2 access token' },
        { flags: '--refresh-token-env <name>', description: 'Environment variable containing the OAuth2 refresh token' },
        { flags: '--access-token-file <path>', description: 'File containing the OAuth2 access token' },
        { flags: '--refresh-token-file <path>', description: 'File containing the OAuth2 refresh token' },
        { flags: '--tokens-stdin', description: 'Read OAuth2 tokens as JSON from stdin', defaultValue: false },
        { flags: '--skip-validation',       description: 'Skip live validation — required in alpha', defaultValue: false },
      ],
      async action(...actionArgs: unknown[]) {
        const args = (actionArgs[0] ?? {}) as CalendarConfigureArgs
        const credentials = await resolveOAuthCredentialsFromArgs(args, {
          provider: 'google-calendar',
          defaultAccessTokenEnv: CALENDAR_ACCESS_TOKEN_ENV,
          defaultRefreshTokenEnv: CALENDAR_REFRESH_TOKEN_ENV,
          warn: (message) => process.stderr.write(`${message}\n`),
        })
        if ('error' in credentials) {
          runtime.print({ configured: false, provider: 'google-calendar', error: credentials.error })
          return
        }
        const result = await runConfigureAction({
          provider: 'google-calendar',
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
      name: 'google-calendar/status',
      description: 'Show the Google Calendar connector configuration status',
      async action() {
        const result = await runStatusAction({
          provider: 'google-calendar',
          organizationId: runtime.organizationId,
          userId: runtime.userId,
          credentialStore: runtime.credentialStore,
        })
        runtime.print(result)
      },
    },
  ]
}
