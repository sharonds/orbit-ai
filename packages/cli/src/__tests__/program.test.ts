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
    expect(program.options.some((o) => o.long === '--json')).toBe(true)
  })

  it('--format default is table', () => {
    const program = createProgram()
    const formatOption = program.options.find((o) => o.long === '--format')
    expect(formatOption).toBeDefined()
    expect(formatOption?.defaultValue).toBe('table')
  })

  it('registers --format flag', () => {
    const program = createProgram()
    expect(program.options.some((o) => o.long === '--format')).toBe(true)
  })

  it('--format json sets format to json', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--format', 'json', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().format).toBe('json')
  })

  it('--format csv sets format to csv', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--format', 'csv', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().format).toBe('csv')
  })

  it('--format tsv sets format to tsv', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--format', 'tsv', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().format).toBe('tsv')
  })

  it('recognizes --quiet flag', () => {
    const program = createProgram()
    expect(program.options.some((o) => o.long === '--quiet')).toBe(true)
  })

  it('--quiet flag is parsed correctly', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--quiet', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().quiet).toBe(true)
  })

  it('recognizes --yes flag', () => {
    const program = createProgram()
    expect(program.options.some((o) => o.long === '--yes')).toBe(true)
  })

  it('--yes flag is parsed correctly', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--yes', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().yes).toBe(true)
  })

  it('recognizes --mode flag', () => {
    const program = createProgram()
    expect(program.options.some((o) => o.long === '--mode')).toBe(true)
  })

  it('--mode api is recognized', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--mode', 'api', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().mode).toBe('api')
  })

  it('--mode direct is recognized', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--mode', 'direct', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().mode).toBe('direct')
  })

  it('--mode default is api', () => {
    const program = createProgram()
    const modeOption = program.options.find((o) => o.long === '--mode')
    expect(modeOption?.defaultValue).toBe('api')
  })

  it('recognizes --api-key flag', () => {
    const program = createProgram()
    expect(program.options.some((o) => o.long === '--api-key')).toBe(true)
  })

  it('--api-key flag is parsed correctly', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--api-key', 'test-key-123', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().apiKey).toBe('test-key-123')
  })

  it('recognizes --base-url flag', () => {
    const program = createProgram()
    expect(program.options.some((o) => o.long === '--base-url')).toBe(true)
  })

  it('--base-url flag is parsed correctly', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--base-url', 'http://localhost:3000', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().baseUrl).toBe('http://localhost:3000')
  })

  it('recognizes --org-id flag', () => {
    const program = createProgram()
    expect(program.options.some((o) => o.long === '--org-id')).toBe(true)
  })

  it('--org-id flag is parsed correctly', () => {
    const program = createProgram()
    program.exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    try { program.parse(['node', 'orbit', '--org-id', 'org_abc123', '--help'], { from: 'user' }) } catch { /* --help throws */ }
    expect(program.opts().orgId).toBe('org_abc123')
  })

  it('--help flag outputs program description', () => {
    const program = createProgram()
    program.exitOverride()
    let helpText = ''
    program.configureOutput({
      writeOut: (str) => { helpText += str },
      writeErr: () => {},
    })
    try {
      program.parse(['node', 'orbit', '--help'], { from: 'user' })
    } catch {
      // exitOverride throws on --help
    }
    expect(helpText).toContain('orbit')
  })
})
