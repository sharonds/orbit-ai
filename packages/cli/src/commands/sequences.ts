import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { CliValidationError } from '../errors.js'
import type { GlobalFlags } from '../types.js'
import type { CreateSequenceInput, UpdateSequenceInput } from '@orbit-ai/sdk'

export function registerSequencesCommand(program: Command): void {
  const sequences = program.command('sequences').description('Manage and enroll contacts in sequences')

  sequences
    .command('list')
    .description('List sequences')
    .option('--limit <n>', 'Max records', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })
      const query = {
        limit: Number(opts.limit),
        ...(opts.cursor ? { cursor: opts.cursor } : {}),
      }

      if (flags.json) {
        const result = await client.sequences.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.sequences.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  sequences
    .command('get <id>')
    .description('Get a sequence by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.sequences.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.sequences.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  sequences
    .command('create')
    .description('Create a new sequence')
    .requiredOption('--name <name>', 'Sequence name')
    .option('--description <description>', 'Sequence description')
    .option('--status <status>', 'Sequence status')
    .option('--trigger-type <type>', 'Trigger type')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateSequenceInput = { name: opts.name }
      if (opts.description) input.description = opts.description
      if (opts.status) input.status = opts.status
      if (opts.triggerType) input.trigger_type = opts.triggerType

      if (flags.json) {
        const result = await client.sequences.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.sequences.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  sequences
    .command('update <id>')
    .description('Update a sequence')
    .option('--name <name>', 'Sequence name')
    .option('--description <description>', 'Sequence description')
    .option('--status <status>', 'Sequence status')
    .option('--trigger-type <type>', 'Trigger type')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateSequenceInput = {}
      if (opts.name) input.name = opts.name
      if (opts.description) input.description = opts.description
      if (opts.status) input.status = opts.status
      if (opts.triggerType) input.trigger_type = opts.triggerType

      if (flags.json) {
        const result = await client.sequences.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.sequences.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  sequences
    .command('delete <id>')
    .description('Delete a sequence')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.sequences.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.sequences.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  sequences
    .command('enroll <seq-id>')
    .description('Enroll a contact in a sequence')
    .requiredOption('--contact <contact-id>', 'Contact ID to enroll')
    .option('--enrolled-at <date>', 'Enrollment date (ISO date)')
    .action(async (seqId, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const body: Record<string, unknown> = { contact_id: opts.contact }
      if (opts.enrolledAt) body.enrolled_at = opts.enrolledAt

      // Uses client.sequences.enroll() — NOT client.sequenceEnrollments.create()
      const result = await client.sequences.enroll(seqId, body)

      if (flags.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  sequences
    .command('unenroll <enrollment-id>')
    .description('Unenroll a contact from a sequence by enrollment ID')
    .action(async (enrollmentId) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (!enrollmentId) {
        throw new CliValidationError('Enrollment ID is required', {
          code: 'MISSING_REQUIRED_ARG',
          path: 'enrollment-id',
        })
      }

      // Uses client.sequenceEnrollments.unenroll() — NOT client.sequenceEnrollments.delete()
      const result = await client.sequenceEnrollments.unenroll(enrollmentId)

      if (flags.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
