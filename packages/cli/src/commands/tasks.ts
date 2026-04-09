import { Command } from 'commander'
import { resolveClient } from '../config/resolve-context.js'
import { formatOutput } from '../output/formatter.js'
import { isJsonMode } from '../program.js'
import type { GlobalFlags } from '../types.js'
import type { CreateTaskInput, UpdateTaskInput } from '@orbit-ai/sdk'

export function registerTasksCommand(program: Command): void {
  const tasks = program.command('tasks').description('Manage tasks')

  tasks
    .command('list')
    .description('List tasks')
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
        const result = await client.tasks.response().list(query)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.tasks.list(query)
        process.stdout.write(formatOutput(result, { format: flags.format ?? 'table' }))
      }
    })

  tasks
    .command('get <id>')
    .description('Get a task by ID')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.tasks.response().get(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.tasks.get(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  tasks
    .command('create')
    .description('Create a new task')
    .requiredOption('--title <title>', 'Task title')
    .option('--description <description>', 'Task description')
    .option('--status <status>', 'Task status')
    .option('--priority <priority>', 'Task priority')
    .option('--due-date <date>', 'Due date (ISO date)')
    .option('--contact-id <id>', 'Contact ID')
    .option('--deal-id <id>', 'Deal ID')
    .option('--assigned-to <userId>', 'Assigned to user ID')
    .action(async (opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: CreateTaskInput = { title: opts.title }
      if (opts.description) input.description = opts.description
      if (opts.status) input.status = opts.status
      if (opts.priority) input.priority = opts.priority
      if (opts.dueDate) input.due_date = opts.dueDate
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.assignedTo) input.assigned_to_user_id = opts.assignedTo

      if (isJsonMode()) {
        const result = await client.tasks.response().create(input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.tasks.create(input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  tasks
    .command('update <id>')
    .description('Update a task')
    .option('--title <title>', 'Task title')
    .option('--description <description>', 'Task description')
    .option('--status <status>', 'Task status')
    .option('--priority <priority>', 'Task priority')
    .option('--due-date <date>', 'Due date (ISO date)')
    .option('--contact-id <id>', 'Contact ID')
    .option('--deal-id <id>', 'Deal ID')
    .option('--assigned-to <userId>', 'Assigned to user ID')
    .action(async (id, opts) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      const input: UpdateTaskInput = {}
      if (opts.title) input.title = opts.title
      if (opts.description) input.description = opts.description
      if (opts.status) input.status = opts.status
      if (opts.priority) input.priority = opts.priority
      if (opts.dueDate) input.due_date = opts.dueDate
      if (opts.contactId) input.contact_id = opts.contactId
      if (opts.dealId) input.deal_id = opts.dealId
      if (opts.assignedTo) input.assigned_to_user_id = opts.assignedTo

      if (isJsonMode()) {
        const result = await client.tasks.response().update(id, input)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.tasks.update(id, input)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })

  tasks
    .command('delete <id>')
    .description('Delete a task')
    .action(async (id) => {
      const flags = program.opts() as GlobalFlags
      const client = resolveClient({ flags })

      if (isJsonMode()) {
        const result = await client.tasks.response().delete(id)
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } else {
        const result = await client.tasks.delete(id)
        process.stdout.write(formatOutput({ data: result }, { format: flags.format ?? 'table' }))
      }
    })
}
