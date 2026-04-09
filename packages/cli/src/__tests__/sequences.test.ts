import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createProgram } from '../program.js'

// --- mock setup ---
const mockSequencesResponse = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  enroll: vi.fn(),
}

const mockSequences = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  enroll: vi.fn(),
  response: () => mockSequencesResponse,
}

const mockSequenceEnrollmentsResponse = {
  unenroll: vi.fn(),
}

const mockSequenceEnrollments = {
  unenroll: vi.fn(),
  response: () => mockSequenceEnrollmentsResponse,
}

const mockClient = {
  sequences: mockSequences,
  sequenceEnrollments: mockSequenceEnrollments,
}

vi.mock('@orbit-ai/sdk', () => ({
  OrbitClient: vi.fn(() => mockClient),
}))

beforeEach(() => {
  process.env.ORBIT_API_KEY = 'test-key'
  vi.clearAllMocks()
})

describe('sequences enroll', () => {
  it('enroll calls client.sequences.enroll() — NOT sequenceEnrollments.create()', async () => {
    const enrollResult = { id: 'se_1', object: 'sequence_enrollment', sequence_id: 'seq_1', contact_id: 'cnt_1' }
    mockSequences.enroll.mockResolvedValue(enrollResult)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync([
      'node', 'orbit', '--json', 'sequences', 'enroll', 'seq_1', '--contact', 'cnt_1',
    ])
    process.stdout.write = origWrite

    // Must have called sequences.enroll, not sequenceEnrollments
    expect(mockSequences.enroll).toHaveBeenCalledWith('seq_1', expect.objectContaining({ contact_id: 'cnt_1' }))
    // sequenceEnrollments should NOT have been touched
    expect(mockSequenceEnrollments.unenroll).not.toHaveBeenCalled()

    const parsed = JSON.parse(output)
    expect(parsed.id).toBe('se_1')
  })
})

describe('sequences unenroll', () => {
  it('unenroll calls client.sequenceEnrollments.unenroll() — NOT sequenceEnrollments.delete()', async () => {
    const unenrollResult = {
      id: 'se_1',
      object: 'sequence_enrollment',
      status: 'unenrolled',
    }
    mockSequenceEnrollments.unenroll.mockResolvedValue(unenrollResult)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'sequences', 'unenroll', 'se_1'])
    process.stdout.write = origWrite

    // Must have called sequenceEnrollments.unenroll
    expect(mockSequenceEnrollments.unenroll).toHaveBeenCalledWith('se_1')
    // sequences.enroll should NOT have been called
    expect(mockSequences.enroll).not.toHaveBeenCalled()

    const parsed = JSON.parse(output)
    expect(parsed.id).toBe('se_1')
    expect(parsed.status).toBe('unenrolled')
  })
})

describe('sequences list', () => {
  it('list --json passes envelope through', async () => {
    const envelope = {
      data: [{ id: 'seq_1', object: 'sequence', name: 'Onboarding' }],
      meta: { request_id: 'r1', has_more: false },
    }
    mockSequencesResponse.list.mockResolvedValue(envelope)

    const program = createProgram()
    let output = ''
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
      return true
    }

    await program.parseAsync(['node', 'orbit', '--json', 'sequences', 'list'])
    process.stdout.write = origWrite

    const parsed = JSON.parse(output)
    expect(parsed.data[0].id).toBe('seq_1')
    expect(mockSequencesResponse.list).toHaveBeenCalledWith({ limit: 20 })
  })
})
