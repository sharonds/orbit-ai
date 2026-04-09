import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProgram, _resetJsonMode } from '../program.js'

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
    expect(mockSchemaResponse.deleteField).toHaveBeenCalledWith('contacts', 'custom_tier')
  })

  it('with global --yes flag: proceeds without confirmation', async () => {
    const envelope = { data: { deleted: true, field: 'custom_tier' }, meta: { request_id: 'r2' } }
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
    expect(mockSchemaResponse.deleteField).toHaveBeenCalledWith('contacts', 'custom_tier')
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

  it('with --yes: proceeds and calls rollbackMigration', async () => {
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
      'node', 'orbit', '--json', 'migrate', '--rollback', '--id', 'mig_123', '--yes',
    ])
    process.stdout.write = origWrite

    expect(mockSchema.rollbackMigration).toHaveBeenCalledWith('mig_123')
    const parsed = JSON.parse(output)
    expect(parsed).toBeTruthy()
  })
})
