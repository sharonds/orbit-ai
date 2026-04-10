import type { ZodTypeAny } from 'zod'

// ─── Plugin contract ───────────────────────────────────────────────────────────

export interface OrbitIntegrationPlugin {
  slug: string
  title: string
  version: string
  commands: IntegrationCommand[]
  tools: IntegrationTool[]
  outboundEventHandlers: Record<string, OrbitEventHandler>
  install(runtime: IntegrationRuntime): Promise<void>
  uninstall(runtime: IntegrationRuntime): Promise<void>
  healthcheck(runtime: IntegrationRuntime): Promise<{ healthy: boolean; message?: string }>
}

export interface IntegrationCommand {
  name: string
  description: string
  action: (...args: unknown[]) => void | Promise<void>
  options?: Array<{ flags: string; description: string; defaultValue?: string | boolean }>
}

export interface IntegrationTool {
  name: string // MUST start with 'integrations.'
  title?: string
  description: string
  inputSchema: ZodTypeAny
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

export interface IntegrationWebhookHandler {
  provider: string
  verify(payload: Buffer, signature: string, secret: string): boolean
  handle(runtime: IntegrationRuntime, event: unknown): Promise<void>
}

// ─── Runtime ──────────────────────────────────────────────────────────────────

export interface IntegrationRuntime {
  adapter: unknown // @orbit-ai/core StorageAdapter
  client: unknown // @orbit-ai/sdk OrbitClient (optional, HTTP mode)
  config: Record<string, unknown>
  eventBus: OrbitIntegrationEventBus
}

// ─── Event bus ────────────────────────────────────────────────────────────────

export type OrbitEventHandler = (event: OrbitDomainEvent) => Promise<void>

export interface OrbitDomainEvent {
  type: string // e.g. 'contact.created', 'deal.stage_moved'
  organizationId: string
  payload: Record<string, unknown>
  occurredAt: Date
}

export interface OrbitIntegrationEventBus {
  publish(event: OrbitDomainEvent): Promise<void>
  subscribe(eventType: string, handler: OrbitEventHandler): void
  // MVP: exact string match only — no wildcards
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface IntegrationResult<T> {
  data: T
  provider: string
  rawResponse?: unknown
}
