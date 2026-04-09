import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgram } from '../program.js'

const mockCompaniesResponse = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockCompanies = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  response: () => mockCompaniesResponse,
}

const mockClient = {
  companies: mockCompanies,
}

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn(() => mockClient),
}))

beforeEach(() => {
  process.env.ORBIT_API_KEY = 'test-key'
  vi.clearAllMocks()
})

describe('companies list', () => {
  it('list --json passes envelope through', async () => {
    const envelope = {
      data: [{ id: 'cmp_1', object: 'company', name: 'Acme' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockCompaniesResponse.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'companies', 'list'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data[0].id).toBe('cmp_1')
    expect(parsed.meta.request_id).toBe('r1')
  })

  it('list table mode renders without [object Object]', async () => {
    const envelope = {
      data: [{ id: 'cmp_1', object: 'company', name: 'Acme', domain: 'acme.com' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockCompanies.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', 'companies', 'list'])
    process.stdout.write = origWrite

    expect(output).not.toContain('[object Object]')
    expect(output).toContain('cmp_1')
  })
})

describe('companies get', () => {
  it('get --json returns single-record envelope', async () => {
    const envelope = { data: { id: 'cmp_1', object: 'company', name: 'Acme' }, meta: { request_id: 'r2' } }
    mockCompaniesResponse.get.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'companies', 'get', 'cmp_1'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('cmp_1')
  })
})

describe('companies create', () => {
  it('create --json returns created record envelope', async () => {
    const envelope = { data: { id: 'cmp_new', object: 'company', name: 'NewCo' }, meta: { request_id: 'r3' } }
    mockCompaniesResponse.create.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'companies', 'create', '--name', 'NewCo'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('cmp_new')
    expect(mockCompaniesResponse.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'NewCo' }))
  })
})

describe('companies update', () => {
  it('update --json returns updated record envelope', async () => {
    const envelope = { data: { id: 'cmp_1', object: 'company', name: 'Acme Updated' }, meta: { request_id: 'r4' } }
    mockCompaniesResponse.update.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'companies', 'update', 'cmp_1', '--name', 'Acme Updated'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('cmp_1')
    expect(mockCompaniesResponse.update).toHaveBeenCalledWith('cmp_1', expect.objectContaining({ name: 'Acme Updated' }))
  })
})

describe('companies delete', () => {
  it('delete --json returns deletion envelope', async () => {
    const envelope = { data: { id: 'cmp_1', deleted: true }, meta: { request_id: 'r5' } }
    mockCompaniesResponse.delete.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'companies', 'delete', 'cmp_1'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.deleted).toBe(true)
  })
})

describe('companies non-TTY validation', () => {
  it('create without --name throws via Commander requiredOption', async () => {
    const program = createProgram()
    program.exitOverride()

    await expect(
      program.parseAsync(['node', 'orbit', '--json', 'companies', 'create'])
    ).rejects.toThrow()
  })
})
