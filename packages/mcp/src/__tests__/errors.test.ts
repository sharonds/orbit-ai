import { describe, expect, it } from 'vitest'
import { OrbitApiError } from '@orbit-ai/sdk'
import { McpNotImplementedError, McpToolError, normalizeToolError, toToolError, toToolSuccess } from '../errors.js'
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
    expect(parsed.error.hint).toContain('Review the tool input')
    expect(parsed.error.recovery).toBeTruthy()
  })

  it('redacts token-like strings', () => {
    const result = toToolError({ code: 'INTERNAL_ERROR', message: 'access_token: ya29.FAKETOKEN secret=sk_live_xyz' })
    const text = getTextContent(result)
    expect(text).not.toContain('ya29.FAKETOKEN')
    expect(text).not.toContain('sk_live_xyz')
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
    expect(normalized.hint).not.toContain('eyJabc')
    expect(normalized.recovery).not.toContain('eyJabc.def.ghi')
  })

  it('preserves custom hint and recovery from McpToolError through normalizeToolError', () => {
    const error = new McpToolError('VALIDATION_FAILED', 'something went wrong', 'custom hint text', 'custom recovery text')
    const normalized = normalizeToolError(error)
    expect(normalized.code).toBe('VALIDATION_FAILED')
    expect(normalized.hint).toContain('custom hint text')
    expect(normalized.recovery).toContain('custom recovery text')
  })

  it('redacts key=value formatted secrets in error messages', () => {
    const cases = [
      { input: 'api_key=sk_live_secret123', secret: 'sk_live_secret123' },
      { input: 'refresh_token=rt_abc_def', secret: 'rt_abc_def' },
      { input: 'client_secret=cs_xyz', secret: 'cs_xyz' },
      { input: 'client_id=my_oauth_client', secret: 'my_oauth_client' },
      { input: 'access_token=ya29.sometoken', secret: 'sometoken' },
    ]
    for (const { input, secret } of cases) {
      const result = toToolError({ code: 'INTERNAL_ERROR', message: input })
      const text = getTextContent(result)
      expect(text).not.toContain(secret)
    }
  })

  it('normalizes duck-typed OrbitApiError shape into mapped code', () => {
    const apiErrorLike = {
      error: { code: 'not_found', message: 'Record not found', hint: undefined, recovery: undefined },
      status: 404,
      code: 'not_found',
      message: 'Record not found',
    }
    const result = normalizeToolError(apiErrorLike)
    // 'not_found' falls through mapApiErrorCode to INTERNAL_ERROR
    expect(result.code).toBe('INTERNAL_ERROR')
  })

  it('maps RESOURCE_NOT_FOUND API code to RESOURCE_NOT_FOUND MCP code', () => {
    const apiErrorLike = {
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found' },
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'Not found',
    }
    const result = normalizeToolError(apiErrorLike)
    expect(result.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('maps VALIDATION_FAILED API code to VALIDATION_FAILED MCP code', () => {
    const apiErrorLike = {
      error: { code: 'VALIDATION_FAILED', message: 'Invalid input' },
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
    }
    const result = normalizeToolError(apiErrorLike)
    expect(result.code).toBe('VALIDATION_FAILED')
  })

  it('normalizeToolError falls through to INTERNAL_ERROR when OrbitApiError-shaped but code is numeric', () => {
    const result = normalizeToolError({
      code: 404,
      message: 'not found',
      status: 404,
      error: { code: 'RESOURCE_NOT_FOUND' },
    })
    expect(result.code).toBe('INTERNAL_ERROR')
  })

  it('normalizeToolError degrades safely on malformed ZodError lookalike with null issues', () => {
    const malformed = { name: 'ZodError', issues: [null, { message: 'Required' }, undefined] }
    const result = normalizeToolError(malformed)
    expect(result.code).toBe('VALIDATION_FAILED')
    expect(result.message).toContain('Required')
  })

  it('collapses double-bracket artifact when credential value ends with ]', () => {
    const error = new Error('request failed: access_token=abc]remaining')
    const result = normalizeToolError(error)
    expect(result.message).not.toContain('[redacted]]')
    expect(result.message).toContain('access_token=[redacted]remaining')
  })

  it('normalizeToolError preserves custom hint on McpNotImplementedError', () => {
    const result = normalizeToolError(new McpNotImplementedError('Not ready', 'Check changelog'))
    expect(result.code).toBe('DEPENDENCY_NOT_AVAILABLE')
    expect(result.hint).toBe('Check changelog')
  })

  it('normalizeToolError maps RATE_LIMITED OrbitApiError to RATE_LIMITED code', () => {
    const apiErrorLike = {
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests',
    }
    const result = normalizeToolError(apiErrorLike)
    expect(result.code).toBe('RATE_LIMITED')
    expect(result.hint).toContain('backing off')
    expect(result.recovery).toContain('exponential backoff')
  })

  it('normalizeToolError maps CONFLICT OrbitApiError to CONFLICT code', () => {
    const apiErrorLike = {
      error: { code: 'CONFLICT', message: 'Record already exists' },
      status: 409,
      code: 'CONFLICT',
      message: 'Record already exists',
    }
    const result = normalizeToolError(apiErrorLike)
    expect(result.code).toBe('CONFLICT')
    expect(result.hint).toContain('conflicting record')
    expect(result.recovery).toContain('update it instead')
  })

  it('normalizeToolError maps IDEMPOTENCY_CONFLICT OrbitApiError to CONFLICT code', () => {
    const apiErrorLike = {
      error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Duplicate idempotency key' },
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Duplicate idempotency key',
    }
    const result = normalizeToolError(apiErrorLike)
    expect(result.code).toBe('CONFLICT')
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
