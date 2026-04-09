import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgram } from '../program.js'

// --- mock setup ---
const mockActivitiesResponse = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockActivities = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  log: vi.fn(),
  response: () => mockActivitiesResponse,
}

const mockClient = {
  activities: mockActivities,
}

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn(() => mockClient),
}))

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

describe('activities list', () => {
  it('list --json passes envelope through', async () => {
    const envelope = {
      data: [{ id: 'act_1', object: 'activity', type: 'call' }],
      meta: { request_id: 'r1', next_cursor: null, has_more: false, total: 1 },
    }
    mockActivitiesResponse.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'activities', 'list'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data[0].id).toBe('act_1')
    expect(parsed.meta.request_id).toBe('r1')
    expect(mockActivitiesResponse.list).toHaveBeenCalledWith({ limit: 20 })
  })
})

describe('activities get', () => {
  it('get --json returns single-record envelope', async () => {
    const envelope = {
      data: { id: 'act_123', object: 'activity', type: 'email' },
      meta: { request_id: 'r2' },
    }
    mockActivitiesResponse.get.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'activities', 'get', 'act_123'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('act_123')
    expect(mockActivitiesResponse.get).toHaveBeenCalledWith('act_123')
  })
})

describe('activities create', () => {
  it('create --json returns created record envelope', async () => {
    const envelope = {
      data: { id: 'act_new', object: 'activity', type: 'call' },
      meta: { request_id: 'r3' },
    }
    mockActivitiesResponse.create.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'activities', 'create', '--type', 'call'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('act_new')
    expect(mockActivitiesResponse.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'call' }))
  })
})

describe('activities update', () => {
  it('update --json returns updated record envelope', async () => {
    const envelope = {
      data: { id: 'act_123', object: 'activity', type: 'meeting', subject: 'Updated' },
      meta: { request_id: 'r4' },
    }
    mockActivitiesResponse.update.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync([
      'node', 'orbit', '--json', 'activities', 'update', 'act_123', '--subject', 'Updated',
    ])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('act_123')
    expect(mockActivitiesResponse.update).toHaveBeenCalledWith(
      'act_123',
      expect.objectContaining({ subject: 'Updated' }),
    )
  })
})

describe('activities delete', () => {
  it('delete --json returns deletion envelope', async () => {
    const envelope = { data: { id: 'act_123', deleted: true }, meta: { request_id: 'r5' } }
    mockActivitiesResponse.delete.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'activities', 'delete', 'act_123'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data.id).toBe('act_123')
    expect(parsed.data.deleted).toBe(true)
    expect(mockActivitiesResponse.delete).toHaveBeenCalledWith('act_123')
  })
})
