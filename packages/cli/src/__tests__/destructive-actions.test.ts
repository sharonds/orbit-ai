import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProgram, run, _resetJsonMode } from '../program.js'

// --- mock schema resource ---
const mockSchemaResponse = {
  deleteField: vi.fn(),
  describeObject: vi.fn(),
  addField: vi.fn(),
  listObjects: vi.fn(),
  updateField: vi.fn(),
  previewMigration: vi.fn(),
  applyMigration: vi.fn(),
  rollbackMigration: vi.fn(),
}

const mockSchema = {
  deleteField: vi.fn(),
  describeObject: vi.fn(),
  addField: vi.fn(),
  listObjects: vi.fn(),
  applyMigration: vi.fn(),
  rollbackMigration: vi.fn(),
  previewMigration: vi.fn(),
  response: () => mockSchemaResponse,
}

const mockClient = {
  schema: mockSchema,
}

const TEST_CHECKSUM = 'a'.repeat(64)
const TEST_DELETE_OPERATION = {
  type: 'custom_field.delete',
  entityType: 'contacts',
  fieldName: 'custom_tier',
}
const TEST_UPDATE_OPERATION = {
  type: 'custom_field.update',
  entityType: 'contacts',
  fieldName: 'custom_tier',
  patch: { fieldType: 'number' },
}
const TEST_ADD_OPERATION = {
  type: 'custom_field.add',
  entityType: 'contacts',
  fieldName: 'custom_tier',
  fieldType: 'text',
}

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn(() => mockClient),
}))

let mockExitCode: number | undefined
let origExit: typeof process.exit

beforeEach(() => {
  process.env.ORBIT_API_KEY = 'test-key'
  vi.clearAllMocks()
  _resetJsonMode()
  // Mock process.exit so tests don't actually exit
  origExit = process.exit
  mockExitCode = undefined
  process.exit = ((code?: number) => {
    mockExitCode = code ?? 0
    throw new Error(`process.exit(${code})`)
  }) as typeof process.exit
  // Ensure non-TTY
  Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true, configurable: true })
})

afterEach(() => {
  process.exit = origExit
  Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true, configurable: true })
})

function captureStdout(fn: () => Promise<unknown>): Promise<{ output: string; exitCode: number | undefined }> {
  return new Promise((resolve) => {
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    // Cast to any to accept optional callback parameter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.stdout as any).write = (chunk: string | Uint8Array, cb?: () => void) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      if (typeof cb === 'function') cb()
      return true
    }
    fn()
      .then(() => {
        process.stdout.write = origWrite
        resolve({ output, exitCode: mockExitCode })
      })
      .catch(() => {
        process.stdout.write = origWrite
        resolve({ output, exitCode: mockExitCode })
      })
  })
}

describe('fields delete — destructive action', () => {
  it('without --yes in JSON mode: exit code 1, DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION on stdout', async () => {
    const program = createProgram()

    const { output, exitCode } = await captureStdout(() =>
      program.parseAsync(['node', 'orbit', '--json', 'fields', 'delete', 'contacts', 'custom_tier']),
    )

    expect(exitCode).toBe(1)
    const parsed = JSON.parse(output)
    expect(parsed.error.code).toBe('DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION')
    expect(parsed.error.action).toBe('fields.delete')
    expect(parsed.error.target).toBe('contacts.custom_tier')
    // SDK delete should NOT have been called
    expect(mockSchemaResponse.deleteField).not.toHaveBeenCalled()
  })

  it('with --yes in JSON mode: proceeds and returns deletion envelope', async () => {
    const envelope = { data: { deleted: true, field: 'custom_tier' }, meta: { request_id: 'r1' } }
    mockSchema.previewMigration.mockResolvedValue({
      checksum: TEST_CHECKSUM,
      operations: [TEST_DELETE_OPERATION],
      destructive: true,
    })
    mockSchemaResponse.deleteField.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync([
      'node', 'orbit', '--json', 'fields', 'delete', 'contacts', 'custom_tier', '--yes',
    ])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.deleted).toBe(true)
    expect(mockSchema.previewMigration).toHaveBeenCalledWith({ operations: [TEST_DELETE_OPERATION] })
    expect(mockSchemaResponse.deleteField).toHaveBeenCalledWith('contacts', 'custom_tier', {
      confirmation: {
        destructive: true,
        checksum: TEST_CHECKSUM,
        confirmedAt: expect.any(String),
      },
    })
  })

  it('with global --yes flag: proceeds without confirmation', async () => {
    const envelope = { data: { deleted: true, field: 'custom_tier' }, meta: { request_id: 'r2' } }
    mockSchema.previewMigration.mockResolvedValue({
      checksum: TEST_CHECKSUM,
      operations: [TEST_DELETE_OPERATION],
      destructive: true,
    })
    mockSchemaResponse.deleteField.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync([
      'node', 'orbit', '--json', '--yes', 'fields', 'delete', 'contacts', 'custom_tier',
    ])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.deleted).toBe(true)
    expect(mockSchemaResponse.deleteField).toHaveBeenCalledWith('contacts', 'custom_tier', {
      confirmation: {
        destructive: true,
        checksum: TEST_CHECKSUM,
        confirmedAt: expect.any(String),
      },
    })
  })
})

