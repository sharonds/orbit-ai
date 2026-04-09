import { describe, expect, it } from 'vitest'
import { OrbitApiError } from '@orbit-ai/sdk'
import { McpToolError, normalizeToolError, toToolError, toToolSuccess } from '../errors.js'
import { getTextContent, parseTextResult } from './helpers.js'

describe('toToolError', () => {
  it('returns structured error content', () => {
    const result = toToolError({ code: 'RESOURCE_NOT_FOUND', message: 'Not found' })
    const parsed = parseTextResult(result)
    expect(result.isError).toBe(true)
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('fills default hint and recovery', () => {
    const result = toToolError({ code: 'VALIDATION_FAILED', message: 'Invalid' })
    const parsed = parseTextResult(result)
    expect(parsed.error.hint).toBeTruthy()
    expect(parsed.error.recovery).toBeTruthy()
  })

  it('redacts token-like strings', () => {
    const result = toToolError({ code: 'INTERNAL_ERROR', message: 'access_token: ya29.FAKETOKEN secret' })
    const text = getTextContent(result)
    expect(text).not.toContain('ya29.FAKETOKEN')
    expect(text).not.toContain('secret')
  })

  it('uses text content blocks', () => {
    const result = toToolError({ code: 'INTERNAL_ERROR', message: 'boom' })
    expect(result.content[0]?.type).toBe('text')
  })

  it('normalizes McpToolErrorShape plain objects via isToolErrorShape', () => {
    const error = normalizeToolError({
      code: 'VALIDATION_FAILED',
      message: 'invalid field',
    })
    expect(error.code).toBe('VALIDATION_FAILED')
    expect(error.hint).toBeTruthy()
    expect(error.recovery).toBeTruthy()
  })

  it('normalizes duck-typed ZodError into VALIDATION_FAILED', () => {
    const zodLike = {
      name: 'ZodError',
      issues: [{ message: 'Required' }, { message: 'Too short' }],
    }
    const result = normalizeToolError(zodLike)
    expect(result.code).toBe('VALIDATION_FAILED')
    expect(result.message).toContain('Required')
    expect(result.message).toContain('Too short')
  })

  it('normalizes OrbitApiError paths with sanitized hint and recovery', () => {
    // `requestId` is the wrong casing for the OrbitApiError shape (correct is `request_id`);
    // `as never` suppresses the type error to keep the fixture minimal.
    const error = new OrbitApiError({
      code: 'AUTH_INVALID_API_KEY',
      message: 'Bearer leakedtoken',
      hint: 'secret token',
      recovery: 'refresh JWT eyJabc.def.ghi',
      requestId: 'req_01',
    } as never, 401)
    const normalized = normalizeToolError(error)
    expect(normalized.code).toBe('AUTH_INVALID')
    expect(normalized.message).not.toContain('leakedtoken')
    expect(normalized.hint).not.toContain('secret')
    expect(normalized.recovery).not.toContain('eyJabc.def.ghi')
  })

  it('preserves custom hint and recovery from McpToolError through normalizeToolError', () => {
    // McpToolError is a class — import it
    const error = new McpToolError('VALIDATION_FAILED', 'something went wrong', 'custom hint text', 'custom recovery text')
    const normalized = normalizeToolError(error)
    expect(normalized.code).toBe('VALIDATION_FAILED')
    expect(normalized.hint).toContain('custom hint text')
    expect(normalized.recovery).toContain('custom recovery text')
  })
})

describe('toToolSuccess', () => {
  it('returns structured success content', () => {
    const result = toToolSuccess({ id: 'record_01' }, { truncated: true })
    const parsed = parseTextResult(result)
    expect(parsed.ok).toBe(true)
    expect(parsed.data.id).toBe('record_01')
    expect(parsed.meta.truncated).toBe(true)
  })
})
