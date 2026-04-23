import type { IntegrationCommand, CliRuntimeContext } from '../types.js'
import { runConfigureAction, runStatusAction } from '../shared/cli-helpers.js'

export interface GmailConfigureArgs {
  readonly accessToken: string
  readonly refreshToken: string
  readonly skipValidation?: boolean
}

export function buildGmailCommands(runtime: CliRuntimeContext): IntegrationCommand[] {
  return [
    {
      name: 'gmail/configure',
      description: 'Configure the Gmail connector with OAuth2 tokens',
      options: [
        { flags: '--access-token <token>',  description: 'OAuth2 access token (short-lived)' },
        { flags: '--refresh-token <token>', description: 'OAuth2 refresh token' },
        { flags: '--skip-validation',       description: 'Skip live validation — required in alpha', defaultValue: false },
      ],
      async action(...actionArgs: unknown[]) {
        const args = (actionArgs[0] ?? {}) as GmailConfigureArgs
        const result = await runConfigureAction({
          provider: 'gmail',
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
