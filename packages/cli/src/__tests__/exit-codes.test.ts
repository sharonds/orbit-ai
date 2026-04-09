import { describe, it, expect } from 'vitest'
import { CliValidationError, CliConfigError, CliUnsupportedAdapterError } from '../errors.js'

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