describe('fields update — destructive action', () => {
  it('with --yes in JSON mode: passes checksum-bound confirmation for destructive update', async () => {
    const envelope = { data: { fieldName: 'custom_tier', fieldType: 'number' }, meta: { request_id: 'r3' } }
    mockSchema.previewMigration.mockResolvedValue({
      checksum: TEST_CHECKSUM,
      operations: [TEST_UPDATE_OPERATION],
      destructive: true,
    })
    mockSchemaResponse.updateField.mockResolvedValue(envelope)

    const { output } = await captureStdout(() =>
      createProgram().parseAsync([
        'node', 'orbit', '--json', 'fields', 'update', 'contacts', 'custom_tier', '--type', 'number', '--yes',
      ]),
    )

    expect(JSON.parse(output).data.fieldType).toBe('number')
    expect(mockSchema.previewMigration).toHaveBeenCalledWith({ operations: [TEST_UPDATE_OPERATION] })
    expect(mockSchemaResponse.updateField).toHaveBeenCalledWith('contacts', 'custom_tier', {
      fieldType: 'number',
      confirmation: {
        destructive: true,
        checksum: TEST_CHECKSUM,
        confirmedAt: expect.any(String),
      },
    })
  })

  it('without --yes in JSON mode: blocks destructive update with structured preview envelope', async () => {
    mockSchema.previewMigration.mockResolvedValue({
      checksum: TEST_CHECKSUM,
      operations: [TEST_UPDATE_OPERATION],
      destructive: true,
    })

    const { output, exitCode } = await captureStdout(() =>
      createProgram().parseAsync([
        'node', 'orbit', '--json', 'fields', 'update', 'contacts', 'custom_tier', '--type', 'number',
      ]),
    )

    expect(exitCode).toBe(1)
    const parsed = JSON.parse(output)
    expect(parsed.error.code).toBe('DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION')
    expect(parsed.error.action).toBe('fields.update')
    expect(parsed.error.preview.checksum).toBe(TEST_CHECKSUM)
    expect(mockSchemaResponse.updateField).not.toHaveBeenCalled()
  })

  it('without --yes: applies non-destructive updates without confirmation', async () => {
    const envelope = { data: { fieldName: 'custom_tier', label: 'Custom tier' }, meta: { request_id: 'r4' } }
    mockSchema.previewMigration.mockResolvedValue({
      checksum: TEST_CHECKSUM,
      operations: [{
        type: 'custom_field.update',
        entityType: 'contacts',
        fieldName: 'custom_tier',
        patch: { label: 'Custom tier' },
      }],
      destructive: false,
    })
    mockSchemaResponse.updateField.mockResolvedValue(envelope)

    const { output } = await captureStdout(() =>
      createProgram().parseAsync([
        'node', 'orbit', '--json', 'fields', 'update', 'contacts', 'custom_tier', '--label', 'Custom tier',
      ]),
    )

    expect(JSON.parse(output).data.label).toBe('Custom tier')
    expect(mockSchemaResponse.updateField).toHaveBeenCalledWith('contacts', 'custom_tier', {
      label: 'Custom tier',
    })
  })
})

