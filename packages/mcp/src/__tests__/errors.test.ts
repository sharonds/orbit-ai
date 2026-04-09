import { describe, expect, it } from 'vitest'
import { toToolError } from '../errors.js'
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
})
