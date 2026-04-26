import { z } from 'zod'

import { createOrbitError } from '../types/errors.js'

const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/
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

const destructiveRollbackDecisionSchema = z.discriminatedUnion('decision', [
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

  const missingSafeguards = missingProductionSafeguards(input.confirmation.safeguards, input.runtimeEnvironment)
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

function missingProductionSafeguards(
  safeguards: DestructiveSafeguards | undefined,
  runtimeEnvironment: DestructiveMigrationEnvironment | undefined,
): string[] {
  const environment = runtimeEnvironment ?? safeguards?.environment
  if (!environment || !PRODUCTION_LIKE_ENVIRONMENTS.has(environment)) {
    return []
  }

  const missing: string[] = []
  if (safeguards?.environmentAcknowledged !== true) missing.push('environmentAcknowledged')
  if (!safeguards?.backup) missing.push('backup')
  if (!safeguards?.ledger) missing.push('ledger')
  if (!safeguards?.rollback) missing.push('rollback')
  return missing
}