describe('migrate --preview / --apply — checksum-bound plans', () => {
  it('migrate --preview sends operations and prints the plan checksum', async () => {
    mockSchema.previewMigration.mockResolvedValue({
      operations: [TEST_ADD_OPERATION],
      checksum: TEST_CHECKSUM,
      destructive: false,
    })

    const operations = JSON.stringify([TEST_ADD_OPERATION])
    const { output } = await captureStdout(async () => {
      await createProgram()
        .exitOverride()
        .parseAsync([
          'node', 'orbit', '--json', '--api-key', 'key', '--mode', 'api',
          'migrate', '--preview', '--operations', operations,
        ])
    })

    expect(mockSchema.previewMigration).toHaveBeenCalledWith({ operations: [TEST_ADD_OPERATION] })
    expect(JSON.parse(output).checksum).toBe(TEST_CHECKSUM)
  })

  it('migrate --apply applies non-destructive migration without --yes', async () => {
    mockSchema.previewMigration.mockResolvedValue({
      operations: [TEST_ADD_OPERATION],
      checksum: TEST_CHECKSUM,
      destructive: false,
    })
    mockSchema.applyMigration.mockResolvedValue({ applied: 1 })
    const operations = JSON.stringify([TEST_ADD_OPERATION])

    const { output } = await captureStdout(async () => {
      await createProgram()
        .exitOverride()
        .parseAsync(
          [
            'node', 'orbit', '--json', '--api-key', 'key', '--mode', 'api',
            'migrate', '--apply', '--operations', operations,
          ],
        )
    })

    expect(mockSchema.applyMigration).toHaveBeenCalledWith({
      operations: [TEST_ADD_OPERATION],
      checksum: TEST_CHECKSUM,
    })
    const parsed = JSON.parse(output)
    expect(parsed).toHaveProperty('applied', 1)
  })

  it('migrate --apply requires --yes for destructive migration (preview has destructive:true)', async () => {
    const destructiveOperation = { type: 'column.drop', tableName: 'contacts', columnName: 'old_field' }
    mockSchema.previewMigration.mockResolvedValue({
      operations: [destructiveOperation],
      checksum: TEST_CHECKSUM,
      destructive: true,
    })
    const operations = JSON.stringify([destructiveOperation])

    const { exitCode, output } = await captureStdout(async () => {
      await createProgram()
        .exitOverride()
        .parseAsync(
          [
            'node', 'orbit', '--json', '--api-key', 'key', '--mode', 'api',
            'migrate', '--apply', '--operations', operations,
          ],
        )
    })

    expect(exitCode).toBe(1)
    const parsed = JSON.parse(output)
    expect(parsed.error.code).toBe('DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION')
    expect(mockSchema.applyMigration).not.toHaveBeenCalled()
  })

  it('migrate --apply --yes passes checksum-bound confirmation from preview', async () => {
    const destructiveOperation = { type: 'column.drop', tableName: 'contacts', columnName: 'old_field' }
    mockSchema.previewMigration.mockResolvedValue({
      operations: [destructiveOperation],
      checksum: TEST_CHECKSUM,
      destructive: true,
    })
    mockSchema.applyMigration.mockResolvedValue({ migrationId: 'mig_123', checksum: TEST_CHECKSUM })
    const operations = JSON.stringify([destructiveOperation])

    await captureStdout(async () => {
      await createProgram()
        .exitOverride()
        .parseAsync([
          'node', 'orbit', '--json', '--api-key', 'key', '--mode', 'api',
          'migrate', '--apply', '--operations', operations, '--yes',
        ])
    })

    expect(mockSchema.applyMigration).toHaveBeenCalledWith({
      operations: [destructiveOperation],
      checksum: TEST_CHECKSUM,
      confirmation: {
        destructive: true,
        checksum: TEST_CHECKSUM,
        confirmedAt: expect.any(String),
      },
    })
  })
})

describe('migrate with no action flag', () => {
  it('emits MISSING_REQUIRED_ARG error in JSON mode', async () => {
    let origArgv = [...process.argv]
    let stdoutOutput = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutOutput += String(chunk)
      return true
    })
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    process.argv = ['node', 'orbit', '--json', '--api-key', 'key', 'migrate']
    try {
      await run()
    } catch {
      // run() calls process.exit which throws in beforeEach mock
    }
    process.argv = origArgv
    const parsed = JSON.parse(stdoutOutput)
    expect(parsed.error.code).toBe('MISSING_REQUIRED_ARG')
    expect(mockExitCode).toBe(2)
  })
})

describe('migrate --rollback — destructive action', () => {
  it('without --yes in JSON mode: exit code 1, DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION on stdout', async () => {
    const program = createProgram()

    const { output, exitCode } = await captureStdout(() =>
      program.parseAsync([
        'node', 'orbit', '--json', 'migrate', '--rollback', '--id', 'mig_123',
      ]),
    )

    expect(exitCode).toBe(1)
    const parsed = JSON.parse(output)
    expect(parsed.error.code).toBe('DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION')
    expect(mockSchema.rollbackMigration).not.toHaveBeenCalled()
  })

  it('with --yes and --checksum: proceeds with checksum-bound rollback confirmation', async () => {
    const migResult = { id: 'mig_123', rolled_back: true }
    mockSchema.rollbackMigration.mockResolvedValue(migResult)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync([
      'node', 'orbit', '--json', 'migrate', '--rollback', '--id', 'mig_123', '--checksum', TEST_CHECKSUM, '--yes',
    ])
    process.stdout.write = origWrite

    expect(mockSchema.rollbackMigration).toHaveBeenCalledWith('mig_123', {
      checksum: TEST_CHECKSUM,
      confirmation: {
        destructive: true,
        checksum: TEST_CHECKSUM,
        confirmedAt: expect.any(String),
      },
    })
    const parsed = JSON.parse(output)
    expect(parsed).toBeTruthy()
  })
})
