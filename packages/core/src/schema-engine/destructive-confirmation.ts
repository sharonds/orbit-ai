import { z } from 'zod'

import { createOrbitError } from '../types/errors.js'

const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/

/** Destructive confirmations expire 15 minutes after they were issued. */
export const DESTRUCTIVE_CONFIRMATION_TTL_MS = 15 * 60 * 1000
/** Tolerated future clock skew for `confirmedAt` timestamps. */
export const DESTRUCTIVE_CONFIRMATION_FUTURE_SKEW_MS = 60 * 1000
const PRODUCTION_LIKE_ENVIRONMENTS = new Set(['production', 'staging'])
const destructiveMigrationEnvironmentSchema = z.enum(['development', 'test', 'staging', 'production'])

export const schemaMigrationChecksumSchema = z.string().regex(CHECKSUM_PATTERN)
export type SchemaMigrationChecksum = z.infer<typeof schemaMigrationChecksumSchema>
export type DestructiveMigrationEnvironment = z.infer<typeof destructiveMigrationEnvironmentSchema>

const destructiveSafeguardEvidenceSchema = z.object({
  kind: z.enum(['backup', 'snapshot', 'branch']),
  evidenceId: z.string().min(1),
  capturedAt: z.string().datetime({ offset: true }).optional(),
}).strict()

const destructiveLedgerEvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  recordedAt: z.string().datetime({ offset: true }).optional(),
}).strict()

export const destructiveRollbackDecisionSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('rollbackable'),
    evidenceId: z.string().min(1).optional(),
  }).strict(),
  z.object({
    decision: z.literal('non_rollbackable'),
    reason: z.string().min(1),
  }).strict(),
])

export const destructiveSafeguardsSchema = z.object({
  environment: destructiveMigrationEnvironmentSchema.optional(),
  environmentAcknowledged: z.boolean().optional(),
  backup: destructiveSafeguardEvidenceSchema.optional(),
  ledger: destructiveLedgerEvidenceSchema.optional(),
  rollback: destructiveRollbackDecisionSchema.optional(),
}).strict()
export type DestructiveSafeguards = z.infer<typeof destructiveSafeguardsSchema>

export const destructiveConfirmationSchema = z.object({
  destructive: z.literal(true),
  checksum: schemaMigrationChecksumSchema,
  confirmedAt: z.string().datetime({ offset: true }),
  safeguards: destructiveSafeguardsSchema.optional(),
}).strict()
export type DestructiveConfirmation = z.infer<typeof destructiveConfirmationSchema>

export interface DestructiveConfirmationInput {
  destructiveOperations: string[]
  checksum: string
  confirmation?: DestructiveConfirmation | undefined
  runtimeEnvironment?: DestructiveMigrationEnvironment | undefined
  requireRuntimeEnvironment?: boolean | undefined
  /** Internal/test-only clock injection for deterministic freshness checks. */
  now?: Date | undefined
}

export function assertDestructiveConfirmation(input: DestructiveConfirmationInput): void {
  if (input.destructiveOperations.length === 0) return

  if (!input.confirmation) {
    throw createOrbitError({
      code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED',
      message: 'Destructive schema migration operations require confirmation before elevated execution',
      details: {
        destructiveOperations: input.destructiveOperations,
        checksum: input.checksum,
      },
    })
  }

  if (input.confirmation.checksum !== input.checksum) {
    throw createOrbitError({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
      message: 'Destructive schema migration confirmation checksum does not match the requested migration checksum',
      details: {
        checksum: input.checksum,
        confirmationChecksum: input.confirmation.checksum,
      },
    })
  }

  assertConfirmationFreshness(input.checksum, input.confirmation.confirmedAt, input.now ?? new Date())

  const missingSafeguards = missingProductionSafeguards(
    input.confirmation.safeguards,
    input.runtimeEnvironment,
    input.requireRuntimeEnvironment === true,
  )
  if (missingSafeguards.length > 0) {
    throw createOrbitError({
      code: 'DESTRUCTIVE_SAFEGUARDS_REQUIRED',
      message: 'Production-like destructive schema migrations require safeguard evidence before elevated execution',
      details: {
        destructiveOperations: input.destructiveOperations,
        checksum: input.checksum,
        missingSafeguards,
      },
    })
  }
}

function assertConfirmationFreshness(checksum: string, confirmedAt: string, now: Date): void {
  const confirmedAtMs = new Date(confirmedAt).getTime()
  const staleDetails = {
    checksum,
    confirmedAt,
    now: now.toISOString(),
    expiresAt: Number.isNaN(confirmedAtMs)
      ? null
      : new Date(confirmedAtMs + DESTRUCTIVE_CONFIRMATION_TTL_MS).toISOString(),
  }

  if (Number.isNaN(confirmedAtMs)) {
    throw createOrbitError({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
      message: 'Destructive schema migration confirmation timestamp is not a valid datetime',
      details: staleDetails,
    })
  }

  const nowMs = now.getTime()
  if (confirmedAtMs - nowMs > DESTRUCTIVE_CONFIRMATION_FUTURE_SKEW_MS) {
    throw createOrbitError({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
      message: 'Destructive schema migration confirmation timestamp is in the future beyond tolerated clock skew',
      details: staleDetails,
    })
  }

  if (nowMs - confirmedAtMs > DESTRUCTIVE_CONFIRMATION_TTL_MS) {
    throw createOrbitError({
      code: 'DESTRUCTIVE_CONFIRMATION_STALE',
      message: 'Destructive schema migration confirmation has expired; request a fresh preview confirmation',
      details: staleDetails,
    })
  }
}

function missingProductionSafeguards(
  safeguards: DestructiveSafeguards | undefined,
  runtimeEnvironment: DestructiveMigrationEnvironment | undefined,
  requireRuntimeEnvironment: boolean,
): string[] {
  if (!runtimeEnvironment && requireRuntimeEnvironment) {
    return ['runtimeEnvironment']
  }
  if (!runtimeEnvironment || !PRODUCTION_LIKE_ENVIRONMENTS.has(runtimeEnvironment)) {
    return []
  }

  const missing: string[] = []
  if (safeguards?.environmentAcknowledged !== true) missing.push('environmentAcknowledged')
  if (!safeguards?.backup) missing.push('backup')
  if (!safeguards?.ledger) missing.push('ledger')
  if (!safeguards?.rollback) missing.push('rollback')
  return missing
}
