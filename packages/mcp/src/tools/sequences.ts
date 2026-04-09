import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import { defineTool } from './schemas.js'
import { toToolSuccess } from '../errors.js'
import { sanitizeRecordPayload } from './schemas.js'

const EnrollInSequenceInput = z.object({
  sequence_id: z.string(),
  contact_id: z.string(),
  body: z.record(z.string(), z.unknown()).optional(),
})

const UnenrollFromSequenceInput = z.object({
  enrollment_id: z.string(),
  reason: z.string().optional(),
  idempotency_key: z.string().optional(),
})

export const enrollInSequenceTool = defineTool({
  name: 'enroll_in_sequence',
  title: 'Enroll a contact in an Orbit sequence',
  description:
    'Use this when you know the target sequence ID and contact ID and want to start enrollment. Do not use it to create sequence metadata.',
  inputSchema: EnrollInSequenceInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export const unenrollFromSequenceTool = defineTool({
  name: 'unenroll_from_sequence',
  title: 'Unenroll a contact from an Orbit sequence',
  description:
    'Use this when an existing enrollment must be stopped by enrollment ID. Do not use it to delete sequence definitions.',
  inputSchema: UnenrollFromSequenceInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export async function handleEnrollInSequence(client: OrbitClient, rawArgs: unknown) {
  const args = EnrollInSequenceInput.parse(rawArgs)
  return toToolSuccess(
    await client.sequences.enroll(args.sequence_id, {
      contact_id: args.contact_id,
      ...(args.body ? (sanitizeRecordPayload(args.body) as Record<string, unknown>) : {}),
    }),
  )
}

export async function handleUnenrollFromSequence(client: OrbitClient, rawArgs: unknown) {
  const args = UnenrollFromSequenceInput.parse(rawArgs)
  void args.reason
  void args.idempotency_key
  // The current SDK seam accepts only the enrollment ID.
  return toToolSuccess(await client.sequenceEnrollments.unenroll(args.enrollment_id))
}
