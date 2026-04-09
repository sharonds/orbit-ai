import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'
import type { CreateWebhookInput, UpdateWebhookInput } from '@orbit-ai/sdk'

export function registerWebhooksCommand(program: Command): void {
  const webhooks = program.command('webhooks').description('Manage webhooks')

  webhooks
    .command('list')
    .description('List webhooks')
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
        const result = await client.webhooks.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.webhooks.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  webhooks
    .command('get <id>')
    .description('Get a webhook by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.webhooks.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.webhooks.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  webhooks
    .command('create')
    .description('Create a new webhook')
    .requiredOption('--url <url>', 'Webhook endpoint URL')
    .requiredOption('--events <events>', 'Comma-separated list of events to subscribe to')
    .option('--status <status>', 'Webhook status')
    .option('--description <description>', 'Webhook description')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateWebhookInput = {
        url: opts.url,
        events: opts.events.split(',').map((e: string) => e.trim()),
      }
      if (opts.status) input.status = opts.status
      if (opts.description) input.description = opts.description

      if (flags.json) {
        const result = await client.webhooks.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.webhooks.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  webhooks
    .command('update <id>')
    .description('Update a webhook')
    .option('--url <url>', 'Webhook endpoint URL')
    .option('--events <events>', 'Comma-separated list of events')
    .option('--status <status>', 'Webhook status')
    .option('--description <description>', 'Webhook description')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateWebhookInput = {}
      if (opts.url) input.url = opts.url
      if (opts.events) input.events = opts.events.split(',').map((e: string) => e.trim())
      if (opts.status) input.status = opts.status
      if (opts.description) input.description = opts.description

      if (flags.json) {
        const result = await client.webhooks.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.webhooks.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  webhooks
    .command('delete <id>')
    .description('Delete a webhook')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.webhooks.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.webhooks.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
