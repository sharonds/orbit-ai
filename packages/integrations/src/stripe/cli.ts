import type { IntegrationCommand, CliRuntimeContext } from '../types.js'
import { sanitizeErrorMessage, runStatusAction } from '../shared/cli-helpers.js'

export interface StripeConfigureArgs {
  readonly apiKey?: string
  readonly apiKeyEnv?: string
  readonly skipValidation?: boolean
}

const STRIPE_API_KEY_ENV = 'ORBIT_STRIPE_API_KEY'
const STRIPE_SLUG = 'stripe'

export function buildStripeCommands(runtime: CliRuntimeContext): IntegrationCommand[] {
  return [
    {
      name: 'stripe/configure',
      description: 'Configure the Stripe connector with an API key',
      options: [
        { flags: '--api-key <key>', description: `Rejected for security; use ${STRIPE_API_KEY_ENV} or --api-key-env` },
        { flags: '--api-key-env <name>', description: 'Environment variable containing the Stripe API key' },
        { flags: '--skip-validation', description: 'Skip live validation — required in alpha', defaultValue: false },
      ],
      async action(...actionArgs: unknown[]) {
        const args = (actionArgs[0] ?? {}) as StripeConfigureArgs
        if (args.apiKey) {
          runtime.print({
            configured: false,
            provider: STRIPE_SLUG,
            error: `Do not pass Stripe API keys on the command line. Use ${STRIPE_API_KEY_ENV} or --api-key-env instead.`,
          })
          return
        }

        const apiKey =
          (args.apiKeyEnv ? process.env[args.apiKeyEnv] : undefined) ??
          process.env[STRIPE_API_KEY_ENV]

        if (!apiKey) {
          runtime.print({
            configured: false,
            provider: STRIPE_SLUG,
            error: `Stripe API key is required. Prefer ${STRIPE_API_KEY_ENV} or --api-key-env.`,
          })
          return
        }

        if (!args.skipValidation) {
          runtime.print({
            configured: false,
            provider: STRIPE_SLUG,
            error: 'Live validation is not supported in alpha. Pass --skip-validation to persist credentials without a probe.',
          })
          return
        }

        try {
          await runtime.credentialStore.saveCredentials(
            runtime.organizationId,
            STRIPE_SLUG,
            runtime.userId,
            { accessToken: apiKey, refreshToken: '__stripe_api_key__' },
          )
          runtime.print({ configured: true, provider: STRIPE_SLUG })
        } catch (err) {
          const raw = err instanceof Error ? err.message : String(err)
          const safe = sanitizeErrorMessage(raw)
          console.error(`[${STRIPE_SLUG}] configure: save failed — ${safe}`)
          runtime.print({ configured: false, provider: STRIPE_SLUG, error: safe })
        }
      },
    },
    {
      name: 'stripe/status',
      description: 'Show the Stripe connector configuration status',
      async action() {
        try {
          const result = await runStatusAction({
            provider: STRIPE_SLUG,
            organizationId: runtime.organizationId,
            userId: runtime.userId,
            credentialStore: runtime.credentialStore,
          })
          runtime.print(result)
        } catch (err) {
          const raw = err instanceof Error ? err.message : String(err)
          const safe = sanitizeErrorMessage(raw)
          console.error(`[${STRIPE_SLUG}] status: failed — ${safe}`)
          runtime.print({ provider: STRIPE_SLUG, configured: false, status: 'not_configured' as const, error: safe })
        }
      },
    },
  ]
}
