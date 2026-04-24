import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProgram, isJsonMode, run, _resetJsonMode, _classifyError } from '../program.js'

describe('program', () => {
  const expectedCommands = [
    'init', 'status', 'doctor', 'seed', 'migrate',
    'contacts', 'companies', 'deals', 'context', 'search', 'users',
    'log', 'tasks', 'notes', 'sequences', 'fields', 'schema', 'report',
    'dashboard', 'mcp', 'integrations', 'calendar',
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

describe('classifyError — OrbitEncryptionConfigError (Finding #4)', () => {
  it('maps OrbitEncryptionConfigError to exit code 2 with CONFIGURATION_ERROR', () => {
    const err = Object.assign(new Error('ORBIT_CREDENTIAL_KEY is not set'), {
      name: 'OrbitEncryptionConfigError',
      code: 'MISSING_CREDENTIAL_KEY',
    })
    const result = _classifyError(err)
    expect(result.code).toBe(2)
    expect(result.payload.code).toBe('CONFIGURATION_ERROR')
    expect(result.payload.detail).toBe('MISSING_CREDENTIAL_KEY')
  })

  it('maps OrbitEncryptionConfigError with INVALID_CREDENTIAL_KEY to exit code 2', () => {
    const err = Object.assign(new Error('ORBIT_CREDENTIAL_KEY must be 64 hex chars'), {
      name: 'OrbitEncryptionConfigError',
      code: 'INVALID_CREDENTIAL_KEY',
    })
    const result = _classifyError(err)
    expect(result.code).toBe(2)
    expect(result.payload.code).toBe('CONFIGURATION_ERROR')
    expect(result.payload.detail).toBe('INVALID_CREDENTIAL_KEY')
  })
})

describe('Commander parse errors — JSON contract', () => {
  let origArgv: string[]
  let origExit: typeof process.exit
  let exitCode: number | undefined
  let stdoutOutput: string

  beforeEach(() => {
    origArgv = [...process.argv]
    origExit = process.exit
    exitCode = undefined
    stdoutOutput = ''
    _resetJsonMode()
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error(`process.exit(${code})`)
    }) as typeof process.exit
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutOutput += String(chunk)
      return true
    })
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    process.argv = origArgv
    process.exit = origExit
    vi.restoreAllMocks()
    _resetJsonMode()
  })

  it('_jsonMode is reset to false between run() invocations', async () => {
    let savedArgv = [...process.argv]

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    try {
      // First invocation with --json sets _jsonMode = true
      process.argv = ['node', 'orbit', '--json', '--unknown-xyz']
      await expect(run()).rejects.toThrow()
      expect(isJsonMode()).toBe(true)

      // Second invocation without --json should reset _jsonMode to false
      process.argv = ['node', 'orbit', '--unknown-xyz']
      await expect(run()).rejects.toThrow()
      expect(isJsonMode()).toBe(false)
    } finally {
      process.argv = savedArgv
      vi.restoreAllMocks()
      _resetJsonMode()
    }
  })

  it('--json: Commander unknown flag error produces { error: ... } JSON on stdout', async () => {
    process.argv = ['node', 'orbit', '--json', '--unknown-flag-xyz-abc']
    await expect(run()).rejects.toThrow()
    let parsed: unknown
    try { parsed = JSON.parse(stdoutOutput) } catch { parsed = null }
    expect(parsed).not.toBeNull()
    expect((parsed as { error?: unknown }).error).toBeDefined()
    expect(typeof (parsed as { error: { code: string; message: string } }).error.code).toBe('string')
    expect(typeof (parsed as { error: { code: string; message: string } }).error.message).toBe('string')
  })
})
