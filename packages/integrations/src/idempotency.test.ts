import { describe, it, expect, vi } from 'vitest'
import { generateIdempotencyKey, IdempotencyHelper } from './idempotency.js'
import type { IdempotencyKeyRepository } from '@orbit-ai/core'

describe('generateIdempotencyKey', () => {
  it('is deterministic — same inputs produce same output', () => {
    const a = generateIdempotencyKey(['stripe', 'payment_intent', 'pi_123'])
    const b = generateIdempotencyKey(['stripe', 'payment_intent', 'pi_123'])
    expect(a).toBe(b)
  })

  it('differs for different inputs', () => {
    const a = generateIdempotencyKey(['stripe', 'payment_intent', 'pi_123'])
    const b = generateIdempotencyKey(['stripe', 'payment_intent', 'pi_456'])
    expect(a).not.toBe(b)
  })

  it('differs when provider changes', () => {
    const a = generateIdempotencyKey(['stripe', 'charge', 'ch_abc'])
    const b = generateIdempotencyKey(['gmail', 'charge', 'ch_abc'])
    expect(a).not.toBe(b)
  })

  it('output is exactly 32 hex characters', () => {
    const key = generateIdempotencyKey(['gmail', 'message', 'msg_xyz'])
    expect(key).toHaveLength(32)
    expect(/^[0-9a-f]{32}$/.test(key)).toBe(true)
  })

  it('handles empty array without throwing', () => {
    const key = generateIdempotencyKey([])
    expect(key).toHaveLength(32)
  })

  it('handles single element array', () => {
    const key = generateIdempotencyKey(['only-one'])
    expect(key).toHaveLength(32)
  })
})

describe('IdempotencyHelper', () => {
  it('generateKey produces a 32-char hex string', () => {
    const helper = new IdempotencyHelper()
    const key = helper.generateKey('stripe', 'charge', 'ch_abc123')
    expect(key).toHaveLength(32)
    expect(/^[0-9a-f]{32}$/.test(key)).toBe(true)
  })

  it('generateKey is deterministic', () => {
    const helper = new IdempotencyHelper()
    const a = helper.generateKey('stripe', 'charge', 'ch_abc123')
    const b = helper.generateKey('stripe', 'charge', 'ch_abc123')
    expect(a).toBe(b)
  })

  it('generateKey differs for different provider', () => {
    const helper = new IdempotencyHelper()
    const a = helper.generateKey('stripe', 'charge', 'ch_abc123')
    const b = helper.generateKey('gmail', 'charge', 'ch_abc123')
    expect(a).not.toBe(b)
  })

  it('generateKey differs for different operationType', () => {
    const helper = new IdempotencyHelper()
    const a = helper.generateKey('stripe', 'charge.created', 'ch_abc')
    const b = helper.generateKey('stripe', 'charge.updated', 'ch_abc')
    expect(a).not.toBe(b)
  })

  it('generateKey differs for different resourceId', () => {
    const helper = new IdempotencyHelper()
    const a = helper.generateKey('stripe', 'charge.created', 'ch_001')
    const b = helper.generateKey('stripe', 'charge.created', 'ch_002')
    expect(a).not.toBe(b)
  })

  it('check returns isDuplicate=false when no repository is injected (backward compat)', async () => {
    const helper = new IdempotencyHelper()
    const key = helper.generateKey('stripe', 'invoice', 'inv_xyz')
    const result = await helper.check(key)
    expect(result.isDuplicate).toBe(false)
    expect(result.key).toBe(key)
  })

  it('check returns isDuplicate=true when repository finds an existing key', async () => {
    const mockRecord = {
      id: 'idem_01ARYZ6S41YYYYYYYYYYYYYYYY',
      organizationId: 'org_01ARYZ6S41YYYYYYYYYYYYYYYY',
      key: 'abc123',
      method: 'INTEGRATION',
      path: '/integration/dedup',
      requestHash: 'abc123',
      responseCode: null,
      responseBody: null,
      lockedUntil: null,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const mockRepo: IdempotencyKeyRepository = {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue({ data: [mockRecord], nextCursor: null, hasMore: false }),
    }
    const helper = new IdempotencyHelper(mockRepo, 'org_01ARYZ6S41YYYYYYYYYYYYYYYY')
    const result = await helper.check('abc123')
    expect(result.isDuplicate).toBe(true)
    expect(result.key).toBe('abc123')
  })

  it('check returns isDuplicate=false when repository finds no existing key', async () => {
    const mockRepo: IdempotencyKeyRepository = {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue({ data: [], nextCursor: null, hasMore: false }),
    }
    const helper = new IdempotencyHelper(mockRepo, 'org_01ARYZ6S41YYYYYYYYYYYYYYYY')
    const result = await helper.check('nonexistent_key')
    expect(result.isDuplicate).toBe(false)
    expect(result.key).toBe('nonexistent_key')
  })

  it('record calls repository.create with the correct key', async () => {
    const mockRepo: IdempotencyKeyRepository = {
      create: vi.fn().mockResolvedValue({}),
      get: vi.fn(),
      list: vi.fn(),
    }
    const helper = new IdempotencyHelper(mockRepo, 'org_01ARYZ6S41YYYYYYYYYYYYYYYY')
    await helper.record('my_dedup_key')
    expect(mockRepo.create).toHaveBeenCalledOnce()
    const [_ctx, record] = (mockRepo.create as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(record.key).toBe('my_dedup_key')
    expect(record.organizationId).toBe('org_01ARYZ6S41YYYYYYYYYYYYYYYY')
  })

  it('record is a no-op when no repository is injected', async () => {
    const helper = new IdempotencyHelper()
    // should not throw
    await expect(helper.record('any_key')).resolves.toBeUndefined()
  })

  it('check returns isDuplicate=false and logs when repository throws', async () => {
    const mockRepo: IdempotencyKeyRepository = {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const helper = new IdempotencyHelper(mockRepo, 'org_01ARYZ6S41YYYYYYYYYYYYYYYY')
    const result = await helper.check('some_key')
    expect(result.isDuplicate).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith(
      'IdempotencyHelper.check failed:',
      'DB connection failed',
    )
    consoleSpy.mockRestore()
  })
})
