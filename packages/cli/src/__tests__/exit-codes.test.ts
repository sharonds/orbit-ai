import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CliValidationError, CliConfigError, CliUnsupportedAdapterError, CliNotImplementedError } from '../errors.js'
import { _classifyError, run, _resetJsonMode } from '../program.js'

// We test the classifyError logic indirectly by checking the error classes
describe('exit code contract', () => {
  it('CliValidationError has exitCode 2', () => {
    const e = new CliValidationError('missing arg', { code: 'MISSING_REQUIRED_ARG' })
    expect(e.exitCode).toBe(2)
  })

  it('CliConfigError has exitCode 3', () => {
    const e = new CliConfigError('bad config', { code: 'CONFIG_PARSE_ERROR' })
    expect(e.exitCode).toBe(3)
  })

  it('CliUnsupportedAdapterError has exitCode 2 and correct code', () => {
    const e = new CliUnsupportedAdapterError('supabase')
    expect(e.exitCode).toBe(2)
    expect(e.details?.code).toBe('UNSUPPORTED_ADAPTER')
  })

  it('CliValidationError for missing required config', () => {
    const e = new CliValidationError('apiKey is required', {
      code: 'MISSING_REQUIRED_CONFIG',
      path: 'apiKey',
    })
    expect(e.exitCode).toBe(2)
    expect(e.details?.path).toBe('apiKey')
  })
})

describe('classifyError end-to-end', () => {
  it('CliNotImplementedError → code 2, payload code NOT_IMPLEMENTED', () => {
    const e = new CliNotImplementedError('feature not yet built', { code: 'NOT_IMPLEMENTED' })
    const result = _classifyError(e)
    expect(result.code).toBe(2)
    expect(result.payload.code).toBe('NOT_IMPLEMENTED')
    expect(result.payload.message).toBe('feature not yet built')
  })

  it('CliNotImplementedError uses default code when no details', () => {
    const e = new CliNotImplementedError('not built')
    const result = _classifyError(e)
    expect(result.code).toBe(2)
    expect(result.payload.code).toBe('NOT_IMPLEMENTED')
  })

  it('CliUnsupportedAdapterError → code 2, payload code UNSUPPORTED_ADAPTER', () => {
    const e = new CliUnsupportedAdapterError('supabase')
    const result = _classifyError(e)
    expect(result.code).toBe(2)
    expect(result.payload.code).toBe('UNSUPPORTED_ADAPTER')
  })

  it('OrbitApiError-shaped object (duck type) → code 1', () => {
    const e = Object.assign(new Error('Not found'), {
      name: 'OrbitApiError',
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    })
    const result = _classifyError(e)
    expect(result.code).toBe(1)
    expect(result.payload.code).toBe('RESOURCE_NOT_FOUND')
    expect(result.payload.message).toBe('Not found')
  })

  it('OrbitApiError-shaped object preserves nested error envelope fields', () => {
    const e = Object.assign(new Error('Request body failed validation'), {
      name: 'OrbitApiError',
      status: 400,
      code: 'VALIDATION_FAILED',
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request body failed validation',
        request_id: 'req_cli_123',
        doc_url: 'https://orbit-ai.dev/docs/errors#validation_failed',
        hint: 'value: value must fit numeric(18,2)',
        retryable: false,
      },
    })
    const result = _classifyError(e)
    expect(result.code).toBe(1)
    expect(result.payload).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Request body failed validation',
      request_id: 'req_cli_123',
      doc_url: 'https://orbit-ai.dev/docs/errors#validation_failed',
      hint: 'value: value must fit numeric(18,2)',
      retryable: false,
    })
  })

  it('Generic Error → code 1, payload code UNKNOWN_ERROR', () => {
    const e = new Error('unexpected')
    const result = _classifyError(e)
    expect(result.code).toBe(1)
    expect(result.payload.code).toBe('UNKNOWN_ERROR')
    expect(result.payload.message).toBe('unexpected')
  })

  it('Non-Error value (string) → code 1, UNKNOWN_ERROR', () => {
    const result = _classifyError('something went wrong')
    expect(result.code).toBe(1)
    expect(result.payload.code).toBe('UNKNOWN_ERROR')
    expect(result.payload.message).toBe('something went wrong')
  })

  it('CliValidationError → code 2', () => {
    const e = new CliValidationError('bad input', { code: 'MISSING_REQUIRED_ARG' })
    const result = _classifyError(e)
    expect(result.code).toBe(2)
    expect(result.payload.code).toBe('MISSING_REQUIRED_ARG')
  })

  it('CliConfigError → code 3', () => {
    const e = new CliConfigError('bad config', { code: 'CONFIG_PARSE_ERROR' })
    const result = _classifyError(e)
    expect(result.code).toBe(3)
    expect(result.payload.code).toBe('CONFIG_PARSE_ERROR')
  })
})

describe('seed --count validation', () => {
  let origArgv: string[]
  let origExit: typeof process.exit
  let exitCode: number | undefined
  let stdoutOutput: string

  beforeEach(() => {
    origArgv = [...process.argv]
    origExit = process.exit
    exitCode = undefined
    stdoutOutput = ''
    process.env.ORBIT_API_KEY = 'test-key'
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error(`process.exit(${code})`)
    }) as typeof process.exit
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutOutput += String(chunk); return true
    })
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    process.argv = origArgv
    process.exit = origExit
    vi.restoreAllMocks()
    _resetJsonMode()
  })

  it('--count 0 exits with INVALID_ARGUMENT in JSON mode', async () => {
    process.argv = ['node', 'orbit', '--json', 'seed', '--count', '0']
    await expect(run()).rejects.toThrow()
    const parsed = JSON.parse(stdoutOutput)
    expect(parsed.error.code).toBe('INVALID_ARGUMENT')
    expect(exitCode).toBe(2)
  })

  it('--count abc (NaN) exits with INVALID_ARGUMENT in JSON mode', async () => {
    process.argv = ['node', 'orbit', '--json', 'seed', '--count', 'abc']
    await expect(run()).rejects.toThrow()
    const parsed = JSON.parse(stdoutOutput)
    expect(parsed.error.code).toBe('INVALID_ARGUMENT')
  })

  it('--count 1001 exits with INVALID_ARGUMENT in JSON mode', async () => {
    process.argv = ['node', 'orbit', '--json', 'seed', '--count', '1001']
    await expect(run()).rejects.toThrow()
    const parsed = JSON.parse(stdoutOutput)
    expect(parsed.error.code).toBe('INVALID_ARGUMENT')
  })
})
