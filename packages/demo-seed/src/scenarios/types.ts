import type { StorageAdapter } from '@orbit-ai/core'

export interface ScenarioSeedOptions {
  readonly adapter: StorageAdapter
  readonly organizationId: string
  readonly now: number
}

export interface ScenarioRecordRef {
  readonly id: string
  readonly label: string
}

export interface ScenarioSeedResult {
  readonly scenario: string
  readonly organizationId: string
  readonly records: Record<string, ScenarioRecordRef>
  readonly expected: Record<string, unknown>
}

export function isoDaysAgo(now: number, days: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}

export function dateDaysAgo(now: number, days: number): Date {
  return new Date(now - days * 24 * 60 * 60 * 1000)
}
