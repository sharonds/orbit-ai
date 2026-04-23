import type { CliRuntimeContext, IntegrationCommand } from '../types.js'

export interface GmailConfigureArgs {
  accessToken: string
  refreshToken: string
  skipValidation?: boolean
}

export function buildGmailCommands(_runtime: CliRuntimeContext): IntegrationCommand[] {
  return []
}
