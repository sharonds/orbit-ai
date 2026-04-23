import type { IntegrationCommand, CliRuntimeContext } from '../types.js'
import { runConfigureAction, runStatusAction } from '../shared/cli-helpers.js'

export interface CalendarConfigureArgs {
  readonly accessToken: string
  readonly refreshToken: string
  readonly skipValidation?: boolean
}

export function buildCalendarCommands(runtime: CliRuntimeContext): IntegrationCommand[] {
  return [
    {
      name: 'google-calendar/configure',
      description: 'Configure the Google Calendar connector with OAuth2 tokens',
      options: [
        { flags: '--access-token <token>',  description: 'OAuth2 access token' },
        { flags: '--refresh-token <token>', description: 'OAuth2 refresh token' },
        { flags: '--skip-validation',       description: 'Skip live validation — required in alpha', defaultValue: false },
      ],
      async action(...actionArgs: unknown[]) {
        const args = (actionArgs[0] ?? {}) as CalendarConfigureArgs
        const result = await runConfigureAction({
          provider: 'google-calendar',
          organizationId: runtime.organizationId,
          userId: runtime.userId,
          credentials: { accessToken: args.accessToken, refreshToken: args.refreshToken },
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
