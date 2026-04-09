import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgram } from '../program.js'

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

beforeEach(() => {
  process.env.ORBIT_API_KEY = 'test-key'
  vi.clearAllMocks()
})

describe('orbit context', () => {
  it('context <id> --json calls contacts.response().context(id) and returns envelope', async () => {
    const envelope = {
      data: {
        contact: { id: 'cnt_123', name: 'Alice' },
        deals: [],
        activities: [],
      },
      meta: { request_id: 'ctx_r1' },
    }
    mockContactsResponse.context.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'context', 'cnt_123'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.contact.id).toBe('cnt_123')
    expect(mockContactsResponse.context).toHaveBeenCalledWith('cnt_123')
  })

  it('context <email> in table mode calls contacts.context(email)', async () => {
    const contextData = { contact: { id: 'cnt_456', name: 'Bob' }, deals: [], activities: [] }
    mockContacts.context.mockResolvedValue(contextData)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', 'context', 'user@example.com'])
    process.stdout.write = origWrite

    expect(mockContacts.context).toHaveBeenCalledWith('user@example.com')
    expect(output).not.toContain('[object Object]')
  })
})
