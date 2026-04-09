import { describe, it, expect } from 'vitest'
import { createProgram, isJsonMode } from '../program.js'

describe('program', () => {
  const expectedCommands = [
    'init', 'status', 'doctor', 'seed', 'migrate',
    'contacts', 'companies', 'deals', 'context', 'search', 'users',
    'log', 'tasks', 'notes', 'sequences', 'fields', 'schema', 'report',
    'dashboard', 'mcp', 'integrations',
  ]

  it('registers all expected commands', () => {
    const program = createProgram()
    const names = program.commands.map((c) => c.name())
    for (const cmd of expectedCommands) {
      expect(names).toContain(cmd)
    }
  })

  it('registers --json flag', () => {
    const program = createProgram()
    const opts = program.opts()
    // Options are defined on the program
    expect(program.options.some((o) => o.long === '--json')).toBe(true)
  })
})
