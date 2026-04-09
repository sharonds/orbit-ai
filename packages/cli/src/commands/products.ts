import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import type { GlobalFlags } from '../types.js'
import type { CreateProductInput, UpdateProductInput } from '@orbit-ai/sdk'

export function registerProductsCommand(program: Command): void {
  const products = program.command('products').description('Manage products')

  products
    .command('list')
    .description('List products')
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
        const result = await client.products.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.products.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  products
    .command('get <id>')
    .description('Get a product by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.products.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.products.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  products
    .command('create')
    .description('Create a new product')
    .requiredOption('--name <name>', 'Product name')
    .option('--description <description>', 'Product description')
    .option('--price <price>', 'Price (number)')
    .option('--currency <currency>', 'Currency code (e.g. USD, EUR)')
    .option('--sku <sku>', 'Product SKU')
    .option('--status <status>', 'Product status')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateProductInput = { name: opts.name }
      if (opts.description) input.description = opts.description
      if (opts.price !== undefined) input.price = Number(opts.price)
      if (opts.currency) input.currency = opts.currency
      if (opts.sku) input.sku = opts.sku
      if (opts.status) input.status = opts.status

      if (flags.json) {
        const result = await client.products.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.products.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  products
    .command('update <id>')
    .description('Update a product')
    .option('--name <name>', 'Product name')
    .option('--description <description>', 'Product description')
    .option('--price <price>', 'Price (number)')
    .option('--currency <currency>', 'Currency code')
    .option('--sku <sku>', 'Product SKU')
    .option('--status <status>', 'Product status')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateProductInput = {}
      if (opts.name) input.name = opts.name
      if (opts.description) input.description = opts.description
      if (opts.price !== undefined) input.price = Number(opts.price)
      if (opts.currency) input.currency = opts.currency
      if (opts.sku) input.sku = opts.sku
      if (opts.status) input.status = opts.status

      if (flags.json) {
        const result = await client.products.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.products.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  products
    .command('delete <id>')
    .description('Delete a product')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (flags.json) {
        const result = await client.products.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.products.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
