import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgram } from '../program.js'

const mockSearchResponse = {
  query: vi.fn(),
}

const mockSearch = {
  query: vi.fn(),
  response: () => mockSearchResponse,
}

const mockClient = {
  search: mockSearch,
}

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn(() => mockClient),
}))

beforeEach(() => {
  process.env.ORBIT_API_KEY = 'test-key'
  vi.clearAllMocks()
})

describe('orbit search', () => {
  it('search "Alice" --types contacts,deals --limit 10 --json maps to correct SearchInput', async () => {
    const envelope = {
      data: [{ id: 'cnt_1', object: 'contact', name: 'Alice' }],
      meta: { request_id: 'srch_1' },
    }
    mockSearchResponse.query.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync([
      'node', 'orbit', '--json', 'search', 'Alice',
      '--types', 'contacts,deals',
      '--limit', '10',
    ])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data[0].id).toBe('cnt_1')
    expect(parsed.meta.request_id).toBe('srch_1')
    expect(mockSearchResponse.query).toHaveBeenCalledWith({
      query: 'Alice',
      object_types: ['contacts', 'deals'],
      limit: 10,
    })
  })

  it('search "Alice" (no --types) sends object_types: undefined', async () => {
    mockSearch.query.mockResolvedValue([{ id: 'cnt_1' }])

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', 'search', 'Alice'])
    process.stdout.write = origWrite

    expect(mockSearch.query).toHaveBeenCalledWith(
      expect.not.objectContaining({ object_types: expect.anything() })
    )
  })

  it('search --json with cursor passes cursor in SearchInput', async () => {
    const envelope = {
      data: [],
      meta: { request_id: 'srch_2', next_cursor: null },
    }
    mockSearchResponse.query.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync([
      'node', 'orbit', '--json', 'search', 'Alice',
      '--cursor', 'cursor_abc',
    ])
    process.stdout.write = origWrite

    expect(mockSearchResponse.query).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'cursor_abc' })
    )
  })
})
