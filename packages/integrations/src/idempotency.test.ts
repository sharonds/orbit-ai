import { describe, it, expect } from 'vitest'
import { generateIdempotencyKey, IdempotencyHelper } from './idempotency.js'

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

  it('check returns isDuplicate=false (placeholder implementation)', async () => {
    const helper = new IdempotencyHelper()
    const key = helper.generateKey('stripe', 'invoice', 'inv_xyz')
    const result = await helper.check(key)
    expect(result.isDuplicate).toBe(false)
    expect(result.key).toBe(key)
  })
})
