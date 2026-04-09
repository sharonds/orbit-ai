import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'
import type { CreateUserInput, UpdateUserInput } from '@orbit-ai/sdk'

export function registerUsersCommand(program: Command): void {
  const users = program.command('users').description('Manage users')

  users
    .command('list')
    .description('List users')
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
        const result = await client.users.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.users.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  users
    .command('get <id>')
    .description('Get a user by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.users.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.users.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  users
    .command('create')
    .description('Create a new user')
    .requiredOption('--name <name>', 'User name')
    .requiredOption('--email <email>', 'User email')
    .option('--role <role>', 'User role')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateUserInput = { name: opts.name, email: opts.email }
      if (opts.role) input.role = opts.role

      if (isJsonMode()) {
        const result = await client.users.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.users.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  users
    .command('update <id>')
    .description('Update a user')
    .option('--name <name>', 'User name')
    .option('--email <email>', 'User email')
    .option('--role <role>', 'User role')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateUserInput = {}
      if (opts.name) input.name = opts.name
      if (opts.email) input.email = opts.email
      if (opts.role) input.role = opts.role

      if (isJsonMode()) {
        const result = await client.users.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.users.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  users
    .command('delete <id>')
    .description('Delete a user')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.users.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.users.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
