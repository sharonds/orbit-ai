import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgram } from '../program.js'

const mockDealsResponse = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  move: vi.fn(),
}

const mockDeals = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  move: vi.fn(),
  response: () => mockDealsResponse,
}

const mockClient = {
  deals: mockDeals,
}

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn(() => mockClient),
}))

beforeEach(() => {
  process.env.ORBIT_API_KEY = 'test-key'
  vi.clearAllMocks()
})

describe('deals list', () => {
  it('list --json passes envelope through', async () => {
    const envelope = {
      data: [{ id: 'deal_1', object: 'deal', name: 'Big Deal' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockDealsResponse.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'deals', 'list'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data[0].id).toBe('deal_1')
    expect(parsed.meta.request_id).toBe('r1')
  })

  it('list table mode renders without [object Object]', async () => {
    const envelope = {
      data: [{ id: 'deal_1', object: 'deal', name: 'Big Deal', status: 'open' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockDeals.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', 'deals', 'list'])
    process.stdout.write = origWrite

    expect(output).not.toContain('[object Object]')
    expect(output).toContain('deal_1')
  })
})

describe('deals get', () => {
  it('get --json returns single-record envelope', async () => {
    const envelope = { data: { id: 'deal_1', object: 'deal', name: 'Big Deal' }, meta: { request_id: 'r2' } }
    mockDealsResponse.get.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'deals', 'get', 'deal_1'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('deal_1')
  })
})

describe('deals create', () => {
  it('create --json returns created record envelope', async () => {
    const envelope = { data: { id: 'deal_new', object: 'deal', name: 'New Deal' }, meta: { request_id: 'r3' } }
    mockDealsResponse.create.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'deals', 'create', '--name', 'New Deal'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('deal_new')
    expect(mockDealsResponse.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Deal' }))
  })
})

describe('deals update', () => {
  it('update --json returns updated record envelope', async () => {
    const envelope = { data: { id: 'deal_1', object: 'deal', name: 'Updated Deal' }, meta: { request_id: 'r4' } }
    mockDealsResponse.update.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'deals', 'update', 'deal_1', '--name', 'Updated Deal'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('deal_1')
    expect(mockDealsResponse.update).toHaveBeenCalledWith('deal_1', expect.objectContaining({ name: 'Updated Deal' }))
  })
})

describe('deals delete', () => {
  it('delete --json returns deletion envelope', async () => {
    const envelope = { data: { id: 'deal_1', deleted: true }, meta: { request_id: 'r5' } }
    mockDealsResponse.delete.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'deals', 'delete', 'deal_1'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.deleted).toBe(true)
  })
})

describe('deals move', () => {
  it('move --json calls deals.response().move with stage_id', async () => {
    const envelope = { data: { id: 'deal_1', object: 'deal', stage_id: 'stg_2' }, meta: { request_id: 'r6' } }
    mockDealsResponse.move.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'deals', 'move', 'deal_1', '--stage-id', 'stg_2'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.stage_id).toBe('stg_2')
    expect(mockDealsResponse.move).toHaveBeenCalledWith('deal_1', { stage_id: 'stg_2' })
  })
})

describe('deals non-TTY validation', () => {
  it('create without --name throws via Commander requiredOption', async () => {
    const program = createProgram()
    program.exitOverride()

    await expect(
      program.parseAsync(['node', 'orbit', '--json', 'deals', 'create'])
    ).rejects.toThrow()
  })
})
