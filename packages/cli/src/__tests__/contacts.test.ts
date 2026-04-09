import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgram } from '../program.js'

// --- mock setup ---
const mockContactsResponse = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  context: vi.fn(),
}

const mockContacts = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  context: vi.fn(),
  response: () => mockContactsResponse,
}

const mockClient = {
  contacts: mockContacts,
}

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn(() => mockClient),
}))

// Suppress config-loading errors by providing ORBIT_API_KEY
beforeEach(() => {
  process.env.ORBIT_API_KEY = 'test-key'
  vi.clearAllMocks()
})

function captureOutput(fn: () => Promise<void>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let output = ''
    const orig = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }
    fn()
      .then(() => {
        process.stdout.write = orig
        resolve(output)
      })
      .catch((err) => {
        process.stdout.write = orig
        reject(err)
      })
  })
}

describe('contacts list', () => {
  it('list --json passes envelope through', async () => {
    const envelope = {
      data: [{ id: 'cnt_1', object: 'contact', name: 'Alice' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockContactsResponse.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'contacts', 'list'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data[0].id).toBe('cnt_1')
    expect(parsed.meta.request_id).toBe('r1')
    expect(mockContactsResponse.list).toHaveBeenCalledWith({ limit: 20 })
  })

  it('list table mode renders without [object Object]', async () => {
    const envelope = {
      data: [{ id: 'cnt_1', object: 'contact', name: 'Alice', email: 'alice@example.com' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockContacts.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', 'contacts', 'list'])
    process.stdout.write = origWrite

    expect(output).not.toContain('[object Object]')
    expect(output).toContain('cnt_1')
  })
})

describe('contacts get', () => {
  it('get --json returns single-record envelope', async () => {
    const envelope = { data: { id: 'cnt_123', object: 'contact', name: 'Alice' }, meta: { request_id: 'r2' } }
    mockContactsResponse.get.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'contacts', 'get', 'cnt_123'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('cnt_123')
    expect(mockContactsResponse.get).toHaveBeenCalledWith('cnt_123')
  })
})

describe('contacts create', () => {
  it('create --json returns created record envelope', async () => {
    const envelope = { data: { id: 'cnt_new', object: 'contact', name: 'Bob' }, meta: { request_id: 'r3' } }
    mockContactsResponse.create.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'contacts', 'create', '--name', 'Bob'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('cnt_new')
    expect(mockContactsResponse.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bob' }))
  })
})

describe('contacts update', () => {
  it('update --json returns updated record envelope', async () => {
    const envelope = { data: { id: 'cnt_123', object: 'contact', name: 'Alice Updated' }, meta: { request_id: 'r4' } }
    mockContactsResponse.update.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'contacts', 'update', 'cnt_123', '--name', 'Alice Updated'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('cnt_123')
    expect(mockContactsResponse.update).toHaveBeenCalledWith('cnt_123', expect.objectContaining({ name: 'Alice Updated' }))
  })
})

describe('contacts delete', () => {
  it('delete --json returns deletion envelope', async () => {
    const envelope = { data: { id: 'cnt_123', deleted: true }, meta: { request_id: 'r5' } }
    mockContactsResponse.delete.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'contacts', 'delete', 'cnt_123'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('cnt_123')
    expect(parsed.data.deleted).toBe(true)
    expect(mockContactsResponse.delete).toHaveBeenCalledWith('cnt_123')
  })
})

describe('contacts non-TTY validation', () => {
  it('create without --name in non-TTY mode throws CliValidationError via Commander requiredOption', async () => {
    const origIsTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true })

    const program = createProgram()
    program.exitOverride()

    await expect(
      program.parseAsync(['node', 'orbit', '--json', 'contacts', 'create'])
    ).rejects.toThrow()

    Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, writable: true, configurable: true })
  })
})
