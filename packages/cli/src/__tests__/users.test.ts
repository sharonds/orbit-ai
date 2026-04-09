import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgram } from '../program.js'

const mockUsersResponse = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockUsers = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  response: () => mockUsersResponse,
}

const mockClient = {
  users: mockUsers,
}

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn(() => mockClient),
}))

beforeEach(() => {
  process.env.ORBIT_API_KEY = 'test-key'
  vi.clearAllMocks()
})

describe('users list', () => {
  it('list --json passes envelope through', async () => {
    const envelope = {
      data: [{ id: 'usr_1', object: 'user', name: 'Alice', email: 'alice@example.com' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockUsersResponse.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'users', 'list'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data[0].id).toBe('usr_1')
    expect(parsed.meta.request_id).toBe('r1')
  })

  it('list table mode renders without [object Object]', async () => {
    const envelope = {
      data: [{ id: 'usr_1', object: 'user', name: 'Alice', email: 'alice@example.com' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockUsers.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', 'users', 'list'])
    process.stdout.write = origWrite

    expect(output).not.toContain('[object Object]')
    expect(output).toContain('usr_1')
  })
})

describe('users get', () => {
  it('get --json returns single-record envelope', async () => {
    const envelope = { data: { id: 'usr_1', object: 'user', name: 'Alice' }, meta: { request_id: 'r2' } }
    mockUsersResponse.get.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'users', 'get', 'usr_1'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('usr_1')
  })
})

describe('users create', () => {
  it('create --json returns created record envelope', async () => {
    const envelope = { data: { id: 'usr_new', object: 'user', name: 'Bob', email: 'bob@example.com' }, meta: { request_id: 'r3' } }
    mockUsersResponse.create.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'users', 'create', '--name', 'Bob', '--email', 'bob@example.com'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('usr_new')
    expect(mockUsersResponse.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bob', email: 'bob@example.com' }))
  })
})

describe('users update', () => {
  it('update --json returns updated record envelope', async () => {
    const envelope = { data: { id: 'usr_1', object: 'user', name: 'Alice Updated' }, meta: { request_id: 'r4' } }
    mockUsersResponse.update.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'users', 'update', 'usr_1', '--name', 'Alice Updated'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('usr_1')
    expect(mockUsersResponse.update).toHaveBeenCalledWith('usr_1', expect.objectContaining({ name: 'Alice Updated' }))
  })
})

describe('users delete', () => {
  it('delete --json returns deletion envelope', async () => {
    const envelope = { data: { id: 'usr_1', deleted: true }, meta: { request_id: 'r5' } }
    mockUsersResponse.delete.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'users', 'delete', 'usr_1'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.deleted).toBe(true)
  })
})

describe('users non-TTY validation', () => {
  it('create without --name and --email throws via Commander requiredOption', async () => {
    const program = createProgram()
    program.exitOverride()

    await expect(
      program.parseAsync(['node', 'orbit', '--json', 'users', 'create'])
    ).rejects.toThrow()
  })
})
