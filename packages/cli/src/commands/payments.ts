import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'
import type { CreatePaymentInput, UpdatePaymentInput } from '@orbit-ai/sdk'

export function registerPaymentsCommand(program: Command): void {
  const payments = program.command('payments').description('Manage payments')

  payments
    .command('list')
    .description('List payments')
    .option('--limit <n>', 'Max records', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })
      const query = {
        limit: Number(opts.limit),
        ...(opts.cursor ? { cursor: opts.cursor } : {}),
      }

      if (isJsonMode()) {
        const result = await client.payments.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.payments.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  payments
    .command('get <id>')
    .description('Get a payment by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.payments.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.payments.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  payments
    .command('create')
    .description('Record a new payment')
    .requiredOption('--amount <amount>', 'Payment amount (number)')
    .requiredOption('--currency <currency>', 'Currency code (e.g. USD, EUR)')
    .option('--status <status>', 'Payment status')
    .option('--deal-id <id>', 'Deal ID')
    .option('--contact-id <id>', 'Contact ID')
    .option('--payment-method <method>', 'Payment method')
    .option('--paid-at <date>', 'Paid at (ISO date)')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreatePaymentInput = {
        amount: Number(opts.amount),
        currency: opts.currency,
      }
      if (opts.status) input.status = opts.status
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.paymentMethod) input.payment_method = opts.paymentMethod
      if (opts.paidAt) input.paid_at = opts.paidAt

      if (isJsonMode()) {
        const result = await client.payments.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.payments.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  payments
    .command('update <id>')
    .description('Update a payment')
    .option('--amount <amount>', 'Payment amount (number)')
    .option('--currency <currency>', 'Currency code')
    .option('--status <status>', 'Payment status')
    .option('--deal-id <id>', 'Deal ID')
    .option('--contact-id <id>', 'Contact ID')
    .option('--payment-method <method>', 'Payment method')
    .option('--paid-at <date>', 'Paid at (ISO date)')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdatePaymentInput = {}
      if (opts.amount !== undefined) input.amount = Number(opts.amount)
      if (opts.currency) input.currency = opts.currency
      if (opts.status) input.status = opts.status
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.paymentMethod) input.payment_method = opts.paymentMethod
      if (opts.paidAt) input.paid_at = opts.paidAt

      if (isJsonMode()) {
        const result = await client.payments.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.payments.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  payments
    .command('delete <id>')
    .description('Delete a payment')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.payments.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.payments.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
